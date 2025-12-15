import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Globals disabled - explicit imports required
    globals: false,

    // Test patterns
    include: ['test/**/*.test.ts'],

    // Default environment is node, webview tests specify their own
    environment: 'node',

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/extension.ts', // Extension entry (integration-heavy)
        'src/ScrcpyViewProvider.ts', // VS Code UI provider (hard to unit test)
        'src/webview/main.ts', // Webview entry (integration-heavy)
        'src/webview/VideoRenderer.ts', // WebCodecs (requires real decoder)
        'src/webview/AudioRenderer.ts', // WebAudio (requires real context)
        'src/webview/WebviewTemplate.ts', // HTML template (no logic)
      ],
      // Coverage thresholds - set lower initially, increase as coverage improves
      thresholds: {
        lines: 45,
        functions: 45,
        branches: 35,
        statements: 45,
      },
    },

    // Test setup file
    setupFiles: ['./test/setup.ts'],
  },

  resolve: {
    alias: {
      // Map vscode module to our mock
      vscode: path.resolve(__dirname, './test/mocks/vscode.ts'),
    },
  },
});
