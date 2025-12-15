# H.265/AV1 Codec Support

This document describes the H.265 (HEVC) and AV1 video codec support in scrcpy-vscode.

## Overview

scrcpy-vscode now supports three video codecs for screen mirroring:

- **H.264 (AVC)** - Default codec, widest browser support
- **H.265 (HEVC)** - Better quality and compression, limited browser support
- **AV1** - Best compression, requires modern browsers and hardware

## Codec Comparison

| Feature                      | H.264      | H.265                  | AV1                    |
| ---------------------------- | ---------- | ---------------------- | ---------------------- |
| **Quality**                  | Good       | Better                 | Best                   |
| **Compression**              | Baseline   | ~50% better than H.264 | ~30% better than H.265 |
| **Bitrate for same quality** | 8 Mbps     | 4-5 Mbps               | 3-4 Mbps               |
| **Encoding performance**     | Fast       | Moderate               | Slower                 |
| **Browser support**          | Universal  | Limited                | Modern browsers        |
| **Hardware acceleration**    | Widespread | Limited                | Growing                |

## Browser Compatibility

### H.264 (avc1)

- **Chrome/Edge**: Full support
- **Firefox**: Full support
- **Safari**: Full support
- **Recommendation**: Use for best compatibility

### H.265 (hev1/hvc1)

- **Chrome/Edge**: Partial support (requires hardware decoder, platform-dependent)
  - Windows 10/11: Supported with HEVC Video Extensions
  - macOS: Limited support
  - Linux: Very limited
- **Firefox**: Very limited support
- **Safari**: Full support on macOS/iOS
- **Recommendation**: Use only if you're on Safari or have verified Chrome/Edge support on your system

### AV1 (av01)

- **Chrome/Edge**: Supported (version 90+)
- **Firefox**: Supported (version 67+)
- **Safari**: Supported (macOS 14+, iOS 17+)
- **Recommendation**: Use on modern browsers if your device supports AV1 encoding

## Configuration

### Setting the Video Codec

1. Open VS Code settings (`Cmd/Ctrl + ,`)
2. Search for "scrcpy video codec"
3. Select your preferred codec:
   - **h264** (default) - Best compatibility
   - **h265** - Better quality, limited browser support
   - **av1** - Best compression, modern browsers only

Or edit `settings.json` directly:

```json
{
  "scrcpy.videoCodec": "h265"
}
```

### Changing Codec

When you change the codec setting, scrcpy will automatically reconnect to apply the new codec. Your current session will be briefly interrupted.

## Usage Recommendations

### When to use H.264

- Default choice for all users
- Maximum compatibility across all browsers
- Lower CPU usage on both device and computer
- Works on all platforms

### When to use H.265

- You're using Safari on macOS/iOS
- You have verified HEVC support in Chrome/Edge
- You want better quality at lower bitrates
- You have limited bandwidth
- Your device supports hardware H.265 encoding

### When to use AV1

- You're using a modern browser (Chrome 90+, Firefox 67+, Safari 14+)
- Your device supports AV1 encoding (Android 10+ with hardware support)
- You want the best compression efficiency
- You have very limited bandwidth
- You don't mind slightly higher CPU usage

## Technical Details

### Video Stream Format

- **H.264/H.265**: Uses Annex B format with start codes (0x00 0x00 0x00 0x01)
- **AV1**: Uses OBU (Open Bitstream Unit) format

### WebCodecs API

The extension uses the WebCodecs API to decode video streams in the browser:

- **H.264**: Uses `avc1.*` codec string (e.g., `avc1.42001f`)
- **H.265**: Uses `hev1.*` codec string (e.g., `hev1.1.6.L93.B0`)
- **AV1**: Uses `av01.*` codec string (e.g., `av01.0.05M.08`)

### Codec Detection

The extension automatically detects the video codec from the stream:

- **H.264**: Detects SPS (Sequence Parameter Set) NAL unit (type 7)
- **H.265**: Detects VPS/SPS/PPS NAL units (types 32/33/34)
- **AV1**: Relies on explicit configuration

### Keyframe Detection

Each codec has different keyframe markers:

- **H.264**: IDR (Instantaneous Decoder Refresh) NAL unit (type 5)
- **H.265**: IDR_W_RADL (type 19) or IDR_N_LP (type 20)
- **AV1**: Key frame flag in OBU header

## Troubleshooting

