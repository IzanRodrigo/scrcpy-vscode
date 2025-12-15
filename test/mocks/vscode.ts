/**
 * Minimal VS Code API mock for testing
 * Based on @types/vscode but with stubbed implementations
 */

import { vi } from 'vitest';

// Localization mock
export const l10n = {
  t: (message: string, ...args: unknown[]): string => {
    // Simple string replacement for testing
    return message.replace(/\{(\d+)\}/g, (_, index) => String(args[Number(index)] ?? ''));
  },
};

// Window mock
export const window = {
  showErrorMessage: vi.fn().mockResolvedValue(undefined),
  showWarningMessage: vi.fn().mockResolvedValue(undefined),
  showInformationMessage: vi.fn().mockResolvedValue(undefined),
  showQuickPick: vi.fn().mockResolvedValue(undefined),
  showInputBox: vi.fn().mockResolvedValue(undefined),
  showSaveDialog: vi.fn().mockResolvedValue(undefined),
  showOpenDialog: vi.fn().mockResolvedValue(undefined),
  withProgress: vi.fn().mockImplementation((_, task) => task({ report: vi.fn() })),
  createOutputChannel: vi.fn().mockReturnValue({
    appendLine: vi.fn(),
    append: vi.fn(),
    clear: vi.fn(),
    show: vi.fn(),
    dispose: vi.fn(),
  }),
};

// Workspace mock
export const workspace = {
  getConfiguration: vi.fn().mockReturnValue({
    get: vi.fn().mockReturnValue(undefined),
    has: vi.fn().mockReturnValue(false),
    inspect: vi.fn().mockReturnValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
  }),
  onDidChangeConfiguration: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  fs: {
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(new Uint8Array()),
  },
};

// Env mock
export const env = {
  clipboard: {
    readText: vi.fn().mockResolvedValue(''),
    writeText: vi.fn().mockResolvedValue(undefined),
  },
  openExternal: vi.fn().mockResolvedValue(true),
};

// Uri mock
export class Uri {
  static file(path: string): Uri {
    return new Uri('file', '', path, '', '');
  }

  static parse(value: string): Uri {
    const match = value.match(/^(\w+):\/\/([^/]*)(\/[^?#]*)?(\?[^#]*)?(#.*)?$/);
    if (!match) {
      throw new Error('Invalid URI');
    }
    return new Uri(match[1], match[2] || '', match[3] || '', match[4] || '', match[5] || '');
  }

  static joinPath(base: Uri, ...pathSegments: string[]): Uri {
    const joined = [base.path, ...pathSegments].join('/').replace(/\/+/g, '/');
    return new Uri(base.scheme, base.authority, joined, base.query, base.fragment);
  }

  constructor(
    public scheme: string,
    public authority: string,
    public path: string,
    public query: string,
    public fragment: string
  ) {}

  toString(): string {
    return `${this.scheme}://${this.authority}${this.path}${this.query}${this.fragment}`;
  }

  get fsPath(): string {
    return this.path;
  }

  with(change: {
    scheme?: string;
    authority?: string;
    path?: string;
    query?: string;
    fragment?: string;
  }): Uri {
    return new Uri(
      change.scheme ?? this.scheme,
      change.authority ?? this.authority,
      change.path ?? this.path,
      change.query ?? this.query,
      change.fragment ?? this.fragment
    );
  }
}

// Commands mock
export const commands = {
  registerCommand: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  executeCommand: vi.fn().mockResolvedValue(undefined),
};

// Progress location enum
export enum ProgressLocation {
  SourceControl = 1,
  Window = 10,
  Notification = 15,
}

// ViewColumn enum
export enum ViewColumn {
  Active = -1,
  Beside = -2,
  One = 1,
  Two = 2,
  Three = 3,
}

// Disposable mock
export class Disposable {
  static from(...disposables: { dispose: () => unknown }[]): Disposable {
    return new Disposable(() => disposables.forEach((d) => d.dispose()));
  }

  constructor(private callOnDispose: () => unknown) {}

  dispose(): unknown {
    return this.callOnDispose();
  }
}

// EventEmitter mock
export class EventEmitter<T> {
  private listeners: ((e: T) => unknown)[] = [];

  event = (listener: (e: T) => unknown): Disposable => {
    this.listeners.push(listener);
    return new Disposable(() => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) {
        this.listeners.splice(index, 1);
      }
    });
  };

  fire(event: T): void {
    this.listeners.forEach((listener) => listener(event));
  }

  dispose(): void {
    this.listeners = [];
  }
}
