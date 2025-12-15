/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { KeyboardHandler } from '../../../src/webview/KeyboardHandler';
import { ANDROID_KEYCODES, AMETA, KEY_TO_KEYCODE } from '../../../src/webview/AndroidKeys';

describe('KeyboardHandler', () => {
  let canvas: HTMLCanvasElement;
  let textCallback: ReturnType<typeof vi.fn>;
  let keycodeCallback: ReturnType<typeof vi.fn>;
  let pasteCallback: ReturnType<typeof vi.fn>;
  let copyCallback: ReturnType<typeof vi.fn>;
  let handler: KeyboardHandler;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    document.body.appendChild(canvas);

    textCallback = vi.fn();
    keycodeCallback = vi.fn();
    pasteCallback = vi.fn();
    copyCallback = vi.fn();

    handler = new KeyboardHandler(
      canvas,
      textCallback,
      keycodeCallback,
      pasteCallback,
      copyCallback
    );
  });

  afterEach(() => {
    handler.dispose();
    document.body.removeChild(canvas);
    vi.useRealTimers();
  });

  describe('focus management', () => {
    it('should not be focused by default', () => {
      expect(handler.isFocused()).toBe(false);
    });

    it('should become focused after click and update canvas attributes', () => {
      canvas.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(handler.isFocused()).toBe(true);
      expect(canvas.classList.contains('keyboard-focused')).toBe(true);
      expect(canvas.tabIndex).toBe(0);
    });

    it('should unfocus and reset canvas attributes', () => {
      handler.setFocused(true);
      handler.setFocused(false);
      expect(handler.isFocused()).toBe(false);
      expect(canvas.classList.contains('keyboard-focused')).toBe(false);
      expect(canvas.tabIndex).toBe(-1);
    });

    it('should not call callbacks for keyboard events when not focused', () => {
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
      expect(textCallback).not.toHaveBeenCalled();
      expect(keycodeCallback).not.toHaveBeenCalled();
    });
  });

  describe('text input', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      handler.setFocused(true);
    });

    it('should buffer regular character input and flush after timeout', () => {
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
      expect(textCallback).not.toHaveBeenCalled();
      vi.advanceTimersByTime(50);
      expect(textCallback).toHaveBeenCalledWith('a');
    });

    it('should batch multiple characters into single callback', () => {
      'hello'.split('').forEach((char) => {
        canvas.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
      });
      vi.advanceTimersByTime(50);
      expect(textCallback).toHaveBeenCalledWith('hello');
    });

    it('should flush buffer on focus loss', () => {
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true }));
      handler.setFocused(false);
      expect(textCallback).toHaveBeenCalledWith('ab');
    });

    it('should flush buffer when reaching max length (300)', () => {
      for (let i = 0; i < 300; i++) {
        canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }));
      }
      expect(textCallback).toHaveBeenCalledWith('x'.repeat(300));
    });
  });

  describe('special keys', () => {
    beforeEach(() => {
      handler.setFocused(true);
    });

    it.each([
      ['Enter', ANDROID_KEYCODES.ENTER],
      ['Backspace', ANDROID_KEYCODES.DEL],
      ['Tab', ANDROID_KEYCODES.TAB],
      ['Escape', ANDROID_KEYCODES.ESCAPE],
      ['ArrowUp', ANDROID_KEYCODES.DPAD_UP],
      ['ArrowDown', ANDROID_KEYCODES.DPAD_DOWN],
      ['ArrowLeft', ANDROID_KEYCODES.DPAD_LEFT],
      ['ArrowRight', ANDROID_KEYCODES.DPAD_RIGHT],
    ])('should send %s as keycode %d', (key, expectedKeycode) => {
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      expect(keycodeCallback).toHaveBeenCalledWith(expectedKeycode, AMETA.NONE, 'down');
      expect(textCallback).not.toHaveBeenCalled();
    });

    it('should flush text buffer before sending special key', () => {
      vi.useFakeTimers();
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(textCallback).toHaveBeenCalledWith('a');
      expect(keycodeCallback).toHaveBeenCalledWith(ANDROID_KEYCODES.ENTER, AMETA.NONE, 'down');
    });
  });

  describe('modifier keys', () => {
    beforeEach(() => {
      handler.setFocused(true);
    });

    it.each([
      ['Shift', 'shiftKey', AMETA.SHIFT_ON],
      ['Alt', 'altKey', AMETA.ALT_ON],
      ['Ctrl', 'ctrlKey', AMETA.CTRL_ON],
    ])('should include %s in metastate', (_name, modifierProp, metaFlag) => {
      canvas.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', [modifierProp]: true, bubbles: true })
      );
      const [, metastate] = keycodeCallback.mock.calls[0];
      expect(metastate & metaFlag).toBeTruthy();
    });

    it('should handle multiple modifiers combined', () => {
      canvas.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, shiftKey: true, bubbles: true })
      );
      const [, metastate] = keycodeCallback.mock.calls[0];
      expect(metastate & AMETA.CTRL_ON).toBeTruthy();
      expect(metastate & AMETA.SHIFT_ON).toBeTruthy();
    });

    it('should send Ctrl+letter as keycode, not text', () => {
      vi.useFakeTimers();
      canvas.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true })
      );
      vi.advanceTimersByTime(50);
      expect(keycodeCallback).toHaveBeenCalled();
      expect(textCallback).not.toHaveBeenCalled();
    });
  });

  describe('clipboard operations', () => {
    beforeEach(() => {
      handler.setFocused(true);
    });

    it('should call pasteCallback on Ctrl+V (case insensitive)', () => {
      canvas.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, bubbles: true })
      );
      expect(pasteCallback).toHaveBeenCalled();
      expect(keycodeCallback).not.toHaveBeenCalled();

      pasteCallback.mockClear();
      canvas.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'V', ctrlKey: true, bubbles: true })
      );
      expect(pasteCallback).toHaveBeenCalled();
    });

    it('should call copyCallback on Ctrl+C (case insensitive)', () => {
      canvas.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true })
      );
      expect(copyCallback).toHaveBeenCalled();
      expect(keycodeCallback).not.toHaveBeenCalled();

      copyCallback.mockClear();
      canvas.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'C', ctrlKey: true, bubbles: true })
      );
      expect(copyCallback).toHaveBeenCalled();
    });

    it('should flush text buffer before clipboard operation', () => {
      vi.useFakeTimers();
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
      canvas.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, bubbles: true })
      );
      expect(textCallback).toHaveBeenCalledWith('a');
      expect(pasteCallback).toHaveBeenCalled();
    });
  });

  describe('keyup events', () => {
    beforeEach(() => {
      handler.setFocused(true);
    });

    it('should send keyup for special keys', () => {
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      canvas.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
      expect(keycodeCallback).toHaveBeenCalledWith(ANDROID_KEYCODES.ENTER, AMETA.NONE, 'down');
      expect(keycodeCallback).toHaveBeenCalledWith(ANDROID_KEYCODES.ENTER, AMETA.NONE, 'up');
    });

    it('should release all pressed keys on focus loss', () => {
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
      keycodeCallback.mockClear();
      handler.setFocused(false);
      expect(keycodeCallback).toHaveBeenCalledWith(ANDROID_KEYCODES.ENTER, AMETA.NONE, 'up');
      expect(keycodeCallback).toHaveBeenCalledWith(ANDROID_KEYCODES.TAB, AMETA.NONE, 'up');
    });

    it('should ignore keyup for already-released keys', () => {
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      canvas.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
      keycodeCallback.mockClear();
      canvas.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
      expect(keycodeCallback).not.toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('should flush text buffer and release keys on dispose', () => {
      vi.useFakeTimers();
      handler.setFocused(true);
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      keycodeCallback.mockClear();

      handler.dispose();

      expect(textCallback).toHaveBeenCalledWith('a');
      expect(keycodeCallback).toHaveBeenCalledWith(ANDROID_KEYCODES.ENTER, AMETA.NONE, 'up');
      expect(canvas.classList.contains('keyboard-focused')).toBe(false);
    });

    it('should stop processing events after dispose', () => {
      handler.dispose();
      canvas.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
      expect(textCallback).not.toHaveBeenCalled();
      expect(keycodeCallback).not.toHaveBeenCalled();
    });
  });

  describe('optional callbacks', () => {
    it('should work without paste/copy callbacks', () => {
      handler.dispose();
      handler = new KeyboardHandler(canvas, textCallback, keycodeCallback);
      handler.setFocused(true);

      expect(() => {
        canvas.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, bubbles: true })
        );
        canvas.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true })
        );
      }).not.toThrow();
    });
  });
});

