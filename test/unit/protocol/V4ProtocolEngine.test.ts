/**
 * Tests for V4ProtocolEngine — scrcpy v4.x wire protocol parsing.
 *
 * These tests exercise the engine in isolation by feeding bytes through a
 * CursorBuffer and asserting on the returned discriminated-union results.
 * The engine never touches sockets, so no net/child_process mocking is needed.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CursorBuffer } from '../../../src/protocol/CursorBuffer';
import { V4ProtocolEngine } from '../../../src/protocol/V4ProtocolEngine';
import {
  AUDIO_OPUS_CODEC_ID,
  PACKET_HEADER_SIZE,
  SESSION_PACKET_SIZE,
  VIDEO_CODEC_IDS,
  createAudioPacket,
  createSessionPacket,
  createVideoCodecMeta,
  createVideoPacket,
} from '../../fixtures/h264-samples';

describe('V4ProtocolEngine', () => {
  let engine: V4ProtocolEngine;

  beforeEach(() => {
    engine = new V4ProtocolEngine('4.0');
  });

  describe('metadata', () => {
    it('exposes version and major version', () => {
      expect(engine.version).toBe('4.0');
      expect(engine.majorVersion).toBe(4);
    });

    it('uses the v4 server arg name', () => {
      expect(engine.serverStreamMetaArg).toBe('send_stream_meta');
    });
  });

  describe('parseInitialVideoHeader', () => {
    it('parses codec_id + SESSION packet', () => {
      const buf = new CursorBuffer(64);
      buf.append(createVideoCodecMeta(VIDEO_CODEC_IDS.H264, 1920, 1080));

      const r = engine.parseInitialVideoHeader(buf);
      expect(r).toEqual({
        type: 'ready',
        codecId: VIDEO_CODEC_IDS.H264,
        width: 1920,
        height: 1080,
      });
    });

    it('parses H265 codec id', () => {
      const buf = new CursorBuffer(64);
      buf.append(createVideoCodecMeta(VIDEO_CODEC_IDS.H265, 2560, 1440));

      const r = engine.parseInitialVideoHeader(buf);
      expect(r).toEqual({
        type: 'ready',
        codecId: VIDEO_CODEC_IDS.H265,
        width: 2560,
        height: 1440,
      });
    });

    it('parses AV1 codec id', () => {
      const buf = new CursorBuffer(64);
      buf.append(createVideoCodecMeta(VIDEO_CODEC_IDS.AV1, 720, 1280));

      const r = engine.parseInitialVideoHeader(buf);
      expect(r).toEqual({ type: 'ready', codecId: VIDEO_CODEC_IDS.AV1, width: 720, height: 1280 });
    });

    it('returns need-more when fewer than 16 bytes available', () => {
      const buf = new CursorBuffer(64);
      buf.append(createVideoCodecMeta(VIDEO_CODEC_IDS.H264, 1920, 1080).subarray(0, 10));

      const r = engine.parseInitialVideoHeader(buf);
      expect(r.type).toBe('need-more');
    });

    it('parses header delivered in fragmented chunks', () => {
      const buf = new CursorBuffer(64);
      const full = createVideoCodecMeta(VIDEO_CODEC_IDS.H264, 1920, 1080);
      buf.append(full.subarray(0, 5));

      let r = engine.parseInitialVideoHeader(buf);
      expect(r.type).toBe('need-more');

      buf.append(full.subarray(5));
      r = engine.parseInitialVideoHeader(buf);
      expect(r).toEqual({
        type: 'ready',
        codecId: VIDEO_CODEC_IDS.H264,
        width: 1920,
        height: 1080,
      });
    });
  });

  describe('parseNextVideoPacket - media packets', () => {
    it('parses a plain media packet (no flags)', () => {
      const buf = new CursorBuffer(64);
      const payload = Buffer.from([0x01, 0x02, 0x03, 0x04]);
      buf.append(createVideoPacket(12345n, false, false, payload));

      const r = engine.parseNextVideoPacket(buf);
      expect(r).toEqual({
        type: 'media',
        pts: 12345n,
        isConfig: false,
        isKeyFrame: false,
        data: new Uint8Array([0x01, 0x02, 0x03, 0x04]),
      });
    });

    it('detects CONFIG flag at bit 62', () => {
      const buf = new CursorBuffer(64);
      buf.append(createVideoPacket(0n, true, false, Buffer.from([0x67])));

      const r = engine.parseNextVideoPacket(buf);
      expect(r.type).toBe('media');
      if (r.type === 'media') {
        expect(r.isConfig).toBe(true);
        expect(r.isKeyFrame).toBe(false);
      }
    });

    it('detects KEY_FRAME flag at bit 61', () => {
      const buf = new CursorBuffer(64);
      buf.append(createVideoPacket(1000n, false, true, Buffer.from([0x65])));

      const r = engine.parseNextVideoPacket(buf);
      expect(r.type).toBe('media');
      if (r.type === 'media') {
        expect(r.isConfig).toBe(false);
        expect(r.isKeyFrame).toBe(true);
      }
    });

    it('handles zero-length payload', () => {
      const buf = new CursorBuffer(64);
      buf.append(createVideoPacket(0n, false, false, Buffer.alloc(0)));

      const r = engine.parseNextVideoPacket(buf);
      expect(r).toEqual({
        type: 'media',
        pts: 0n,
        isConfig: false,
        isKeyFrame: false,
        data: new Uint8Array(0),
      });
    });

    it('returns need-more when only partial header is available', () => {
      const buf = new CursorBuffer(64);
      buf.append(createVideoPacket(0n, false, false, Buffer.alloc(4)).subarray(0, 8));

      const r = engine.parseNextVideoPacket(buf);
      expect(r.type).toBe('need-more');
    });

    it('returns need-more when payload has not fully arrived', () => {
      const buf = new CursorBuffer(64);
      const full = createVideoPacket(0n, false, false, Buffer.alloc(8));
      buf.append(full.subarray(0, full.length - 2));

      const r = engine.parseNextVideoPacket(buf);
      expect(r.type).toBe('need-more');
    });

    it('parses consecutive packets from the same buffer', () => {
      const buf = new CursorBuffer(64);
      buf.append(createVideoPacket(1n, false, false, Buffer.from([0x01])));
      buf.append(createVideoPacket(2n, false, false, Buffer.from([0x02])));

      const r1 = engine.parseNextVideoPacket(buf);
      const r2 = engine.parseNextVideoPacket(buf);
      expect(r1.type).toBe('media');
      expect(r2.type).toBe('media');
      if (r1.type === 'media' && r2.type === 'media') {
        expect(r1.pts).toBe(1n);
        expect(r2.pts).toBe(2n);
      }
    });
  });

  describe('parseNextVideoPacket - SESSION packets', () => {
    it('parses a mid-stream SESSION packet as a session event', () => {
      const buf = new CursorBuffer(64);
      buf.append(createSessionPacket(1080, 1920));

      const r = engine.parseNextVideoPacket(buf);
      expect(r).toEqual({
        type: 'session',
        width: 1080,
        height: 1920,
        clientResized: false,
      });
    });

    it('exposes clientResized flag (byte 3, bit 0)', () => {
      const buf = new CursorBuffer(64);
      buf.append(createSessionPacket(800, 600, true));

      const r = engine.parseNextVideoPacket(buf);
      expect(r).toEqual({
        type: 'session',
        width: 800,
        height: 600,
        clientResized: true,
      });
    });

    it('returns need-more when only partial SESSION packet is available', () => {
      const buf = new CursorBuffer(64);
      buf.append(createSessionPacket(1080, 1920).subarray(0, 6));

      const r = engine.parseNextVideoPacket(buf);
      expect(r.type).toBe('need-more');
    });

    it('can switch between SESSION and media packets', () => {
      const buf = new CursorBuffer(64);
      buf.append(createVideoPacket(0n, false, false, Buffer.from([0xaa])));
      buf.append(createSessionPacket(720, 1280));
      buf.append(createVideoPacket(1n, false, false, Buffer.from([0xbb])));

      const r1 = engine.parseNextVideoPacket(buf);
      const r2 = engine.parseNextVideoPacket(buf);
      const r3 = engine.parseNextVideoPacket(buf);
      expect(r1.type).toBe('media');
      expect(r2.type).toBe('session');
      expect(r3.type).toBe('media');
    });
  });

  describe('parseNextAudioPacket', () => {
    it('parses a regular audio packet', () => {
      const buf = new CursorBuffer(64);
      buf.append(createAudioPacket(500n, false, Buffer.from([0xaa, 0xbb])));

      const r = engine.parseNextAudioPacket(buf);
      expect(r).toEqual({
        type: 'media',
        isConfig: false,
        data: new Uint8Array([0xaa, 0xbb]),
      });
    });

    it('detects CONFIG at bit 62 (same as video media packets)', () => {
      const buf = new CursorBuffer(64);
      buf.append(createAudioPacket(0n, true, Buffer.from([0x41, 0x4f, 0x50, 0x55])));

      const r = engine.parseNextAudioPacket(buf);
      expect(r).toEqual({
        type: 'media',
        isConfig: true,
        data: new Uint8Array([0x41, 0x4f, 0x50, 0x55]),
      });
    });

    it('returns need-more on partial header', () => {
      const buf = new CursorBuffer(64);
      buf.append(createAudioPacket(0n, false, Buffer.alloc(4)).subarray(0, 4));

      const r = engine.parseNextAudioPacket(buf);
      expect(r.type).toBe('need-more');
    });
  });

  describe('constants consistency', () => {
    it('uses 12-byte packet headers', () => {
      expect(PACKET_HEADER_SIZE).toBe(12);
    });

    it('uses 12-byte SESSION packets', () => {
      expect(SESSION_PACKET_SIZE).toBe(12);
    });

    it('matches the "opus" codec id', () => {
      expect(AUDIO_OPUS_CODEC_ID).toBe(0x6f707573);
    });
  });
});
