/**
 * WDASetupManager - Manages the setup-wda.sh script execution
 *
 * This class spawns the setup-wda script, parses its output to track state transitions,
 * and emits events for UI updates and user action requirements.
 */

import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * WDA setup process state
 */
export type WDASetupState =
  | 'idle'
  | 'checking_xcode'
  | 'checking_iproxy'
  | 'checking_device'
  | 'cloning_wda'
  | 'configuring'
  | 'building'
  | 'starting'
  | 'ready'
  | 'error'
  | 'cancelled';

/**
 * WDA setup status with UI-relevant information
 */
export interface WDASetupStatus {
  state: WDASetupState;
  message?: string;
  error?: string;
  requiresUserAction: boolean;
  userActionInstructions?: string[];
}

/**
 * Events emitted by WDASetupManager
 */
export interface WDASetupManagerEvents {
  'state-change': (status: WDASetupStatus) => void;
  'user-action-required': (status: WDASetupStatus) => void;
  output: (line: string) => void;
  error: (error: Error) => void;
}

/**
 * Output pattern matching for state detection
 */
interface StatePattern {
  pattern: RegExp;
  state: WDASetupState;
  message: string;
}

const STATE_PATTERNS: StatePattern[] = [
  { pattern: /Checking Xcode/i, state: 'checking_xcode', message: 'Checking Xcode...' },
  { pattern: /Checking iproxy/i, state: 'checking_iproxy', message: 'Checking iproxy...' },
  { pattern: /Checking iOS device/i, state: 'checking_device', message: 'Checking iOS device...' },
  {
    pattern: /Checking WebDriverAgent|Cloning WebDriverAgent/i,
    state: 'cloning_wda',
    message: 'Setting up WebDriverAgent...',
  },
  {
    pattern: /Checking ios-helper/i,
    state: 'checking_device',
    message: 'Checking ios-helper...',
  },
  {
    pattern: /First-time setup|Configure signing|Configuring code signing/i,
    state: 'configuring',
    message: 'Configure signing in Xcode',
  },
  {
    pattern: /Building WebDriverAgent/i,
    state: 'building',
    message: 'Building WebDriverAgent...',
  },
  {
    pattern: /Starting WebDriverAgent/i,
    state: 'starting',
    message: 'Starting WebDriverAgent...',
  },
  {
    pattern: /Ready!.*Touch input/i,
    state: 'ready',
    message: 'Touch input enabled!',
  },
  {
    pattern: /WDA repository ready/i,
    state: 'cloning_wda',
    message: 'WebDriverAgent ready',
  },
  {
    pattern: /WDA already built/i,
    state: 'building',
    message: 'WebDriverAgent ready',
  },
];

/**
 * Pattern to detect when script is waiting for user input
 */
const USER_ACTION_PATTERN = /Press Enter to (retry|continue)/i;

/**
 * Patterns to extract user action instructions
 */
const INSTRUCTION_PATTERNS = [
  // Xcode installation
  {
    trigger: /Xcode.*not.*found|xcodebuild.*not.*configured/i,
    instructions: [
      '1. Open the App Store',
      '2. Search for "Xcode" and install it',
      '3. Open Xcode once to accept the license',
      '4. Click Continue when ready',
    ],
  },
  // Homebrew installation
  {
    trigger: /Homebrew.*not.*found|brew.*not.*found/i,
    instructions: [
      '1. Open Terminal and run:',
      '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
      '2. Click Continue when installation completes',
    ],
  },
  // Device connection
  {
    trigger: /No iOS devices found|Connect.*iOS device/i,
    instructions: [
      '1. Connect your iOS device via USB',
      '2. Unlock the device',
      '3. Tap "Trust" if prompted on the device',
      '4. Click Continue when ready',
    ],
  },
  // Code signing
  {
    trigger: /Configure.*signing|First-time setup/i,
    instructions: [
      'Xcode will open automatically.',
      '1. Select "WebDriverAgentRunner" target',
      '2. Go to "Signing & Capabilities" tab',
      '3. Check "Automatically manage signing"',
      '4. Select your Team (add Apple ID if needed)',
      '5. Repeat for "IntegrationApp" target',
      '6. Click Continue when done',
    ],
  },
  // Build failures
  {
    trigger: /BUILD FAILED|build.*failed/i,
    instructions: [
      'The build failed. Common fixes:',
      '1. Check code signing in Xcode',
      '2. Ensure device is connected and unlocked',
      '3. Try restarting Xcode',
      'Click Continue to retry',
    ],
  },
  // Device trust
  {
    trigger: /trust.*developer|Device Management/i,
    instructions: [
      'Trust the developer on your iOS device:',
      '1. Go to Settings > General > VPN & Device Management',
      '2. Tap your developer profile',
      '3. Tap "Trust"',
      '4. Click Continue when done',
    ],
  },
];

