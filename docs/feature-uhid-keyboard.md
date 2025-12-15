# UHID Keyboard Feature

## Overview

The UHID (User-space HID) keyboard feature allows scrcpy-vscode to simulate a physical hardware keyboard instead of using text injection. This provides better compatibility with games, password fields, and apps that are sensitive to input method editors (IMEs).

## Keyboard Modes

scrcpy-vscode supports two keyboard input modes, configurable via the `scrcpy.keyboardMode` setting:

### Inject Mode (Default)

- **Value**: `inject`
- **Default**: Yes
- **Android Version**: Works on all Android versions
- **How it works**: Uses Android's text injection API to directly insert text and keycodes into the focused input field
- **Advantages**:
  - Works on all Android versions (no minimum version required)
  - More reliable for standard text input in apps
  - Lower latency for typing
- **Disadvantages**:
  - Some games and apps ignore injected input
  - May not work properly in password fields (some apps reject injected passwords)
  - Apps with IME restrictions may not accept injected text

### UHID Mode

- **Value**: `uhid`
- **Default**: No
- **Android Version**: Requires Android 11+ (API level 30+)
- **How it works**: Creates a virtual HID (Human Interface Device) keyboard at the kernel level, making Android think a physical USB keyboard is connected
- **Advantages**:
  - **Full hardware keyboard simulation**: Apps see it as a real physical keyboard
  - **Games compatibility**: Works with games that ignore injected input
  - **Password fields**: Better compatibility with secure input fields that block text injection
  - **IME bypass**: Works with apps that have strict IME restrictions
  - **Keyboard shortcuts**: Better support for complex key combinations
- **Disadvantages**:
  - Requires Android 11 or newer (API level 30+)
  - May require root access on some devices or custom ROMs
  - Slightly higher latency compared to inject mode

## Configuration

To change the keyboard mode:

1. Open VS Code settings (`Cmd+,` on macOS, `Ctrl+,` on Windows/Linux)
2. Search for "scrcpy keyboard"
3. Find "Scrcpy: Keyboard Mode"
4. Select either:
   - `inject` - Text injection mode (default)
   - `uhid` - Hardware keyboard simulation

Or edit your `settings.json` directly:

```json
{
  "scrcpy.keyboardMode": "uhid"
}
```

**Note**: Changing the keyboard mode requires reconnecting to the device. The extension will automatically reconnect when you change this setting.

## Use Cases

### When to Use Inject Mode

Use inject mode (default) when:

- You need maximum compatibility across all Android versions
- You're primarily typing text in standard apps (messaging, notes, browsers)
- You want the lowest possible input latency
- Your device is running Android 10 or older

### When to Use UHID Mode

Use UHID mode when:

- Playing Android games that require keyboard input
- Entering passwords in security-conscious apps
- Using apps that block or restrict IME input
- You need hardware-level keyboard simulation
- Your device runs Android 11 or newer

## Implementation Details

### Server Arguments

When `keyboardMode` is set to `uhid`, scrcpy-vscode adds the following server argument:

```
keyboard=uhid
```

When `keyboardMode` is set to `inject` (or not specified), no explicit keyboard argument is passed, and scrcpy uses its default text injection mode.

### Code Flow

1. **Configuration**: The `scrcpy.keyboardMode` setting is read from VS Code workspace configuration
2. **ScrcpyConfig Interface**: The setting is stored in the `ScrcpyConfig.keyboardMode` property
3. **Server Launch**: When starting the scrcpy server, if `keyboardMode === 'uhid'`, the `keyboard=uhid` argument is added to the server arguments
4. **Input Handling**: The keyboard input handler in the webview continues to work the same way - the mode difference is handled entirely by the scrcpy server

### Technical Background

UHID (User-space HID) is a Linux kernel feature that allows userspace programs to create virtual HID devices. When scrcpy uses UHID mode:

1. The scrcpy server creates a virtual HID keyboard device in the Android kernel
2. Android's input system sees this as a physical USB keyboard
3. All keyboard events are sent through the HID protocol layer
4. Apps receive input events as if from a real hardware keyboard, bypassing IME and text injection mechanisms

This is the same technology used by:

- USB OTG keyboards
- Bluetooth keyboards
- Virtual machines for input device passthrough

## Known Limitations

### Android Version Requirement

UHID keyboard mode requires Android 11 (API level 30) or newer. If you try to use UHID mode on an older Android version, the scrcpy server may fail to start or keyboard input may not work.

**Workaround**: Keep using inject mode on devices running Android 10 or older.

### Root Access on Some Devices

Some devices or custom ROMs may require root access to create UHID devices due to SELinux policies or permission restrictions. This is device-dependent.

**Workaround**: If UHID mode doesn't work on your device, either:

1. Try enabling developer options and disabling SELinux enforcement (not recommended for security reasons)
2. Use a custom ROM that allows UHID without root
3. Fall back to inject mode

### No Automatic Fallback

If you configure UHID mode but your device doesn't support it, the extension won't automatically fall back to inject mode. You'll need to manually change the setting back to `inject`.

**Future improvement**: We could detect UHID support and automatically fall back to inject mode with a user notification.

### Modifier Key Combinations

Both modes support modifier keys (Ctrl, Alt, Shift, etc.), but UHID mode may have better support for complex key combinations in games and specialized apps.

## Troubleshooting

### Keyboard input not working after switching to UHID mode

**Symptoms**: You can see the video stream but keyboard input doesn't work.

**Possible causes**:

1. Your Android device is running Android 10 or older
2. Your device requires root access for UHID
3. SELinux is blocking UHID device creation

**Solutions**:

1. Check your Android version: Settings > About phone > Android version
2. If Android < 11: Switch back to inject mode
3. If Android >= 11: Check `adb logcat | grep scrcpy` for error messages
4. Try switching back to inject mode

### How to check scrcpy server logs

If UHID mode isn't working, check the scrcpy server logs:

1. Open a terminal
2. Run: `adb logcat | grep scrcpy`
3. Look for error messages about UHID or keyboard initialization
4. Share the logs when reporting issues

### Extension not reconnecting after changing mode

**Symptoms**: You changed the keyboard mode setting but the device didn't reconnect.

**Solution**: The extension should auto-reconnect when `scrcpy.keyboardMode` changes. If it doesn't:

1. Click the "Reconnect" button in the scrcpy view
2. Or run command: "Scrcpy: Start Device Mirroring"

## Comparison Table

| Feature             | Inject Mode  | UHID Mode                    |
| ------------------- | ------------ | ---------------------------- |
| Android Version     | All versions | Android 11+                  |
| Compatibility       | Most apps    | All apps (including games)   |
| Password Fields     | May not work | Works                        |
| Games               | May not work | Works                        |
| Root Required       | No           | Sometimes (device-dependent) |
| Input Latency       | Lower        | Slightly higher              |
| Hardware Simulation | No           | Yes                          |
| Default Mode        | ✓            |                              |

## References

- [scrcpy keyboard documentation](https://github.com/Genymobile/scrcpy/blob/master/doc/keyboard.md)
- [UHID kernel documentation](https://www.kernel.org/doc/html/latest/hid/uhid.html)
- [Android HID support](https://source.android.com/devices/input/keyboard-devices)
