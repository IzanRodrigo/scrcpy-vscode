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

    it('should become focused after click', () => {
      canvas.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(handler.isFocused()).toBe(true);
    });

    it('should add keyboard-focused class when focused', () => {
      handler.setFocused(true);
      expect(canvas.classList.contains('keyboard-focused')).toBe(true);
    });

    it('should remove keyboard-focused class when unfocused', () => {
      handler.setFocused(true);
      handler.setFocused(false);
      expect(canvas.classList.contains('keyboard-focused')).toBe(false);
    });

    it('should set canvas tabIndex to 0 when focused', () => {
      handler.setFocused(true);
      expect(canvas.tabIndex).toBe(0);
    });

    it('should set canvas tabIndex to -1 when unfocused', () => {
      handler.setFocused(true);
      handler.setFocused(false);
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

    it('should buffer regular character input', () => {
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));

      // Should not be called immediately (buffered)
      expect(textCallback).not.toHaveBeenCalled();

      // Flush buffer timer (50ms)
      vi.advanceTimersByTime(50);

      expect(textCallback).toHaveBeenCalledWith('a');
    });

    it('should batch multiple characters', () => {
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', bubbles: true }));
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', bubbles: true }));
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', bubbles: true }));
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'o', bubbles: true }));

      vi.advanceTimersByTime(50);

      expect(textCallback).toHaveBeenCalledWith('hello');
    });

    it('should flush buffer on focus loss', () => {
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true }));

      handler.setFocused(false);

      expect(textCallback).toHaveBeenCalledWith('ab');
    });

    it('should flush buffer when reaching max length', () => {
      // Type 300 characters (max length)
      for (let i = 0; i < 300; i++) {
        canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }));
      }

      // Should flush immediately at max length, not wait for timer
      expect(textCallback).toHaveBeenCalledWith('x'.repeat(300));
    });
  });

  describe('special keys', () => {
    beforeEach(() => {
      handler.setFocused(true);
    });

    it('should send Enter as keycode, not text', () => {
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

      expect(keycodeCallback).toHaveBeenCalledWith(ANDROID_KEYCODES.ENTER, AMETA.NONE, 'down');
      expect(textCallback).not.toHaveBeenCalled();
    });

    it('should send Backspace as keycode', () => {
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));

      expect(keycodeCallback).toHaveBeenCalledWith(ANDROID_KEYCODES.DEL, AMETA.NONE, 'down');
    });

    it('should send Tab as keycode', () => {
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));

      expect(keycodeCallback).toHaveBeenCalledWith(ANDROID_KEYCODES.TAB, AMETA.NONE, 'down');
    });

    it('should send Escape as keycode', () => {
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      expect(keycodeCallback).toHaveBeenCalledWith(ANDROID_KEYCODES.ESCAPE, AMETA.NONE, 'down');
    });

    it('should send arrow keys as keycodes', () => {
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      expect(keycodeCallback).toHaveBeenCalledWith(ANDROID_KEYCODES.DPAD_UP, AMETA.NONE, 'down');

      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      expect(keycodeCallback).toHaveBeenCalledWith(ANDROID_KEYCODES.DPAD_DOWN, AMETA.NONE, 'down');

      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      expect(keycodeCallback).toHaveBeenCalledWith(ANDROID_KEYCODES.DPAD_LEFT, AMETA.NONE, 'down');

      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      expect(keycodeCallback).toHaveBeenCalledWith(ANDROID_KEYCODES.DPAD_RIGHT, AMETA.NONE, 'down');
    });

    it('should flush text buffer before sending special key', () => {
      vi.useFakeTimers();

      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

      // Text should be flushed before Enter
      expect(textCallback).toHaveBeenCalledWith('a');
      expect(keycodeCallback).toHaveBeenCalledWith(ANDROID_KEYCODES.ENTER, AMETA.NONE, 'down');
    });
  });

  describe('modifier keys', () => {
    beforeEach(() => {
      handler.setFocused(true);
    });

    it('should include Shift in metastate', () => {
      canvas.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true })
      );

      expect(keycodeCallback).toHaveBeenCalledWith(
        ANDROID_KEYCODES.ENTER,
        expect.any(Number),
        'down'
      );
      const [, metastate] = keycodeCallback.mock.calls[0];
      expect(metastate & AMETA.SHIFT_ON).toBeTruthy();
    });

    it('should include Alt in metastate', () => {
      canvas.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', altKey: true, bubbles: true })
      );

      expect(keycodeCallback).toHaveBeenCalledWith(
        ANDROID_KEYCODES.ENTER,
        expect.any(Number),
        'down'
      );
      const [, metastate] = keycodeCallback.mock.calls[0];
      expect(metastate & AMETA.ALT_ON).toBeTruthy();
    });

    it('should include Ctrl in metastate', () => {
      canvas.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true })
      );

      expect(keycodeCallback).toHaveBeenCalledWith(ANDROID_KEYCODES.A, expect.any(Number), 'down');
      const [, metastate] = keycodeCallback.mock.calls[0];
      expect(metastate & AMETA.CTRL_ON).toBeTruthy();
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

    it('should handle multiple modifiers', () => {
      canvas.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'a',
          ctrlKey: true,
          shiftKey: true,
          bubbles: true,
        })
      );

      expect(keycodeCallback).toHaveBeenCalled();
      const [, metastate] = keycodeCallback.mock.calls[0];
      expect(metastate & AMETA.CTRL_ON).toBeTruthy();
      expect(metastate & AMETA.SHIFT_ON).toBeTruthy();
    });
  });

  describe('clipboard operations', () => {
    beforeEach(() => {
      handler.setFocused(true);
    });

    it('should call pasteCallback on Ctrl+V', () => {
      canvas.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, bubbles: true })
      );

      expect(pasteCallback).toHaveBeenCalled();
      expect(keycodeCallback).not.toHaveBeenCalled();
    });

    it('should call copyCallback on Ctrl+C', () => {
      canvas.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true })
      );

      expect(copyCallback).toHaveBeenCalled();
      expect(keycodeCallback).not.toHaveBeenCalled();
    });

    it('should handle uppercase V for paste', () => {
      canvas.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'V', ctrlKey: true, bubbles: true })
      );

      expect(pasteCallback).toHaveBeenCalled();
    });

    it('should handle uppercase C for copy', () => {
      canvas.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'C', ctrlKey: true, bubbles: true })
      );

      expect(copyCallback).toHaveBeenCalled();
    });

    it('should flush text buffer before paste', () => {
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
      // Press multiple keys
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));

      keycodeCallback.mockClear();

      // Lose focus
      handler.setFocused(false);

      // Should have released all pressed keys
      expect(keycodeCallback).toHaveBeenCalledWith(ANDROID_KEYCODES.ENTER, AMETA.NONE, 'up');
      expect(keycodeCallback).toHaveBeenCalledWith(ANDROID_KEYCODES.TAB, AMETA.NONE, 'up');
    });

    it('should track pressed keys correctly', () => {
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      canvas.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));

      // Key up after key down should work
      expect(keycodeCallback).toHaveBeenCalledTimes(2);

      // Second key up for same key should be ignored (key already released)
      keycodeCallback.mockClear();
      canvas.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
      expect(keycodeCallback).not.toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('should flush text buffer on dispose', () => {
      vi.useFakeTimers();
      handler.setFocused(true);

      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
      handler.dispose();

      expect(textCallback).toHaveBeenCalledWith('a');
    });

    it('should release all pressed keys on dispose', () => {
      handler.setFocused(true);

      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      keycodeCallback.mockClear();

      handler.dispose();

      expect(keycodeCallback).toHaveBeenCalledWith(ANDROID_KEYCODES.ENTER, AMETA.NONE, 'up');
    });

    it('should remove keyboard-focused class on dispose', () => {
      handler.setFocused(true);
      handler.dispose();

      expect(canvas.classList.contains('keyboard-focused')).toBe(false);
    });

    it('should stop processing events after dispose', () => {
      handler.dispose();

      canvas.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));

      // No callbacks should be triggered
      expect(textCallback).not.toHaveBeenCalled();
      expect(keycodeCallback).not.toHaveBeenCalled();
    });
  });

  describe('optional callbacks', () => {
    it('should work without paste callback', () => {
      handler.dispose();
      handler = new KeyboardHandler(canvas, textCallback, keycodeCallback);
      handler.setFocused(true);

      // Should not throw
      expect(() =>
        canvas.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, bubbles: true })
        )
      ).not.toThrow();
    });

    it('should work without copy callback', () => {
      handler.dispose();
      handler = new KeyboardHandler(canvas, textCallback, keycodeCallback);
      handler.setFocused(true);

      // Should not throw
      expect(() =>
        canvas.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true })
        )
      ).not.toThrow();
    });
  });
});

