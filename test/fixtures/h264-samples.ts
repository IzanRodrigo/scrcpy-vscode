/**
 * Sample H.264 data for testing
 *
 * These are real H.264 NAL units that can be used to test SPS parsing
 */

/**
 * SPS NAL unit for 1920x1080 (landscape)
 * Profile: High (100), Level: 4.0 (40)
 *
 * This is a typical SPS from an Android device in landscape mode
 */
export const H264_SPS_1920x1080 = new Uint8Array([
  // Start code (4 bytes)
  0x00, 0x00, 0x00, 0x01,
  // NAL header: type=7 (SPS), nal_ref_idc=3
  0x67,
  // profile_idc=100 (High profile)
  0x64,
  // constraint_set flags and reserved
  0x00,
  // level_idc=40 (Level 4.0)
  0x28,
  // SPS data (simplified, actual data varies)
  0xac, 0xd9, 0x40, 0x78, 0x02, 0x27, 0xe5, 0xc0, 0x44, 0x00, 0x00, 0x03, 0x00, 0x04, 0x00, 0x00,
  0x03, 0x00, 0xf0, 0x3c, 0x60, 0xc6, 0x58,
]);

/**
 * SPS NAL unit for 1080x1920 (portrait)
 * Same profile/level but rotated dimensions
 */
export const H264_SPS_1080x1920 = new Uint8Array([
  // Start code (4 bytes)
  0x00, 0x00, 0x00, 0x01,
  // NAL header: type=7 (SPS), nal_ref_idc=3
  0x67,
  // profile_idc=100 (High profile)
  0x64,
  // constraint_set flags and reserved
  0x00,
  // level_idc=40 (Level 4.0)
  0x28,
  // SPS data for portrait mode
  0xac, 0xd9, 0x40, 0x43, 0x82, 0x27, 0xe5, 0xc0, 0x44, 0x00, 0x00, 0x03, 0x00, 0x04, 0x00, 0x00,
  0x03, 0x00, 0xf0, 0x3c, 0x60, 0xc6, 0x58,
]);

/**
 * SPS NAL unit for 720x1280 (common lower resolution)
 */
export const H264_SPS_720x1280 = new Uint8Array([
  // Start code (4 bytes)
  0x00, 0x00, 0x00, 0x01,
  // NAL header: type=7 (SPS)
  0x67,
  // profile_idc=100
  0x64,
  // constraint_set flags
  0x00,
  // level_idc=31 (Level 3.1)
  0x1f,
  // SPS data
  0xac, 0xd9, 0x40, 0x2d, 0x02, 0x27, 0xe5, 0xc0, 0x44, 0x00, 0x00, 0x03, 0x00, 0x04, 0x00, 0x00,
  0x03, 0x00, 0xf0, 0x3c, 0x60, 0xc6, 0x58,
]);

/**
 * PPS NAL unit (Picture Parameter Set)
 */
export const H264_PPS = new Uint8Array([
  // Start code (4 bytes)
  0x00, 0x00, 0x00, 0x01,
  // NAL header: type=8 (PPS), nal_ref_idc=3
  0x68,
  // PPS data (simplified)
  0xee, 0x3c, 0x80,
]);

/**
 * IDR frame header (Instantaneous Decoder Refresh)
 * This is just the NAL header, actual frame data would follow
 */
export const H264_IDR_HEADER = new Uint8Array([
  // Start code (4 bytes)
  0x00, 0x00, 0x00, 0x01,
  // NAL header: type=5 (IDR), nal_ref_idc=3
  0x65,
]);

/**
 * Non-IDR frame header (P-frame or B-frame)
 */
export const H264_NON_IDR_HEADER = new Uint8Array([
  // Start code (4 bytes)
  0x00, 0x00, 0x00, 0x01,
  // NAL header: type=1 (non-IDR), nal_ref_idc=2
  0x41,
]);

/**
 * Config packet combining SPS and PPS (common format from scrcpy)
 */
export const H264_CONFIG_1920x1080 = new Uint8Array([
  // SPS
  ...H264_SPS_1920x1080,
  // PPS
  ...H264_PPS,
]);

/**
 * Invalid/malformed data for error testing
 */
