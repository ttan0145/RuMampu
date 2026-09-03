import { defineConfig } from '@playwright/test';
import { LIVE_APP } from './live-e2e/support';

// Separate from playwright.config.ts: never starts Expo/Django or runs migrations.
// Default local CI only discovers ./e2e, not these manually invoked live tests.
export default defineConfig({
  testDir: './live-e2e',
  testMatch: 'production.spec.ts',
  grep: process.env.RUMAMPU_LIVE_WRITES === '1' ? /TECH-LIVE-02/ : /TECH-LIVE-01/,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  repeatEach: 1,
  timeout: 240_000,
  expect: { timeout: 20_000 },
  outputDir: '../output/playwright/live/test-results',
  reporter: [
    ['list'],
    ['html', { outputFolder: '../output/playwright/live/report', open: 'never' }],
    ['json', { outputFile: '../output/playwright/live/report/results.json' }],
  ],
  use: {
    baseURL: LIVE_APP,
    browserName: 'chromium',
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
    viewport: { width: 390, height: 844 },
    locale: 'en-GB',
    timezoneId: 'Asia/Kuala_Lumpur',
    storageState: { cookies: [], origins: [] },
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    serviceWorkers: 'block',
  },
});
