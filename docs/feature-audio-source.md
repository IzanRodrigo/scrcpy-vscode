# Audio Source Selection

## Overview

The Audio Source Selection feature allows you to choose which audio source to capture from your Android device when audio streaming is enabled. This provides flexibility for different use cases such as recording device playback, capturing microphone input, or monitoring internal audio routing.

## Configuration

### Settings

The audio source can be configured via the `scrcpy.audioSource` setting in VS Code settings. This setting only applies when `scrcpy.audio` is enabled.

**Setting:** `scrcpy.audioSource`
**Type:** String (enum)
**Default:** `output`
**Options:**

- `output` - Device playback audio (default)
- `mic` - Device microphone
- `playback-capture` - Internal playback capture

### How to Configure

1. Open VS Code Settings (Cmd/Ctrl + ,)
2. Search for "scrcpy audio source"
3. Select your desired audio source from the dropdown
4. The extension will automatically reconnect to apply the new setting

Alternatively, edit your `settings.json`:

```json
{
  "scrcpy.audio": true,
  "scrcpy.audioSource": "output"
}
```

## Audio Source Options

### 1. Output (Default)

**Value:** `output`
**Description:** Captures the device's output audio stream.

**Use Cases:**

- Listening to music, videos, or games playing on the device
- Monitoring app audio output
- Recording device playback for demonstrations
- General screen mirroring with audio

**Technical Details:**

- Captures audio from the device's audio output mixer
- This is the most common and widely compatible option
- Works with media playback, system sounds, and app audio
- Audio is routed to your computer speakers/headphones

**Example Scenarios:**

- Watching a YouTube video on the device and hearing it on your computer
- Playing a mobile game and hearing the game audio through your PC
- Testing audio playback in your Android app

### 2. Microphone

**Value:** `mic`
**Description:** Captures audio from the device's microphone input.

**Use Cases:**

- Recording voice memos or audio notes
- Testing microphone functionality in your app
- Monitoring voice input for voice-controlled applications
- Debugging audio recording features
- Voice chat testing

**Technical Details:**

- Captures audio from the device's primary microphone
- Useful for apps that use voice input or recording
- The device microphone will be active during streaming
- May not work if another app is using the microphone

**Example Scenarios:**

- Testing a voice recorder app on the device
- Debugging speech recognition features
- Recording ambient sound around the device
- Testing voice chat or VoIP applications

**Limitations:**

- Cannot capture microphone and playback simultaneously (choose one source)
- Some devices may restrict microphone access during screen capture
- Other apps using the microphone may conflict with this source

### 3. Playback Capture

**Value:** `playback-capture`
**Description:** Captures internal audio playback without affecting the device's audio output routing.

**Use Cases:**

- Capturing audio in scenarios with complex audio routing
- Recording internal app audio when the standard output source has issues
- Monitoring audio without interference from device speakers/headphones
- Advanced debugging of audio mixing and routing

**Technical Details:**

- Uses Android's AudioPlaybackCapture API (requires Android 10+)
- Captures audio directly from app playback, bypassing physical output
- Device speakers/headphones are not affected by the capture
- May provide better quality in certain scenarios
- Some apps may opt-out of playback capture for privacy/DRM reasons

**Example Scenarios:**

- Recording audio from apps that modify audio routing
- Capturing game audio when Bluetooth headphones are connected
- Monitoring audio output without disturbing local playback
- Testing audio mixing in multi-app scenarios

**Limitations:**

- Requires Android 10 or higher
- Apps with DRM-protected content may block playback capture
- Some apps can opt-out of being captured via `setAllowedCapturePolicy()`
- May not work with system sounds or notification audio

## Implementation Details

### Architecture

The audio source selection is implemented at the scrcpy server level:

1. **Configuration Layer** (`package.json`):
   - Defines the `scrcpy.audioSource` setting with enum validation
   - Provides localized descriptions for each option

2. **Interface Layer** (`ScrcpyConnection.ts`):
   - Adds `audioSource: string` to the `ScrcpyConfig` interface
   - Validates audio source value before passing to server

3. **Server Communication** (`ScrcpyConnection.ts`):
   - Includes `audio_source=<value>` in server arguments when audio is enabled
   - Only sends parameter when value is not the default "output"
   - Format: `audio_source=output|mic|playback-capture`

