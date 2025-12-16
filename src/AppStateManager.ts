/**
 * Centralized Application State Manager
 *
 * This class is the single source of truth for all application state.
 * Components subscribe to state changes and receive complete snapshots.
 */

import {
  AppState,
  AppStateSnapshot,
  DeviceState,
  DeviceDetailedInfo,
  ToolStatus,
  WebviewSettings,
  StatusMessage,
  ConnectionState,
  VideoCodec,
} from './types/AppState';

/**
 * Listener function type for state changes
 */
export type StateListener = (snapshot: AppStateSnapshot) => void;

/**
 * Unsubscribe function type
 */
export type Unsubscribe = () => void;

/**
 * Centralized state manager for the application
 */
export class AppStateManager {
  private state: AppState;
  private listeners = new Set<StateListener>();
  private notifyScheduled = false;

  constructor() {
    this.state = {
      devices: new Map(),
      activeDeviceId: null,
      settings: {
        showStats: false,
        showExtendedStats: false,
        audioEnabled: true,
      },
      toolStatus: {
        adbAvailable: true,
        scrcpyAvailable: true,
      },
      statusMessage: undefined,
      deviceInfo: new Map(),
      isMonitoring: false,
    };
  }

  /**
   * Get a serializable snapshot of the current state
   * (Converts Maps to arrays/records for postMessage)
   */
  getSnapshot(): AppStateSnapshot {
    return {
      devices: Array.from(this.state.devices.values()),
      activeDeviceId: this.state.activeDeviceId,
      settings: { ...this.state.settings },
      toolStatus: { ...this.state.toolStatus },
      statusMessage: this.state.statusMessage ? { ...this.state.statusMessage } : undefined,
      deviceInfo: Object.fromEntries(this.state.deviceInfo),
    };
  }

  /**
   * Get the raw state (for internal use by DeviceService)
   */
  getRawState(): Readonly<AppState> {
    return this.state;
  }

  /**
   * Subscribe to state changes
   * @returns Unsubscribe function
   */
  subscribe(listener: StateListener): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of state change
   * Uses microtask scheduling to batch multiple mutations
   */
  private notifyListeners(): void {
    if (this.notifyScheduled) {
      return;
    }
    this.notifyScheduled = true;

    queueMicrotask(() => {
      this.notifyScheduled = false;
      const snapshot = this.getSnapshot();
      this.listeners.forEach((listener) => {
        try {
          listener(snapshot);
        } catch (error) {
          console.error('Error in state listener:', error);
        }
      });
    });
  }

  // ==================== Device State Mutations ====================

  /**
   * Add a new device
   */
  addDevice(device: DeviceState): void {
    this.state.devices.set(device.deviceId, { ...device });
    this.notifyListeners();
  }

  /**
   * Remove a device
   */
  removeDevice(deviceId: string): void {
    const device = this.state.devices.get(deviceId);
    const existed = this.state.devices.delete(deviceId);
    if (existed) {
      // Clear cached device info for the removed device
      if (device) {
        this.state.deviceInfo.delete(device.serial);
      }

      // Clear active device if it was the removed one
      if (this.state.activeDeviceId === deviceId) {
        this.state.activeDeviceId = null;
      }
      this.notifyListeners();
    }
  }

  /**
   * Get a device by ID
   */
  getDevice(deviceId: string): DeviceState | undefined {
    return this.state.devices.get(deviceId);
  }

  /**
   * Check if a device exists
   */
  hasDevice(deviceId: string): boolean {
    return this.state.devices.has(deviceId);
  }

  /**
   * Get device by serial
   */
  getDeviceBySerial(serial: string): DeviceState | undefined {
    for (const device of this.state.devices.values()) {
      if (device.serial === serial) {
        return device;
      }
    }
    return undefined;
  }

  /**
   * Get all device IDs
   */
  getDeviceIds(): string[] {
    return Array.from(this.state.devices.keys());
  }

  /**
   * Get device count
   */
  getDeviceCount(): number {
    return this.state.devices.size;
  }

  /**
   * Update a device's state
   */
  updateDevice(deviceId: string, updates: Partial<DeviceState>): void {
    const device = this.state.devices.get(deviceId);
    if (device) {
      this.state.devices.set(deviceId, { ...device, ...updates });
      this.notifyListeners();
    }
  }

  /**
   * Update device connection state
   */
  updateDeviceConnectionState(deviceId: string, connectionState: ConnectionState): void {
    this.updateDevice(deviceId, { connectionState });
  }

