# Multiple Display Support

This document describes the multiple display support feature in scrcpy-vscode, which allows you to select which physical display to mirror when your Android device has multiple displays connected.

## Overview

Modern Android devices can support multiple displays through:

- External monitors via USB-C/HDMI adapters
- Wireless display projection (Miracast)
- Secondary screens on foldable devices
- Display output modes (Desktop Mode, DeX, etc.)

The multiple display support feature enables you to choose which of these displays to mirror in VS Code.

## How to Use

### 1. List Available Displays

To see which displays are available on your connected device:

1. Connect your Android device via USB or WiFi
2. Click the display icon (monitor) in the scrcpy view title bar, or
3. Run the command **"Scrcpy: Select Display"** from the Command Palette (Cmd/Ctrl+Shift+P)

This will show a QuickPick menu with all available displays on your device, including:

- Display ID
- Display name (if available)
- Resolution (if available)

### 2. Select a Display

From the display picker:

- **Display 0** is always the main/built-in display (default)
- Additional displays will be numbered 1, 2, 3, etc.
- Select the display you want to mirror

The extension will automatically reconnect to stream the selected display.

### 3. Manual Configuration

You can also manually set the display ID in VS Code settings:

1. Open Settings (Cmd/Ctrl+,)
2. Search for "scrcpy"
3. Find **"Scrcpy: Display Id"**
4. Set the display ID (0 for main display, 1+ for secondary displays)

The connection will automatically restart when you change this setting.

## Use Cases

### External Monitor Mirroring

If your Android device is connected to an external monitor, you can mirror that display instead of the device's built-in screen:

- Useful for testing apps on different screen sizes
- Monitor presentations or media playback on external displays
- Debug multi-display app behavior

### Desktop Mode / Samsung DeX

When using Desktop Mode or Samsung DeX:

- Display 0 = Device's built-in screen
- Display 1 = External desktop display
- Switch between them to test your app's behavior in both contexts

### Foldable Devices

For devices with multiple physical screens:

- Mirror the inner or outer display independently
- Test app continuity when switching between displays

### Wireless Displays

When projecting to a wireless display (Miracast):

- Mirror the wireless display output
- Debug casting or projection features

## Implementation Details

### Display Detection

The extension uses `adb shell dumpsys display` to enumerate available displays on the device. The output is parsed to extract:

- Display ID (`mDisplayId`)
- Display name/description
- Resolution information

### Server Configuration

When a non-zero display ID is configured, the extension adds the `display_id=N` parameter to the scrcpy server arguments. This tells the scrcpy server to capture from the specified display instead of the default display.

Server argument example:

```
display_id=1  // Mirror display 1 instead of display 0
```

### Scrcpy Protocol

The scrcpy server supports the `display_id` option starting from scrcpy 2.0+. This parameter is passed during server initialization and determines which display's framebuffer to capture.

### Settings Integration

The display ID is stored as a workspace/global setting:

- **Setting**: `scrcpy.displayId`
- **Type**: `number`
- **Default**: `0` (main display)
- **Range**: `0` to number of available displays

Changing this setting triggers an automatic reconnection to apply the new display selection.

## Troubleshooting

### No Secondary Displays Shown

If the display picker only shows "Display 0":

- Ensure your external display is properly connected
- Enable Desktop Mode or display output on your device
- Check that your device supports multiple displays
- Some devices may need specific permissions or developer options enabled

### Display Selection Not Working

If changing the display ID doesn't work:

- Verify your scrcpy version is 2.0 or newer (`scrcpy --version`)
- Check that the display ID exists on your device
- Try listing displays manually: `adb shell dumpsys display | grep mDisplayId`
- Ensure USB debugging is enabled and authorized

### Black Screen on Secondary Display

If the secondary display shows a black screen:

- The display might be off or in standby mode
- Try waking the secondary display on your device
- Some displays may have content protection that prevents mirroring
- Check device-specific display output settings

## Limitations

1. **Display Availability**: The display must be active and accessible to the scrcpy server. Some displays may be protected or unavailable for capture.

2. **Performance**: Mirroring high-resolution external displays may require higher bitrate settings for optimal quality.

3. **Orientation**: The `lockVideoOrientation` setting applies to the selected display's orientation.

4. **Device Support**: Not all Android devices support multiple displays. The feature requires Android API level with multi-display support.

## Related Settings

- **scrcpy.maxSize**: Maximum resolution for the mirrored display
- **scrcpy.bitRate**: Video bitrate (increase for higher resolution displays)
- **scrcpy.lockVideoOrientation**: Lock the orientation of the selected display

## Technical Reference

### Code Locations

- **Setting definition**: `package.json` → `contributes.configuration`
- **Display enumeration**: `ScrcpyConnection.ts` → `listDisplays()`
- **Display selection UI**: `ScrcpyViewProvider.ts` → `selectDisplay()`
- **Server parameter**: `ScrcpyConnection.ts` → `startScrcpy()` → `display_id` argument

### ADB Commands

List displays on device:

```bash
adb shell dumpsys display
```

Filter display IDs:

```bash
adb shell dumpsys display | grep mDisplayId
```

Get display info:

```bash
adb shell dumpsys display | grep -A 20 "Display Id=1"
```

## Future Enhancements

Potential improvements for this feature:

- Real-time display detection (notify when displays are connected/disconnected)
- Display preview thumbnails in the picker
- Per-device display preferences
- Automatic display selection based on resolution or type
- Display rotation control per display