export class WDASetupManager extends EventEmitter {
  private process: ChildProcess | null = null;
  private currentState: WDASetupState = 'idle';
  private outputBuffer: string = '';
  private recentOutput: string[] = [];
  private pendingUserAction: boolean = false;
  private lastInstructions: string[] = [];
  private extensionUri: vscode.Uri;

  constructor(extensionUri: vscode.Uri) {
    super();
    this.extensionUri = extensionUri;
  }

  /**
   * Whether the setup process is currently running
   */
  get isRunning(): boolean {
    return this.process !== null && this.currentState !== 'idle' && this.currentState !== 'ready';
  }

  /**
   * Current setup state
   */
  get state(): WDASetupState {
    return this.currentState;
  }

  /**
   * Start the WDA setup process
   */
  async start(): Promise<void> {
    if (this.process) {
      console.warn('WDASetupManager: Setup already running');
      return;
    }

    // Reset state
    this.currentState = 'idle';
    this.outputBuffer = '';
    this.recentOutput = [];
    this.pendingUserAction = false;
    this.lastInstructions = [];

    // Find the setup script
    const scriptPath = path.join(this.extensionUri.fsPath, 'scripts', 'setup-wda.sh');

    try {
      // Spawn the script
      this.process = spawn('bash', [scriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          // Disable colors for easier parsing
          NO_COLOR: '1',
          TERM: 'dumb',
        },
      });

      this.setupProcessHandlers();

      // Initial state
      this.updateState('checking_xcode');
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * Cancel the setup process
   */
  cancel(): void {
    if (this.process) {
      this.process.kill('SIGTERM');
      // Give it a moment, then force kill if needed
      setTimeout(() => {
        if (this.process) {
          this.process.kill('SIGKILL');
        }
      }, 1000);
    }
    this.cleanup('cancelled');
  }

  /**
   * Continue after user has completed required action
   * Sends Enter key to the script's stdin
   */
  continueAfterUserAction(): void {
    if (this.process && this.process.stdin && this.pendingUserAction) {
      this.pendingUserAction = false;
      this.process.stdin.write('\n');
    }
  }

  /**
   * Set up handlers for process stdout/stderr/exit
   */
  private setupProcessHandlers(): void {
    if (!this.process) {
      return;
    }

    // Handle stdout
    this.process.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      this.outputBuffer += text;
      this.parseOutput(text);
    });

