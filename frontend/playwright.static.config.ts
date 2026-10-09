import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
import path from 'node:path';
import base from './playwright.config';

/* The same specs against a production web export instead of the Metro dev server.
   Since the Expo SDK 57 upgrade the development bundle shows React's "Invalid ARIA
   attribute `ariaHidden`" warning in a toast (#error-toast) that covers the page
   and blocks every click; a production bundle does not. Build first with the same
   environment the dev server gets, then point this config at the export:

     set EXPO_PUBLIC_E2E=1
     set EXPO_PUBLIC_PLAYWRIGHT_API_URL=http://localhost:8000/api/v1
     set EXPO_NO_DOTENV=1
     npx expo export --platform web --output-dir dist --clear
     npx playwright test --config playwright.static.config.ts e2e/epic5-prepare-path.spec.ts

   The backend server entry is reused from playwright.config.ts unchanged; dist/ is
   ignored by git. */

const frontendPort = process.env.PLAYWRIGHT_FRONTEND_PORT || '8081';
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
const exportDirectory = process.env.PLAYWRIGHT_STATIC_DIR || 'dist';
const servers = Array.isArray(base.webServer) ? base.webServer : base.webServer ? [base.webServer] : [];

export default defineConfig({
  ...base,
  webServer: [
    servers[0],
    {
      command: `"${python}" -m http.server ${frontendPort} --bind 127.0.0.1 --directory ${exportDirectory}`,
      cwd: '.',
      url: `http://localhost:${frontendPort}`,
      reuseExistingServer: process.env.PLAYWRIGHT_REUSE === '1',
      timeout: 60_000,
    },
  ],
});