### "Codec not supported by this browser"

**Problem**: You see an error message that the codec is not supported.

**Solutions**:

1. Switch back to H.264 in settings
2. Update your browser to the latest version
3. For H.265 on Windows: Install "HEVC Video Extensions" from Microsoft Store
4. For AV1: Ensure you're using Chrome 90+, Firefox 67+, or Safari 14+

### Black screen or no video

**Problem**: The extension connects but shows no video.

**Possible causes**:

1. **Browser doesn't support codec**: Switch to H.264
2. **Device doesn't support encoding**: Check Android device codec support
3. **Decoder initialization failed**: Check browser console for errors

**Solutions**:

1. Open browser console (F12) and look for decoder errors
2. Try a different codec
3. Restart the connection
4. Check if your device supports the selected codec

### Poor performance with H.265/AV1

**Problem**: High CPU usage or choppy video.

**Causes**:

- Software decoding (no hardware acceleration)
- Device encoding performance issues

**Solutions**:

1. Switch to H.264 for better performance
2. Reduce resolution in settings (scrcpy.maxSize)
3. Lower bitrate (scrcpy.bitRate)
4. Reduce frame rate (scrcpy.maxFps)

### Video quality worse than expected

**Problem**: H.265/AV1 doesn't look better than H.264.

**Solutions**:

1. Increase bitrate for H.264 comparison
2. Enable hardware encoding on your device
3. Check device codec capabilities
4. Some devices have better H.264 encoders than H.265/AV1

## Device Requirements

### Android Device Support

Not all Android devices support all codecs:

- **H.264**: Universally supported (Android 4.3+)
- **H.265**: Supported on most modern devices (Android 5.0+)
- **AV1**: Limited support (Android 10+ with specific hardware)

To check your device's codec support:

1. Use an app like "Codec Info" or "AIDA64"
2. Look for MediaCodec encoder support
3. Check for hardware-accelerated encoders

### Recommended Device Specs

| Codec | Minimum Android | Recommended                        |
| ----- | --------------- | ---------------------------------- |
| H.264 | Android 4.3+    | Any modern device                  |
| H.265 | Android 5.0+    | Android 7.0+ with hardware encoder |
| AV1   | Android 10+     | Android 12+ with hardware encoder  |

## Implementation Details

### Architecture Changes

1. **CodecUtils.ts**: Generalized codec utilities supporting H.264, H.265, and AV1
   - Codec detection from config data
   - NAL unit parsing for H.264/H.265
   - Codec string generation for WebCodecs API

2. **VideoRenderer.ts**: Enhanced to support multiple codecs
   - Dynamic codec detection
   - Codec-specific keyframe detection
   - Fallback and error handling

3. **ScrcpyConnection.ts**: Updated to pass codec parameter to scrcpy server
   - Dynamic `video_codec` parameter
   - Support for multiple codec metadata formats

4. **ScrcpyProtocol.ts**: Added codec ID constants
   - H.265 codec ID: `0x68323635` ("h265")
   - AV1 codec ID: `0x00617631` ("av1")

### Testing

The implementation includes:

- Unit tests for codec detection
- H.264 SPS parsing tests
- Backward compatibility with existing H.264-only code

## Known Limitations

1. **H.265/AV1 dimension parsing**: Currently relies on metadata from scrcpy rather than parsing VPS/SPS for H.265 or sequence headers for AV1
2. **Browser support detection**: The extension doesn't pre-check codec support before attempting to use it
3. **Hardware encoding**: Performance depends heavily on device hardware encoder availability
4. **Fallback**: No automatic fallback to H.264 if H.265/AV1 fails

## Future Improvements

Potential enhancements:

- Pre-flight codec support check using `VideoDecoder.isConfigSupported()`
- Automatic fallback to H.264 on codec errors
- H.265 VPS/SPS parsing for dimension extraction
- AV1 sequence header parsing
- Codec performance benchmarking and recommendations
- Real-time codec switching without reconnection

## References

- [WebCodecs API](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API)
- [H.264 Specification (ITU-T H.264)](https://www.itu.int/rec/T-REC-H.264)
- [H.265 Specification (ITU-T H.265)](https://www.itu.int/rec/T-REC-H.265)
- [AV1 Specification](https://aomediacodec.github.io/av1-spec/)
- [Scrcpy Protocol](https://github.com/Genymobile/scrcpy)
