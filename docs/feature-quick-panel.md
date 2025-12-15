# Quick Panel Access Feature

## Overview

The Quick Panel Access feature provides convenient buttons to quickly open Android's notification panel and settings panel directly from the scrcpy-vscode extension toolbar. This eliminates the need to swipe down from the top of the device screen using touch gestures.

## Features

- **Notification Panel Button**: Opens the Android notification panel with a single click
- **Settings Panel Button**: Opens the Android quick settings panel with a single click
- **Automatic Panel Collapse**: Panels can be collapsed by clicking outside or using the back button

## Usage

### Opening the Notification Panel

1. Locate the notification bell icon in the control toolbar at the bottom of the scrcpy view
2. Click the bell button
3. The device's notification panel will expand from the top of the screen

### Opening the Settings Panel

1. Locate the gear/settings icon in the control toolbar at the bottom of the scrcpy view
2. Click the settings button
3. The device's quick settings panel will expand from the top of the screen

### Closing Panels

To close an open panel, you can:

- Click the Back button in the toolbar
- Use the physical back button on the device
- Click outside the panel area on the device screen

## Button Location

The notification and settings panel buttons are located in the control toolbar at the bottom of the scrcpy view, in the center group alongside the Back, Home, and Recent Apps buttons:

```
[Vol-] [Vol+] | [Back] [Home] [Recent] [Notification] [Settings] | [Screenshot] [Rotate] [Power]
```

## Implementation Details

### Protocol Messages

The feature uses the scrcpy control protocol to send single-byte messages to the device:

- **Expand Notification Panel**: Control message type 5
- **Expand Settings Panel**: Control message type 6
- **Collapse Panels**: Control message type 7

### Architecture

The implementation follows the existing scrcpy-vscode architecture:

1. **WebView UI** (WebviewTemplate.ts): Defines the HTML buttons with bell and gear icons
2. **WebView Handler** (main.ts): Handles button click events and posts messages to the extension
3. **Message Router** (ScrcpyViewProvider.ts): Routes messages to the DeviceManager
4. **Device Manager** (DeviceManager.ts): Delegates commands to the active device session
5. **Connection** (ScrcpyConnection.ts): Sends the control messages over the control socket

### Message Flow

```
Button Click → main.ts → ScrcpyViewProvider → DeviceManager → DeviceSession → ScrcpyConnection → Device
```

### Code Structure

#### ScrcpyProtocol.ts

```typescript
export enum ControlMessageType {
  EXPAND_NOTIFICATION_PANEL = 5,
  EXPAND_SETTINGS_PANEL = 6,
  COLLAPSE_PANELS = 7,
  // ...
}
```

#### ScrcpyConnection.ts

```typescript
expandNotificationPanel(): void {
  // Sends 1-byte message (type 5)
}

expandSettingsPanel(): void {
  // Sends 1-byte message (type 6)
}

collapsePanels(): void {
  // Sends 1-byte message (type 7)
}
```

#### DeviceManager.ts

```typescript
expandNotificationPanel(): void {
  this.getActiveSession()?.expandNotificationPanel();
}

expandSettingsPanel(): void {
  this.getActiveSession()?.expandSettingsPanel();
}

collapsePanels(): void {
  this.getActiveSession()?.collapsePanels();
}
```

#### WebviewTemplate.ts

```html
<button class="control-btn" id="notification-panel-btn" title="Open notification panel">
  <!-- Bell SVG icon -->
</button>
<button class="control-btn" id="settings-panel-btn" title="Open settings panel">
  <!-- Gear SVG icon -->
</button>
```

#### main.ts

```typescript
const notificationPanelBtn = document.getElementById('notification-panel-btn');
notificationPanelBtn?.addEventListener('click', () => {
  vscode.postMessage({ type: 'expandNotificationPanel' });
});

const settingsPanelBtn = document.getElementById('settings-panel-btn');
settingsPanelBtn?.addEventListener('click', () => {
  vscode.postMessage({ type: 'expandSettingsPanel' });
});
```

#### ScrcpyViewProvider.ts

```typescript
case 'expandNotificationPanel':
  if (this._deviceManager) {
    this._deviceManager.expandNotificationPanel();
  }
  break;

case 'expandSettingsPanel':
  if (this._deviceManager) {
    this._deviceManager.expandSettingsPanel();
  }
  break;
```

## Compatibility

- Requires scrcpy server version that supports panel expansion control messages (scrcpy 1.16+)
- Works with all Android versions that support programmatic panel expansion
- Compatible with both USB and WiFi connections
- Works with multi-device sessions (affects only the active device)

## Technical Notes

### Control Socket

The panel control commands are sent over the scrcpy control socket, which is bidirectional and used for all device control operations (touch, keys, clipboard, etc.).

### Message Format

All panel control messages use the same simple format:

- Size: 1 byte
- Content: Control message type (5, 6, or 7)

This is the same format used by other simple control commands like `ROTATE_DEVICE`.

### Error Handling

If the control socket is not connected or the connection is lost, the commands are silently ignored with an error logged to the console. This matches the behavior of other control commands.

## Testing

To test the feature:

1. Connect an Android device
2. Open the scrcpy view in VS Code
3. Click the notification bell button - verify the notification panel expands
4. Click the back button - verify the panel collapses
5. Click the settings gear button - verify the settings panel expands
6. Test with multiple devices to ensure it affects only the active device

## Future Enhancements

Potential improvements for future versions:

- **Toggle Behavior**: Make buttons toggle panels (expand/collapse) instead of just expanding
- **Visual Feedback**: Show button state when panel is open
- **Keyboard Shortcuts**: Add keyboard shortcuts for panel access
- **Panel State Detection**: Detect when panels are open via other means and update button state