describe('AndroidKeys', () => {
  describe('ANDROID_KEYCODES', () => {
    it.each([
      ['ENTER', 66],
      ['DEL', 67],
      ['TAB', 61],
      ['ESCAPE', 111],
      ['DPAD_UP', 19],
      ['DPAD_DOWN', 20],
      ['DPAD_LEFT', 21],
      ['DPAD_RIGHT', 22],
      ['A', 29],
      ['Z', 54],
    ])('should have %s = %d', (key, expected) => {
      expect(ANDROID_KEYCODES[key as keyof typeof ANDROID_KEYCODES]).toBe(expected);
    });

    it('should have consecutive letter keycodes A-Z', () => {
      expect(ANDROID_KEYCODES.Z - ANDROID_KEYCODES.A).toBe(25);
    });
  });

  describe('AMETA', () => {
    it('should have correct metastate flag values', () => {
      expect(AMETA.NONE).toBe(0);
      expect(AMETA.SHIFT_ON).toBe(0x01);
      expect(AMETA.ALT_ON).toBe(0x02);
      expect(AMETA.CTRL_ON).toBe(0x1000);
    });

    it('should allow combining metastate flags', () => {
      const combined = AMETA.SHIFT_ON | AMETA.CTRL_ON;
      expect(combined & AMETA.SHIFT_ON).toBeTruthy();
      expect(combined & AMETA.CTRL_ON).toBeTruthy();
      expect(combined & AMETA.ALT_ON).toBeFalsy();
    });
  });

  describe('KEY_TO_KEYCODE', () => {
    it.each([
      ['Enter', ANDROID_KEYCODES.ENTER],
      ['Backspace', ANDROID_KEYCODES.DEL],
      ['Tab', ANDROID_KEYCODES.TAB],
      ['Escape', ANDROID_KEYCODES.ESCAPE],
      ['ArrowUp', ANDROID_KEYCODES.DPAD_UP],
      ['ArrowDown', ANDROID_KEYCODES.DPAD_DOWN],
      ['ArrowLeft', ANDROID_KEYCODES.DPAD_LEFT],
      ['ArrowRight', ANDROID_KEYCODES.DPAD_RIGHT],
      ['PageUp', ANDROID_KEYCODES.PAGE_UP],
      ['PageDown', ANDROID_KEYCODES.PAGE_DOWN],
      ['Home', ANDROID_KEYCODES.MOVE_HOME],
      ['End', ANDROID_KEYCODES.MOVE_END],
    ])('should map %s to correct keycode', (browserKey, androidKeycode) => {
      expect(KEY_TO_KEYCODE[browserKey]).toBe(androidKeycode);
    });
  });
});
