import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetMocks as resetChildProcessMocks } from '../mocks/child_process';

vi.mock('child_process', () => import('../mocks/child_process'));
vi.mock('vscode', () => import('../mocks/vscode'));

import * as vscode from 'vscode';
import { ScrcpyViewProvider } from '../../src/ScrcpyViewProvider';
import { AppStateManager } from '../../src/AppStateManager';
import { ActionType } from '../../src/types/Actions';

/**
 * Build a WebviewView stand-in good enough for resolveWebviewView().
 * postMessage records what the webview would have received.
 */
function makeWebviewView() {
  const posted: Array<Record<string, unknown>> = [];
  const messageHandlers: Array<(m: unknown) => unknown> = [];
  const webviewView = {
    visible: true,
    webview: {
      options: {},
      html: '',
      cspSource: 'vscode-webview:',
      asWebviewUri: (uri: unknown) => uri,
      postMessage: (message: Record<string, unknown>) => {
        posted.push(message);
        return Promise.resolve(true);
      },
      onDidReceiveMessage: (handler: (m: unknown) => unknown) => {
        messageHandlers.push(handler);
        return { dispose: vi.fn() };
      },
    },
    onDidDispose: () => ({ dispose: vi.fn() }),
    onDidChangeVisibility: () => ({ dispose: vi.fn() }),
    show: vi.fn(),
  };
  return { webviewView, posted, messageHandlers };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('ScrcpyViewProvider lifecycle', () => {
  let provider: ScrcpyViewProvider;
  let view: ReturnType<typeof makeWebviewView>;

  beforeEach(async () => {
    resetChildProcessMocks();
    vi.clearAllMocks();

    provider = new ScrcpyViewProvider(vscode.Uri.file('/ext'));
    view = makeWebviewView();
    provider.resolveWebviewView(
      view.webviewView as unknown as vscode.WebviewView,
      {} as vscode.WebviewViewResolveContext,
      {} as vscode.CancellationToken
    );
    await flush();
  });

  it('keeps its state manager after stop, so the view can connect again', async () => {
    const state = provider as unknown as { _appState?: unknown; _deviceService?: unknown };
    expect(state._deviceService).toBeDefined();

    await provider.stop();
    await flush();

    // Regression: stop() used to null the state manager, which is only ever built in
    // the constructor. _initializeAndConnect() then returned early forever and the
    // panel could only be revived by reloading the window.
    expect(state._appState).toBeDefined();
    expect(state._deviceService).toBeUndefined();

    await provider.start();
    await flush();

    expect(state._deviceService).toBeDefined();
  });

  it('tells the webview the devices are gone when it stops', async () => {
    const appState = (provider as unknown as { _appState: AppStateManager })._appState;
    appState.dispatch({
      type: ActionType.ADD_DEVICE,
      payload: {
        deviceId: 'device_1',
        serial: 'emulator-5554',
        name: 'Pixel',
        connectionState: 'connected',
        isActive: true,
      },
    });
    view.posted.length = 0;

    await provider.stop();
    await flush();

    // Regression: stop() unsubscribed before disconnectAll() dispatched
    // CLEAR_ALL_DEVICES, so the webview kept drawing a dead device tab.
    const snapshots = view.posted.filter((m) => m.type === 'stateSnapshot');
    expect(snapshots.length).toBeGreaterThan(0);
    const last = snapshots[snapshots.length - 1].state as {
      devices: unknown[];
      statusMessage?: { type: string };
    };
    expect(last.devices).toHaveLength(0);
    expect(last.statusMessage?.type).toBe('empty');
  });
});
