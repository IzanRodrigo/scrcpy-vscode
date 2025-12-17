import AVFoundation
import CoreMediaIO

/// Device information structure
struct IOSDeviceInfo: Codable {
    let udid: String
    let name: String
    let model: String
}

/// Manages iOS device discovery via CoreMediaIO/AVFoundation
class DeviceEnumerator {

    /// Enable CoreMediaIO screen capture devices
    /// This is required before iOS devices appear as AVCaptureDevice
    static func enableScreenCaptureDevices() {
        var property = CMIOObjectPropertyAddress(
            mSelector: CMIOObjectPropertySelector(kCMIOHardwarePropertyAllowScreenCaptureDevices),
            mScope: CMIOObjectPropertyScope(kCMIOObjectPropertyScopeGlobal),
            mElement: CMIOObjectPropertyElement(kCMIOObjectPropertyElementMain)
        )

        var allow: UInt32 = 1
        let dataSize = UInt32(MemoryLayout<UInt32>.size)

        CMIOObjectSetPropertyData(
            CMIOObjectID(kCMIOObjectSystemObject),
            &property,
            0,
            nil,
            dataSize,
            &allow
        )
    }

    /// Get list of connected iOS devices
    static func getIOSDevices() -> [IOSDeviceInfo] {
        enableScreenCaptureDevices()

        // Small delay to allow devices to appear
        Thread.sleep(forTimeInterval: 0.5)

        var devices: [IOSDeviceInfo] = []

        // Get all video capture devices
        let discoverySession = AVCaptureDevice.DiscoverySession(
            deviceTypes: [.external],
            mediaType: .video,
            position: .unspecified
        )

        for device in discoverySession.devices {
            // iOS devices appear as external devices with specific characteristics
            // They typically have "iPhone" or "iPad" in their name
            let name = device.localizedName

            // Filter for iOS devices (they appear as external video devices)
            // We check if the device supports muxed media type (video + audio)
            // which is a characteristic of iOS screen capture
            if device.hasMediaType(.video) {
                // Use the uniqueID as UDID (CoreMediaIO provides this)
                let udid = device.uniqueID

                // Try to determine model from name
                let model: String
                if name.lowercased().contains("iphone") {
                    model = "iPhone"
                } else if name.lowercased().contains("ipad") {
                    model = "iPad"
                } else if name.lowercased().contains("ipod") {
                    model = "iPod"
                } else {
                    // Skip non-iOS devices (webcams, etc.)
                    // iOS devices via CoreMediaIO typically have specific identifiers
                    // For now, we'll be permissive and include external devices
                    // that might be iOS devices
                    if !isLikelyIOSDevice(device) {
                        continue
                    }
                    model = "iOS Device"
                }

                devices.append(IOSDeviceInfo(
                    udid: udid,
                    name: name,
                    model: model
                ))
            }
        }

        return devices
    }

    /// Check if a device is likely an iOS device based on its properties
    private static func isLikelyIOSDevice(_ device: AVCaptureDevice) -> Bool {
        // iOS devices connected via USB appear as external devices
        // and typically support specific formats

        // Check if device supports formats typical of iOS screen capture
        let formats = device.formats
        for format in formats {
            let dimensions = CMVideoFormatDescriptionGetDimensions(format.formatDescription)
            // iOS devices typically have screen resolutions
            // Common iOS resolutions: 1920x1080, 2532x1170, 2778x1284, etc.
            if dimensions.width >= 1080 && dimensions.height >= 1920 {
                return true
            }
            if dimensions.width >= 1920 && dimensions.height >= 1080 {
                return true
            }
        }

        // Also check the manufacturer/model info if available
        let uniqueID = device.uniqueID.lowercased()
        if uniqueID.contains("apple") || uniqueID.contains("iphone") || uniqueID.contains("ipad") {
            return true
        }

        // Be permissive for external devices
        return device.deviceType == .external
    }

    /// Find a specific device by UDID
    static func findDevice(udid: String) -> AVCaptureDevice? {
        enableScreenCaptureDevices()

        // Small delay to allow devices to appear
        Thread.sleep(forTimeInterval: 0.3)

        let discoverySession = AVCaptureDevice.DiscoverySession(
            deviceTypes: [.external],
            mediaType: .video,
            position: .unspecified
        )

        return discoverySession.devices.first { $0.uniqueID == udid }
    }
}
