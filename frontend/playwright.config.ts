import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
import path from 'node:path';

const npm = process.platform === 'win32'
  ? '"C:\\Program Files\\nodejs\\npm.cmd"'
  : 'npm';

const repositoryDirectory = path.resolve(__dirname, '..');
const pythonCandidates = process.platform === 'win32'
  ? [
      path.join(repositoryDirectory, 'backend', '.venv', 'Scripts', 'python.exe'),
      path.join(repositoryDirectory, 'venv', 'Scripts', 'python.exe'),
      path.join(repositoryDirectory, '.venv', 'Scripts', 'python.exe'),
    ]
  : [
      path.join(repositoryDirectory, 'backend', '.venv', 'bin', 'python'),
      path.join(repositoryDirectory, 'venv', 'bin', 'python'),
      path.join(repositoryDirectory, '.venv', 'bin', 'python'),
    ];
const python = process.env.PLAYWRIGHT_PYTHON?.trim()
  || pythonCandidates.find(candidate => existsSync(candidate))
  || (process.platform === 'win32' ? 'python' : 'python3');

const browserChannel = process.env.PLAYWRIGHT_CHANNEL?.trim();

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  outputDir: '../output/playwright/test-results',
  reporter: [
    ['list'],
    ['html', { outputFolder: '../output/playwright/report', open: 'never' }],
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
      env: {
        ...process.env,
        ENABLE_TEST_SCENARIOS: 'True',
        // Acceptance tests must use the local SQLite database, not Neon.
        // settings.py loads backend/.env, but python-dotenv does not override
        // environment variables already supplied here.
        PGHOST: '',
        PGDATABASE: '',
        PGUSER: '',
        PGPASSWORD: '',
        PGPORT: '',
        PGSSLMODE: '',
      },
      url: 'http://localhost:8000/api/v1/health/',
      // Do not accidentally reuse a manually-running Django server connected to Neon.
      reuseExistingServer: false,
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
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