  /**
   * Update device video dimensions
   */
  updateDeviceVideoDimensions(
    deviceId: string,
    width: number,
    height: number,
    codec?: VideoCodec
  ): void {
    const updates: Partial<DeviceState> = {
      videoDimensions: { width, height },
    };
    if (codec) {
      updates.videoCodec = codec;
    }
    this.updateDevice(deviceId, updates);
  }

  // ==================== Active Device ====================

  /**
   * Set the active device
   */
  setActiveDevice(deviceId: string | null): void {
    if (this.state.activeDeviceId === deviceId) {
      return;
    }

    // Update isActive flags on all devices
    for (const [id, device] of this.state.devices) {
      const isActive = id === deviceId;
      if (device.isActive !== isActive) {
        this.state.devices.set(id, { ...device, isActive });
      }
    }

    this.state.activeDeviceId = deviceId;
    this.notifyListeners();
  }

  /**
   * Get the active device ID
   */
  getActiveDeviceId(): string | null {
    return this.state.activeDeviceId;
  }

  /**
   * Get the active device state
   */
  getActiveDevice(): DeviceState | undefined {
    if (!this.state.activeDeviceId) {
      return undefined;
    }
    return this.state.devices.get(this.state.activeDeviceId);
  }

  // ==================== Settings ====================

  /**
   * Update settings
   */
  updateSettings(settings: Partial<WebviewSettings>): void {
    this.state.settings = { ...this.state.settings, ...settings };
    this.notifyListeners();
  }

  /**
   * Get current settings
   */
  getSettings(): WebviewSettings {
    return { ...this.state.settings };
  }

  // ==================== Tool Status ====================

  /**
   * Update tool status
   */
  updateToolStatus(toolStatus: ToolStatus): void {
    this.state.toolStatus = { ...toolStatus };
    this.notifyListeners();
  }

  /**
   * Get tool status
   */
  getToolStatus(): ToolStatus {
    return { ...this.state.toolStatus };
  }

  // ==================== Status Message ====================

  /**
   * Set status message
   */
  setStatusMessage(message: StatusMessage | undefined): void {
    this.state.statusMessage = message ? { ...message } : undefined;
    this.notifyListeners();
  }

  /**
   * Clear status message
   */
  clearStatusMessage(): void {
    if (this.state.statusMessage) {
      this.state.statusMessage = undefined;
      this.notifyListeners();
    }
  }

  /**
   * Get status message
   */
  getStatusMessage(): StatusMessage | undefined {
    return this.state.statusMessage ? { ...this.state.statusMessage } : undefined;
  }

  // ==================== Device Info ====================

  /**
   * Set device detailed info
   */
  setDeviceInfo(serial: string, info: DeviceDetailedInfo): void {
    this.state.deviceInfo.set(serial, { ...info });
    this.notifyListeners();
  }

  /**
   * Get device detailed info
   */
  getDeviceInfo(serial: string): DeviceDetailedInfo | undefined {
    return this.state.deviceInfo.get(serial);
  }

  /**
   * Remove device detailed info
   */
  removeDeviceInfo(serial: string): void {
    if (this.state.deviceInfo.delete(serial)) {
      this.notifyListeners();
    }
  }

  /**
   * Clear all device info
   */
  clearDeviceInfo(): void {
    if (this.state.deviceInfo.size > 0) {
      this.state.deviceInfo.clear();
      this.notifyListeners();
    }
  }

  // ==================== Monitoring State ====================

  /**
   * Set monitoring state
   */
  setMonitoring(isMonitoring: boolean): void {
    if (this.state.isMonitoring !== isMonitoring) {
      this.state.isMonitoring = isMonitoring;
      // Note: monitoring state is not sent to webview, only used internally
    }
  }

  /**
   * Get monitoring state
   */
  isMonitoring(): boolean {
    return this.state.isMonitoring;
  }

  // ==================== Bulk Operations ====================

  /**
   * Clear all devices
   */
  clearAllDevices(): void {
    const hadDevices = this.state.devices.size > 0;
    const hadActiveDevice = this.state.activeDeviceId !== null;
    const hadDeviceInfo = this.state.deviceInfo.size > 0;

    if (hadDevices || hadActiveDevice || hadDeviceInfo) {
      this.state.devices.clear();
      this.state.activeDeviceId = null;
      this.state.deviceInfo.clear();
      this.notifyListeners();
    }
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.state.devices.clear();
    this.state.activeDeviceId = null;
    this.state.statusMessage = undefined;
    this.state.deviceInfo.clear();
    this.state.isMonitoring = false;
    this.notifyListeners();
  }
}
