# iOS Input Control Research

## Executive Summary

**Goal:** Research how to control iOS devices using mouse/trackpad input from the scrcpy-vscode extension.

**Finding:** There is **no simple, non-jailbreak solution** for injecting touch input into iOS devices. Unlike Android (which uses scrcpy's control socket), iOS has strict security limitations that prevent external touch/keyboard injection without either:

1. A jailbroken device with specialized tweaks
2. WebDriverAgent (requires Apple Developer account and device signing)
3. A companion iOS app on the device

**Current State:** Phase 8 has implemented **optional WebDriverAgent integration** for iOS input control. When WDA is available and enabled, users can interact with iOS devices using touch, scroll, and keyboard input. Without WDA, the extension operates in display-only mode.

## Research Summary

### 1. Why Android Works But iOS Doesn't

| Aspect              | Android (scrcpy)                      | iOS                               |
| ------------------- | ------------------------------------- | --------------------------------- |
| **Touch Injection** | ADB shell `input` command             | Not possible without jailbreak    |
| **Protocol**        | Binary control messages via socket    | No standardized control protocol  |
| **Control Method**  | Server app has system privileges      | No server-side component possible |
| **Security Model**  | Developer Mode + ADB allows injection | Sandboxed, no cross-app input     |

Android's scrcpy server runs as a privileged process via `app_process` and can inject touch events system-wide. iOS's security model doesn't allow any app or process to inject input events into other apps.

### 2. Available Tools & Their Limitations

#### libimobiledevice

- **Status:** Cannot send touch/key input to iOS devices
- **Evidence:** [GitHub Issue #385](https://github.com/libimobiledevice/libimobiledevice/issues/385) - open since 2016, no solution
- **Capabilities:** File transfer, app management, device info - but NO input control

#### pymobiledevice3

- **Status:** No touch/input injection support
- **Capabilities:**
  - Location simulation (`dvt simulate-location`)
  - Screenshots
  - Process management
  - Device information
- **Missing:** Touch, tap, swipe, keyboard input injection
- **Reference:** [pymobiledevice3 GitHub](https://github.com/doronz88/pymobiledevice3)

#### Facebook IDB (iOS Development Bridge)

- **Status:** Touch/tap/swipe commands **only work on Simulators**
- **Real Device Error:** "Target doesn't conform to FBSimulatorLifecycleCommands protocol"
- **Evidence:** [GitHub Issue #836](https://github.com/facebook/idb/issues/836)
- **Reference:** [IDB Documentation](https://fbidb.io/docs/accessibility/)

### 3. Potential Solutions (Each With Significant Trade-offs)

#### Option A: WebDriverAgent (Most Viable for Non-Jailbreak)

**How it works:**

- [WebDriverAgent](https://github.com/appium/WebDriverAgent) runs as an XCTest bundle on the iOS device
- Listens on port 8100 for WebDriver commands
- Can inject touch, tap, swipe, and keyboard events
- Uses Apple's XCUITest framework under the hood

**Requirements:**

- macOS host with Xcode installed
- Apple Developer account (free or paid)
- Device must be signed for development
- WDA must be built and deployed to device
- Device stays in "testing mode" with UI visible

**Pros:**

- Works on non-jailbroken devices
- Comprehensive touch/keyboard support
- Already used by Appium for iOS testing

**Cons:**

- Complex setup (code signing, provisioning)
- [Only supports iOS 16-18 and iPhone 14 series and below](https://appium.github.io/appium-xcuitest-driver/4.16/wda-custom-server/) (hardware security limitations on newer models)
- "Automation Running" banner shown on device
- Requires rebuilding WDA periodically (when certificate expires)
- Heavy dependency (Xcode, WebDriverAgent project)

**Implementation Approach:**

```
scrcpy-vscode (Extension)
    ↓ HTTP/WebDriver commands
WebDriverAgent (on iOS device, port 8100)
    ↓ XCUITest framework
iOS UI
```

#### Option B: Companion iOS App

**How it works:**

- Custom iOS app installed on device
- Receives touch coordinates via local network
- Uses iOS accessibility/automation APIs within app sandbox

**Limitations:**

- Can only control elements within its own app
- Cannot inject system-wide touch events
- App Store distribution requires review
- TestFlight has user limits

**Not viable** for general device control.

#### Option C: Bluetooth HID Emulation

**How it works:**

- Use external hardware (ESP32, Adafruit Bluefruit) as Bluetooth keyboard/mouse
- Host computer sends commands to hardware, which acts as HID device
- iOS pairs with it as a regular Bluetooth accessory

**Reference:** [ESP32 Mouse/Keyboard](https://github.com/asterics/esp32_mouse_keyboard)

**Limitations:**

- Requires external hardware
- Only keyboard/mouse HID input (no multi-touch gestures)
- iOS cannot natively act as HID device ([Apple blocks HID service UUIDs](https://developer.apple.com/forums/thread/725238))

**Not practical** for a VS Code extension.

#### Option D: Jailbreak + zxtouch

**How it works:**

- [zxtouch](https://zxtouch.net/) is a jailbreak tweak for touch simulation
- Listens on port 6000 for touch commands
- Combined with screen mirroring (UxPlay), enables full remote control

**Reference:** [Remote control for iOS from Linux](https://f-viktor.github.io/articles/scrgto.html)

**Limitations:**

- Requires jailbroken device
- Security risk
- Not available for latest iOS versions
- Not acceptable for most users

### 4. Comparison Matrix

| Solution         | Non-Jailbreak | Touch  | Keyboard | Multi-Touch | Setup Complexity | Device Compatibility  |
| ---------------- | ------------- | ------ | -------- | ----------- | ---------------- | --------------------- |
| WebDriverAgent   | ✅            | ✅     | ✅       | ✅          | High             | iOS 16-18, iPhone ≤14 |
| Companion App    | ✅            | ❌\*   | ❌\*     | ❌\*        | Medium           | All iOS               |
| Bluetooth HID    | ✅            | ❌     | ✅       | ❌          | High (hardware)  | All iOS               |
| zxtouch (JB)     | ❌            | ✅     | ✅       | ✅          | Medium           | JB iOS only           |
| libimobiledevice | ✅            | ❌     | ❌       | ❌          | N/A              | N/A                   |
| pymobiledevice3  | ✅            | ❌     | ❌       | ❌          | N/A              | N/A                   |
| IDB              | ✅            | ❌\*\* | ❌\*\*   | ❌\*\*      | N/A              | Simulators only       |

\*Only within app sandbox
\*\*Simulators only, not real devices

## Implementation Status

### Phase 8: WebDriverAgent Integration (Completed)

Phase 8 implemented **optional WebDriverAgent support** with the following architecture:

```
Canvas (WebView)
    ↓ pointer events
InputHandler (normalized 0-1 coords)
    ↓ postMessage
ScrcpyViewProvider
    ↓
DeviceService.sendTouch()
    ↓ (capability check)
iOSConnection.sendTouch()
    ↓ HTTP via WDAClient
iproxy:8100 → USB → WebDriverAgent (device)
```

**Features implemented:**

- Touch input (tap and swipe gestures)
- Scroll/swipe via WDA touch chains
- Text input via WDA keyboard API
- Home/volume button presses
- Dynamic capability updates based on WDA availability
- Status feedback in device tooltip

**Settings added:**

- `scrcpy.ios.webDriverAgentEnabled`: Enable/disable WDA (default: false)
- `scrcpy.ios.webDriverAgentPort`: WDA port (default: 8100)

### Future Considerations

Monitor developments in:

- [pymobiledevice3](https://github.com/doronz88/pymobiledevice3) for new input capabilities
- Apple's evolving developer tools
- Alternative approaches from the iOS automation community

## Setup Guide: WebDriverAgent

### Prerequisites

1. **macOS** with Xcode installed
2. **Apple Developer Account** (free account works for personal devices)
3. **iproxy** tool: `brew install libimobiledevice`
4. **WebDriverAgent** built and deployed to device

### Step 1: Install WebDriverAgent

1. Clone WebDriverAgent:

   ```bash
   git clone https://github.com/appium/WebDriverAgent.git
   cd WebDriverAgent
   ```

2. Open in Xcode:

   ```bash
   open WebDriverAgent.xcodeproj
   ```

3. Configure signing:
   - Select the `WebDriverAgentRunner` target
   - In "Signing & Capabilities", enable automatic signing
   - Select your Apple Developer team
   - Change the Bundle Identifier if needed (e.g., add your name)

4. Build and run on your iOS device:
   - Connect your iOS device via USB
   - Select your device as the target
   - Press ⌘+U to build and test (or Product → Test)
   - First run may require trust: Settings → General → Device Management → Trust

### Step 2: Verify WDA is Running

After WDA starts, verify it's accessible:

```bash
# Start iproxy in a terminal (keep it running)
iproxy 8100 8100 -u <your-device-UDID>

# In another terminal, test the connection
curl http://localhost:8100/status
```

You should see a JSON response with `"ready": true`.

### Step 3: Enable in scrcpy-vscode

1. Open VS Code Settings (⌘+,)
2. Search for "scrcpy ios"
3. Enable "WebDriver Agent Enabled"
4. (Optional) Change the port if not using 8100

### Troubleshooting

**"WDA: iproxy not found"**

- Install libimobiledevice: `brew install libimobiledevice`

**"WDA: Connection failed, input disabled"**

- Ensure WDA is running on the device (keep Xcode test running)
- Ensure iproxy is running: `iproxy 8100 8100 -u <UDID>`
- Check device trust: Settings → General → Device Management

**"WDA: Input unavailable"**

- WDA started but returned `ready: false`
- Try restarting WDA from Xcode (⌘+U)

**Input works but device shows "Automation Running" banner**

- This is normal WDA behavior
- The banner is required by Apple's XCUITest framework

### Limitations

- **iOS version:** Best support for iOS 16-18
- **Device models:** iPhone 14 series and earlier (hardware security limitations on newer models)
- **Certificate expiry:** Free developer accounts require rebuilding WDA every 7 days
- **Automation banner:** Cannot be hidden (Apple requirement)

## Implementation Details (If WebDriverAgent Route Chosen)

### Architecture

```
WebView (Canvas)
    ↓ (pointer events via InputHandler)
Extension (ScrcpyViewProvider)
    ↓ (HTTP request)
iOSConnection.sendTouch()
    ↓ (HTTP POST to device IP:8100)
WebDriverAgent
    ↓ (XCUITest)
iOS Device UI
```

### WebDriver Touch Commands

```typescript
// Tap at coordinates
async sendTouch(x: number, y: number, action: TouchAction): Promise<void> {
  if (action === 'down') {
    await fetch(`http://${this.deviceIp}:8100/session/${sessionId}/wda/touch/perform`, {
      method: 'POST',
      body: JSON.stringify({
        actions: [{
          action: 'tap',
          options: { x, y }
        }]
      })
    });
  }
}
```

### Required Changes

1. **iOSConnection.ts:** Add WDA HTTP client
2. **Settings:** Add `scrcpy.ios.webDriverAgentHost` setting
3. **PlatformCapabilities.ts:** Conditionally enable touch if WDA detected
4. **Documentation:** Setup guide for WDA

## Conclusion

iOS input control is fundamentally harder than Android due to Apple's security model. The most viable non-jailbreak option is **WebDriverAgent**, but it comes with significant setup complexity and device/iOS version limitations.

For now, **display-only iOS support is the pragmatic choice**. Users who need full control should continue using their Android devices via scrcpy, which provides a seamless experience.

## References

- [scrcpy iOS support discussion](https://github.com/Genymobile/scrcpy/issues/1691)
- [libimobiledevice - no touch support](https://github.com/libimobiledevice/libimobiledevice/issues/385)
- [IDB real device limitations](https://github.com/facebook/idb/issues/836)
- [WebDriverAgent](https://github.com/appium/WebDriverAgent)
- [Appium XCUITest Driver](https://github.com/appium/appium-xcuitest-driver)
- [pymobiledevice3](https://github.com/doronz88/pymobiledevice3)
- [zxtouch (jailbreak)](https://f-viktor.github.io/articles/scrgto.html)
- [iOS Bluetooth HID limitations](https://developer.apple.com/forums/thread/725238)