describe('AndroidKeys', () => {
  describe('ANDROID_KEYCODES', () => {
    it('should have correct values for common keys', () => {
      expect(ANDROID_KEYCODES.ENTER).toBe(66);
      expect(ANDROID_KEYCODES.DEL).toBe(67);
      expect(ANDROID_KEYCODES.TAB).toBe(61);
      expect(ANDROID_KEYCODES.ESCAPE).toBe(111);
    });

    it('should have correct values for arrow keys', () => {
      expect(ANDROID_KEYCODES.DPAD_UP).toBe(19);
      expect(ANDROID_KEYCODES.DPAD_DOWN).toBe(20);
      expect(ANDROID_KEYCODES.DPAD_LEFT).toBe(21);
      expect(ANDROID_KEYCODES.DPAD_RIGHT).toBe(22);
    });

    it('should have correct values for letter keys A-Z', () => {
      expect(ANDROID_KEYCODES.A).toBe(29);
      expect(ANDROID_KEYCODES.Z).toBe(54);
      // All letters should be consecutive from A (29) to Z (54)
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
    it('should map browser key names to Android keycodes', () => {
      expect(KEY_TO_KEYCODE['Enter']).toBe(ANDROID_KEYCODES.ENTER);
      expect(KEY_TO_KEYCODE['Backspace']).toBe(ANDROID_KEYCODES.DEL);
      expect(KEY_TO_KEYCODE['Tab']).toBe(ANDROID_KEYCODES.TAB);
      expect(KEY_TO_KEYCODE['Escape']).toBe(ANDROID_KEYCODES.ESCAPE);
    });

    it('should map arrow keys correctly', () => {
      expect(KEY_TO_KEYCODE['ArrowUp']).toBe(ANDROID_KEYCODES.DPAD_UP);
      expect(KEY_TO_KEYCODE['ArrowDown']).toBe(ANDROID_KEYCODES.DPAD_DOWN);
      expect(KEY_TO_KEYCODE['ArrowLeft']).toBe(ANDROID_KEYCODES.DPAD_LEFT);
      expect(KEY_TO_KEYCODE['ArrowRight']).toBe(ANDROID_KEYCODES.DPAD_RIGHT);
    });

    it('should map page navigation keys', () => {
      expect(KEY_TO_KEYCODE['PageUp']).toBe(ANDROID_KEYCODES.PAGE_UP);
      expect(KEY_TO_KEYCODE['PageDown']).toBe(ANDROID_KEYCODES.PAGE_DOWN);
      expect(KEY_TO_KEYCODE['Home']).toBe(ANDROID_KEYCODES.MOVE_HOME);
      expect(KEY_TO_KEYCODE['End']).toBe(ANDROID_KEYCODES.MOVE_END);
    });
  });
});
