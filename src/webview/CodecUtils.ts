/**
 * Video Codec Utilities
 *
 * Provides functionality to parse video codec bitstreams (H.264, H.265, AV1)
 * to extract video dimensions and codec information. This is necessary because WebCodecs VideoDecoder
 * needs to be reconfigured when the video resolution changes (e.g. device rotation),
 * and the stream provides this information in codec-specific configuration units.
 *
 * - H.264: Uses SPS (Sequence Parameter Set) - NAL type 7
 * - H.265: Uses VPS/SPS/PPS - NAL type 32/33/34
 * - AV1: Uses Sequence Header OBU
 */

import { Buffer } from 'buffer';
import { parse as parseSPS } from 'h264-sps-parser';

/**
 * H.264 NAL Unit Types
 */
export enum H264NALUnitType {
  IDR = 5,
  SPS = 7,
  PPS = 8,
}

/**
 * H.265 NAL Unit Types
 */
export enum H265NALUnitType {
  VPS = 32,
  SPS = 33,
  PPS = 34,
  IDR_W_RADL = 19,
  IDR_N_LP = 20,
}

/**
 * Video codec types
 */
export type VideoCodec = 'h264' | 'h265' | 'av1';

/**
 * Codec detection result
 */
export interface CodecInfo {
  codec: VideoCodec;
  profile?: number;
  level?: number;
  constraint?: number;
}

export class CodecUtils {
  /**
   * Detect codec type from config data
   */
  static detectCodec(config: Uint8Array): VideoCodec | null {
    // Check for H.264 SPS (NAL type 7)
    if (this.findH264SPS(config)) {
      return 'h264';
    }

    // Check for H.265 VPS/SPS (NAL type 32/33)
    if (this.findH265ConfigNAL(config)) {
      return 'h265';
    }

    // AV1 detection would require OBU parsing
    // For now, we'll rely on the codec being set explicitly
    return null;
  }

  /**
   * Parse config data to extract video dimensions
   * Works for H.264, H.265, and AV1 (where applicable)
   */
  static parseConfigDimensions(
    config: Uint8Array,
    codec?: VideoCodec
  ): { width: number; height: number } | null {
    const detectedCodec = codec || this.detectCodec(config);

    if (detectedCodec === 'h264') {
      return this.parseH264SPSDimensions(config);
    } else if (detectedCodec === 'h265') {
      // H.265 SPS parsing is complex and would require a specialized library
      // For now, dimensions will come from the codec metadata in the stream
      return null;
    } else if (detectedCodec === 'av1') {
      // AV1 sequence header parsing is complex
      // Dimensions will come from the codec metadata in the stream
      return null;
    }

    return null;
  }

  /**
   * Parse H.264 SPS to extract video dimensions
   */
  static parseH264SPSDimensions(config: Uint8Array): { width: number; height: number } | null {
    const spsData = this.findH264SPS(config);
    if (!spsData) {
      return null;
    }

    try {
      // Parse using library
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sps = parseSPS(Buffer.from(spsData)) as any;

      const frameMbsOnly = sps.frame_mbs_only_flag;
      const width = sps.pic_width_in_mbs * 16;
      const height = sps.pic_height_in_map_units * 16 * (2 - frameMbsOnly);

      let cropX = 0;
      let cropY = 0;

      if (sps.frame_cropping_flag) {
        const crop = sps.frame_cropping;

        let subWidthC = 2;
        let subHeightC = 2;

        // chroma_format_idc defaults to 1 (4:2:0) in the library if not present
        if (sps.chroma_format_idc === 2) {
          subWidthC = 2;
          subHeightC = 1;
        } else if (sps.chroma_format_idc === 3) {
          subWidthC = 1;
          subHeightC = 1;
        }

        const cropUnitX = subWidthC;
        const cropUnitY = subHeightC * (2 - frameMbsOnly);

        cropX = (crop.left + crop.right) * cropUnitX;
        cropY = (crop.top + crop.bottom) * cropUnitY;
      }

      return { width: width - cropX, height: height - cropY };
    } catch (error) {
      console.error('Failed to parse H.264 SPS:', error);
      return null;
    }
  }

  /**
   * Extract H.264 SPS info (profile, constraint, level)
   */
  static extractH264SPSInfo(
    config: Uint8Array
  ): { profile: number; constraint: number; level: number } | null {
    const spsData = this.findH264SPS(config);
    if (!spsData) {
      return null;
    }

    try {
      const sps = parseSPS(Buffer.from(spsData));
      return {
        profile: sps.profile_idc,
        constraint: sps.profile_compatibility,
        level: sps.level_idc,
      };
    } catch (error) {
      console.error('Failed to parse H.264 SPS info:', error);
      return null;
    }
  }

