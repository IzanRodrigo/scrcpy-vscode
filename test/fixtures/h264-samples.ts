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
 */
export function createScrcpyVideoHeader(
  deviceName: string,
  codecId: number,
  width: number,
  height: number
): Buffer {
  const header = Buffer.alloc(64 + 12);

  // Device name (64 bytes, null-padded)
  const nameBytes = Buffer.from(deviceName, 'utf-8');
  nameBytes.copy(header, 0, 0, Math.min(nameBytes.length, 64));

  // Codec ID (4 bytes)
  header.writeUInt32BE(codecId, 64);

  // Initial width (4 bytes)
  header.writeUInt32BE(width, 68);

  // Initial height (4 bytes)
  header.writeUInt32BE(height, 72);

  return header;
}
