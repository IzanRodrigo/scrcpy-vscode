/**
 * Protocol engine abstraction for scrcpy's wire protocol.
 *
 * scrcpy has introduced breaking wire-protocol changes between major versions
 * (v2, v3, v4). Each engine implementation encapsulates the parsing logic for
 * one major version. `ScrcpyConnection` delegates stream parsing to the engine
 * selected by `createProtocolEngine(version)` and stays focused on socket I/O.
 *
 * The engine is passive: it reads bytes from a `CursorBuffer` and returns
 * discriminated-union results. It never touches sockets or invokes callbacks
 * directly, which keeps it trivially testable in isolation.
 */

import type { CursorBuffer } from './CursorBuffer';

/**
 * Result of attempting to read the initial video header (codec + dimensions)
 * from the stream right after the 64-byte device name.
 */
export type InitialHeaderResult =
  | { type: 'need-more' }
  | { type: 'ready'; codecId: number; width: number; height: number };

/**
 * Result of attempting to read the next packet from the video socket
 * (after the initial header has been consumed).
 */
export type VideoParseResult =
  | { type: 'need-more' }
  | { type: 'session'; width: number; height: number; clientResized?: boolean }
  | {
      type: 'media';
      pts: bigint;
      isConfig: boolean;
      isKeyFrame: boolean;
      data: Uint8Array;
    };

/**
 * Result of attempting to read the next packet from the audio socket
 * (after the 4-byte codec id has been consumed).
 */
export type AudioParseResult =
  | { type: 'need-more' }
  | { type: 'media'; isConfig: boolean; data: Uint8Array };

/**
 * Version-strategy interface for parsing scrcpy's video/audio streams.
 *
 * Implementations:
 *   - `V3ProtocolEngine` — scrcpy 3.x (codec metadata: codec_id + width + height)
 *   - `V4ProtocolEngine` — scrcpy 4.x+ (codec_id + SESSION packet)
 *
 * To support a future major version (e.g. v5), implement this interface and
 * register it in `createProtocolEngine.ts`.
 */
export interface ProtocolEngine {
  /** Full version string passed to the scrcpy server (e.g. "4.0", "3.3.2"). */
  readonly version: string;

  /** Major version integer (e.g. 4, 3). */
  readonly majorVersion: number;

  /**
   * Server argument name controlling whether codec/stream metadata is sent.
   * v3.x uses `send_codec_meta`; v4.x renamed it to `send_stream_meta`.
   */
  readonly serverStreamMetaArg: string;

  /**
   * Read the initial video header that arrives after the 64-byte device name.
   * Consumed exactly once per stream. Returns `'need-more'` if the buffer
   * doesn't yet contain enough bytes; the caller should retry on the next chunk.
   */
  parseInitialVideoHeader(buf: CursorBuffer): InitialHeaderResult;

  /**
   * Read the next packet from the video stream (after the initial header).
   * May return a `'session'` event (mid-stream dimension change) or a
   * `'media'` packet (decoded video frame or config).
   */
  parseNextVideoPacket(buf: CursorBuffer): VideoParseResult;

  /**
   * Read the next packet from the audio stream (after the 4-byte codec id).
   * Audio streams never produce `'session'` events; only media packets.
   */
  parseNextAudioPacket(buf: CursorBuffer): AudioParseResult;
}
