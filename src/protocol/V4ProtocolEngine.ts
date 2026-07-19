/**
 * Protocol engine for scrcpy v4.x wire protocol.
 *
 * Implements the SESSION-packet-based framing introduced in scrcpy 4.0
 * (PR https://github.com/Genymobile/scrcpy/pull/6159). Video streams send an
 * initial 12-byte SESSION packet after the codec_id (instead of v3's 8-byte
 * width|height block), and may send additional SESSION packets mid-stream on
 * encoder resets (rotation, virtual-display resize, capture reset).
 *
 * PTS/flags bit layout (8 bytes, big-endian):
 *   bit 63: SESSION (only set on SESSION packets)
 *   bit 62: CONFIG
 *   bit 61: KEY_FRAME
 *   bits 0-60: PTS
 */

import { ScrcpyProtocol } from '../ScrcpyProtocol';
import type {
  AudioParseResult,
  InitialHeaderResult,
  ProtocolEngine,
  VideoParseResult,
} from './ProtocolEngine';
import type { CursorBuffer } from './CursorBuffer';

export class V4ProtocolEngine implements ProtocolEngine {
  readonly version: string;
  readonly majorVersion = 4;
  readonly serverStreamMetaArg = 'send_stream_meta';

  constructor(version: string) {
    this.version = version;
  }

  parseInitialVideoHeader(buf: CursorBuffer): InitialHeaderResult {
    // codec_id (4) + SESSION packet (12) = 16 bytes
    if (buf.available() < 4 + ScrcpyProtocol.SESSION_PACKET_SIZE) {
      return { type: 'need-more' };
    }

    const codecId = buf.readUInt32BE();
    const session = buf.readBytes(ScrcpyProtocol.SESSION_PACKET_SIZE);

    if ((session[0] & 0x80) === 0) {
      // Protocol error: v4 mandates a SESSION packet here. We still extract
      // best-effort dimensions and let the caller decide how to handle it.
      console.error('V4ProtocolEngine: expected SESSION packet but MSB was 0');
    }

    return {
      type: 'ready',
      codecId,
      width: session.readUInt32BE(4),
      height: session.readUInt32BE(8),
    };
  }

  parseNextVideoPacket(buf: CursorBuffer): VideoParseResult {
    if (buf.available() < ScrcpyProtocol.PACKET_HEADER_SIZE) {
      return { type: 'need-more' };
    }

    // SESSION packets have the MSB of byte 0 set; media packets do not.
    if ((buf.peekUInt8(0) & 0x80) !== 0) {
      if (buf.available() < ScrcpyProtocol.SESSION_PACKET_SIZE) {
        return { type: 'need-more' };
      }
      const session = buf.readBytes(ScrcpyProtocol.SESSION_PACKET_SIZE);
      return {
        type: 'session',
        width: session.readUInt32BE(4),
        height: session.readUInt32BE(8),
        clientResized: (session[3] & 1) !== 0,
      };
    }

    // Media packet
    const ptsFlags = buf.peekBigUInt64BE(0);
    const packetSize = buf.peekUInt32BE(8);
    if (buf.available() < ScrcpyProtocol.PACKET_HEADER_SIZE + packetSize) {
      return { type: 'need-more' };
    }
    buf.discard(ScrcpyProtocol.PACKET_HEADER_SIZE);
    const data = buf.readBytes(packetSize);

    return {
      type: 'media',
      pts: ptsFlags & ScrcpyProtocol.PACKET_PTS_MASK,
      isConfig: (ptsFlags & ScrcpyProtocol.PACKET_FLAG_CONFIG) !== 0n,
      isKeyFrame: (ptsFlags & ScrcpyProtocol.PACKET_FLAG_KEY_FRAME) !== 0n,
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
      isConfig: (ptsFlags & ScrcpyProtocol.PACKET_FLAG_CONFIG) !== 0n,
      data: new Uint8Array(data),
    };
  }
}
