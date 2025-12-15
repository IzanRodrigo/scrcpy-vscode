# iOS Device Support Investigation

## Executive Summary

**Current State:** scrcpy-vscode is Android-only, using the scrcpy protocol over ADB.

**iOS Challenge:** There is no direct equivalent to scrcpy for iOS. iOS screen mirroring relies on Apple's proprietary AirPlay protocol, which requires reverse-engineering and has significant architectural differences from the Android approach.

**Recommendation:** Use **CoreMediaIO + AVFoundation** on macOS - the same technology QuickTime uses for "Movie Recording" from iOS devices. This provides real-time USB streaming with no external dependencies. iOS support will be **macOS-only** for now.

## Technical Comparison: Android vs iOS

| Aspect          | Android (scrcpy)                      | iOS (CoreMediaIO)                                 |
| --------------- | ------------------------------------- | ------------------------------------------------- |
| **Protocol**    | Custom binary over ADB                | CoreMediaIO + AVFoundation (macOS native)         |
| **Connection**  | USB/WiFi via ADB                      | USB via CoreMediaIO                               |
| **Server**      | scrcpy server (Java) pushed to device | No server needed - iOS exposes as AVCaptureDevice |
| **Video codec** | H.264/H.265/AV1                       | H.264 (native frames via AVFoundation)            |
| **Audio**       | Opus codec over socket                | AAC via AVCaptureDevice (`.muxed` type)           |
| **Control**     | Binary control messages over socket   | No standardized control protocol                  |
| **Device info** | ADB shell commands                    | AVCaptureDevice properties                        |
| **Latency**     | ~35-70ms                              | ~50-100ms                                         |
| **Platforms**   | macOS, Windows, Linux                 | **macOS only**                                    |

## Recommended Approach: CoreMediaIO + AVFoundation

**Description:** Use Apple's native frameworks to capture iOS screen via USB, the same technology QuickTime uses for "Movie Recording" from iOS devices.

### How it works

1. Enable screen capture devices via CoreMediaIO:

   ```swift
   var prop = CMIOObjectPropertyAddress(
       mSelector: CMIOObjectPropertySelector(kCMIOHardwarePropertyAllowScreenCaptureDevices),
       mScope: CMIOObjectPropertyScope(kCMIOObjectPropertyScopeGlobal),
       mElement: CMIOObjectPropertyElement(kCMIOObjectPropertyElementMain)
   )
   var allow: UInt32 = 1
   CMIOObjectSetPropertyData(CMIOObjectID(kCMIOObjectSystemObject), &prop, 0, nil, UInt32(MemoryLayout.size(ofValue: allow)), &allow)
   ```

2. Get iOS device as AVCaptureDevice:

   ```swift
   let device = AVCaptureDevice.default(for: .muxed)  // .muxed = video + audio
   ```

3. Capture frames via standard AVCaptureSession

### Pros

- Native macOS framework (no external dependencies)
- Real-time streaming with low latency (~50-100ms)
- Same technology QuickTime uses - proven and reliable
- Includes audio capture (`.muxed` type)
- No license concerns (Apple system framework)
- USB-based = stable connection

### Cons

- **macOS only** - won't work on Windows/Linux
- Requires native code (Swift CLI helper)
- No touch/keyboard control (display only)
- Devices take a moment to appear after enabling

### Implementation Options

1. **Swift CLI helper**: Small Swift executable that captures frames and outputs to stdout/socket
2. **Node.js native addon**: Use N-API to call CoreMediaIO/AVFoundation directly

## Alternative Approaches (Not Recommended)

### AirPlay Receiver (UxPlay-based)

- Real-time streaming but GPL-3.0 license (incompatible with Apache-2.0)
- Requires iOS device to initiate connection from Control Center
- Complex protocol implementation

### Custom AirPlay Implementation

- Massive engineering effort
- Requires reverse-engineering Apple protocols
- Ongoing maintenance burden

## Phased Approach

### Phase 1: CoreMediaIO Streaming

