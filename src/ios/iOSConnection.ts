/**
 * iOS device connection via CoreMediaIO/AVFoundation
 * macOS only - uses Swift CLI helper to capture screen
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import {
  IDeviceConnection,
  DeviceInfo,
  VideoFrameCallback,
  AudioFrameCallback,
  StatusCallback,
  ErrorCallback,
  StreamConfig,
  VideoCodecType,
} from '../IDeviceConnection';
import { DevicePlatform, IOS_CAPABILITIES, PlatformCapabilities } from '../PlatformCapabilities';

/**
 * Message types from the iOS helper binary protocol
 */
enum MessageType {
  DEVICE_LIST = 0x01,
  DEVICE_INFO = 0x02,
  VIDEO_CONFIG = 0x03,
  VIDEO_FRAME = 0x04,
  ERROR = 0x05,
  STATUS = 0x06,
}

/**
 * iOS device connection using CoreMediaIO via Swift CLI helper
 * Display-only (no touch/keyboard control)
 */
export class iOSConnection implements IDeviceConnection {
  readonly platform: DevicePlatform = 'ios';
  readonly capabilities: PlatformCapabilities = IOS_CAPABILITIES;

  private helperProcess: ChildProcess | null = null;
  private deviceSerial: string | null = null;
  private _deviceInfo: DeviceInfo | null = null;
  private _connected = false;
  private _deviceWidth = 0;
  private _deviceHeight = 0;
  private messageBuffer = Buffer.alloc(0);

  // Callbacks
  onVideoFrame?: VideoFrameCallback;
  onAudioFrame?: AudioFrameCallback;
  onStatus?: StatusCallback;
  onError?: ErrorCallback;
  onClipboardChange?: (text: string) => void;

  constructor(
    private targetUDID?: string,
    private customHelperPath?: string
  ) {}

  get connected(): boolean {
    return this._connected;
  }

  get deviceWidth(): number {
    return this._deviceWidth;
  }

  get deviceHeight(): number {
    return this._deviceHeight;
  }

  async connect(targetSerial?: string): Promise<void> {
    this.deviceSerial = targetSerial || this.targetUDID || null;

    // Validate we're on macOS
    if (process.platform !== 'darwin') {
      throw new Error('iOS support is only available on macOS');
    }

    if (!this.deviceSerial) {
      throw new Error('No device serial specified');
    }
  }

  async startStreaming(_config: StreamConfig): Promise<void> {
    if (!this.deviceSerial) {
      throw new Error('No device serial specified');
    }

    const helperPath = this.getHelperPath();

    this.onStatus?.('Starting iOS screen capture...');

    // If helper is a JS file, run with node
    const isNodeScript = helperPath.endsWith('.js');
    const command = isNodeScript ? 'node' : helperPath;
    const args = isNodeScript
      ? [helperPath, 'stream', this.deviceSerial]
      : ['stream', this.deviceSerial];

    this.helperProcess = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.helperProcess.stdout?.on('data', (chunk: Buffer) => {
      this.handleHelperData(chunk);
    });

    this.helperProcess.stderr?.on('data', (data: Buffer) => {
      const message = data.toString().trim();
      if (message) {
        console.error('[ios-helper]', message);
      }
    });

    this.helperProcess.on('error', (err) => {
      this._connected = false;
      this.onError?.(err.message);
    });

    this.helperProcess.on('close', (code) => {
      this._connected = false;
      if (code !== 0 && code !== null) {
        this.onError?.(`iOS helper exited with code ${code}`);
      }
    });

    this._connected = true;
  }

  /**
   * Parse binary protocol from helper stdout
   */
  private handleHelperData(chunk: Buffer): void {
    this.messageBuffer = Buffer.concat([this.messageBuffer, chunk]);

    // Process all complete messages in the buffer
    while (this.messageBuffer.length >= 5) {
      const type = this.messageBuffer.readUInt8(0);
      const length = this.messageBuffer.readUInt32BE(1);

      // Check if we have the complete message
      if (this.messageBuffer.length < 5 + length) {
        break; // Wait for more data
      }

      const payload = this.messageBuffer.subarray(5, 5 + length);
      this.messageBuffer = this.messageBuffer.subarray(5 + length);

      this.processMessage(type, payload);
    }
  }

