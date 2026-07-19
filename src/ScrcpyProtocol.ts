/**
 * Scrcpy Protocol Constants
 *
 * Based on scrcpy v4.x wire protocol.
 * See: https://github.com/Genymobile/scrcpy/blob/v4.0/app/src/demuxer.c
 */

// Device Name header length
export const DEVICE_NAME_LENGTH = 64;

// Video Codec IDs
export const VIDEO_CODEC_ID_H264 = 0x68323634; // "h264"
export const VIDEO_CODEC_ID_H265 = 0x68323635; // "h265"
export const VIDEO_CODEC_ID_AV1 = 0x00617631; // "av1" (little-endian interpretation)
// Audio Codec IDs
export const AUDIO_CODEC_ID_OPUS = 0x6f707573; // "opus"

// Packet header size (PTS/flags + packet_size) for media packets
export const PACKET_HEADER_SIZE = 12;

// Video session packet size (flags + width + height)
export const SESSION_PACKET_SIZE = 12;

// Packet flag bits (high bits of the 8-byte PTS/flags field, big-endian)
// In v4.x the MSB (bit 63) is the SESSION flag, which steals the top bit
// that was previously used for CONFIG. CONFIG and KEY_FRAME shift down by one.
export const PACKET_FLAG_SESSION = 1n << 63n;
export const PACKET_FLAG_CONFIG = 1n << 62n;
export const PACKET_FLAG_KEY_FRAME = 1n << 61n;
export const PACKET_PTS_MASK = PACKET_FLAG_KEY_FRAME - 1n;

// Control Message Types (Host -> Device)
export enum ControlMessageType {
  INJECT_KEYCODE = 0,
  INJECT_TEXT = 1,
  INJECT_TOUCH_EVENT = 2,
  INJECT_SCROLL_EVENT = 3,
  BACK_OR_SCREEN_ON = 4,
  EXPAND_NOTIFICATION_PANEL = 5,
  EXPAND_SETTINGS_PANEL = 6,
  COLLAPSE_PANELS = 7,
  GET_CLIPBOARD = 8,
  SET_CLIPBOARD = 9,
  SET_DISPLAY_POWER = 10,
  ROTATE_DEVICE = 11,
  UHID_CREATE = 12,
  UHID_INPUT = 13,
  UHID_DESTROY = 14,
  OPEN_HARD_KEYBOARD_SETTINGS = 15,
  START_APP = 16,
  RESET_VIDEO = 17,
  CAMERA_SET_TORCH = 18,
  CAMERA_ZOOM_IN = 19,
  CAMERA_ZOOM_OUT = 20,
  RESIZE_DISPLAY = 21,
  SCAN_FILE = 22, // v4.1+
}

// Device Message Types (Device -> Host)
export enum DeviceMessageType {
  CLIPBOARD = 0,
  ACK_CLIPBOARD = 1,
  UHID_OUTPUT = 2,
}

// Motion Event Actions
export enum MotionEventAction {
  DOWN = 0,
  UP = 1,
  MOVE = 2,
}

// Key Actions
export enum KeyAction {
  DOWN = 0,
  UP = 1,
}

// Re-export as namespace for backwards compatibility
export const ScrcpyProtocol = {
  DEVICE_NAME_LENGTH,
  PACKET_HEADER_SIZE,
  SESSION_PACKET_SIZE,
  VIDEO_CODEC_ID_H264,
  VIDEO_CODEC_ID_H265,
  VIDEO_CODEC_ID_AV1,
  AUDIO_CODEC_ID_OPUS,
  PACKET_FLAG_SESSION,
  PACKET_FLAG_CONFIG,
  PACKET_FLAG_KEY_FRAME,
  PACKET_PTS_MASK,
  ControlMessageType,
  DeviceMessageType,
  MotionEventAction,
  KeyAction,
};
