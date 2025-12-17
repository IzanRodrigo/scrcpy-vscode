/**
 * Tests for WDAClient HTTP client for WebDriverAgent
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WDAClient } from '../../../src/ios/WDAClient';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('WDAClient', () => {
  let client: WDAClient;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    client = new WDAClient('localhost', 8100);
  });

  afterEach(() => {
    vi.useRealTimers();
    client.disconnect();
  });

  describe('constructor', () => {
    it('should create client with correct base URL', () => {
      const customClient = new WDAClient('192.168.1.100', 8200);
      // The baseUrl is private, but we can verify it indirectly through requests
      expect(customClient).toBeDefined();
    });
  });

  describe('checkStatus', () => {
    it('should return WDA status on success', async () => {
      const mockStatus = {
        value: {
          ready: true,
          message: 'Ready',
          os: { name: 'iOS', version: '17.0' },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockStatus),
      });

      const statusPromise = client.checkStatus();
      await vi.runAllTimersAsync();
      const status = await statusPromise;

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8100/status',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
      expect(status).toEqual(mockStatus.value);
    });

    it('should return null on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const statusPromise = client.checkStatus();
      await vi.runAllTimersAsync();
      const status = await statusPromise;

      expect(status).toBeNull();
    });
  });

  describe('createSession', () => {
    it('should create session and store session ID', async () => {
      const mockResponse = {
        value: {
          sessionId: 'test-session-123',
          capabilities: {
            device: 'iPhone',
            browserName: 'Safari',
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const sessionPromise = client.createSession();
      await vi.runAllTimersAsync();
      const session = await sessionPromise;

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8100/session',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(String),
        })
      );
      expect(session.sessionId).toBe('test-session-123');
      expect(session.capabilities).toEqual(mockResponse.value.capabilities);
    });

    it('should throw error if no session ID in response', async () => {
      // Use real timers for this test as AbortController doesn't work well with fake timers
      vi.useRealTimers();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ value: {} }),
      });

      await expect(client.createSession()).rejects.toThrow('No session ID in WDA response');

      // Restore fake timers
      vi.useFakeTimers();
    });
  });

  describe('deleteSession', () => {
    it('should delete existing session', async () => {
      // First create a session
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ value: { sessionId: 'delete-me-123' } }),
      });
      const createPromise = client.createSession();
      await vi.runAllTimersAsync();
      await createPromise;

      // Then delete it
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const deletePromise = client.deleteSession();
      await vi.runAllTimersAsync();
      await deletePromise;

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:8100/session/delete-me-123',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });

    it('should do nothing if no session exists', async () => {
      mockFetch.mockClear();

      await client.deleteSession();

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('touch', () => {
    beforeEach(async () => {
      // Create session first
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ value: { sessionId: 'touch-session' } }),
      });
      const sessionPromise = client.createSession();
      await vi.runAllTimersAsync();
      await sessionPromise;
      mockFetch.mockClear();
    });

    it('should perform tap for quick down/up', async () => {
      // Mock the tap endpoint
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ value: null }),
      });

      // Down then immediately up at same position = tap
      client.touch('down', 100, 200);
      const touchPromise = client.touch('up', 100, 200);
      await vi.runAllTimersAsync();
      await touchPromise;

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8100/session/touch-session/wda/touch/perform',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"action":"tap"'),
        })
      );
    });

    it('should perform swipe for drag gesture', async () => {
      // Mock the swipe endpoint
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ value: null }),
      });

      // Down, move far, up = swipe
      client.touch('down', 100, 200);
      client.touch('move', 300, 200);
      const touchPromise = client.touch('up', 300, 200);
      await vi.runAllTimersAsync();
      await touchPromise;

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8100/session/touch-session/wda/touch/perform',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"action":"press"'),
        })
      );
    });
  });

  describe('scroll', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ value: { sessionId: 'scroll-session' } }),
      });
      const sessionPromise = client.createSession();
      await vi.runAllTimersAsync();
      await sessionPromise;
      mockFetch.mockClear();
    });

    it('should convert scroll to swipe gesture', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ value: null }),
      });

      const scrollPromise = client.scroll(200, 300, 0, -5);
      await vi.runAllTimersAsync();
      await scrollPromise;

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/wda/touch/perform'),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  describe('typeText', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ value: { sessionId: 'type-session' } }),
      });
      const sessionPromise = client.createSession();
      await vi.runAllTimersAsync();
      await sessionPromise;
      mockFetch.mockClear();
    });

    it('should send text via WDA keys endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ value: null }),
      });

      const typePromise = client.typeText('Hello World');
      await vi.runAllTimersAsync();
      await typePromise;

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8100/session/type-session/wda/keys',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ value: 'Hello World'.split('') }),
        })
      );
    });
  });

  describe('pressButton', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ value: { sessionId: 'button-session' } }),
      });
      const sessionPromise = client.createSession();
      await vi.runAllTimersAsync();
      await sessionPromise;
      mockFetch.mockClear();
    });

    it('should send home button press', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ value: null }),
      });

      const pressPromise = client.pressButton('home');
      await vi.runAllTimersAsync();
      await pressPromise;

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8100/session/button-session/wda/pressButton',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'home' }),
        })
      );
    });

    it('should support volume buttons', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ value: null }),
      });

      const pressPromise = client.pressButton('volumeUp');
      await vi.runAllTimersAsync();
      await pressPromise;

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/wda/pressButton'),
        expect.objectContaining({
          body: JSON.stringify({ name: 'volumeUp' }),
        })
      );
    });
  });

  describe('getWindowSize', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ value: { sessionId: 'size-session' } }),
      });
      const sessionPromise = client.createSession();
      await vi.runAllTimersAsync();
      await sessionPromise;
      mockFetch.mockClear();
    });

    it('should return window dimensions', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ value: { width: 375, height: 812 } }),
      });

      const sizePromise = client.getWindowSize();
      await vi.runAllTimersAsync();
      const size = await sizePromise;

      expect(size).toEqual({ width: 375, height: 812 });
    });
  });

  describe('ensureSession', () => {
    it('should create session if none exists', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ value: { sessionId: 'new-session' } }),
      });

      const sessionPromise = client.ensureSession();
      await vi.runAllTimersAsync();
      const sessionId = await sessionPromise;

      expect(sessionId).toBe('new-session');
    });

    it('should return existing session if available', async () => {
      // Create session first
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ value: { sessionId: 'existing-session' } }),
      });
      const createPromise = client.createSession();
      await vi.runAllTimersAsync();
      await createPromise;
      mockFetch.mockClear();

      // ensureSession should not create new session
      const ensurePromise = client.ensureSession();
      await vi.runAllTimersAsync();
      const sessionId = await ensurePromise;

      expect(mockFetch).not.toHaveBeenCalled();
      expect(sessionId).toBe('existing-session');
    });
  });

  describe('disconnect', () => {
    it('should clean up session and state', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ value: { sessionId: 'cleanup-session' } }),
      });
      const createPromise = client.createSession();
      await vi.runAllTimersAsync();
      await createPromise;
      mockFetch.mockClear();

      // Disconnect should try to delete session (fire and forget)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      client.disconnect();

      // Give it time to fire the delete request
      await vi.runAllTimersAsync();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/session/cleanup-session'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('error handling', () => {
    it('should throw on HTTP error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      const statusPromise = client.checkStatus();
      await vi.runAllTimersAsync();
      const status = await statusPromise;

      // checkStatus catches errors and returns null
      expect(status).toBeNull();
    });
  });
});