  /**
   * Process a complete message from the helper
   */
  private processMessage(type: number, payload: Buffer): void {
    switch (type) {
      case MessageType.DEVICE_INFO:
        this.handleDeviceInfo(payload);
        break;
      case MessageType.VIDEO_CONFIG:
        this.handleVideoConfig(payload);
        break;
      case MessageType.VIDEO_FRAME:
        this.handleVideoFrame(payload);
        break;
      case MessageType.ERROR:
        this.onError?.(payload.toString('utf8'));
        break;
      case MessageType.STATUS:
        this.onStatus?.(payload.toString('utf8'));
        break;
    }
  }

  /**
   * Handle device info message
   */
  private handleDeviceInfo(payload: Buffer): void {
    try {
      const info = JSON.parse(payload.toString('utf8'));
      this._deviceInfo = {
        serial: info.udid,
        name: info.name,
        model: info.model,
        platform: 'ios',
      };
    } catch {
      // Ignore parse errors
    }
  }

  /**
   * Handle video config message (SPS/PPS + dimensions)
   */
  private handleVideoConfig(payload: Buffer): void {
    if (payload.length < 8) {
      return;
    }

    // Parse dimensions
    this._deviceWidth = payload.readUInt32BE(0);
    this._deviceHeight = payload.readUInt32BE(4);

    // Extract config data (SPS/PPS in Annex B format)
    const configData = new Uint8Array(payload.subarray(8));

    this.onStatus?.(`Streaming at ${this._deviceWidth}x${this._deviceHeight}`);

    // Send config to video renderer
    this.onVideoFrame?.(
      configData,
      true, // isConfig
      false, // isKeyFrame
      this._deviceWidth,
      this._deviceHeight,
      'h264' as VideoCodecType
    );
  }

  /**
   * Handle video frame message
   */
  private handleVideoFrame(payload: Buffer): void {
    if (payload.length < 9) {
      return;
    }

    // Parse flags
    const flags = payload.readUInt8(0);
    const isKeyFrame = (flags & 0x01) !== 0;
    const isConfig = (flags & 0x02) !== 0;

    // Skip PTS (8 bytes) and get frame data
    const frameData = new Uint8Array(payload.subarray(9));

    this.onVideoFrame?.(
      frameData,
      isConfig,
      isKeyFrame,
      undefined,
      undefined,
      'h264' as VideoCodecType
    );
  }

  disconnect(): void {
    this._connected = false;
    if (this.helperProcess) {
      this.helperProcess.kill();
      this.helperProcess = null;
    }
    this.messageBuffer = Buffer.alloc(0);
  }

  getDeviceSerial(): string | null {
    return this.deviceSerial;
  }

  getDeviceInfo(): DeviceInfo | null {
    return this._deviceInfo;
  }

  /**
   * Get path to the ios-helper binary
   */
  private getHelperPath(): string {
    // Allow custom helper path for testing
    if (this.customHelperPath) {
      return this.customHelperPath;
    }

    // Check environment variable for mock helper
    const envHelperPath = process.env.IOS_HELPER_PATH;
    if (envHelperPath && fs.existsSync(envHelperPath)) {
      return envHelperPath;
    }

    // In development, look for the built binary in native/ios-helper
    // In production, it's bundled alongside the extension
    const extensionPath = path.join(__dirname, '..');

    // Try production path first (bundled with extension)
    const prodPath = path.join(extensionPath, 'ios-helper');

    // Development path
    const devPath = path.join(
      extensionPath,
      '..',
      'native',
      'ios-helper',
      '.build',
      'release',
      'ios-helper'
    );

    // Check if running in development by looking for node_modules at project root
    const projectRoot = path.join(extensionPath, '..');
    const isDevMode = fs.existsSync(path.join(projectRoot, 'node_modules'));

    if (isDevMode && fs.existsSync(devPath)) {
      return devPath;
    }

    return prodPath;
  }

  // Input methods - not supported on iOS (display-only MVP)
  sendTouch?(): void {
    // Not supported
  }

  sendScroll?(): void {
    // Not supported
  }

  sendKey?(): void {
    // Not supported
  }

  injectText?(): void {
    // Not supported
  }

  rotate?(): void {
    // Not supported
  }

  pasteFromHost?(): void {
    // Not supported
  }

  copyToHost?(): void {
    // Not supported
  }

  async takeScreenshot(): Promise<Buffer | null> {
    // Could implement via helper command in the future
    return null;
  }
}
