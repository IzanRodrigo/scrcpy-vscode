/**
 * Tests for createProtocolEngine factory and parseMajorVersion helper.
 *
 * Verifies version dispatch, rejection of unsupported versions, and that each
 * major version maps to the right engine class.
 */

import { describe, it, expect } from 'vitest';
import {
  createProtocolEngine,
  parseMajorVersion,
} from '../../../src/protocol/createProtocolEngine';
import { V3ProtocolEngine } from '../../../src/protocol/V3ProtocolEngine';
import { V4ProtocolEngine } from '../../../src/protocol/V4ProtocolEngine';
import { ToolNotFoundError } from '../../../src/types/AppState';

describe('parseMajorVersion', () => {
  it('extracts major from semver strings', () => {
    expect(parseMajorVersion('4.0')).toBe(4);
    expect(parseMajorVersion('4.0.1')).toBe(4);
    expect(parseMajorVersion('3.3.2')).toBe(3);
    expect(parseMajorVersion('3.12.0')).toBe(3);
  });

  it('handles plain major numbers', () => {
    expect(parseMajorVersion('4')).toBe(4);
    expect(parseMajorVersion('5')).toBe(5);
  });

  it('returns 0 for unparseable input', () => {
    expect(parseMajorVersion('')).toBe(0);
    expect(parseMajorVersion('not-a-version')).toBe(0);
  });
});

describe('createProtocolEngine', () => {
  it('returns V4ProtocolEngine for 4.x versions', () => {
    const engine = createProtocolEngine('4.0');
    expect(engine).toBeInstanceOf(V4ProtocolEngine);
    expect(engine.majorVersion).toBe(4);
    expect(engine.version).toBe('4.0');
    expect(engine.serverStreamMetaArg).toBe('send_stream_meta');
  });

  it('returns V4ProtocolEngine for newer 4.x patch versions', () => {
    const engine = createProtocolEngine('4.1.0');
    expect(engine).toBeInstanceOf(V4ProtocolEngine);
    expect(engine.version).toBe('4.1.0');
  });

  it('returns V3ProtocolEngine for 3.x versions', () => {
    const engine = createProtocolEngine('3.3.2');
    expect(engine).toBeInstanceOf(V3ProtocolEngine);
    expect(engine.majorVersion).toBe(3);
    expect(engine.version).toBe('3.3.2');
    expect(engine.serverStreamMetaArg).toBe('send_codec_meta');
  });

  it('throws ToolNotFoundError for unsupported v2', () => {
    expect(() => createProtocolEngine('2.7')).toThrow(ToolNotFoundError);
    expect(() => createProtocolEngine('2.7')).toThrow(/Unsupported scrcpy version 2\.7/);
  });

  it('throws ToolNotFoundError for unparseable input', () => {
    expect(() => createProtocolEngine('garbage')).toThrow(ToolNotFoundError);
  });

  it('throws ToolNotFoundError for v1', () => {
    expect(() => createProtocolEngine('1.0')).toThrow(ToolNotFoundError);
  });
});