**Goal:** Real-time iOS screen mirroring on macOS using native frameworks.

**Features:**

- iOS device discovery via CoreMediaIO/AVFoundation
- Real-time video streaming (same as QuickTime)
- Audio capture support
- Device info display

**Technical Requirements:**

- Swift CLI helper binary (bundled with extension for macOS)
- Frame streaming via stdout or local socket
- Platform detection to enable only on macOS

### Phase 2: Enhanced Features

**Goal:** Improve user experience and feature set.

**Features:**

- Screenshot saving with timestamp
- Improved device info UI
- Recording support

### Phase 3: Touch Control (Future Research)

**Goal:** Investigate touch/keyboard control for iOS.

**Potential Approaches:**

1. **WebDriverAgent:** Appium's WebDriverAgent for touch injection (requires developer signing)
2. **Companion App:** iOS app that receives and injects touch events

**Note:** This is significantly more complex than Android's scrcpy control and may not be feasible without a companion app.

## Architecture Changes Required

### Current Architecture (Android-only)

```
Extension
    └── ScrcpyViewProvider
        └── DeviceManager
            └── DeviceSession
                └── ScrcpyConnection
                    └── ADB (child_process)
```

### Proposed Architecture (with iOS)

```
Extension
    └── ScrcpyViewProvider
        └── DeviceManager
            └── DeviceSession
                └── IDeviceConnection (interface)
                    ├── ScrcpyConnection (Android)
                    │   └── ADB (child_process)
                    └── iOSConnection (macOS only)
                        └── CoreMediaIOHelper (Swift CLI)
```

### Key Abstractions to Introduce

1. **IDeviceConnection Interface**

   ```typescript
   interface IDeviceConnection {
     connect(): Promise<void>;
     disconnect(): Promise<void>;
     getDeviceInfo(): Promise<DeviceInfo>;
     takeScreenshot(): Promise<Buffer>;
     // Platform-specific methods optional
   }
   ```

2. **Extended DeviceInfo**

   ```typescript
   interface DeviceInfo {
     serial: string;
     name: string;
     model?: string;
     platform: 'android' | 'ios';
   }
   ```

## Dependencies

| Dependency       | Purpose                  | License       | Installation                   |
| ---------------- | ------------------------ | ------------- | ------------------------------ |
| CoreMediaIO      | iOS device video capture | Apple (macOS) | Built into macOS               |
| AVFoundation     | Video/audio capture API  | Apple (macOS) | Built into macOS               |
| Swift CLI helper | Bridge to Node.js        | Apache-2.0    | Bundled with extension (macOS) |

## Open Questions

1. **Swift CLI vs Node.js Addon:** Should we build a Swift CLI helper that pipes frames, or a Node.js native addon that calls CoreMediaIO directly?
   - CLI: Easier to build and debug, separate process
   - Addon: Better performance, single process, more complex build

2. **Frame Format:** What format should the Swift helper output?
   - Raw BGRA frames (simple but large bandwidth)
   - JPEG frames (compressed, lower quality)
   - H.264 stream (complex but efficient, matches Android)

3. **Touch Control:** Is touch control a hard requirement for full parity?
   - WebDriverAgent (requires Apple Developer account)
   - Companion iOS app (App Store distribution)
   - Accept display-only limitation initially

## Next Steps

1. Create proof-of-concept Swift CLI for CoreMediaIO capture
2. Test frame streaming to Node.js (stdout/socket)
3. Integrate with existing webview video renderer
4. Implement device detection (iOS vs Android)
5. Add iOS device tab support in UI

## References

- [Apple Developer Forums - AVFoundation iOS capture](https://developer.apple.com/forums/thread/94744)
- [IOSCaptureSample-withDAL](https://github.com/jyu0414/IOSCaptureSample-withDAL) - Sample code for iOS screen capture on macOS
- [CoreMediaIO DAL Plugin Example](https://github.com/johnboiles/coremediaio-dal-minimal-example)
- [scrcpy GitHub](https://github.com/Genymobile/scrcpy)
