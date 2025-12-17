/**
 * iOS Device Manager - handles device discovery via ios-helper CLI
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { DeviceInfo } from '../IDeviceConnection';
import { isIOSSupportAvailable } from '../PlatformCapabilities';

/**
 * Message types from the iOS helper binary protocol
 */
enum MessageType {
  DEVICE_LIST = 0x01,
}

/**
 * Manages iOS device discovery using the ios-helper CLI
 */
export class iOSDeviceManager {
  /**
   * Get list of connected iOS devices
   */
  static async getAvailableDevices(): Promise<DeviceInfo[]> {
    if (!isIOSSupportAvailable()) {
      return [];
    }

    const helperPath = this.getHelperPath();

    // Check if helper exists
    if (!fs.existsSync(helperPath)) {
      console.warn('[iOSDeviceManager] ios-helper binary not found at:', helperPath);
      return [];
    }

    return new Promise((resolve) => {
      // If helper is a JS file, run with node
      const isNodeScript = helperPath.endsWith('.js');
      const command = isNodeScript ? 'node' : helperPath;
      const args = isNodeScript ? [helperPath, 'list'] : ['list'];

      const proc = spawn(command, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const chunks: Buffer[] = [];

      proc.stdout.on('data', (data: Buffer) => {
        chunks.push(data);
      });

      proc.stderr.on('data', (data: Buffer) => {
        const message = data.toString().trim();
        if (message) {
          console.log('[ios-helper]', message);
        }
      });

      proc.on('close', () => {
        try {
          const buffer = Buffer.concat(chunks);

          // Parse protocol: scan for DEVICE_LIST message
          // Format: type (1 byte) + length (4 bytes) + payload
          let offset = 0;
          while (offset + 5 <= buffer.length) {
            const type = buffer.readUInt8(offset);
            const length = buffer.readUInt32BE(offset + 1);

            if (offset + 5 + length > buffer.length) {
              break; // Incomplete message
            }

            if (type === MessageType.DEVICE_LIST) {
              const payload = buffer.subarray(offset + 5, offset + 5 + length);
              const devices = JSON.parse(payload.toString('utf8'));

              resolve(
                devices.map((d: { udid: string; name: string; model: string }) => ({
                  serial: d.udid,
                  name: d.name,
                  model: d.model,
                  platform: 'ios' as const,
                }))
              );
              return;
            }

            offset += 5 + length; // Move to next message
          }

          resolve([]);
        } catch (error) {
          console.error('[iOSDeviceManager] Failed to parse device list:', error);
          resolve([]);
        }
      });

      proc.on('error', (error) => {
        console.error('[iOSDeviceManager] Failed to spawn ios-helper:', error);
        resolve([]);
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        proc.kill();
        resolve([]);
      }, 10000);
    });
  }

  /**
   * Get path to the ios-helper binary
   */
  private static getHelperPath(): string {
    // Check environment variable for mock helper
    const envHelperPath = process.env.IOS_HELPER_PATH;
    if (envHelperPath && fs.existsSync(envHelperPath)) {
      return envHelperPath;
    }

    // In development, look for the built binary in native/ios-helper
    // In production, it's bundled alongside the extension
    const extensionPath = path.join(__dirname, '..');

    // Try production path first (bundled with extension)
    const prodPath = path.join(extensionPath, 'ios-helper');

    // Development path
    const devPath = path.join(
      extensionPath,
      '..',
      'native',
      'ios-helper',
      '.build',
      'release',
      'ios-helper'
    );

    // Check if running in development by looking for node_modules at project root
    const projectRoot = path.join(extensionPath, '..');
    const isDevMode = fs.existsSync(path.join(projectRoot, 'node_modules'));

    if (isDevMode && fs.existsSync(devPath)) {
      return devPath;
    }

    return prodPath;
  }
}
