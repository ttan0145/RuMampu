import { defineConfig } from '@playwright/test';

const npm = process.platform === 'win32'
  ? '"C:\\Program Files\\nodejs\\npm.cmd"'
  : 'npm';
const python = process.platform === 'win32'
  ? '.\\.venv\\Scripts\\python.exe'
  : './.venv/bin/python';
const browserChannel = process.env.PLAYWRIGHT_CHANNEL?.trim();

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  outputDir: '../output/playwright/epic-2/test-results',
  reporter: [
    ['list'],
    ['html', { outputFolder: '../output/playwright/epic-2/report', open: 'never' }],
  ],
  use: {
    baseURL: 'http://localhost:8081',
    ...(browserChannel ? { channel: browserChannel } : {}),
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: `${python} manage.py migrate --noinput && ${python} manage.py runserver localhost:8000 --noreload`,
      cwd: '../backend',
      env: { ...process.env, ENABLE_TEST_SCENARIOS: 'True' },
      url: 'http://localhost:8000/api/v1/health/',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: `${npm} run web -- --port 8081`,
      cwd: '.',
      env: {
        ...process.env,
        CI: '1',
        EXPO_PUBLIC_APP_MODE: 'api',
        EXPO_PUBLIC_API_URL: 'http://localhost:8000/api/v1',
      },
      url: 'http://localhost:8081',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