export const INVALID_DATA = {
  // Too short to contain valid NAL unit
  tooShort: new Uint8Array([0x00, 0x01]),

  // No valid start code
  noStartCode: new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]),

  // Valid start code but unknown NAL type
  unknownNalType: new Uint8Array([0x00, 0x00, 0x00, 0x01, 0x0a]),

  // Start code but truncated data
  truncated: new Uint8Array([0x00, 0x00, 0x00, 0x01, 0x67]),

  // Empty buffer
  empty: new Uint8Array(0),
};

/**
 * Helper to create a complete config packet with custom dimensions
 *
 * Note: This creates a simplified/mock SPS that may not be parseable
 * by real H.264 decoders, but is useful for testing the parsing logic
 */
export function createMockSPS(profile: number, level: number): Uint8Array {
  return new Uint8Array([
    // Start code
    0x00,
    0x00,
    0x00,
    0x01,
    // NAL header: type=7 (SPS)
    0x67,
    // profile_idc
    profile,
    // constraint_set flags
    0x00,
    // level_idc
    level,
    // Placeholder data
    0x00,
    0x00,
    0x00,
  ]);
}

/**
 * Create a buffer containing video stream header (as sent by scrcpy server)
 *
 * scrcpy v4.x layout: device_name (64) + codec_id (4) + SESSION packet (12).
 */
export function createScrcpyVideoHeader(
  deviceName: string,
  codecId: number,
  width: number,
  height: number
): Buffer {
  const header = Buffer.alloc(64 + 4 + SESSION_PACKET_SIZE);

  // Device name (64 bytes, null-padded)
  const nameBytes = Buffer.from(deviceName, 'utf-8');
  nameBytes.copy(header, 0, 0, Math.min(nameBytes.length, 64));

  // Codec ID (4 bytes)
  header.writeUInt32BE(codecId, 64);

  // SESSION packet (12 bytes): flags(4) + width(4) + height(4)
  // MSB of the flags u32 must be set (0x80000000) to indicate a session packet.
  writeSessionPacket(header, 68, width, height, false);

  return header;
}

// ============================================
// Protocol Test Fixtures
// ============================================

/**
 * Audio codec ID constant for Opus
 */
export const AUDIO_OPUS_CODEC_ID = 0x6f707573; // "opus"

/**
 * Video codec ID constants
 */
export const VIDEO_CODEC_IDS = {
  H264: 0x68323634,
  H265: 0x68323635,
  AV1: 0x00617631,
};

/**
 * scrcpy v4.x packet flag bit positions (high bits of the 8-byte PTS/flags field)
 */
export const PACKET_FLAG_SESSION = 1n << 63n;
export const PACKET_FLAG_CONFIG = 1n << 62n;
export const PACKET_FLAG_KEY_FRAME = 1n << 61n;

export const PACKET_HEADER_SIZE = 12;
export const SESSION_PACKET_SIZE = 12;

/**
 * Create a device name header (64 bytes, null-padded)
 */
export function createDeviceNameHeader(name: string): Buffer {
  const header = Buffer.alloc(64);
  const nameBytes = Buffer.from(name, 'utf-8');
  nameBytes.copy(header, 0, 0, Math.min(nameBytes.length, 64));
  return header;
}

/**
 * Write a scrcpy v4.x SESSION packet into a buffer at the given offset.
 * Layout: flags(4) + width(4) + height(4) = 12 bytes; MSB of flags u32 is set.
 */
export function writeSessionPacket(
  buf: Buffer,
  offset: number,
  width: number,
  height: number,
  isClientResize: boolean = false
): void {
  // Top bit of the high byte must be 1 (session flag); low bit of byte 3 = client-resized.
  let flags = 0x80000000;
  if (isClientResize) {
    flags |= 1;
  }
  buf.writeUInt32BE(flags >>> 0, offset);
  buf.writeUInt32BE(width, offset + 4);
  buf.writeUInt32BE(height, offset + 8);
}

/**
 * Create a standalone SESSION packet (12 bytes) for mid-stream injection.
 */
export function createSessionPacket(
  width: number,
  height: number,
  isClientResize: boolean = false
): Buffer {
  const pkt = Buffer.alloc(SESSION_PACKET_SIZE);
  writeSessionPacket(pkt, 0, width, height, isClientResize);
  return pkt;
}

/**
 * Create video codec header for v4.x: codec_id (4) + SESSION packet (12).
 */
