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
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;

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
    it('should call onInput for pointerdown/up/move lifecycle', async () => {
      // Down
      canvas.dispatchEvent(
        new PointerEvent('pointerdown', { clientX: 100, clientY: 100, pointerId: 1, bubbles: true })
      );
      expect(inputCallback).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 'down');

      // Wait for throttle
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Move
      canvas.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 200, clientY: 200, pointerId: 1, bubbles: true })
      );
      expect(inputCallback).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 'move');

      // Up
      canvas.dispatchEvent(
        new PointerEvent('pointerup', { clientX: 200, clientY: 200, pointerId: 1, bubbles: true })
      );
      expect(inputCallback).toHaveBeenLastCalledWith(expect.any(Number), expect.any(Number), 'up');
    });

    it('should ignore pointermove when pointer is not down', () => {
      canvas.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 200, clientY: 200, pointerId: 1, bubbles: true })
      );
      expect(inputCallback).not.toHaveBeenCalled();
    });

    it('should only track first pointer (single touch)', () => {
      canvas.dispatchEvent(
        new PointerEvent('pointerdown', { clientX: 100, clientY: 100, pointerId: 1, bubbles: true })
      );
      canvas.dispatchEvent(
        new PointerEvent('pointerdown', { clientX: 200, clientY: 200, pointerId: 2, bubbles: true })
      );
      expect(inputCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('coordinate normalization', () => {
    it.each([
      ['top-left (0,0)', 0, 0, 0, 0],
      ['bottom-right (800,600)', 800, 600, 1, 1],
      ['center (400,300)', 400, 300, 0.5, 0.5],
      ['outside left (-100,300)', -100, 300, 0, 0.5],
      ['outside right (900,300)', 900, 300, 1, 0.5],
      ['outside top (400,-100)', 400, -100, 0.5, 0],
      ['outside bottom (400,700)', 400, 700, 0.5, 1],
    ])('should normalize %s to (%d, %d)', (_name, clientX, clientY, expectedX, expectedY) => {
      canvas.dispatchEvent(
        new PointerEvent('pointerdown', { clientX, clientY, pointerId: 1, bubbles: true })
      );
      expect(inputCallback).toHaveBeenCalledWith(expectedX, expectedY, 'down');
    });
  });

  describe('scroll handling', () => {
    it('should call onScroll with accumulated delta on wheel event', async () => {
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
      expect(scrollCallback).toHaveBeenCalled();
      expect(scrollCallback.mock.calls[0]).toHaveLength(4); // x, y, deltaX, deltaY
    });

    it.each([
      ['pixel mode (deltaMode=0)', 0],
      ['line mode (deltaMode=1)', 1],
      ['page mode (deltaMode=2)', 2],
    ])('should handle %s scroll events', async (_name, deltaMode) => {
      canvas.dispatchEvent(
        new WheelEvent('wheel', {
          clientX: 400,
          clientY: 300,
          deltaX: 0,
          deltaY: 1,
          deltaMode,
          bubbles: true,
        })
      );
      await new Promise((resolve) => requestAnimationFrame(resolve));
      expect(scrollCallback).toHaveBeenCalled();
    });

    it('should accumulate scroll deltas and batch in RAF', async () => {
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
      expect(scrollCallback).toHaveBeenCalledTimes(1);
    });

    it('should not throw if no scroll callback is provided', () => {
      handler.dispose();
      handler = new InputHandler(canvas, inputCallback);
      expect(() =>
        canvas.dispatchEvent(
          new WheelEvent('wheel', {
            clientX: 400,
            clientY: 300,
            deltaX: 0,
            deltaY: 100,
            deltaMode: 0,
            bubbles: true,
          })
        )
      ).not.toThrow();
    });
  });

  describe('throttling', () => {
    it('should throttle move events', async () => {
      canvas.dispatchEvent(
        new PointerEvent('pointerdown', { clientX: 100, clientY: 100, pointerId: 1, bubbles: true })
      );
      inputCallback.mockClear();

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
      expect(inputCallback.mock.calls.length).toBeLessThan(10);
    });

    it('should allow setting custom throttle rate', () => {
      handler.setThrottleRate(100);
      canvas.dispatchEvent(
        new PointerEvent('pointerdown', { clientX: 100, clientY: 100, pointerId: 1, bubbles: true })
      );
      inputCallback.mockClear();

      canvas.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 200, clientY: 200, pointerId: 1, bubbles: true })
      );
      canvas.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 300, clientY: 300, pointerId: 1, bubbles: true })
      );

      expect(inputCallback.mock.calls.length).toBeLessThanOrEqual(1);
    });
  });

  describe('dispose', () => {
    it('should clean up event listeners on dispose', () => {
      handler.dispose();
      canvas.dispatchEvent(
        new PointerEvent('pointerdown', { clientX: 100, clientY: 100, pointerId: 1, bubbles: true })
      );
      expect(inputCallback).not.toHaveBeenCalled();
    });

    it('should reset state on dispose', () => {
      canvas.dispatchEvent(
        new PointerEvent('pointerdown', { clientX: 100, clientY: 100, pointerId: 1, bubbles: true })
      );
      handler.dispose();

      const newCallback = vi.fn();
      const newHandler = new InputHandler(canvas, newCallback);
      canvas.dispatchEvent(
        new PointerEvent('pointerdown', { clientX: 100, clientY: 100, pointerId: 1, bubbles: true })
      );
      expect(newCallback).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 'down');
      newHandler.dispose();
    });
  });

  describe('edge cases', () => {
    it.each([
      ['pointerleave', 'pointerleave'],
      ['pointercancel', 'pointercancel'],
    ])('should handle %s as pointer up', (_name, eventType) => {
      canvas.dispatchEvent(
        new PointerEvent('pointerdown', { clientX: 100, clientY: 100, pointerId: 1, bubbles: true })
      );
      inputCallback.mockClear();

      canvas.dispatchEvent(
        new PointerEvent(eventType, { clientX: 100, clientY: 100, pointerId: 1, bubbles: true })
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

  describe('multi-touch gestures', () => {
    let multiTouchCallback: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      handler.dispose();
      multiTouchCallback = vi.fn();
      handler = new InputHandler(canvas, inputCallback, scrollCallback, multiTouchCallback);
    });

    it('should detect two-finger touch lifecycle', () => {
      // Start
      canvas.dispatchEvent(
        new TouchEvent('touchstart', {
          bubbles: true,
          cancelable: true,
          touches: [
            { identifier: 0, clientX: 200, clientY: 200 } as Touch,
            { identifier: 1, clientX: 400, clientY: 300 } as Touch,
          ],
        })
      );
      expect(multiTouchCallback).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        'down'
      );

      multiTouchCallback.mockClear();

      // Move
      canvas.dispatchEvent(
        new TouchEvent('touchmove', {
          bubbles: true,
          cancelable: true,
          touches: [
            { identifier: 0, clientX: 150, clientY: 150 } as Touch,
            { identifier: 1, clientX: 450, clientY: 350 } as Touch,
          ],
        })
      );
      expect(multiTouchCallback).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        'move'
      );

      multiTouchCallback.mockClear();

      // End
      canvas.dispatchEvent(
        new TouchEvent('touchend', {
          bubbles: true,
          cancelable: true,
          touches: [],
          changedTouches: [
            { identifier: 0, clientX: 150, clientY: 150 } as Touch,
            { identifier: 1, clientX: 450, clientY: 350 } as Touch,
          ],
        })
      );
      expect(multiTouchCallback).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        'up'
      );
    });

    it('should not trigger multiTouch callback for single touch', () => {
      canvas.dispatchEvent(
        new TouchEvent('touchstart', {
          bubbles: true,
          cancelable: true,
          touches: [{ identifier: 0, clientX: 200, clientY: 200 } as Touch],
        })
      );
      expect(multiTouchCallback).not.toHaveBeenCalled();
    });

    it('should cancel pinch when more than 2 touches are detected', () => {
      canvas.dispatchEvent(
        new TouchEvent('touchstart', {
          bubbles: true,
          cancelable: true,
          touches: [
            { identifier: 0, clientX: 200, clientY: 200 } as Touch,
            { identifier: 1, clientX: 400, clientY: 300 } as Touch,
          ],
        })
      );
      multiTouchCallback.mockClear();

      canvas.dispatchEvent(
        new TouchEvent('touchstart', {
          bubbles: true,
          cancelable: true,
          touches: [
            { identifier: 0, clientX: 200, clientY: 200 } as Touch,
            { identifier: 1, clientX: 400, clientY: 300 } as Touch,
            { identifier: 2, clientX: 500, clientY: 400 } as Touch,
          ],
        })
      );
      expect(multiTouchCallback).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        'up'
      );
    });

    it('should normalize touch coordinates correctly', () => {
      canvas.dispatchEvent(
        new TouchEvent('touchstart', {
          bubbles: true,
          cancelable: true,
          touches: [
            { identifier: 0, clientX: 0, clientY: 0 } as Touch,
            { identifier: 1, clientX: 800, clientY: 600 } as Touch,
          ],
        })
      );
      expect(multiTouchCallback).toHaveBeenCalledWith(0, 0, 1, 1, 'down');
    });

    it('should prevent default browser zoom behavior', () => {
      const touchEvent = new TouchEvent('touchstart', {
        bubbles: true,
        cancelable: true,
        touches: [
          { identifier: 0, clientX: 200, clientY: 200 } as Touch,
          { identifier: 1, clientX: 400, clientY: 300 } as Touch,
        ],
      });
      const preventDefaultSpy = vi.spyOn(touchEvent, 'preventDefault');
      canvas.dispatchEvent(touchEvent);
      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });
});