  /**
   * Check if data contains a keyframe (IDR frame)
   * Works for H.264 and H.265
   */
  static containsKeyFrame(data: Uint8Array, codec: VideoCodec): boolean {
    if (codec === 'h264') {
      return this.containsH264IDR(data);
    } else if (codec === 'h265') {
      return this.containsH265IDR(data);
    } else if (codec === 'av1') {
      // AV1 keyframe detection would require OBU parsing
      // For now, rely on the isKeyFrame flag from scrcpy
      return false;
    }
    return false;
  }

  /**
   * Check if H.264 data contains an IDR NAL unit
   */
  private static containsH264IDR(data: Uint8Array): boolean {
    for (let i = 0; i < data.length - 4; i++) {
      if (
        (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 1) ||
        (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0 && data[i + 3] === 1)
      ) {
        const offset = data[i + 2] === 1 ? 3 : 4;
        const nalType = data[i + offset] & 0x1f;
        if (nalType === H264NALUnitType.IDR) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Check if H.265 data contains an IDR NAL unit
   */
  private static containsH265IDR(data: Uint8Array): boolean {
    for (let i = 0; i < data.length - 4; i++) {
      if (
        (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 1) ||
        (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0 && data[i + 3] === 1)
      ) {
        const offset = data[i + 2] === 1 ? 3 : 4;
        const nalType = (data[i + offset] >> 1) & 0x3f; // H.265 NAL type is in bits 1-6
        if (nalType === H265NALUnitType.IDR_W_RADL || nalType === H265NALUnitType.IDR_N_LP) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Find H.264 SPS NAL unit in config data
   */
  private static findH264SPS(config: Uint8Array): Uint8Array | null {
    for (let i = 0; i < config.length - 4; i++) {
      let offset = 0;
      if (config[i] === 0 && config[i + 1] === 0 && config[i + 2] === 1) {
        offset = 3;
      } else if (
        config[i] === 0 &&
        config[i + 1] === 0 &&
        config[i + 2] === 0 &&
        config[i + 3] === 1
      ) {
        offset = 4;
      }

      if (offset > 0) {
        const nalType = config[i + offset] & 0x1f;
        if (nalType === H264NALUnitType.SPS) {
          return config.subarray(i + offset);
        }
      }
    }
    return null;
  }

  /**
   * Find H.265 VPS, SPS, or PPS NAL unit in config data
   */
  private static findH265ConfigNAL(config: Uint8Array): boolean {
    for (let i = 0; i < config.length - 4; i++) {
      let offset = 0;
      if (config[i] === 0 && config[i + 1] === 0 && config[i + 2] === 1) {
        offset = 3;
      } else if (
        config[i] === 0 &&
        config[i + 1] === 0 &&
        config[i + 2] === 0 &&
        config[i + 3] === 1
      ) {
        offset = 4;
      }

      if (offset > 0) {
        const nalType = (config[i + offset] >> 1) & 0x3f;
        if (
          nalType === H265NALUnitType.VPS ||
          nalType === H265NALUnitType.SPS ||
          nalType === H265NALUnitType.PPS
        ) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Generate codec string for WebCodecs API
   */
  static generateCodecString(
    codec: VideoCodec,
    config?: Uint8Array,
    _width?: number,
    _height?: number
  ): string {
    if (codec === 'h264') {
      const spsInfo = config ? this.extractH264SPSInfo(config) : null;
      if (spsInfo) {
        return `avc1.${spsInfo.profile.toString(16).padStart(2, '0')}${spsInfo.constraint.toString(16).padStart(2, '0')}${spsInfo.level.toString(16).padStart(2, '0')}`;
      }
      return 'avc1.42001f'; // Default: baseline profile level 3.1
    } else if (codec === 'h265') {
      // H.265 codec string format: hev1.PROFILE.FLAGS.LEVEL
      // Default to Main profile, Main tier, Level 3.1
      return 'hev1.1.6.L93.B0';
    } else if (codec === 'av1') {
      // AV1 codec string format: av01.PROFILE.LEVEL.BITDEPTH
      // Default to Main profile, Level 3.0, 8-bit
      return 'av01.0.05M.08';
    }
    return 'avc1.42001f'; // Fallback to H.264
  }
}

// Maintain backward compatibility with old class name
export const H264Utils = CodecUtils;

// Export NAL types for backward compatibility
export const NALUnitType = H264NALUnitType;
