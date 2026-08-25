import { expect, Page, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const API = 'http://localhost:8000/api/v1';
const EVIDENCE = path.resolve(__dirname, '../../output/playwright/housing-integration/evidence');

test.beforeAll(() => mkdirSync(EVIDENCE, { recursive: true }));

async function openApp(page: Page): Promise<void> {
  await page.goto('/');
  const splash = page.getByLabel('RuMampu');
  if (await splash.isVisible().catch(() => false)) await splash.click();
  const skip = page.getByText('Skip', { exact: true });
  if (await skip.isVisible().catch(() => false)) await skip.click();
}

test('housing uses the finance guest session and authoritative pre-check record', async ({ browser, page }) => {
  const loaded = await page.request.post(`${API}/dev/scenarios/my-gig-driver-12m/load/`, {
    data: { confirm_reset: true },
  });
  expect(loaded.status()).toBe(201);

  const preCheck = await page.request.post(`${API}/housing/pre-check/`, { data: {} });
  expect(preCheck.ok()).toBeTruthy();
  const result = await preCheck.json();
  expect(result).toMatchObject({
    provenance: 'calculated_from_user_record',
    work_cost_basis: 'current_active_monthly_snapshot',
    has_existing_shortfall: false,
    tested_months: 12,
    largest_existing_gap: 0,
    worst_month: null,
  });

  const scenario = await page.request.post(`${API}/housing/scenarios/`, {
    data: {
      property_price: '300000.00',
      deposit: '30000.00',
      financing_rate: '4.250',
      tenure_years: 30,
      known_monthly_payment: null,
    },
  });
  expect(scenario.status()).toBe(201);

  const other = await browser.newContext();
  try {
    const otherScenarios = await other.request.get(`${API}/housing/scenarios/`);
    const otherPreCheck = await other.request.post(`${API}/housing/pre-check/`, { data: {} });
    expect(await otherScenarios.json()).toEqual([]);
    expect((await otherPreCheck.json()).tested_months).toBe(0);
  } finally {
    await other.close();
  }

  await openApp(page);
  await page.getByText('Test', { exact: true }).last().click();
  await page.getByText(/Total monthly cost/).last().click();
  await page.getByText(/Run the test/).last().click();

  await expect(page.getByText(/2 of your 12 recorded months would have run short/)).toBeVisible();
  await expect(page.getByText('RM 742', { exact: true })).toBeVisible();
  await page.screenshot({
    path: path.join(EVIDENCE, '01-authoritative-pre-housing-check.png'),
    fullPage: true,
  });
});