export function createVideoCodecMeta(codecId: number, width: number, height: number): Buffer {
  const meta = Buffer.alloc(4 + SESSION_PACKET_SIZE);
  meta.writeUInt32BE(codecId, 0);
  writeSessionPacket(meta, 4, width, height, false);
  return meta;
}

/**
 * Create audio codec metadata (4 bytes: codec_id)
 */
export function createAudioCodecMeta(codecId: number = AUDIO_OPUS_CODEC_ID): Buffer {
  const meta = Buffer.alloc(4);
  meta.writeUInt32BE(codecId, 0);
  return meta;
}

/**
 * Create a video packet with header
 * @param pts - Presentation timestamp
 * @param isConfig - Set config flag (bit 62 in v4.x)
 * @param isKeyFrame - Set keyframe flag (bit 61 in v4.x)
 * @param data - Packet payload data
 */
export function createVideoPacket(
  pts: bigint,
  isConfig: boolean,
  isKeyFrame: boolean,
  data: Buffer
): Buffer {
  const packet = Buffer.alloc(PACKET_HEADER_SIZE + data.length);

  // Build pts_flags: 8 bytes. v4.x bit layout (MSB-first):
  //   bit 63 = SESSION (always 0 for media packets)
  //   bit 62 = CONFIG
  //   bit 61 = KEY_FRAME
  //   bits 60..0 = PTS
  let ptsFlags = pts;
  if (isConfig) {
    ptsFlags = PACKET_FLAG_CONFIG;
  } else {
    if (isKeyFrame) {
      ptsFlags |= PACKET_FLAG_KEY_FRAME;
    }
  }
  packet.writeBigUInt64BE(ptsFlags, 0);

  // Packet size: 4 bytes
  packet.writeUInt32BE(data.length, 8);

  // Packet data
  data.copy(packet, PACKET_HEADER_SIZE);

  return packet;
}

/**
 * Create an audio packet with header (same media-packet format as video;
 * audio never uses SESSION packets but shares the same flag bit positions).
 */
export function createAudioPacket(pts: bigint, isConfig: boolean, data: Buffer): Buffer {
  const packet = Buffer.alloc(PACKET_HEADER_SIZE + data.length);

  let ptsFlags = pts;
  if (isConfig) {
    ptsFlags = PACKET_FLAG_CONFIG;
  }
  packet.writeBigUInt64BE(ptsFlags, 0);
  packet.writeUInt32BE(data.length, 8);
  data.copy(packet, PACKET_HEADER_SIZE);

  return packet;
}

/**
 * Device message type constants
 */
export const DEVICE_MESSAGE_TYPE = {
  CLIPBOARD: 0,
  ACK_CLIPBOARD: 1,
  UHID_OUTPUT: 2,
};

/**
 * Create a clipboard device message
 * Format: type (1) + text_length (4) + text (variable)
 */
export function createClipboardMessage(text: string): Buffer {
  const textBuf = Buffer.from(text, 'utf-8');
  const msg = Buffer.alloc(5 + textBuf.length);
  msg.writeUInt8(DEVICE_MESSAGE_TYPE.CLIPBOARD, 0);
  msg.writeUInt32BE(textBuf.length, 1);
  textBuf.copy(msg, 5);
  return msg;
}

/**
 * Create an ACK_CLIPBOARD device message
 * Format: type (1) + sequence (8)
 */
export function createAckClipboardMessage(sequence: bigint): Buffer {
  const msg = Buffer.alloc(9);
  msg.writeUInt8(DEVICE_MESSAGE_TYPE.ACK_CLIPBOARD, 0);
  msg.writeBigUInt64BE(sequence, 1);
  return msg;
}

/**
 * Create a UHID_OUTPUT device message
 * Format: type (1) + id (2) + data_length (2) + data (variable)
 */
export function createUhidOutputMessage(id: number, data: Buffer): Buffer {
  const msg = Buffer.alloc(5 + data.length);
  msg.writeUInt8(DEVICE_MESSAGE_TYPE.UHID_OUTPUT, 0);
  msg.writeUInt16BE(id, 1);
  msg.writeUInt16BE(data.length, 3);
  data.copy(msg, 5);
  return msg;
}

/**
 * Create an unknown device message (for testing unknown type handling)
 */
export function createUnknownDeviceMessage(type: number): Buffer {
  const msg = Buffer.alloc(1);
  msg.writeUInt8(type, 0);
  return msg;
}
