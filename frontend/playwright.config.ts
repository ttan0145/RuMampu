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

/* Local speed switches (all off by default, so CI behaves as before):
   PLAYWRIGHT_REUSE=1             reuse servers that are already listening. Start the backend and
                                  the frontend yourself with the commands in webServer below
                                  (or the static export server in playwright.static.config.ts),
                                  then run playwright with PLAYWRIGHT_REUSE=1 to skip the restart.
   PLAYWRIGHT_TRACE=1             keep traces of failures locally (CI always keeps them).
   PLAYWRIGHT_SKIP_PRICE_MODEL=1  skip load_price_model; it is idempotent, so only skip it when
                                  the database already holds the active price model. */
const reuseServers = process.env.PLAYWRIGHT_REUSE === '1';
const keepTrace = Boolean(process.env.CI) || process.env.PLAYWRIGHT_TRACE === '1';
const skipPriceModel = process.env.PLAYWRIGHT_SKIP_PRICE_MODEL === '1';
const priceModelStep = skipPriceModel
  ? ''
  : `${python} manage.py load_price_model ../ml/app_export --activate && `;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: Number(process.env.PLAYWRIGHT_WORKERS || 1) > 1,
  workers: Number(process.env.PLAYWRIGHT_WORKERS || 1),
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
    trace: keepTrace ? 'retain-on-failure' : 'off',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: useNeon
        ? `${python} manage.py runserver localhost:${backendPort} --noreload`
        : `${python} manage.py migrate --noinput && ${priceModelStep}${python} manage.py runserver localhost:${backendPort} --noreload`,
      cwd: '../backend',
      env: {
        ...process.env,

        DEBUG: 'True',
        ENABLE_TEST_SCENARIOS: 'True',
        // Test runs log in, scan and parse far more often than a person would;
        // an empty rate switches each endpoint limit off for the test server only.
        AUTH_LOGIN_IP_RATE: '',
        AUTH_LOGIN_IDENTIFIER_RATE: '',
        AUTH_PASSWORD_RESET_IP_RATE: '',
        AUTH_PASSWORD_RESET_EMAIL_RATE: '',
        AUTH_PASSWORD_RESET_CONFIRM_RATE: '',
        RECEIPT_SCAN_RATE: '',
        ASSISTANT_ACTION_PREVIEW_RATE: '',
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
      reuseExistingServer: reuseServers,
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
      reuseExistingServer: reuseServers,
      timeout: 120_000,
    },
  ],
});
