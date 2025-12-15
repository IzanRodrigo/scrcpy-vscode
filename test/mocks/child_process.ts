/**
 * Mock child_process module for testing ADB commands
 */

import { EventEmitter } from 'events';
import { vi } from 'vitest';

/**
 * Mock ChildProcess for testing spawned processes
 */
export class MockChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  stdin = {
    write: vi.fn(),
    end: vi.fn(),
  };

  killed = false;
  pid = Math.floor(Math.random() * 10000);

  kill = vi.fn(() => {
    if (!this.killed) {
      this.killed = true;
      this.emit('exit', 0, null);
    }
    return true;
  });

  // Test helpers
  simulateStdout(data: string | Buffer) {
    this.stdout.emit('data', Buffer.from(data));
  }

  simulateStderr(data: string | Buffer) {
    this.stderr.emit('data', Buffer.from(data));
  }

  simulateExit(code: number, signal: string | null = null) {
    this.emit('exit', code, signal);
  }

  simulateClose(code: number, signal: string | null = null) {
    this.emit('close', code, signal);
  }

  simulateError(error: Error) {
    this.emit('error', error);
  }
}

// Store for the last created mock process (useful for tests)
let lastMockProcess: MockChildProcess | null = null;

export const spawn = vi.fn((): MockChildProcess => {
  lastMockProcess = new MockChildProcess();
  return lastMockProcess;
});

export const exec = vi.fn(
  (
    command: string,
    optionsOrCallback?:
      | Record<string, unknown>
      | ((error: Error | null, stdout: string, stderr: string) => void),
    callback?: (error: Error | null, stdout: string, stderr: string) => void
  ) => {
    // Handle both exec(cmd, callback) and exec(cmd, options, callback) signatures
    const cb = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;

    // Default success - override in tests using mockImplementation
    if (cb) {
      setTimeout(() => cb(null, '', ''), 0);
    }

    const mockProcess = new MockChildProcess();
    return mockProcess;
  }
);

export const execSync = vi.fn((): Buffer => {
  return Buffer.from('');
});

// Helper to get the last created mock process
export function getLastMockProcess(): MockChildProcess | null {
  return lastMockProcess;
}

// Helper to reset the module state
export function resetMocks() {
  lastMockProcess = null;
  spawn.mockClear();
  exec.mockClear();
  execSync.mockClear();
}
