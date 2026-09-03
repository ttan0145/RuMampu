import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const allowed = new Set(['--allow-writes', '--headed', '--list', '--help']);
if (args.some(arg => !allowed.has(arg))) {
  console.error('Unknown option. Use npm run test:live -- --help.');
  process.exit(2);
}
if (args.includes('--help')) {
  console.log(`RuMampu real production website tests (no local servers or mocks).

npm run test:live                         Read-only financial-data smoke test
npm run test:live -- --allow-writes        Full UI flow with NEW synthetic guest data
npm run test:live -- --allow-writes --headed
npm run test:live -- --list                List the selected test without browsing
npm run test:live:report                   Open the last HTML report

Even read-only visits create an anonymous guest and default categories.
--allow-writes creates one income, two costs and one housing scenario per run.
The isolated synthetic records are retained; existing visitor data is never reused.
No automatic retries, production migrations, reset endpoints, or cleanup deletes.
Reports: output/playwright/live/report and output/playwright/live/test-results.
`);
  process.exit(0);
}

const writes = args.includes('--allow-writes');
console.log(`Target: https://rumampu-frontend.vercel.app/`);
console.log(writes
  ? 'Mode: full UI flow. Synthetic financial records will remain in a new isolated guest.'
  : 'Mode: read-only financial checks. No income, costs or housing scenarios will be saved.');
const require = createRequire(import.meta.url);
const child = spawnSync(process.execPath, [
  require.resolve('@playwright/test/cli'), 'test', '--config=playwright.live.config.ts',
  ...(args.includes('--headed') ? ['--headed'] : []),
  ...(args.includes('--list') ? ['--list'] : []),
], {
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  stdio: 'inherit',
  env: { ...process.env, RUMAMPU_LIVE_WRITES: writes ? '1' : '0' },
});
if (child.error) console.error(child.error.message);
process.exit(child.status ?? 1);
