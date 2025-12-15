import { describe, it, expect } from 'vitest';
import {
  DEVICE_NAME_LENGTH,
  VIDEO_CODEC_ID_H264,
  AUDIO_CODEC_ID_OPUS,
  ControlMessageType,
  DeviceMessageType,
  MotionEventAction,
  KeyAction,
  ScrcpyProtocol,
} from '../../src/ScrcpyProtocol';

describe('ScrcpyProtocol', () => {
  describe('constants', () => {
    it('should have correct device name length', () => {
      expect(DEVICE_NAME_LENGTH).toBe(64);
    });

    it('should have correct video codec ID for H.264', () => {
      // "h264" in ASCII: 0x68323634
      expect(VIDEO_CODEC_ID_H264).toBe(0x68323634);

      // Verify it decodes to "h264"
      const bytes = [
        (VIDEO_CODEC_ID_H264 >> 24) & 0xff,
        (VIDEO_CODEC_ID_H264 >> 16) & 0xff,
        (VIDEO_CODEC_ID_H264 >> 8) & 0xff,
        VIDEO_CODEC_ID_H264 & 0xff,
      ];
      const str = String.fromCharCode(...bytes);
      expect(str).toBe('h264');
    });

    it('should have correct audio codec ID for Opus', () => {
      // "opus" in ASCII: 0x6f707573
      expect(AUDIO_CODEC_ID_OPUS).toBe(0x6f707573);

      // Verify it decodes to "opus"
      const bytes = [
        (AUDIO_CODEC_ID_OPUS >> 24) & 0xff,
        (AUDIO_CODEC_ID_OPUS >> 16) & 0xff,
        (AUDIO_CODEC_ID_OPUS >> 8) & 0xff,
        AUDIO_CODEC_ID_OPUS & 0xff,
      ];
      const str = String.fromCharCode(...bytes);
      expect(str).toBe('opus');
    });
  });

  describe('ControlMessageType', () => {
    it('should have correct values for control message types', () => {
      expect(ControlMessageType.INJECT_KEYCODE).toBe(0);
      expect(ControlMessageType.INJECT_TEXT).toBe(1);
      expect(ControlMessageType.INJECT_TOUCH_EVENT).toBe(2);
      expect(ControlMessageType.INJECT_SCROLL_EVENT).toBe(3);
      expect(ControlMessageType.BACK_OR_SCREEN_ON).toBe(4);
      expect(ControlMessageType.EXPAND_NOTIFICATION_PANEL).toBe(5);
      expect(ControlMessageType.EXPAND_SETTINGS_PANEL).toBe(6);
      expect(ControlMessageType.COLLAPSE_PANELS).toBe(7);
      expect(ControlMessageType.GET_CLIPBOARD).toBe(8);
      expect(ControlMessageType.SET_CLIPBOARD).toBe(9);
      expect(ControlMessageType.SET_DISPLAY_POWER).toBe(10);
      expect(ControlMessageType.ROTATE_DEVICE).toBe(11);
      expect(ControlMessageType.UHID_CREATE).toBe(12);
      expect(ControlMessageType.UHID_INPUT).toBe(13);
    });

    it('should be usable as enum values', () => {
      // Test that enum values can be used in type-safe way
      const type: ControlMessageType = ControlMessageType.INJECT_TOUCH_EVENT;
      expect(type).toBe(2);

      // Test enum reverse mapping
      expect(ControlMessageType[0]).toBe('INJECT_KEYCODE');
      expect(ControlMessageType[2]).toBe('INJECT_TOUCH_EVENT');
    });
  });

  describe('DeviceMessageType', () => {
    it('should have correct values for device message types', () => {
      expect(DeviceMessageType.CLIPBOARD).toBe(0);
      expect(DeviceMessageType.ACK_CLIPBOARD).toBe(1);
      expect(DeviceMessageType.UHID_OUTPUT).toBe(2);
    });

    it('should be usable as enum values', () => {
      const type: DeviceMessageType = DeviceMessageType.CLIPBOARD;
      expect(type).toBe(0);
    });
  });

  describe('MotionEventAction', () => {
    it('should have correct values for motion event actions', () => {
      expect(MotionEventAction.DOWN).toBe(0);
      expect(MotionEventAction.UP).toBe(1);
      expect(MotionEventAction.MOVE).toBe(2);
    });

    it('should cover all pointer states', () => {
      // These are the Android MotionEvent action values
      // DOWN = 0, UP = 1, MOVE = 2
      expect(MotionEventAction.DOWN).toBeLessThan(MotionEventAction.UP);
      expect(MotionEventAction.UP).toBeLessThan(MotionEventAction.MOVE);
    });
  });

  describe('KeyAction', () => {
    it('should have correct values for key actions', () => {
      expect(KeyAction.DOWN).toBe(0);
      expect(KeyAction.UP).toBe(1);
    });

    it('should match Android KeyEvent action values', () => {
      // Android KeyEvent: ACTION_DOWN = 0, ACTION_UP = 1
      expect(KeyAction.DOWN).toBe(0);
      expect(KeyAction.UP).toBe(1);
    });
  });

  describe('ScrcpyProtocol namespace (backwards compatibility)', () => {
    it('should re-export all constants', () => {
      expect(ScrcpyProtocol.DEVICE_NAME_LENGTH).toBe(DEVICE_NAME_LENGTH);
      expect(ScrcpyProtocol.VIDEO_CODEC_ID_H264).toBe(VIDEO_CODEC_ID_H264);
      expect(ScrcpyProtocol.AUDIO_CODEC_ID_OPUS).toBe(AUDIO_CODEC_ID_OPUS);
    });

    it('should re-export all enums', () => {
      expect(ScrcpyProtocol.ControlMessageType).toBe(ControlMessageType);
      expect(ScrcpyProtocol.DeviceMessageType).toBe(DeviceMessageType);
      expect(ScrcpyProtocol.MotionEventAction).toBe(MotionEventAction);
      expect(ScrcpyProtocol.KeyAction).toBe(KeyAction);
    });

    it('should allow accessing enum values through namespace', () => {
      expect(ScrcpyProtocol.ControlMessageType.INJECT_TOUCH_EVENT).toBe(2);
      expect(ScrcpyProtocol.MotionEventAction.DOWN).toBe(0);
    });
  });

  describe('protocol correctness', () => {
    it('should have non-overlapping control message types', () => {
      const types = [
        ControlMessageType.INJECT_KEYCODE,
        ControlMessageType.INJECT_TEXT,
        ControlMessageType.INJECT_TOUCH_EVENT,
        ControlMessageType.INJECT_SCROLL_EVENT,
        ControlMessageType.BACK_OR_SCREEN_ON,
        ControlMessageType.EXPAND_NOTIFICATION_PANEL,
        ControlMessageType.EXPAND_SETTINGS_PANEL,
        ControlMessageType.COLLAPSE_PANELS,
        ControlMessageType.GET_CLIPBOARD,
        ControlMessageType.SET_CLIPBOARD,
        ControlMessageType.SET_DISPLAY_POWER,
        ControlMessageType.ROTATE_DEVICE,
        ControlMessageType.UHID_CREATE,
        ControlMessageType.UHID_INPUT,
      ];

      const uniqueTypes = new Set(types);
      expect(uniqueTypes.size).toBe(types.length);
    });

    it('should have non-overlapping device message types', () => {
      const types = [
        DeviceMessageType.CLIPBOARD,
        DeviceMessageType.ACK_CLIPBOARD,
        DeviceMessageType.UHID_OUTPUT,
      ];

      const uniqueTypes = new Set(types);
      expect(uniqueTypes.size).toBe(types.length);
    });

    it('should have sequential control message type values starting from 0', () => {
      // scrcpy protocol expects sequential values
      expect(ControlMessageType.INJECT_KEYCODE).toBe(0);
      expect(ControlMessageType.INJECT_TEXT).toBe(1);
      expect(ControlMessageType.INJECT_TOUCH_EVENT).toBe(2);
      expect(ControlMessageType.INJECT_SCROLL_EVENT).toBe(3);
      // ... and so on
    });
  });
});
