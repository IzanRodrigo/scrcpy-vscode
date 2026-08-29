import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resetMocks as resetChildProcessMocks } from '../mocks/child_process';

vi.mock('child_process', () => import('../mocks/child_process'));
vi.mock('vscode', () => import('../mocks/vscode'));

import { DeviceService } from '../../src/DeviceService';
import { AppStateManager } from '../../src/AppStateManager';
import { ScrcpyConfig } from '../../src/ScrcpyConnection';
import { ActionType } from '../../src/types/Actions';

const baseConfig: ScrcpyConfig = {
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
  autoReconnect: true,
  reconnectRetries: 1,
  lockVideoOrientation: false,
  scrollSensitivity: 1.0,
  videoCodec: 'h264',
};

/**
 * A single unplug raises more than one event: the video socket closes and the adb
 * process exits. Both reach handleDisconnect for the same session.
 */
describe('DeviceService duplicate disconnect events', () => {
  let service: DeviceService;
  let appState: AppStateManager;
  let errorCallback: ReturnType<typeof vi.fn>;

  const DEVICE_ID = 'device_1';

  beforeEach(() => {
    resetChildProcessMocks();
    vi.clearAllMocks();
    vi.useFakeTimers();

    appState = new AppStateManager();
    errorCallback = vi.fn();
    service = new DeviceService(appState, vi.fn(), vi.fn(), vi.fn(), errorCallback, {
      ...baseConfig,
    });

    appState.dispatch({
      type: ActionType.ADD_DEVICE,
      payload: {
        deviceId: DEVICE_ID,
        serial: 'emulator-5554',
        name: 'Pixel',
        connectionState: 'connected',
        isActive: true,
      },
    });

    // Reach into the private session map: the race is between two internal
    // callbacks, and there is no public way to raise them.
    const sessions = (service as unknown as { sessions: Map<string, unknown> }).sessions;
    sessions.set(DEVICE_ID, {
      deviceId: DEVICE_ID,
      deviceInfo: { serial: 'emulator-5554', name: 'Pixel' },
      connection: null,
      isPaused: false,
      retryCount: 0,
      isReconnecting: false,
      isHandlingDisconnect: false,
      isDisposed: false,
      effectiveCodec: 'h264',
      lastWidth: 0,
      lastHeight: 0,
      lastConfigData: null,
      lastKeyFrameData: null,
      lastCodec: 'h264',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reconnects once and keeps the session when two events arrive together', async () => {
    const internals = service as unknown as {
      sessions: Map<string, unknown>;
      handleDisconnect: (session: unknown, error: string) => Promise<void>;
      connectSession: (session: unknown) => Promise<void>;
    };
    const session = internals.sessions.get(DEVICE_ID);
    const connectSession = vi.fn().mockResolvedValue(undefined);
    internals.connectSession = connectSession;

    const first = internals.handleDisconnect(session, 'Disconnected from device');
    const second = internals.handleDisconnect(session, 'Server disconnected');
    await vi.advanceTimersByTimeAsync(3000);
    await Promise.all([first, second]);

    // The second event used to run handleSessionFailed, dropping the session while
    // the first was still retrying on it. That left an orphan connection.
    expect(connectSession).toHaveBeenCalledTimes(1);
    expect(internals.sessions.has(DEVICE_ID)).toBe(true);
    expect(appState.getDeviceIds()).toContain(DEVICE_ID);
    expect(errorCallback).not.toHaveBeenCalled();
  });

  it('still fails the session when the retries run out', async () => {
    const internals = service as unknown as {
      sessions: Map<string, unknown>;
      handleDisconnect: (session: unknown, error: string) => Promise<void>;
      connectSession: (session: unknown) => Promise<void>;
    };
    const session = internals.sessions.get(DEVICE_ID);
    internals.connectSession = vi.fn().mockRejectedValue(new Error('device not found'));

    const first = internals.handleDisconnect(session, 'Disconnected from device');
    const second = internals.handleDisconnect(session, 'Server disconnected');
    await vi.advanceTimersByTimeAsync(3000);
    await Promise.all([first, second]);

    expect(internals.sessions.has(DEVICE_ID)).toBe(false);
    expect(appState.getDeviceIds()).not.toContain(DEVICE_ID);
    expect(errorCallback).toHaveBeenCalledTimes(1);
  });
});
