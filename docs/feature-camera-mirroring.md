# Camera Mirroring Feature

## Overview

The camera mirroring feature allows you to mirror your Android device's front, back, or external camera instead of the screen display. This is particularly useful for developers working on camera-related applications, as it enables debugging camera feeds directly within VS Code.

## Features

- Mirror device cameras (front, back, or external)
- Specify camera by ID or facing direction
- Configure camera resolution and frame rate
- List available cameras on the device
- Seamless switching between screen and camera mirroring

## Settings Reference

### Video Source

**Setting:** `scrcpy.videoSource`

**Type:** `string`

**Default:** `"display"`

**Options:**

- `display` - Mirror device screen (default)
- `camera` - Mirror device camera

**Description:** Choose what to mirror from your device.

### Camera Facing

**Setting:** `scrcpy.cameraFacing`

**Type:** `string`

**Default:** `"back"`

**Options:**

- `front` - Front-facing camera (selfie)
- `back` - Back-facing camera (default)
- `external` - External camera (USB)

**Description:** Which camera to use when video source is set to camera. Only applies when `scrcpy.videoSource` is set to `camera`.

### Camera ID

**Setting:** `scrcpy.cameraId`

**Type:** `string`

**Default:** `""`

**Description:** Specific camera ID to use (leave empty to auto-select based on `cameraFacing`). Use the "List Cameras" command to see available cameras and their IDs. Only applies when `scrcpy.videoSource` is set to `camera`.

### Camera Size

**Setting:** `scrcpy.cameraSize`

**Type:** `string`

**Default:** `""`

**Pattern:** `^\d+x\d+$`

**Examples:** `"1920x1080"`, `"1280x720"`

**Description:** Camera resolution. Leave empty for automatic selection. Only applies when `scrcpy.videoSource` is set to `camera`.

### Camera FPS

**Setting:** `scrcpy.cameraFps`

**Type:** `number`

**Default:** `0`

**Range:** `0-120`

**Common values:** `15`, `30`, `60`

**Description:** Camera frame rate (0 for default). Only applies when `scrcpy.videoSource` is set to `camera`.

## Usage Instructions

### Basic Camera Mirroring

1. Open VS Code settings (Cmd+, on Mac, Ctrl+, on Windows/Linux)
2. Search for "scrcpy"
3. Change `Video Source` from `display` to `camera`
4. Optionally change `Camera Facing` to `front`, `back`, or `external`
5. The device will automatically reconnect and start mirroring the selected camera

### Using a Specific Camera

If your device has multiple cameras, you can specify which one to use:

1. Run the command **"Scrcpy: List Available Cameras"**
   - Press Cmd+Shift+P (Mac) or Ctrl+Shift+P (Windows/Linux)
   - Type "Scrcpy: List Available Cameras"
   - Select it from the list
2. A quick pick will show all available cameras with their details:
   - Camera ID
   - Facing direction (front/back/external)
   - Sensor resolution
   - Supported frame rates
3. Select a camera from the list
4. Choose "Yes" to automatically set the camera ID in settings
5. Change `Video Source` to `camera` if not already set

### Custom Resolution and Frame Rate

For specific camera configurations:

1. Set `Video Source` to `camera`
2. Set `Camera Size` to your desired resolution (e.g., `1920x1080`)
3. Set `Camera FPS` to your desired frame rate (e.g., `30`)
4. The extension will reconnect with the new settings

### Switching Back to Screen Mirroring

1. Open VS Code settings
2. Change `Video Source` from `camera` back to `display`
3. The device will automatically reconnect and show the screen

## Implementation Details

### Files Modified

#### 1. package.json

- Added camera-related settings:
  - `scrcpy.videoSource` - Choose between display and camera
  - `scrcpy.cameraFacing` - Select front/back/external camera
  - `scrcpy.cameraId` - Specify camera by ID
  - `scrcpy.cameraSize` - Set camera resolution
  - `scrcpy.cameraFps` - Set camera frame rate
- Added `scrcpy.listCameras` command
- Added camera settings section in configuration

#### 2. package.nls.json

- Added localization strings for all camera settings
- Added description for `scrcpy.listCameras` command

#### 3. ScrcpyConnection.ts

- Updated `ScrcpyConfig` interface to include camera settings
- Modified `startScrcpy()` to pass camera parameters to scrcpy server:
  - `video_source=camera` when camera mode is selected
  - `camera_facing=front|back|external`
  - `camera_id=X` when specific ID is provided
  - `camera_size=WxH` when custom resolution is specified
  - `camera_fps=X` when custom frame rate is specified
- Added `listCameras()` method to enumerate available cameras

#### 4. ScrcpyViewProvider.ts

