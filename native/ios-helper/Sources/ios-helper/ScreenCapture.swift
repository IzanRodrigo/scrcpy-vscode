import AVFoundation
import CoreMedia
import CoreVideo

/// Delegate protocol for receiving video frames
protocol ScreenCaptureDelegate: AnyObject {
    func screenCapture(_ capture: ScreenCapture, didOutputVideoFrame frame: CMSampleBuffer)
    func screenCapture(_ capture: ScreenCapture, didReceiveError error: Error)
    func screenCapture(_ capture: ScreenCapture, didStart width: Int, height: Int)
}

/// Manages screen capture from iOS devices via AVCaptureSession
class ScreenCapture: NSObject {

    weak var delegate: ScreenCaptureDelegate?

    private var captureSession: AVCaptureSession?
    private var videoOutput: AVCaptureVideoDataOutput?
    private var device: AVCaptureDevice
    private let sessionQueue = DispatchQueue(label: "com.scrcpy.ios-helper.session")

    private var videoWidth: Int = 0
    private var videoHeight: Int = 0
    private var hasStarted = false

    init(device: AVCaptureDevice) {
        self.device = device
        super.init()
    }

    /// Start capturing video from the device
    func start() throws {
        let session = AVCaptureSession()
        self.captureSession = session

        // Configure session for high quality
        session.beginConfiguration()

        // Add video input
        let videoInput = try AVCaptureDeviceInput(device: device)
        guard session.canAddInput(videoInput) else {
            throw ScreenCaptureError.cannotAddInput
        }
        session.addInput(videoInput)

        // Add video output
        let videoOutput = AVCaptureVideoDataOutput()
        videoOutput.videoSettings = [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
        ]
        videoOutput.alwaysDiscardsLateVideoFrames = true
        videoOutput.setSampleBufferDelegate(self, queue: sessionQueue)

        guard session.canAddOutput(videoOutput) else {
            throw ScreenCaptureError.cannotAddOutput
        }
        session.addOutput(videoOutput)
        self.videoOutput = videoOutput

        // Configure format to get highest resolution
        try configureFormat()

        session.commitConfiguration()

        // Start the session
        sessionQueue.async {
            session.startRunning()
        }
    }

    /// Stop capturing
    func stop() {
        sessionQueue.async { [weak self] in
            self?.captureSession?.stopRunning()
            self?.captureSession = nil
        }
    }

    /// Configure the capture format for best quality
    private func configureFormat() throws {
        // Find the best format (highest resolution)
        var bestFormat: AVCaptureDevice.Format?
        var bestWidth: Int32 = 0

        for format in device.formats {
            let dimensions = CMVideoFormatDescriptionGetDimensions(format.formatDescription)
            if dimensions.width > bestWidth {
                bestWidth = dimensions.width
                bestFormat = format
            }
        }

        guard let format = bestFormat else {
            throw ScreenCaptureError.noSuitableFormat
        }

        try device.lockForConfiguration()
        device.activeFormat = format
        device.unlockForConfiguration()

        let dimensions = CMVideoFormatDescriptionGetDimensions(format.formatDescription)
        self.videoWidth = Int(dimensions.width)
        self.videoHeight = Int(dimensions.height)
    }
}

// MARK: - AVCaptureVideoDataOutputSampleBufferDelegate
extension ScreenCapture: AVCaptureVideoDataOutputSampleBufferDelegate {

    func captureOutput(
        _ output: AVCaptureOutput,
        didOutput sampleBuffer: CMSampleBuffer,
        from connection: AVCaptureConnection
    ) {
        // Notify delegate that we've started (with dimensions)
        if !hasStarted {
            hasStarted = true
            if let formatDescription = CMSampleBufferGetFormatDescription(sampleBuffer) {
                let dimensions = CMVideoFormatDescriptionGetDimensions(formatDescription)
                videoWidth = Int(dimensions.width)
                videoHeight = Int(dimensions.height)
            }
            delegate?.screenCapture(self, didStart: videoWidth, height: videoHeight)
        }

        // Forward the sample buffer to delegate
        delegate?.screenCapture(self, didOutputVideoFrame: sampleBuffer)
    }

    func captureOutput(
        _ output: AVCaptureOutput,
        didDrop sampleBuffer: CMSampleBuffer,
        from connection: AVCaptureConnection
    ) {
        // Frame dropped - could log this if needed
    }
}

// MARK: - Errors
enum ScreenCaptureError: Error, LocalizedError {
    case cannotAddInput
    case cannotAddOutput
    case noSuitableFormat

    var errorDescription: String? {
        switch self {
        case .cannotAddInput:
            return "Cannot add video input to capture session"
        case .cannotAddOutput:
            return "Cannot add video output to capture session"
        case .noSuitableFormat:
            return "No suitable video format found"
        }
    }
}
