import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  use: {
    baseURL: 'http://127.0.0.1:5187',
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chromium',
    viewport: {width: 1280, height: 800},
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node tests/browser/server.mjs',
    url: 'http://127.0.0.1:5187/react.html',
    reuseExistingServer: false,
  },
});
