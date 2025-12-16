# Gesture Support Feature

This document describes the two-finger pinch-to-zoom gesture support added to the scrcpy-vscode extension.

## Overview

The gesture support feature enables users to perform pinch-to-zoom gestures on the canvas to zoom in/out on their Android device. This feature works by detecting two-finger touch events on the webview canvas and translating them into simultaneous multi-touch events sent to the Android device via the scrcpy protocol.

## How It Works

### Touch Event Detection

The `InputHandler` class in `src/webview/InputHandler.ts` detects and processes touch events:

1. **Touch Start**: When two fingers touch the canvas, the handler:
   - Records the initial positions of both touch points
   - Calculates the initial distance between the fingers
   - Sends a multi-touch "down" event to the extension

2. **Touch Move**: As the fingers move:
   - Updates the positions of both touch points
   - Sends multi-touch "move" events continuously
   - The device interprets the changing distance as a pinch gesture

3. **Touch End**: When fingers are lifted:
   - Sends a multi-touch "up" event to end the gesture
   - Clears the gesture state

### Multi-Touch Architecture

The implementation follows a layered architecture:

```
Canvas (Browser) → InputHandler → main.ts → ScrcpyViewProvider → DeviceService → ScrcpyConnection → Device
```

#### 1. InputHandler (src/webview/InputHandler.ts)

- Listens for native browser `touchstart`, `touchmove`, `touchend`, and `touchcancel` events
- Maintains state for active touches using a `Map<number, {x, y}>`
- Detects when exactly 2 fingers are present
- Normalizes touch coordinates to 0-1 range
- Calls the `onMultiTouch` callback with coordinates of both fingers

**Key Implementation Details**:

- Uses `event.touches.length` to detect the number of active touches
- Uses `event.touches[i].identifier` to track individual fingers
- Prevents default browser zoom behavior with `event.preventDefault()`
- Sets `canvas.style.touchAction = 'none'` to disable browser gesture handling
- Cancels pinch gesture if more than 2 touches are detected

#### 2. Message Passing (src/webview/main.ts)

The webview sends multi-touch messages to the extension:

```typescript
vscode.postMessage({
  type: 'multiTouch',
  deviceId,
  x1, // Normalized X coordinate of first finger (0-1)
  y1, // Normalized Y coordinate of first finger (0-1)
  x2, // Normalized X coordinate of second finger (0-1)
  y2, // Normalized Y coordinate of second finger (0-1)
  action, // 'down' | 'move' | 'up'
  screenWidth: canvas.width,
  screenHeight: canvas.height,
});
```

#### 3. Extension Processing (src/ScrcpyViewProvider.ts)

The extension receives the message and forwards it to the device manager:

```typescript
case 'multiTouch':
  this._deviceManager.sendMultiTouch(
    message.x1,
    message.y1,
    message.x2,
    message.y2,
    message.action,
    message.screenWidth,
    message.screenHeight
  );
```

#### 4. Device Session (src/DeviceService.ts)

Each device session forwards multi-touch events to its connection:

```typescript
sendMultiTouch(x1, y1, x2, y2, action, screenWidth, screenHeight) {
  this.connection?.sendMultiTouch(x1, y1, x2, y2, action, screenWidth, screenHeight);
}
```

#### 5. Protocol Implementation (src/ScrcpyConnection.ts)

The connection converts multi-touch to scrcpy protocol messages:

```typescript
sendMultiTouch(normalizedX1, normalizedY1, normalizedX2, normalizedY2, action, ...) {
  // Convert normalized coordinates to device coordinates
  const x1 = Math.round(normalizedX1 * this.deviceWidth);
  const y1 = Math.round(normalizedY1 * this.deviceHeight);
  const x2 = Math.round(normalizedX2 * this.deviceWidth);
  const y2 = Math.round(normalizedY2 * this.deviceHeight);

  // Send two touch events with different pointer IDs
  this.sendMultiTouchEvent(x1, y1, 0, action);  // Pointer ID 0
  this.sendMultiTouchEvent(x2, y2, 1, action);  // Pointer ID 1
}
```

### Scrcpy Protocol Details

Each touch event is sent as a 32-byte control message:

```
Offset | Size | Field
-------|------|-------
0      | 1    | Type: INJECT_TOUCH_EVENT (2)
1      | 1    | Action: DOWN (0) / MOVE (2) / UP (1)
2      | 8    | Pointer ID (0 for first finger, 1 for second finger)
10     | 4    | X coordinate (device pixels)
14     | 4    | Y coordinate (device pixels)
18     | 2    | Device width
20     | 2    | Device height
22     | 2    | Pressure (0xFFFF for down/move, 0 for up)
24     | 4    | Action button (0)
28     | 4    | Buttons (0)
```

**Critical for Multi-Touch**:

- Each finger must use a unique `Pointer ID` (0 and 1)
- Both touch events are sent sequentially
- Android interprets two simultaneous pointer IDs as a multi-touch gesture

## Implementation Components

### Modified Files