4. **Settings Management** (`ScrcpyViewProvider.ts`):
   - Reads audio source from workspace configuration
   - Triggers automatic reconnection when audio source changes
   - Passes configuration to ScrcpyConnection instance

### Server Arguments

When audio is enabled and audio source is not the default, the extension passes the audio source to the scrcpy server:

```typescript
// Server args include:
(`audio=true`, `audio_codec=opus`, `audio_source=${audioSource}`); // Only if not "output"
```

The scrcpy server accepts these audio source values:

- `output` - Device playback (default, can be omitted)
- `mic` - Device microphone
- `playback-capture` - Internal playback capture (Android 10+)

### Configuration Changes

Changes to `scrcpy.audioSource` trigger an automatic reconnection because the audio source is a server-level parameter that cannot be changed while streaming. The reconnection flow:

1. User changes `scrcpy.audioSource` setting
2. Configuration change event detected in `ScrcpyViewProvider`
3. All active device connections are gracefully disconnected
4. Connections are re-established with new audio source parameter
5. Audio streaming resumes with the new source

## Known Limitations

### General Limitations

1. **Single Source Only**: You can only capture one audio source at a time. You cannot simultaneously capture both microphone and playback audio.

2. **Reconnection Required**: Changing audio source requires reconnecting to the device. The extension handles this automatically.

3. **Audio Requirement**: The `scrcpy.audio` setting must be enabled for audio source selection to have any effect.

### Source-Specific Limitations

**Microphone (`mic`):**

- Cannot capture if another app is actively using the microphone
- Some devices restrict microphone access during screen recording
- May have privacy/permission implications on certain devices

**Playback Capture (`playback-capture`):**

- Requires Android 10 or higher
- Apps can opt-out of being captured for privacy/DRM reasons
- Protected content (Netflix, Spotify, etc.) may be blocked
- System sounds and notifications may not be captured
- Audio focus changes might affect capture behavior

**Output (`output`):**

- May include mixed audio from multiple sources
- Can be affected by device volume settings and audio routing
- Bluetooth audio routing may cause issues on some devices

### Device Compatibility

- **Android Version**: Microphone and output work on all supported Android versions. Playback capture requires Android 10+.
- **Scrcpy Version**: Requires scrcpy 2.0 or higher for audio support.
- **Permissions**: Audio capture requires appropriate permissions on the device.

## Troubleshooting

### No Audio After Changing Source

**Problem:** Audio stops working after changing audio source.
**Solution:**

- Verify `scrcpy.audio` is enabled
- Check that the device has the appropriate permissions
- Try reconnecting manually: disconnect and reconnect the device
- For microphone, ensure no other app is using the microphone

### Playback Capture Not Working

**Problem:** `playback-capture` source doesn't capture audio.
**Solution:**

- Verify Android version is 10 or higher
- Check if the app playing audio allows capture (DRM apps may block)
- Try using `output` source instead
- Restart the scrcpy connection

### Microphone Conflict

**Problem:** Cannot capture microphone audio.
**Solution:**

- Close other apps using the microphone (voice recorder, assistant, etc.)
- Check device microphone permissions for scrcpy
- Verify microphone is working in other apps
- Try disconnecting and reconnecting

### Poor Audio Quality

**Problem:** Audio sounds distorted or low quality.
**Solution:**

- This is controlled by the scrcpy server audio encoder settings
- Audio quality is independent of the audio source
- All sources use Opus codec at the same bitrate
- Network conditions affect quality more than source selection

## References

### Related Settings

- `scrcpy.audio` - Enable/disable audio streaming
- `scrcpy.autoReconnect` - Auto-reconnect when connection is lost
- `scrcpy.reconnectRetries` - Number of reconnection attempts

### Scrcpy Documentation

- [scrcpy Audio Documentation](https://github.com/Genymobile/scrcpy/blob/master/doc/audio.md)
- [Android AudioPlaybackCapture API](https://developer.android.com/guide/topics/media/playback-capture)
- [scrcpy Server Options](https://github.com/Genymobile/scrcpy/blob/master/server/src/main/java/com/genymobile/scrcpy/Options.java)

### Implementation Files

- `/src/ScrcpyConnection.ts` - Server argument construction
- `/src/ScrcpyViewProvider.ts` - Configuration management
- `/package.json` - Setting definition
- `/package.nls.json` - Localized descriptions
