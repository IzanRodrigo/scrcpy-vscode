import { describe, it, expect } from 'vitest';
import { AppStateManager } from '../../src/AppStateManager';
import { DeviceDetailedInfo } from '../../src/types/AppState';

describe('AppStateManager', () => {
  it('should remove deviceInfo when device is removed', () => {
    const appState = new AppStateManager();

    appState.addDevice({
      deviceId: 'device_1',
      serial: 'serial_1',
      name: 'Device 1',
      connectionState: 'connected',
      isActive: true,
    });

    const info: DeviceDetailedInfo = {
      serial: 'serial_1',
      model: 'Pixel',
      manufacturer: 'Google',
      androidVersion: '14',
      sdkVersion: 34,
      batteryLevel: 50,
      batteryCharging: false,
      storageTotal: 1024,
      storageUsed: 256,
      screenResolution: '1080x2400',
      ipAddress: '192.168.1.100',
    };

    appState.setDeviceInfo('serial_1', info);
    expect(appState.getDeviceInfo('serial_1')).toBeDefined();

    appState.removeDevice('device_1');

    expect(appState.getDeviceCount()).toBe(0);
    expect(appState.getDeviceInfo('serial_1')).toBeUndefined();
    expect(appState.getSnapshot().deviceInfo).toEqual({});
  });

  it('should clear deviceInfo when clearing all devices', () => {
    const appState = new AppStateManager();

    appState.addDevice({
      deviceId: 'device_1',
      serial: 'serial_1',
      name: 'Device 1',
      connectionState: 'connected',
      isActive: false,
    });

    appState.addDevice({
      deviceId: 'device_2',
      serial: 'serial_2',
      name: 'Device 2',
      connectionState: 'connected',
      isActive: true,
    });

    appState.setActiveDevice('device_2');

    appState.setDeviceInfo('serial_1', {
      serial: 'serial_1',
      model: 'Model 1',
      manufacturer: 'Manufacturer 1',
      androidVersion: '13',
      sdkVersion: 33,
      batteryLevel: 25,
      batteryCharging: false,
      storageTotal: 2048,
      storageUsed: 1024,
      screenResolution: '1080x2400',
    });

    appState.setDeviceInfo('serial_2', {
      serial: 'serial_2',
      model: 'Model 2',
      manufacturer: 'Manufacturer 2',
      androidVersion: '14',
      sdkVersion: 34,
      batteryLevel: 75,
      batteryCharging: true,
      storageTotal: 4096,
      storageUsed: 512,
      screenResolution: '1440x3200',
    });

    expect(Object.keys(appState.getSnapshot().deviceInfo)).toHaveLength(2);

    appState.clearAllDevices();

    expect(appState.getDeviceCount()).toBe(0);
    expect(appState.getActiveDeviceId()).toBeNull();
    expect(appState.getSnapshot().deviceInfo).toEqual({});
  });
});
