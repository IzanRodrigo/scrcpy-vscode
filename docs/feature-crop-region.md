# Crop Region Feature

The crop region feature allows you to mirror only a specific portion of the Android device screen, instead of mirroring the entire screen. This is useful when you want to focus on a particular area of the device display.

## Overview

By configuring a crop region, scrcpy will capture and stream only the specified rectangular area from the device screen. This can improve performance by reducing the amount of data being encoded and transmitted, and allows you to focus on specific UI elements or app areas.

## Configuration

The crop region is configured via the `scrcpy.crop` setting in VS Code settings.

### Setting Format

The crop setting uses the format: `width:height:x:y`

- **width**: The width of the crop region in pixels
- **height**: The height of the crop region in pixels
- **x**: The horizontal offset from the left edge of the screen in pixels
- **y**: The vertical offset from the top edge of the screen in pixels

### Example Values

- `800:600:100:200` - Captures a 800x600 pixel region starting at position (100, 200)
- `1080:1920:0:0` - Captures from top-left corner (equivalent to full screen if device is 1080x1920)
- `` (empty string) - No crop, mirrors the full screen (default)

## Use Cases

### Focus on Specific App Area

When developing or testing a specific section of your app, you can crop to show only that area:

```
# Example: Focus on bottom navigation bar (assuming 1080x1920 device)
crop: 1080:200:0:1720
```

### Hide Sensitive Information

When recording demos or taking screenshots, you can exclude areas that contain sensitive data:

```
# Example: Hide notification bar (assuming 1080x1920 device)
crop: 1080:1820:0:100
```

### Improve Performance

By reducing the captured area, you can achieve better frame rates and lower latency on resource-constrained systems:

```
# Example: Quarter screen for low-end PC
crop: 540:960:0:0
```

### Test Specific Screen Regions

When testing responsive layouts or multi-window scenarios, focus on specific areas:

```
# Example: Left half of screen in split-screen mode
crop: 540:1920:0:0
```

## Common Crop Configurations

### Portrait Device (1080x1920)

- **Top half**: `1080:960:0:0`
- **Bottom half**: `1080:960:0:960`
- **Center square**: `1080:1080:0:420`
- **Without status bar**: `1080:1820:0:100`
- **Without nav bar**: `1080:1800:0:0`

### Landscape Device (1920x1080)

- **Left half**: `960:1080:0:0`
- **Right half**: `960:1080:960:0`
- **Center**: `1280:720:320:180`

## Implementation Details

### Server Argument

When the `scrcpy.crop` setting is configured with a non-empty value, the extension passes the `crop=W:H:X:Y` argument to the scrcpy server during connection setup.

### Video Stream Behavior

- The cropped region is encoded at the device side before streaming
- The video stream dimensions will match the crop width and height
- Touch coordinates are automatically adjusted to match the cropped region
- The canvas in VS Code will display only the cropped area

### Configuration Changes

Changing the crop setting requires reconnecting to the device. The extension will automatically disconnect and reconnect when you modify this setting.

### Validation

The scrcpy server performs validation on the crop parameters:

- Coordinates must be within the device screen bounds
- Width and height must be positive values
- The crop region (x + width, y + height) must not exceed screen dimensions

If invalid crop values are provided, the scrcpy server will fail to start with an error message.

## Troubleshooting

### Server Fails to Start

If the connection fails after setting a crop region, verify that:

1. The crop format is correct: `width:height:x:y`
2. All values are positive integers
3. The crop region fits within your device's screen resolution
4. Check the Output panel in VS Code for scrcpy server error messages

### Touch Input Not Working

If touch input seems offset or not working correctly with crop enabled:

1. Ensure you're clicking within the visible cropped area
2. Verify the crop coordinates are correct
3. Try reconnecting the device

### Performance Issues

If you experience performance degradation with crop enabled:

1. Try a smaller crop region
2. Reduce the `maxSize` setting to lower the resolution
3. Reduce the `bitRate` setting to lower the encoding quality
4. Check that your crop region doesn't exceed the `maxSize` constraint

## Related Settings

The crop feature works in combination with these settings:

- `scrcpy.maxSize` - The maximum dimension is applied after cropping
- `scrcpy.bitRate` - Affects the quality of the cropped stream
- `scrcpy.lockVideoOrientation` - Locks orientation of the cropped region
- `scrcpy.showTouches` - Touch feedback is shown within the cropped area

## Technical Reference

The crop feature is implemented using scrcpy's native `--crop` option, which performs server-side cropping before H.264 encoding. This ensures minimal performance overhead and network bandwidth usage.

For more details on the scrcpy crop implementation, see the [scrcpy documentation](https://github.com/Genymobile/scrcpy/blob/master/doc/crop.md).
