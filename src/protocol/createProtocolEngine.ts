/**
 * Factory that selects the right protocol engine for an installed scrcpy version.
 *
 * Adding support for a future major version (e.g. v5) is a two-step change:
 *   1. Implement `ProtocolEngine` in `V5ProtocolEngine.ts`.
 *   2. Add a `case 5:` here that returns it.
 *
 * No edits to `ScrcpyConnection` are required.
 */

import { ToolNotFoundError, ToolErrorCode } from '../types/AppState';
import type { ProtocolEngine } from './ProtocolEngine';
import { V3ProtocolEngine } from './V3ProtocolEngine';
import { V4ProtocolEngine } from './V4ProtocolEngine';

/**
 * Extract the major version integer from a version string like "4.0" or "3.3.2".
 * Returns 0 if the string can't be parsed.
 */
export function parseMajorVersion(version: string): number {
  const match = version.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Create the protocol engine matching the given scrcpy version string.
 *
 * @param version - Version string from `scrcpy --version` (e.g. "4.0", "3.3.2")
 * @param installInstructions - Optional override for the error message shown
 *   to users running an unsupported version. When omitted, a generic message is used.
 */
export function createProtocolEngine(version: string): ProtocolEngine {
  const major = parseMajorVersion(version);

  switch (major) {
    case 4:
      return new V4ProtocolEngine(version);
    case 3:
      return new V3ProtocolEngine(version);
    default:
      throw new ToolNotFoundError(
        ToolErrorCode.SCRCPY_NOT_FOUND,
        `Unsupported scrcpy version ${version}. This extension requires scrcpy 3.x or 4.x. ` +
          'Install the latest scrcpy from https://github.com/Genymobile/scrcpy/releases'
      );
  }
}