- Updated `_getConfig()` to read camera settings from workspace configuration
- Added camera settings to reconnect trigger list
- Added `listCameras()` method to show available cameras in a quick pick

#### 5. DeviceManager.ts

- Added `listCameras()` method to delegate to active session

#### 6. extension.ts

- Registered `scrcpy.listCameras` command

### Key Changes

1. **Server Arguments**: The scrcpy server already supports camera mirroring through the following arguments:
   - `video_source=camera` - Switches from display to camera capture
   - `camera_facing=front|back|external` - Selects camera by facing
   - `camera_id=X` - Selects camera by specific ID
   - `camera_size=WxH` - Sets camera resolution
   - `camera_fps=X` - Sets camera frame rate

2. **Camera Listing**: The scrcpy server supports listing cameras via `list_cameras=true` argument, which outputs camera information including ID, facing, resolution, and supported FPS.

3. **Auto-Reconnect**: Camera settings are included in the list of settings that trigger automatic reconnection, ensuring smooth transitions when changing camera configuration.

## Known Limitations

1. **Camera Permissions**: The scrcpy server requires camera permissions on the device. If permission is denied, the connection will fail with an error.

2. **Camera Availability**: If another app is using the camera, scrcpy may not be able to access it. Close other camera apps before enabling camera mirroring.

3. **Android Version**: Camera mirroring requires Android 5.0 (API 21) or higher.

4. **Resolution Support**: Not all cameras support all resolutions. If you specify a resolution not supported by the camera, scrcpy will select the closest available resolution.

5. **Control Limitations**: When mirroring a camera, touch input and other device controls work the same way as display mirroring. However, some camera-specific controls (like focus, exposure, etc.) are not available.

6. **Screen Off**: The `screenOff` setting has no effect in camera mode since the camera is independent of the screen state.

## Testing Notes

### Display Mode (Default Behavior)

- ✅ Default `videoSource` is `display`
- ✅ Screen mirroring works as expected
- ✅ All existing features work normally
- ✅ Touch input and controls function correctly

### Camera Mode

- ✅ Switching to `camera` mode triggers reconnection
- ✅ Camera feed displays in the webview
- ✅ Touch input continues to work (touches the screen, not the camera feed)
- ✅ Control buttons (volume, back, home, etc.) work normally

### Camera Selection

- ✅ `cameraFacing` setting allows selecting front/back/external cameras
- ✅ `cameraId` setting allows selecting specific camera by ID
- ✅ List Cameras command shows all available cameras
- ✅ Selecting a camera from the list updates the settings

### Camera Configuration

- ✅ `cameraSize` setting allows custom resolution
- ✅ `cameraFps` setting allows custom frame rate
- ✅ Invalid resolutions fall back to supported resolution
- ✅ Settings changes trigger automatic reconnection

## Troubleshooting

### Camera feed not showing

1. Check that `Video Source` is set to `camera` in settings
2. Verify camera permissions are granted to scrcpy on the device
3. Close any other apps that might be using the camera
4. Try listing cameras to ensure they are detected
5. Check the Output panel for error messages

### Wrong camera selected

1. Run "Scrcpy: List Available Cameras" command
2. Note the ID of the desired camera
3. Set `Camera ID` to the specific ID in settings
4. Alternatively, set `Camera Facing` to the desired direction

### Low quality or frame rate

1. Increase `Video Bit Rate` setting (default: 8 Mbps)
2. Increase `Max FPS` setting (default: 60 FPS)
3. Set `Camera FPS` to match your desired frame rate
4. Verify your camera supports the specified resolution and FPS

### Camera permission denied

1. Go to Android Settings → Apps → scrcpy → Permissions
2. Grant Camera permission
3. Reconnect in VS Code

## Examples

### Example 1: Use front camera at 720p 30fps

```json
{
  "scrcpy.videoSource": "camera",
  "scrcpy.cameraFacing": "front",
  "scrcpy.cameraSize": "1280x720",
  "scrcpy.cameraFps": 30
}
```

### Example 2: Use specific camera by ID

```json
{
  "scrcpy.videoSource": "camera",
  "scrcpy.cameraId": "0",
  "scrcpy.cameraSize": "1920x1080",
  "scrcpy.cameraFps": 60
}
```

### Example 3: Use back camera with default settings

```json
{
  "scrcpy.videoSource": "camera",
  "scrcpy.cameraFacing": "back"
}
```

## References

- [scrcpy camera support](https://github.com/Genymobile/scrcpy/blob/master/doc/camera.md)
- [Android Camera2 API](https://developer.android.com/media/camera/camera2)
- scrcpy server source: `server/src/main/java/com/genymobile/scrcpy/video/CameraCapture.java`
