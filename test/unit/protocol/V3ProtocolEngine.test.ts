/**
 * Tests for V3ProtocolEngine — scrcpy v3.x wire protocol parsing (legacy).
 *
 * Verifies the pre-v4 framing: 12-byte codec+size header (no SESSION packet),
 * PTS/flags with CONFIG at bit 63 and KEY_FRAME at bit 62, and the v3 server
 * arg name.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CursorBuffer } from '../../../src/protocol/CursorBuffer';
import { V3ProtocolEngine } from '../../../src/protocol/V3ProtocolEngine';
import {
  AUDIO_OPUS_CODEC_ID,
  VIDEO_CODEC_IDS,
  createAudioPacketV3,
  createVideoCodecMetaV3,
  createVideoPacketV3,
} from '../../fixtures/h264-samples';

describe('V3ProtocolEngine', () => {
  let engine: V3ProtocolEngine;

  beforeEach(() => {
    engine = new V3ProtocolEngine('3.3.2');
  });

  describe('metadata', () => {
    it('exposes version and major version', () => {
      expect(engine.version).toBe('3.3.2');
      expect(engine.majorVersion).toBe(3);
    });

    it('uses the v3 server arg name', () => {
      expect(engine.serverStreamMetaArg).toBe('send_codec_meta');
    });
  });

  describe('parseInitialVideoHeader', () => {
    it('parses codec_id + width + height (no SESSION packet)', () => {
      const buf = new CursorBuffer(64);
      buf.append(createVideoCodecMetaV3(VIDEO_CODEC_IDS.H264, 1920, 1080));

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
      buf.append(createVideoCodecMetaV3(VIDEO_CODEC_IDS.H265, 2560, 1440));

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
      buf.append(createVideoCodecMetaV3(VIDEO_CODEC_IDS.AV1, 720, 1280));

      const r = engine.parseInitialVideoHeader(buf);
      expect(r).toEqual({ type: 'ready', codecId: VIDEO_CODEC_IDS.AV1, width: 720, height: 1280 });
    });

    it('returns need-more when fewer than 12 bytes available', () => {
      const buf = new CursorBuffer(64);
      buf.append(createVideoCodecMetaV3(VIDEO_CODEC_IDS.H264, 1920, 1080).subarray(0, 8));

      const r = engine.parseInitialVideoHeader(buf);
      expect(r.type).toBe('need-more');
    });
  });

  describe('parseNextVideoPacket', () => {
    it('parses a plain media packet', () => {
      const buf = new CursorBuffer(64);
      const payload = Buffer.from([0x01, 0x02, 0x03, 0x04]);
      buf.append(createVideoPacketV3(12345n, false, false, payload));

      const r = engine.parseNextVideoPacket(buf);
      expect(r).toEqual({
        type: 'media',
        pts: 12345n,
        isConfig: false,
        isKeyFrame: false,
        data: new Uint8Array([0x01, 0x02, 0x03, 0x04]),
      });
    });

    it('detects CONFIG flag at bit 63 (not 62 like v4)', () => {
      const buf = new CursorBuffer(64);
      buf.append(createVideoPacketV3(0n, true, false, Buffer.from([0x67])));

      const r = engine.parseNextVideoPacket(buf);
      expect(r.type).toBe('media');
      if (r.type === 'media') {
        expect(r.isConfig).toBe(true);
        expect(r.isKeyFrame).toBe(false);
      }
    });

    it('detects KEY_FRAME flag at bit 62 (not 61 like v4)', () => {
      const buf = new CursorBuffer(64);
      buf.append(createVideoPacketV3(1000n, false, true, Buffer.from([0x65])));

      const r = engine.parseNextVideoPacket(buf);
      expect(r.type).toBe('media');
      if (r.type === 'media') {
        expect(r.isConfig).toBe(false);
        expect(r.isKeyFrame).toBe(true);
      }
    });

    it('returns need-more when payload has not fully arrived', () => {
      const buf = new CursorBuffer(64);
      const full = createVideoPacketV3(0n, false, false, Buffer.alloc(8));
      buf.append(full.subarray(0, full.length - 2));

      const r = engine.parseNextVideoPacket(buf);
      expect(r.type).toBe('need-more');
    });

    it('never produces session events (v3 has no SESSION packets)', () => {
      // Even if the high bit of the first header byte happens to be set (because
      // a v3 config packet has CONFIG at bit 63), the engine must classify it as
      // a media packet, not a session event.
      const buf = new CursorBuffer(64);
      buf.append(createVideoPacketV3(0n, true, false, Buffer.from([0x67])));

      const r = engine.parseNextVideoPacket(buf);
      expect(r.type).not.toBe('session');
      expect(r.type).toBe('media');
    });
  });

  describe('parseNextAudioPacket', () => {
    it('parses a regular audio packet', () => {
      const buf = new CursorBuffer(64);
      buf.append(createAudioPacketV3(500n, false, Buffer.from([0xaa, 0xbb])));

      const r = engine.parseNextAudioPacket(buf);
      expect(r).toEqual({
        type: 'media',
        isConfig: false,
        data: new Uint8Array([0xaa, 0xbb]),
      });
    });

    it('detects CONFIG at bit 63 (v3 layout)', () => {
      const buf = new CursorBuffer(64);
      buf.append(createAudioPacketV3(0n, true, Buffer.from([0x41, 0x4f])));

      const r = engine.parseNextAudioPacket(buf);
      expect(r).toEqual({
        type: 'media',
        isConfig: true,
        data: new Uint8Array([0x41, 0x4f]),
      });
    });

    it('matches the opus codec id constant', () => {
      expect(AUDIO_OPUS_CODEC_ID).toBe(0x6f707573);
    });
  });
});
