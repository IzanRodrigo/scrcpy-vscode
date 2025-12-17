<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=izantech.scrcpy-vscode">
    <img src="media/icon.png" width="128" alt="Scrcpy for VS Code"/>
  </a>
</p>

# Scrcpy for VS Code

[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/izantech.scrcpy-vscode)](https://marketplace.visualstudio.com/items?itemName=izantech.scrcpy-vscode)
[![Visual Studio Marketplace Installs](https://img.shields.io/visual-studio-marketplace/azure-devops/installs/total/izantech.scrcpy-vscode)](https://marketplace.visualstudio.com/items?itemName=izantech.scrcpy-vscode)
[![Visual Studio Marketplace Rating](https://img.shields.io/visual-studio-marketplace/stars/izantech.scrcpy-vscode)](https://marketplace.visualstudio.com/items?itemName=izantech.scrcpy-vscode)

Display and control your Android device screen directly within VS Code, similar to Android Studio's "Running Devices" feature. Also supports iOS device mirroring on macOS (experimental).

## Features

- **Multi-device support** - Tab bar for switching between devices
- **Touch & scroll** - Tap, drag, and mouse wheel scrolling
- **Keyboard input** - Click canvas to type, with modifier support (Ctrl, Alt, Shift)
- **Audio streaming** - Hear device audio with mute control
- **Clipboard sync** - Ctrl+V to paste, Ctrl+C to copy
- **Device controls** - Volume, Back, Home, Recent Apps, Power, Rotate (long press supported)
- **WiFi connection** - Android 11+ Wireless Debugging or legacy `adb tcpip`
- **Auto-connect/reconnect** - Automatically handles device connections
- **APK install & file upload** - Via toolbar buttons
- **Hardware-accelerated decoding** - WebCodecs API for smooth playback
- **iOS support (experimental)** - Mirror iOS devices on macOS via CoreMediaIO

### Advanced Features

| Feature                                              | Description                                   |
| ---------------------------------------------------- | --------------------------------------------- |
| [Camera Mirroring](docs/feature-camera-mirroring.md) | Mirror front/back camera instead of screen    |
| [Screen Recording](docs/feature-screen-recording.md) | Record to WebM or MP4                         |
| [Virtual Display](docs/feature-virtual-display.md)   | Separate virtual display instead of mirroring |
| [Multiple Display](docs/feature-multiple-display.md) | Select which physical display to mirror       |
| [H.265/AV1 Codec](docs/feature-h265-av1.md)          | Better quality/compression codecs             |
| [App Launcher](docs/feature-app-launcher.md)         | Launch apps by package name                   |
| [UHID Keyboard](docs/feature-uhid-keyboard.md)       | Hardware keyboard simulation                  |
| [Audio Sources](docs/feature-audio-source.md)        | Device output, mic, or playback capture       |
| [Device Info](docs/feature-device-info.md)           | Model, Android version, battery, storage      |
| [Enhanced Stats](docs/feature-enhanced-stats.md)     | FPS, bitrate, frame drops                     |

## Prerequisites

### 1. Install ADB and scrcpy

| Platform | Command                                                   |
| -------- | --------------------------------------------------------- |
| macOS    | `brew install scrcpy android-platform-tools`              |
| Linux    | `sudo apt install scrcpy adb`                             |
| Windows  | `winget install --exact Genymobile.scrcpy` (includes ADB) |

### 2. Enable USB Debugging

1. Enable Developer Options: **Settings > About Phone > Tap "Build number" 7 times**
2. Enable USB Debugging: **Settings > Developer Options > USB Debugging**

## Usage

1. Connect your Android device via USB
2. Verify with `adb devices`
3. Click the **scrcpy** icon in the Activity Bar
4. **Tip**: Drag the view to the Secondary Sidebar (right side)

### Multi-Device

- **+** button to add devices
- Click tabs to switch (only active tab streams)
- **×** to disconnect

### WiFi Connection

**Android 11+**: Settings > Developer Options > Wireless debugging > Pair device with pairing code

**Legacy**: `adb tcpip 5555`, then connect via IP

### iOS Devices (Experimental, macOS only)

iOS device mirroring is available as an experimental feature on macOS.

#### Quick Start

1. Enable iOS support: **Settings > scrcpy > iOS: Enabled** (check the box)
2. Connect your iOS device via USB
3. Trust the computer on your iOS device if prompted
4. The device should appear in the device list with an Apple icon

> **Note:** iOS mirroring is display-only by default. For touch and keyboard input, see the optional WebDriverAgent setup below.

#### Optional: Enable Touch Input with WebDriverAgent

To control your iOS device (tap, swipe, type), you need to set up [WebDriverAgent](https://github.com/appium/WebDriverAgent):

1. **Install prerequisites:**

   ```bash
   brew install libimobiledevice
   ```

2. **Clone and build WebDriverAgent:**

   ```bash
   git clone https://github.com/appium/WebDriverAgent.git
   cd WebDriverAgent
   open WebDriverAgent.xcodeproj
   ```

3. **Configure in Xcode:**
   - Select `WebDriverAgentRunner` target
   - Enable automatic signing with your Apple Developer team
   - Connect your iOS device and press ⌘+U to build and run

4. **Start the USB tunnel (keep this running):**

   ```bash
   iproxy 8100 8100 -u <your-device-UDID>
   ```

5. **Enable in VS Code:**
   - Settings > scrcpy > iOS: Web Driver Agent Enabled (check the box)

For detailed instructions and troubleshooting, see [iOS Input Control Guide](docs/ios-input-control-research.md).

## Commands

| Command                               | Description                 |
| ------------------------------------- | --------------------------- |
| `Scrcpy: Start Device Mirroring`      | Focus view and connect      |
| `Scrcpy: Stop Device Mirroring`       | Disconnect                  |
| `Scrcpy: Connect to Device over WiFi` | Wireless connection         |
| `Scrcpy: Install APK`                 | Install APK on device       |
| `Scrcpy: Upload Files to Device`      | Upload to /sdcard/Download/ |

## Settings

Access via the **gear icon** in the scrcpy view toolbar.

| Setting                | Default | Description                  |
| ---------------------- | ------- | ---------------------------- |
| `scrcpy.path`          | (empty) | Path to scrcpy directory     |
| `scrcpy.adbPath`       | (empty) | Path to ADB directory        |
| `scrcpy.maxSize`       | `1920`  | Max screen dimension (px)    |
| `scrcpy.bitRate`       | `8`     | Video bitrate (Mbps)         |
| `scrcpy.maxFps`        | `60`    | Max FPS                      |
| `scrcpy.audio`         | `true`  | Enable audio streaming       |
| `scrcpy.screenOff`     | `false` | Turn device screen off       |
| `scrcpy.autoConnect`   | `true`  | Auto-connect on plug in      |
| `scrcpy.autoReconnect` | `true`  | Auto-reconnect on disconnect |

See all settings in VS Code: `Preferences: Open Settings` > search "scrcpy"

## Troubleshooting

See [Troubleshooting Guide](docs/troubleshooting.md) for common issues.

## Requirements

### Android

- VS Code 1.85.0+
- ADB installed
- scrcpy installed

### iOS (experimental)

- macOS only
- iOS device connected via USB
- Optional: WebDriverAgent + iproxy for touch input

## License

[Apache-2.0](LICENSE)

## Credits

- [scrcpy](https://github.com/Genymobile/scrcpy) by Genymobile