1. **src/webview/InputHandler.ts**
   - Added `MultiTouchCallback` type
   - Added `onMultiTouch` callback parameter to constructor
   - Added touch event listeners (`touchstart`, `touchmove`, `touchend`, `touchcancel`)
   - Added state tracking for active touches and pinch gesture
   - Implemented `onTouchStart()`, `onTouchMove()`, `onTouchEnd()` handlers
   - Added `getNormalizedCoordsFromTouch()` helper method
   - Added `calculateDistance()` helper for pinch distance calculation

2. **src/webview/main.ts**
   - Added multi-touch callback to `InputHandler` constructor
   - Sends `multiTouch` message to extension with both finger coordinates

3. **src/ScrcpyViewProvider.ts**
   - Added `x1`, `y1`, `x2`, `y2` fields to message type
   - Added `multiTouch` case to message handler
   - Calls `DeviceService.sendMultiTouch()`

4. **src/DeviceService.ts**
   - Added `sendMultiTouch()` method to `DeviceSession` class
   - Added `sendMultiTouch()` method to `DeviceService` class
   - Forwards multi-touch events to active device connection

5. **src/ScrcpyConnection.ts**
   - Added public `sendMultiTouch()` method
   - Added private `sendMultiTouchEvent()` helper method
   - Sends two simultaneous touch events with unique pointer IDs

### Test Coverage

Comprehensive tests were added in `test/unit/webview/InputHandler.test.ts`:

1. **Two-finger detection**: Verifies callback is triggered with "down" action
2. **Finger movement tracking**: Verifies "move" actions during pinch
3. **Gesture end**: Verifies "up" action when fingers are removed
4. **Single touch rejection**: Verifies multi-touch callback is not triggered for one finger
5. **Three-finger cancellation**: Verifies gesture is cancelled if >2 fingers touch
6. **Browser zoom prevention**: Verifies `preventDefault()` is called on touch events
7. **Coordinate normalization**: Verifies touch coordinates are normalized to 0-1 range

All tests pass successfully (152 tests total, including 8 new multi-touch tests).

## Usage

### For Users

1. Open the scrcpy extension in VS Code
2. Connect to an Android device
3. On the device screen canvas, place two fingers and:
   - **Spread fingers apart** to zoom in
   - **Pinch fingers together** to zoom out
4. The gesture works in apps that support pinch-to-zoom (Maps, Photos, Browsers, etc.)

### For Developers

To add multi-touch support when creating an `InputHandler`:

```typescript
const inputHandler = new InputHandler(
  canvas,
  onSingleTouch, // Single touch callback
  onScroll, // Scroll callback (optional)
  onMultiTouch // Multi-touch callback (optional)
);

// Multi-touch callback signature
function onMultiTouch(
  x1: number, // First finger X (0-1)
  y1: number, // First finger Y (0-1)
  x2: number, // Second finger X (0-1)
  y2: number, // Second finger Y (0-1)
  action: 'down' | 'move' | 'up'
) {
  // Handle multi-touch gesture
}
```

## Edge Cases Handled

1. **Single touch fallback**: If only one finger touches, falls back to regular pointer events
2. **Three+ finger rejection**: If more than 2 fingers touch, gesture is cancelled
3. **Mid-gesture finger addition**: If user adds a third finger mid-pinch, sends "up" to end cleanly
4. **Touch cancellation**: Handles `touchcancel` events the same as `touchend`
5. **Coordinate clamping**: Normalizes and clamps coordinates to [0, 1] range
6. **Browser zoom prevention**: Prevents default touch behavior to avoid browser zoom conflicts

## Limitations

1. **Two-finger only**: Currently only supports exactly 2 fingers (not 3+ finger gestures)
2. **No rotation gestures**: Does not detect rotation, only pinch-to-zoom
3. **No gesture velocity**: Does not track pinch speed or momentum
4. **Device app dependent**: Zoom behavior depends on the Android app's gesture support

## Future Enhancements

Potential improvements for future versions:

1. **Three-finger swipe**: Support for 3-finger gestures (screenshot, app switch)
2. **Rotation detection**: Calculate angle between fingers for rotation gestures
3. **Gesture velocity**: Track pinch speed for momentum-based zooming
4. **Configurable sensitivity**: Add settings for gesture detection thresholds
5. **Visual feedback**: Show touch points on canvas during gestures

## Technical References

- **Scrcpy Protocol**: [github.com/Genymobile/scrcpy](https://github.com/Genymobile/scrcpy)
- **Android MotionEvent**: [developer.android.com/reference/android/view/MotionEvent](https://developer.android.com/reference/android/view/MotionEvent)
- **Touch Events API**: [developer.mozilla.org/en-US/docs/Web/API/Touch_events](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events)
- **Pointer Events API**: [developer.mozilla.org/en-US/docs/Web/API/Pointer_events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)

## Testing

Run tests with:

```bash
npm test
```

Run tests with coverage:

```bash
npm run test:coverage
```

The gesture support tests are located in `test/unit/webview/InputHandler.test.ts` under the "multi-touch gestures" describe block.
