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
const useNeon = process.env.PLAYWRIGHT_USE_NEON === '1';
const backendPort = process.env.PLAYWRIGHT_BACKEND_PORT || '8000';
const frontendPort = process.env.PLAYWRIGHT_FRONTEND_PORT || '8081';

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
    baseURL: `http://localhost:${frontendPort}`,
    ...(browserChannel ? { channel: browserChannel } : {}),
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: useNeon
        ? `${python} manage.py runserver localhost:${backendPort} --noreload`
        : `${python} manage.py migrate --noinput && ${python} manage.py runserver localhost:${backendPort} --noreload`,
      cwd: '../backend',
      env: {
        ...process.env,

        DEBUG: 'True',
        ENABLE_TEST_SCENARIOS: 'True',
        CORS_ALLOWED_ORIGINS: `http://localhost:${frontendPort},http://127.0.0.1:${frontendPort}`,

        // Local tests use SQLite; opt-in Epic 4 runs can use backend/.env Neon settings.
        ...(!useNeon ? {
          PGHOST: '',
          PGDATABASE: '',
          PGUSER: '',
          PGPASSWORD: '',
          PGPORT: '',
          PGSSLMODE: '',
        } : {}),
      },
      url: `http://localhost:${backendPort}/api/v1/health/`,
      reuseExistingServer: false,
      timeout: 120_000,
    },

    {
      command: `npm run web -- --port ${frontendPort} --clear`,
      cwd: '.',
      env: {
        ...process.env,
        CI: '1',
        EXPO_NO_DOTENV: '1',
        EXPO_PUBLIC_E2E: '1',

        // Override only for Playwright. Keep frontend/.env for Expo Go.
        EXPO_PUBLIC_PLAYWRIGHT_API_URL: `http://localhost:${backendPort}/api/v1`,
      },
      url: `http://localhost:${frontendPort}`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
