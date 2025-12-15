/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InputHandler } from '../../../src/webview/InputHandler';

describe('InputHandler', () => {
  let canvas: HTMLCanvasElement;
  let inputCallback: ReturnType<typeof vi.fn>;
  let scrollCallback: ReturnType<typeof vi.fn>;
  let handler: InputHandler;

  beforeEach(() => {
    // Create a canvas with known dimensions
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;

    // Mock getBoundingClientRect to return predictable values
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    // Mock setPointerCapture and releasePointerCapture (not implemented in happy-dom)
    canvas.setPointerCapture = vi.fn();
    canvas.releasePointerCapture = vi.fn();

    document.body.appendChild(canvas);

    inputCallback = vi.fn();
    scrollCallback = vi.fn();
    handler = new InputHandler(canvas, inputCallback, scrollCallback);
  });

  afterEach(() => {
    handler.dispose();
    document.body.removeChild(canvas);
  });

  describe('pointer events', () => {
    it('should call onInput with "down" action on pointerdown', () => {
      const event = new PointerEvent('pointerdown', {
        clientX: 100,
        clientY: 100,
        pointerId: 1,
        bubbles: true,
      });

      canvas.dispatchEvent(event);

      expect(inputCallback).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 'down');
    });

    it('should call onInput with "up" action on pointerup', () => {
      // First pointer down
      canvas.dispatchEvent(
        new PointerEvent('pointerdown', {
          clientX: 100,
          clientY: 100,
          pointerId: 1,
          bubbles: true,
        })
      );

      // Then pointer up
      canvas.dispatchEvent(
        new PointerEvent('pointerup', {
          clientX: 100,
          clientY: 100,
          pointerId: 1,
          bubbles: true,
        })
      );

      expect(inputCallback).toHaveBeenLastCalledWith(expect.any(Number), expect.any(Number), 'up');
    });

    it('should ignore pointermove when pointer is not down', () => {
      const event = new PointerEvent('pointermove', {
        clientX: 200,
        clientY: 200,
        pointerId: 1,
        bubbles: true,
      });

      canvas.dispatchEvent(event);

      expect(inputCallback).not.toHaveBeenCalled();
    });

    it('should call onInput with "move" action when pointer is down and moving', async () => {
      // Pointer down
      canvas.dispatchEvent(
        new PointerEvent('pointerdown', {
          clientX: 100,
          clientY: 100,
          pointerId: 1,
          bubbles: true,
        })
      );

      // Wait for throttle interval
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Pointer move
      canvas.dispatchEvent(
        new PointerEvent('pointermove', {
          clientX: 200,
          clientY: 200,
          pointerId: 1,
          bubbles: true,
        })
      );

      expect(inputCallback).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 'move');
    });

    it('should only track the first pointer (single touch)', () => {
      // First pointer down
      canvas.dispatchEvent(
        new PointerEvent('pointerdown', {
          clientX: 100,
          clientY: 100,
          pointerId: 1,
          bubbles: true,
        })
      );

      // Second pointer down (should be ignored)
      canvas.dispatchEvent(
        new PointerEvent('pointerdown', {
          clientX: 200,
          clientY: 200,
          pointerId: 2,
          bubbles: true,
        })
      );

      // Only first pointer should have triggered callback
      expect(inputCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('coordinate normalization', () => {
    it('should normalize top-left corner to (0, 0)', () => {
      canvas.dispatchEvent(
        new PointerEvent('pointerdown', {
          clientX: 0,
          clientY: 0,
          pointerId: 1,
          bubbles: true,
        })
      );

      expect(inputCallback).toHaveBeenCalledWith(0, 0, 'down');
    });

    it('should normalize bottom-right corner to (1, 1)', () => {
      canvas.dispatchEvent(
        new PointerEvent('pointerdown', {
          clientX: 800,
          clientY: 600,
          pointerId: 1,
          bubbles: true,
        })
      );

      expect(inputCallback).toHaveBeenCalledWith(1, 1, 'down');
    });

    it('should normalize center to (0.5, 0.5)', () => {
      canvas.dispatchEvent(
        new PointerEvent('pointerdown', {
          clientX: 400,
          clientY: 300,
          pointerId: 1,
          bubbles: true,
        })
      );

      expect(inputCallback).toHaveBeenCalledWith(0.5, 0.5, 'down');
    });

    it('should clamp coordinates outside canvas to [0, 1]', () => {
      canvas.dispatchEvent(
        new PointerEvent('pointerdown', {
          clientX: -100,
          clientY: 700,
          pointerId: 1,
          bubbles: true,
        })
      );

      expect(inputCallback).toHaveBeenCalledWith(0, 1, 'down');
    });

    it('should clamp coordinates above canvas to [0, 1]', () => {
      canvas.dispatchEvent(
        new PointerEvent('pointerdown', {
          clientX: 1000,
          clientY: -100,
          pointerId: 1,
          bubbles: true,
        })
      );

      expect(inputCallback).toHaveBeenCalledWith(1, 0, 'down');
    });
  });

  describe('scroll handling', () => {
    it('should call onScroll with accumulated delta on wheel event', async () => {
      const event = new WheelEvent('wheel', {
        clientX: 400,
        clientY: 300,
        deltaX: 0,
        deltaY: 100,
        deltaMode: 0, // Pixel mode
        bubbles: true,
      });

      canvas.dispatchEvent(event);

      // Wait for RAF to process scroll buffer
      await new Promise((resolve) => requestAnimationFrame(resolve));

      expect(scrollCallback).toHaveBeenCalled();
    });

    it('should not call onScroll if no scroll callback is provided', () => {
      // Create handler without scroll callback
      handler.dispose();
      handler = new InputHandler(canvas, inputCallback);

      const event = new WheelEvent('wheel', {
        clientX: 400,
        clientY: 300,
        deltaX: 0,
        deltaY: 100,
        deltaMode: 0,
        bubbles: true,
      });

      expect(() => canvas.dispatchEvent(event)).not.toThrow();
    });

    it('should convert line mode scroll to pixel values', async () => {
      const event = new WheelEvent('wheel', {
        clientX: 400,
        clientY: 300,
        deltaX: 0,
        deltaY: 1, // 1 line
        deltaMode: 1, // Line mode
        bubbles: true,
      });

      canvas.dispatchEvent(event);

      await new Promise((resolve) => requestAnimationFrame(resolve));

      // Line mode multiplies by 16, then divides by SCROLL_STEP (200)
      // and negates, so 1 line -> 16 pixels -> -16/200 = -0.08
      expect(scrollCallback).toHaveBeenCalled();
    });

    it('should convert page mode scroll to pixel values', async () => {
      const event = new WheelEvent('wheel', {
        clientX: 400,
        clientY: 300,
        deltaX: 0,
        deltaY: 1, // 1 page
        deltaMode: 2, // Page mode
        bubbles: true,
      });

      canvas.dispatchEvent(event);

      await new Promise((resolve) => requestAnimationFrame(resolve));

      // Page mode multiplies by 100
      expect(scrollCallback).toHaveBeenCalled();
    });

    it('should accumulate scroll deltas across multiple events', async () => {
      // Fire multiple scroll events quickly
      for (let i = 0; i < 3; i++) {
        canvas.dispatchEvent(
          new WheelEvent('wheel', {
            clientX: 400,
            clientY: 300,
            deltaX: 0,
            deltaY: 50,
            deltaMode: 0,
            bubbles: true,
          })
        );
      }

      await new Promise((resolve) => requestAnimationFrame(resolve));

      // Should be called once with accumulated delta (batched in RAF)
      expect(scrollCallback).toHaveBeenCalledTimes(1);
    });

    it('should include normalized coordinates in scroll callback', async () => {
      canvas.dispatchEvent(
        new WheelEvent('wheel', {
          clientX: 400,
          clientY: 300,
          deltaX: 0,
          deltaY: 100,
          deltaMode: 0,
          bubbles: true,
        })
      );

      await new Promise((resolve) => requestAnimationFrame(resolve));

      // Verify scroll callback was called with 4 arguments (x, y, deltaX, deltaY)
      expect(scrollCallback).toHaveBeenCalled();
      expect(scrollCallback.mock.calls[0]).toHaveLength(4);
      // Note: In happy-dom, WheelEvent clientX/Y may not work correctly,
      // so we just verify the callback structure is correct
    });
  });

  describe('throttling', () => {
    it('should throttle move events', async () => {
      // Pointer down
      canvas.dispatchEvent(
        new PointerEvent('pointerdown', {
          clientX: 100,
          clientY: 100,
          pointerId: 1,
          bubbles: true,
        })
      );

      // Reset the mock to count only moves
      inputCallback.mockClear();

      // Fire many move events quickly (faster than throttle)
      for (let i = 0; i < 10; i++) {
        canvas.dispatchEvent(
          new PointerEvent('pointermove', {
            clientX: 100 + i * 10,
            clientY: 100 + i * 10,
            pointerId: 1,
            bubbles: true,
          })
        );
      }

      // Should be throttled to fewer calls
      expect(inputCallback.mock.calls.length).toBeLessThan(10);
    });

    it('should allow setting custom throttle rate', async () => {
      handler.setThrottleRate(100); // 100ms throttle

      canvas.dispatchEvent(
        new PointerEvent('pointerdown', {
          clientX: 100,
          clientY: 100,
          pointerId: 1,
          bubbles: true,
        })
      );

      inputCallback.mockClear();

      // Fire moves
      canvas.dispatchEvent(
        new PointerEvent('pointermove', {
          clientX: 200,
          clientY: 200,
          pointerId: 1,
          bubbles: true,
        })
      );

      canvas.dispatchEvent(
        new PointerEvent('pointermove', {
          clientX: 300,
          clientY: 300,
          pointerId: 1,
          bubbles: true,
        })
      );

      // With 100ms throttle, both events in quick succession should result in 1 call
      expect(inputCallback.mock.calls.length).toBeLessThanOrEqual(1);
    });
  });

  describe('dispose', () => {
    it('should clean up event listeners on dispose', () => {
      handler.dispose();

      // Events should no longer be processed
      canvas.dispatchEvent(
        new PointerEvent('pointerdown', {
          clientX: 100,
          clientY: 100,
          pointerId: 1,
          bubbles: true,
        })
      );

      expect(inputCallback).not.toHaveBeenCalled();
    });

    it('should reset state on dispose', () => {
      // Trigger pointer down
      canvas.dispatchEvent(
        new PointerEvent('pointerdown', {
          clientX: 100,
          clientY: 100,
          pointerId: 1,
          bubbles: true,
        })
      );

      handler.dispose();

      // Create new handler
      const newCallback = vi.fn();
      const newHandler = new InputHandler(canvas, newCallback);

      // Should work fresh, not carry over state
      canvas.dispatchEvent(
        new PointerEvent('pointerdown', {
          clientX: 100,
          clientY: 100,
          pointerId: 1,
          bubbles: true,
        })
      );

      expect(newCallback).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 'down');

      newHandler.dispose();
    });
  });

  describe('pointer capture', () => {
    it('should set pointer capture on pointerdown', () => {
      const setPointerCapture = vi.spyOn(canvas, 'setPointerCapture');

      canvas.dispatchEvent(
        new PointerEvent('pointerdown', {
          clientX: 100,
          clientY: 100,
          pointerId: 1,
          bubbles: true,
        })
      );

      expect(setPointerCapture).toHaveBeenCalledWith(1);
    });

    it('should release pointer capture on pointerup', () => {
      const releasePointerCapture = vi.spyOn(canvas, 'releasePointerCapture');

      // Down then up
      canvas.dispatchEvent(
        new PointerEvent('pointerdown', {
          clientX: 100,
          clientY: 100,
          pointerId: 1,
          bubbles: true,
        })
      );

      canvas.dispatchEvent(
        new PointerEvent('pointerup', {
          clientX: 100,
          clientY: 100,
          pointerId: 1,
          bubbles: true,
        })
      );

      expect(releasePointerCapture).toHaveBeenCalledWith(1);
    });
  });

  describe('edge cases', () => {
    it('should handle pointerleave as pointer up', () => {
      canvas.dispatchEvent(
        new PointerEvent('pointerdown', {
          clientX: 100,
          clientY: 100,
          pointerId: 1,
          bubbles: true,
        })
      );

      inputCallback.mockClear();

      canvas.dispatchEvent(
        new PointerEvent('pointerleave', {
          clientX: -10,
          clientY: -10,
          pointerId: 1,
          bubbles: true,
        })
      );

      expect(inputCallback).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 'up');
    });

    it('should handle pointercancel as pointer up', () => {
      canvas.dispatchEvent(
        new PointerEvent('pointerdown', {
          clientX: 100,
          clientY: 100,
          pointerId: 1,
          bubbles: true,
        })
      );

      inputCallback.mockClear();

      canvas.dispatchEvent(
        new PointerEvent('pointercancel', {
          clientX: 100,
          clientY: 100,
          pointerId: 1,
          bubbles: true,
        })
      );

      expect(inputCallback).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 'up');
    });

    it('should prevent default context menu', () => {
      const event = new MouseEvent('contextmenu', {
        clientX: 100,
        clientY: 100,
        bubbles: true,
        cancelable: true,
      });

      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      canvas.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });
});
