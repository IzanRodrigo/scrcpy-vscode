/**
 * Protocol engine for scrcpy v3.x wire protocol (legacy).
 *
 * Implements the pre-v4 framing: video stream opens with `codec_id + width +
 * height` (12 bytes total), and media packets use the old PTS/flags bit layout
 * where CONFIG occupies bit 63 and KEY_FRAME occupies bit 62. There are no
 * mid-stream SESSION packets — rotation is signaled implicitly via SPS changes
 * detected by the decoder.
 *
 * PTS/flags bit layout (8 bytes, big-endian):
 *   bit 63: CONFIG
 *   bit 62: KEY_FRAME
 *   bits 0-61: PTS
 */

import { ScrcpyProtocol } from '../ScrcpyProtocol';
import type {
  AudioParseResult,
  InitialHeaderResult,
  ProtocolEngine,
  VideoParseResult,
} from './ProtocolEngine';
import type { CursorBuffer } from './CursorBuffer';

// v3 PTS/flags bit positions (CONFIG and KEY_FRAME each one higher than v4).
const V3_PACKET_FLAG_CONFIG = 1n << 63n;
const V3_PACKET_FLAG_KEY_FRAME = 1n << 62n;
const V3_PACKET_PTS_MASK = V3_PACKET_FLAG_KEY_FRAME - 1n;

export class V3ProtocolEngine implements ProtocolEngine {
  readonly version: string;
  readonly majorVersion = 3;
  readonly serverStreamMetaArg = 'send_codec_meta';

  constructor(version: string) {
    this.version = version;
  }

  parseInitialVideoHeader(buf: CursorBuffer): InitialHeaderResult {
    // codec_id (4) + width (4) + height (4) = 12 bytes
    if (buf.available() < 12) {
      return { type: 'need-more' };
    }

    const codecId = buf.readUInt32BE();
    const width = buf.readUInt32BE();
    const height = buf.readUInt32BE();

    return { type: 'ready', codecId, width, height };
  }

  parseNextVideoPacket(buf: CursorBuffer): VideoParseResult {
    if (buf.available() < ScrcpyProtocol.PACKET_HEADER_SIZE) {
      return { type: 'need-more' };
    }

    const ptsFlags = buf.peekBigUInt64BE(0);
    const packetSize = buf.peekUInt32BE(8);
    if (buf.available() < ScrcpyProtocol.PACKET_HEADER_SIZE + packetSize) {
      return { type: 'need-more' };
    }
    buf.discard(ScrcpyProtocol.PACKET_HEADER_SIZE);
    const data = buf.readBytes(packetSize);

    return {
      type: 'media',
      pts: ptsFlags & V3_PACKET_PTS_MASK,
      isConfig: (ptsFlags & V3_PACKET_FLAG_CONFIG) !== 0n,
      isKeyFrame: (ptsFlags & V3_PACKET_FLAG_KEY_FRAME) !== 0n,
      data: new Uint8Array(data),
    };
  }

  parseNextAudioPacket(buf: CursorBuffer): AudioParseResult {
    if (buf.available() < ScrcpyProtocol.PACKET_HEADER_SIZE) {
      return { type: 'need-more' };
    }

    const ptsFlags = buf.peekBigUInt64BE(0);
    const packetSize = buf.peekUInt32BE(8);
    if (buf.available() < ScrcpyProtocol.PACKET_HEADER_SIZE + packetSize) {
      return { type: 'need-more' };
    }
    buf.discard(ScrcpyProtocol.PACKET_HEADER_SIZE);
    const data = buf.readBytes(packetSize);

    return {
      type: 'media',
      isConfig: (ptsFlags & V3_PACKET_FLAG_CONFIG) !== 0n,
      data: new Uint8Array(data),
    };
  }
}