    // Handle stderr (also contains script output)
    this.process.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      this.outputBuffer += text;
      this.parseOutput(text);
    });

    // Handle process exit
    this.process.on('close', (code: number | null) => {
      if (code === 0 && this.currentState === 'ready') {
        // Success - already handled
      } else if (this.currentState !== 'cancelled') {
        // Unexpected exit
        this.handleError(new Error(`Setup process exited with code ${code}`));
      }
      this.process = null;
    });

    this.process.on('error', (error: Error) => {
      this.handleError(error);
    });
  }

  /**
   * Parse output text for state changes and user action requirements
   */
  private parseOutput(text: string): void {
    // Split by newlines and process each line
    const lines = text.split(/\r?\n/);

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      // Store recent output for instruction detection
      this.recentOutput.push(line);
      if (this.recentOutput.length > 50) {
        this.recentOutput.shift();
      }

      // Emit raw output for logging
      this.emit('output', line);

      // Parse the line for state changes
      this.parseLine(line);
    }
  }

  /**
   * Parse a single line for state transitions
   */
  private parseLine(line: string): void {
    // Check for user action required
    if (USER_ACTION_PATTERN.test(line)) {
      this.pendingUserAction = true;
      this.emitUserActionRequired();
      return;
    }

    // Check for state patterns
    for (const pattern of STATE_PATTERNS) {
      if (pattern.pattern.test(line)) {
        this.updateState(pattern.state, pattern.message);
        return;
      }
    }

    // Check for error indicators
    if (/error|failed|not found/i.test(line) && !/error handling/i.test(line)) {
      // Update instructions based on error type
      this.detectInstructions();
    }
  }

  /**
   * Update the current state and emit change event
   */
  private updateState(state: WDASetupState, message?: string): void {
    const previousState = this.currentState;
    this.currentState = state;

    // Detect instructions when entering certain states
    if (state === 'configuring') {
      this.detectInstructions();
    }

    const status = this.getStatus(message);
    this.emit('state-change', status);

    // Log state change
    console.log(`WDASetupManager: ${previousState} -> ${state}`, message || '');
  }

  /**
   * Detect user action instructions from recent output
   */
  private detectInstructions(): void {
    const recentText = this.recentOutput.join('\n');

    for (const instructionPattern of INSTRUCTION_PATTERNS) {
      if (instructionPattern.trigger.test(recentText)) {
        this.lastInstructions = instructionPattern.instructions;
        return;
      }
    }
  }

  /**
   * Emit user action required event with appropriate instructions
   */
  private emitUserActionRequired(): void {
    // Detect instructions based on recent output
    this.detectInstructions();

    const status = this.getStatus();
    status.requiresUserAction = true;
    status.userActionInstructions =
      this.lastInstructions.length > 0 ? this.lastInstructions : undefined;

    this.emit('user-action-required', status);
  }

  /**
   * Get the current status object
   */
  private getStatus(message?: string): WDASetupStatus {
    return {
      state: this.currentState,
      message: message || this.getStatusMessage(),
      requiresUserAction: this.pendingUserAction,
      userActionInstructions:
        this.pendingUserAction && this.lastInstructions.length > 0
          ? this.lastInstructions
          : undefined,
    };
  }

  /**
   * Get a human-readable status message for the current state
   */
  private getStatusMessage(): string {
    switch (this.currentState) {
      case 'idle':
        return 'Ready to start';
      case 'checking_xcode':
        return 'Checking Xcode...';
      case 'checking_iproxy':
        return 'Checking iproxy...';
      case 'checking_device':
        return 'Checking iOS device...';
      case 'cloning_wda':
        return 'Setting up WebDriverAgent...';
      case 'configuring':
        return 'Configure signing in Xcode';
      case 'building':
        return 'Building WebDriverAgent...';
      case 'starting':
        return 'Starting WebDriverAgent...';
      case 'ready':
        return 'Touch input enabled!';
      case 'error':
        return 'Setup failed';
      case 'cancelled':
        return 'Setup cancelled';
      default:
        return 'Setting up...';
    }
  }

  /**
   * Handle errors during setup
   */
  private handleError(error: Error): void {
    console.error('WDASetupManager error:', error);
    this.cleanup('error');

    const status = this.getStatus();
    status.error = error.message;
    this.emit('state-change', status);
    this.emit('error', error);
  }

  /**
   * Clean up resources
   */
  private cleanup(finalState: WDASetupState): void {
    this.currentState = finalState;
    this.process = null;
    this.outputBuffer = '';
    this.pendingUserAction = false;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.cancel();
    this.removeAllListeners();
  }
}
