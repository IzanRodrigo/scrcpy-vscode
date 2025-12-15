import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { exec, spawn } from 'child_process';
import { MockChildProcess, resetMocks as resetChildProcessMocks } from '../mocks/child_process';

// Mock child_process module before importing DeviceManager
vi.mock('child_process', () => import('../mocks/child_process'));

// Mock vscode module
vi.mock('vscode', () => import('../mocks/vscode'));

// Import after mocks are set up
import { DeviceManager } from '../../src/DeviceManager';
import { ScrcpyConfig } from '../../src/ScrcpyConnection';

describe('DeviceManager', () => {
  let manager: DeviceManager;
  let videoCallback: ReturnType<typeof vi.fn>;
  let audioCallback: ReturnType<typeof vi.fn>;
  let statusCallback: ReturnType<typeof vi.fn>;
  let sessionListCallback: ReturnType<typeof vi.fn>;
  let errorCallback: ReturnType<typeof vi.fn>;
  let config: ScrcpyConfig;

  beforeEach(() => {
    resetChildProcessMocks();
    vi.clearAllMocks();

    videoCallback = vi.fn();
    audioCallback = vi.fn();
    statusCallback = vi.fn();
    sessionListCallback = vi.fn();
    errorCallback = vi.fn();

    config = {
      scrcpyPath: '',
      screenOff: false,
      stayAwake: true,
      maxSize: 1920,
      bitRate: 8,
      maxFps: 60,
      showTouches: false,
      audio: false,
      clipboardSync: false,
      autoConnect: false,
      autoReconnect: false,
      reconnectRetries: 2,
      lockVideoOrientation: false,
      scrollSensitivity: 1.0,
    };

    manager = new DeviceManager(
      videoCallback,
      audioCallback,
      statusCallback,
      sessionListCallback,
      errorCallback,
      config
    );
  });

  afterEach(async () => {
    await manager.disconnectAll();
  });

  describe('getAvailableDevices', () => {
    it('should parse single device from adb devices output', async () => {
      vi.mocked(exec).mockImplementation(
        (
          _cmd: string,
          _optionsOrCallback?: unknown,
          callback?: (error: Error | null, stdout: string, stderr: string) => void
        ) => {
          const cb = typeof _optionsOrCallback === 'function' ? _optionsOrCallback : callback;
          cb?.(null, 'List of devices attached\nemulator-5554\tdevice model:Pixel_5\n', '');
          return new MockChildProcess();
        }
      );

      const devices = await manager.getAvailableDevices();

      expect(devices).toHaveLength(1);
      expect(devices[0]).toMatchObject({
        serial: 'emulator-5554',
        model: 'Pixel 5',
      });
    });

    it('should parse multiple devices from adb devices output', async () => {
      vi.mocked(exec).mockImplementation(
        (
          _cmd: string,
          _optionsOrCallback?: unknown,
          callback?: (error: Error | null, stdout: string, stderr: string) => void
        ) => {
          const cb = typeof _optionsOrCallback === 'function' ? _optionsOrCallback : callback;
          cb?.(
            null,
            'List of devices attached\n' +
              'emulator-5554\tdevice model:Pixel_5\n' +
              '192.168.1.100:5555\tdevice model:SM_G970F\n' +
              'RZXYZ12345\tdevice model:Galaxy_S21\n',
            ''
          );
          return new MockChildProcess();
        }
      );

      const devices = await manager.getAvailableDevices();

      expect(devices).toHaveLength(3);
      expect(devices[0].serial).toBe('emulator-5554');
      expect(devices[1].serial).toBe('192.168.1.100:5555');
      expect(devices[2].serial).toBe('RZXYZ12345');
    });

    it('should filter out mDNS devices', async () => {
      vi.mocked(exec).mockImplementation(
        (
          _cmd: string,
          _optionsOrCallback?: unknown,
          callback?: (error: Error | null, stdout: string, stderr: string) => void
        ) => {
          const cb = typeof _optionsOrCallback === 'function' ? _optionsOrCallback : callback;
          cb?.(
            null,
            'List of devices attached\n' +
              'emulator-5554\tdevice model:Pixel_5\n' +
              'adb-12345._adb-tls-connect._tcp\tdevice\n',
            ''
          );
          return new MockChildProcess();
        }
      );

      const devices = await manager.getAvailableDevices();

      expect(devices).toHaveLength(1);
      expect(devices[0].serial).toBe('emulator-5554');
    });

    it('should return empty array when no devices connected', async () => {
      vi.mocked(exec).mockImplementation(
        (
          _cmd: string,
          _optionsOrCallback?: unknown,
          callback?: (error: Error | null, stdout: string, stderr: string) => void
        ) => {
          const cb = typeof _optionsOrCallback === 'function' ? _optionsOrCallback : callback;
          cb?.(null, 'List of devices attached\n', '');
          return new MockChildProcess();
        }
      );

      const devices = await manager.getAvailableDevices();

      expect(devices).toHaveLength(0);
    });

    it('should return empty array when adb command fails', async () => {
      vi.mocked(exec).mockImplementation(
        (
          _cmd: string,
          _optionsOrCallback?: unknown,
          callback?: (error: Error | null, stdout: string, stderr: string) => void
        ) => {
          const cb = typeof _optionsOrCallback === 'function' ? _optionsOrCallback : callback;
          cb?.(new Error('ADB not found'), '', 'command not found: adb');
          return new MockChildProcess();
        }
      );

      const devices = await manager.getAvailableDevices();

      expect(devices).toHaveLength(0);
    });

    it('should skip offline and unauthorized devices', async () => {
      vi.mocked(exec).mockImplementation(
        (
          _cmd: string,
          _optionsOrCallback?: unknown,
          callback?: (error: Error | null, stdout: string, stderr: string) => void
        ) => {
          const cb = typeof _optionsOrCallback === 'function' ? _optionsOrCallback : callback;
          cb?.(
            null,
            'List of devices attached\n' +
              'emulator-5554\tdevice model:Pixel_5\n' +
              'offline-device\toffline\n' +
              'unauthorized-device\tunauthorized\n',
            ''
          );
          return new MockChildProcess();
        }
      );

      const devices = await manager.getAvailableDevices();

      expect(devices).toHaveLength(1);
      expect(devices[0].serial).toBe('emulator-5554');
    });

    it('should handle device without model info', async () => {
      vi.mocked(exec).mockImplementation(
        (
          _cmd: string,
          _optionsOrCallback?: unknown,
          callback?: (error: Error | null, stdout: string, stderr: string) => void
        ) => {
          const cb = typeof _optionsOrCallback === 'function' ? _optionsOrCallback : callback;
          cb?.(null, 'List of devices attached\nemulator-5554\tdevice\n', '');
          return new MockChildProcess();
        }
      );

      const devices = await manager.getAvailableDevices();

      expect(devices).toHaveLength(1);
      expect(devices[0]).toMatchObject({
        serial: 'emulator-5554',
        name: 'emulator-5554', // Falls back to serial when no model
        model: undefined,
      });
    });
  });

  describe('session management', () => {
    it('should have no active sessions initially', () => {
      const sessions = manager.getAllSessions();
      expect(sessions).toHaveLength(0);
    });

    it('should return null for active session initially', () => {
      expect(manager.getActiveSession()).toBeNull();
    });
  });

  describe('pairWifi', () => {
    it('should send pairing code when prompted', async () => {
      const mockProcess = new MockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess);

      const pairPromise = manager.pairWifi('192.168.1.100:5555', '123456');

      // Simulate ADB prompting for pairing code
      setTimeout(() => {
        mockProcess.simulateStdout('Enter pairing code: ');
      }, 10);

      // Simulate successful pairing
      setTimeout(() => {
        mockProcess.simulateStdout('Successfully paired\n');
        mockProcess.simulateClose(0);
      }, 20);

      await pairPromise;

      expect(spawn).toHaveBeenCalledWith('adb', ['pair', '192.168.1.100:5555']);
      expect(mockProcess.stdin.write).toHaveBeenCalledWith('123456\n');
    });

    it('should reject on pairing failure', async () => {
      const mockProcess = new MockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess);

      const pairPromise = manager.pairWifi('192.168.1.100:5555', 'wrong-code');

      // Simulate pairing failure
      setTimeout(() => {
        mockProcess.simulateStderr('Failed: incorrect pairing code\n');
        mockProcess.simulateClose(1);
      }, 10);

      await expect(pairPromise).rejects.toThrow();
    });
  });

  describe('connectWifi', () => {
    it('should connect to device over WiFi', async () => {
      vi.mocked(exec).mockImplementation(
        (
          cmd: string,
          _optionsOrCallback?: unknown,
          callback?: (error: Error | null, stdout: string, stderr: string) => void
        ) => {
          const cb = typeof _optionsOrCallback === 'function' ? _optionsOrCallback : callback;
          if (cmd.includes('adb connect')) {
            cb?.(null, 'connected to 192.168.1.100:5555\n', '');
          }
          return new MockChildProcess();
        }
      );

      const result = await manager.connectWifi('192.168.1.100', 5555);

      expect(exec).toHaveBeenCalledWith('adb connect 192.168.1.100:5555', expect.any(Function));
      expect(result.serial).toBe('192.168.1.100:5555');
    });

    it('should resolve when already connected', async () => {
      vi.mocked(exec).mockImplementation(
        (
          cmd: string,
          _optionsOrCallback?: unknown,
          callback?: (error: Error | null, stdout: string, stderr: string) => void
        ) => {
          const cb = typeof _optionsOrCallback === 'function' ? _optionsOrCallback : callback;
          if (cmd.includes('adb connect')) {
            cb?.(null, 'already connected to 192.168.1.100:5555\n', '');
          }
          return new MockChildProcess();
        }
      );

      // Should not throw for "already connected" - it's a success case
      const result = await manager.connectWifi('192.168.1.100', 5555);
      expect(result.serial).toBe('192.168.1.100:5555');
    });

    it('should reject on connection failure', async () => {
      vi.mocked(exec).mockImplementation(
        (
          cmd: string,
          _optionsOrCallback?: unknown,
          callback?: (error: Error | null, stdout: string, stderr: string) => void
        ) => {
          const cb = typeof _optionsOrCallback === 'function' ? _optionsOrCallback : callback;
          if (cmd.includes('adb connect')) {
            cb?.(null, 'failed to connect to 192.168.1.100:5555\n', '');
          }
          return new MockChildProcess();
        }
      );

      await expect(manager.connectWifi('192.168.1.100', 5555)).rejects.toThrow();
    });
  });

  describe('disconnectWifi', () => {
    it('should disconnect WiFi device', async () => {
      vi.mocked(exec).mockImplementation(
        (
          cmd: string,
          _optionsOrCallback?: unknown,
          callback?: (error: Error | null, stdout: string, stderr: string) => void
        ) => {
          const cb = typeof _optionsOrCallback === 'function' ? _optionsOrCallback : callback;
          if (cmd.includes('adb disconnect')) {
            cb?.(null, 'disconnected 192.168.1.100:5555\n', '');
          }
          return new MockChildProcess();
        }
      );

      await manager.disconnectWifi('192.168.1.100:5555');

      expect(exec).toHaveBeenCalledWith('adb disconnect 192.168.1.100:5555', expect.any(Function));
    });
  });

  describe('config updates', () => {
    it('should allow updating configuration', () => {
      const newConfig: ScrcpyConfig = {
        ...config,
        maxSize: 1080,
        bitRate: 4,
      };

      manager.updateConfig(newConfig);

      // Configuration should be stored for new sessions
      // (internal state, so we just verify no error)
      expect(() => manager.updateConfig(newConfig)).not.toThrow();
    });
  });

  describe('disconnectAll', () => {
    it('should clean up all sessions on disconnectAll', async () => {
      await manager.disconnectAll();

      expect(manager.getAllSessions()).toHaveLength(0);
      expect(manager.getActiveSession()).toBeNull();
    });
  });
});
