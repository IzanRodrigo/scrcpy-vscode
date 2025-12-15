/**
 * Mock net module for testing socket connections
 */

import { EventEmitter } from 'events';
import { vi } from 'vitest';

/**
 * Mock Socket for testing ScrcpyConnection
 */
export class MockSocket extends EventEmitter {
  destroyed = false;
  readable = true;
  writable = true;

  write = vi.fn((_data: Buffer | Uint8Array): boolean => {
    return true;
  });

  end = vi.fn(() => {
    this.writable = false;
    this.emit('end');
    return this;
  });

  destroy = vi.fn(() => {
    if (!this.destroyed) {
      this.destroyed = true;
      this.readable = false;
      this.writable = false;
      this.emit('close');
    }
    return this;
  });

  setTimeout = vi.fn(() => this);
  setNoDelay = vi.fn(() => this);
  setKeepAlive = vi.fn(() => this);
  ref = vi.fn(() => this);
  unref = vi.fn(() => this);

  // Test helpers
  simulateData(data: Buffer | Uint8Array) {
    this.emit('data', data instanceof Buffer ? data : Buffer.from(data));
  }

  simulateConnect() {
    this.emit('connect');
  }

  simulateClose(hadError = false) {
    this.destroyed = true;
    this.emit('close', hadError);
  }

  simulateError(error: Error) {
    this.emit('error', error);
  }

  simulateEnd() {
    this.readable = false;
    this.emit('end');
  }
}

/**
 * Mock Server for testing socket connections
 */
export class MockServer extends EventEmitter {
  listening = false;
  address = vi.fn(() => ({ address: '127.0.0.1', family: 'IPv4', port: 27183 }));

  listen = vi.fn(
    (
      port?: number | string | Record<string, unknown>,
      host?: string | (() => void),
      callback?: () => void
    ): MockServer => {
      this.listening = true;
      // Handle different overloads
      const cb =
        typeof port === 'function'
          ? port
          : typeof host === 'function'
            ? host
            : typeof callback === 'function'
              ? callback
              : undefined;
      if (cb) {
        setTimeout(() => cb(), 0);
      }
      return this;
    }
  );

  close = vi.fn((callback?: (err?: Error) => void): MockServer => {
    this.listening = false;
    if (callback) {
      setTimeout(() => callback(), 0);
    }
    return this;
  });

  ref = vi.fn(() => this);
  unref = vi.fn(() => this);

  // Test helpers
  simulateConnection(socket?: MockSocket): MockSocket {
    const connectionSocket = socket ?? new MockSocket();
    this.emit('connection', connectionSocket);
    return connectionSocket;
  }

  simulateError(error: Error) {
    this.emit('error', error);
  }

  simulateClose() {
    this.listening = false;
    this.emit('close');
  }
}

// Factory functions
export const createServer = vi.fn(
  (
    options?: Record<string, unknown> | ((socket: MockSocket) => void),
    connectionListener?: (socket: MockSocket) => void
  ): MockServer => {
    const server = new MockServer();
    const listener = typeof options === 'function' ? options : connectionListener;
    if (listener) {
      server.on('connection', listener);
    }
    return server;
  }
);

export const createConnection = vi.fn(
  (
    options?: number | string | Record<string, unknown>,
    _host?: string | (() => void),
    connectionListener?: () => void
  ): MockSocket => {
    const socket = new MockSocket();
    const cb = typeof _host === 'function' ? _host : connectionListener;
    if (cb) {
      setTimeout(() => {
        socket.simulateConnect();
        cb();
      }, 0);
    }
    return socket;
  }
);

export const connect = createConnection;

// Re-export Socket class for instanceof checks
export const Socket = MockSocket;
export const Server = MockServer;

// Helper to reset the module state
export function resetMocks() {
  createServer.mockClear();
  createConnection.mockClear();
}
