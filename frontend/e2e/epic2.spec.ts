import { expect, Page, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const API = 'http://localhost:8000/api/v1';
const EVIDENCE = path.resolve(__dirname, '../../output/playwright/epic-2/evidence');

test.beforeAll(() => mkdirSync(EVIDENCE, { recursive: true }));

async function openApp(page: Page): Promise<void> {
  await page.goto('/');
  const splash = page.getByLabel('RuMampu');
  if (await splash.isVisible().catch(() => false)) await splash.click();
  const skip = page.getByText('Skip', { exact: true });
  if (await skip.isVisible().catch(() => false)) await skip.click();
}

async function openMoneyScreen(page: Page, label: string): Promise<void> {
  await page.getByText('Money', { exact: true }).last().click();
  await page.getByText(label, { exact: true }).last().click();
}

async function resetScreenScroll(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.querySelectorAll('*').forEach(element => { element.scrollLeft = 0; });
  });
  await page.getByTestId('screen-scroll').evaluate(element => {
    element.scrollTop = 0;
    element.scrollLeft = 0;
  });
}

async function loadTwelveMonthScenario(page: Page): Promise<void> {
  const response = await page.request.post(`${API}/dev/scenarios/my-gig-driver-12m/load/`, {
    data: { confirm_reset: true },
  });
  expect(response.status()).toBe(201);
}

async function addIncomeMonth(page: Page, date: string, amount: string): Promise<void> {
  const record = await page.request.get(`${API}/income/record/`);
  expect(record.ok()).toBeTruthy();
  const payload = await record.json();
  const source = payload.sources.find((item: { slug: string }) => item.slug === 'ehail');
  const created = await page.request.post(`${API}/income/entries/`, {
    data: {
      amount,
      date,
      source_id: source.id,
      entry_method: 'manual',
      confirm_outlier: true,
    },
  });
  expect(created.status()).toBe(201);
}

async function setPetrolWorkCost(page: Page, amount: string): Promise<void> {
  const response = await page.request.get(`${API}/work-costs/`);
  expect(response.ok()).toBeTruthy();
  const items = await response.json();
  const petrol = items.find((item: { slug: string }) => item.slug === 'petrol');
  const updated = await page.request.patch(`${API}/work-costs/${petrol.id}/`, {
    data: { monthly_amount: amount },
  });
  expect(updated.ok()).toBeTruthy();
}

async function assertForbiddenConclusionsAbsent(page: Page): Promise<void> {
  const body = page.locator('body');
  await expect(body).not.toContainText('75%');
  await expect(body).not.toContainText(/\bCV\b/);
  await expect(body).not.toContainText(/risk band/i);
  await expect(body).not.toContainText(/stable income/i);
}

test('US2.1–US2.3 show the authoritative 12-month pattern and statistics', async ({ page }) => {
  await loadTwelveMonthScenario(page);
  await openApp(page);
  await openMoneyScreen(page, 'Income pattern');

  const bars = page.locator(
    '[aria-label*="calculated usable income"]:not([aria-label="Month-by-month calculated usable income"])',
  );
  await expect(bars).toHaveCount(12);
  await expect(page.getByLabel(/Aug 25: RM 4,030.00 calculated usable income/)).toBeVisible();
  await expect(page.getByLabel(/Feb 26: RM 3,160.00 calculated usable income, lowest recorded month/)).toBeVisible();
  await expect(page.getByText('RM 4,437.50', { exact: true })).toBeVisible();
  await expect(page.getByText('RM 4,385.00', { exact: true })).toBeVisible();
  await expect(page.getByText('RM 5,870.00', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('RM 3,160.00', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('RM 2,710.00', { exact: true })).toBeVisible();
  await expect(page.getByText('RM 699.16', { exact: true })).toBeVisible();
  await expect(page.getByText(/Lowest in your current record: Feb 2026/)).toBeVisible();
  await expect(page.getByText(/not a financial standard or a prediction/i)).toBeVisible();
  await expect(page.getByText('Scroll horizontally to see all recorded months.', { exact: true })).toBeVisible();
  const augustHeight = await page.getByTestId('income-bar-2025-08').evaluate(
    element => Number.parseFloat(getComputedStyle(element).height),
  );
  const februaryHeight = await page.getByTestId('income-bar-2026-02').evaluate(
    element => Number.parseFloat(getComputedStyle(element).height),
  );
  expect(augustHeight).toBeGreaterThan(februaryHeight);
  await assertForbiddenConclusionsAbsent(page);
  await resetScreenScroll(page);
  await page.screenshot({ path: path.join(EVIDENCE, '01-income-pattern-12m.png'), fullPage: true });
});

test('US2.4 explicitly confirms represented and unrepresented slower months and persists', async ({ page }) => {
  await addIncomeMonth(page, '2026-01-05', '1000.00');
  await addIncomeMonth(page, '2026-08-05', '1600.00');
  await openApp(page);
  await openMoneyScreen(page, 'Coverage check');

  await page.getByText('Yes', { exact: true }).click();
  await page.getByText('Jan', { exact: true }).click();
  await page.getByText('Mar', { exact: true }).click();
  await page.getByText('Aug', { exact: true }).click();
  await expect(page.getByText(/Represented in your recorded income/)).toHaveCount(0);
  await page.getByText('Check coverage', { exact: true }).click();

  await expect(page.getByText('Represented in your recorded income: Jan, Aug.', { exact: true })).toBeVisible();
  await expect(page.getByText('Not yet represented in your recorded income: Mar.', { exact: true })).toBeVisible();
  await resetScreenScroll(page);
  await page.screenshot({ path: path.join(EVIDENCE, '02-coverage-months.png'), fullPage: true });

  await page.reload();
  await openApp(page);
  await openMoneyScreen(page, 'Coverage check');
  await expect(page.getByText('Not yet represented in your recorded income: Mar.', { exact: true })).toBeVisible();

  await page.getByText('No', { exact: true }).click();
  await page.getByText('Check coverage', { exact: true }).click();
  await expect(page.getByText(/Across 2 recorded months, usable income ranges from RM 1,000.00 to RM 1,600.00/)).toBeVisible();

  await page.getByText('Not sure', { exact: true }).click();
  await page.getByText('Check coverage', { exact: true }).click();
  await expect(page.getByText(/These facts cannot confirm whether your usual slower periods are represented/)).toBeVisible();
  await assertForbiddenConclusionsAbsent(page);
  await resetScreenScroll(page);
  await page.screenshot({ path: path.join(EVIDENCE, '03-coverage-factual-observation.png'), fullPage: true });
});

test('limited history preserves zero and negative usable-income bars', async ({ page }) => {
  await addIncomeMonth(page, '2026-01-05', '800.00');
  await addIncomeMonth(page, '2026-02-05', '400.00');
  await setPetrolWorkCost(page, '800.00');
  await openApp(page);
  await openMoneyScreen(page, 'Income pattern');

  await expect(page.getByText(/This is two recorded months/)).toBeVisible();
  await expect(page.getByLabel(/Jan 26: RM 0.00 calculated usable income/)).toBeVisible();
  await expect(page.getByLabel(/Feb 26: RM -400.00 calculated usable income, lowest recorded month/)).toBeVisible();
  const zeroHeight = await page.getByTestId('income-bar-2026-01').evaluate(
    element => Number.parseFloat(getComputedStyle(element).height),
  );
  const negativeHeight = await page.getByTestId('income-bar-2026-02').evaluate(
    element => Number.parseFloat(getComputedStyle(element).height),
  );
  expect(negativeHeight).toBeGreaterThan(zeroHeight);
  await assertForbiddenConclusionsAbsent(page);
  await resetScreenScroll(page);
  await page.screenshot({ path: path.join(EVIDENCE, '05-limited-zero-negative.png'), fullPage: true });
});

test('coverage controls wait for one authoritative initial response', async ({ page }) => {
  let releaseCoverage: () => void = () => undefined;
  const coverageGate = new Promise<void>(resolve => { releaseCoverage = resolve; });
  let coverageGetCount = 0;
  await page.route('**/api/v1/income-coverage/', async route => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    coverageGetCount += 1;
    await coverageGate;
    await route.fulfill({ response: await route.fetch() });
  });

  await openApp(page);
  await openMoneyScreen(page, 'Coverage check');
  await expect(page.getByRole('radio', { name: 'Yes' })).toBeDisabled();
  releaseCoverage();
  await expect(page.getByRole('radio', { name: 'Yes' })).toBeEnabled();
  expect(coverageGetCount).toBe(1);
});

test('coverage save failure keeps the confirmed result and retryable draft', async ({ page }) => {
  await addIncomeMonth(page, '2026-01-05', '1000.00');
  await openApp(page);
  await openMoneyScreen(page, 'Coverage check');
  await page.getByRole('radio', { name: 'Yes' }).click();
  await page.getByRole('checkbox', { name: 'Jan' }).click();
  await page.getByRole('button', { name: 'Check coverage' }).click();
  await expect(page.getByText('Represented in your recorded income: Jan.', { exact: true })).toBeVisible();

  let failNextPut = true;
  await page.route('**/api/v1/income-coverage/', async route => {
    if (route.request().method() === 'PUT' && failNextPut) {
      failNextPut = false;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'test_failure', message: 'Unavailable' } }),
      });
      return;
    }
    await route.continue();
  });

  await page.getByRole('radio', { name: 'No', exact: true }).click();
  await page.getByRole('button', { name: 'Check coverage' }).click();
  await expect(page.getByText(/last server-confirmed answer/)).toBeVisible();
  await expect(page.getByText('Represented in your recorded income: Jan.', { exact: true })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'No', exact: true })).toBeChecked();
  await resetScreenScroll(page);
  await page.screenshot({ path: path.join(EVIDENCE, '06-coverage-save-failure.png'), fullPage: true });

  await page.getByRole('button', { name: 'Check coverage' }).click();
  await expect(page.getByText(/Across 1 recorded months, usable income ranges from RM 1,000.00/)).toBeVisible();
  await page.reload();
  await openApp(page);
  await openMoneyScreen(page, 'Coverage check');
  await expect(page.getByRole('radio', { name: 'No', exact: true })).toBeChecked();
});

test('empty pattern and failed API calls have bounded retry states', async ({ page }) => {
  await page.route('**/api/v1/income-pattern/', route => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ error: { code: 'test_failure', message: 'Unavailable' } }),
  }));
  await openApp(page);
  await openMoneyScreen(page, 'Income pattern');

  await expect(page.getByText(/calculated income pattern could not be reached/i)).toBeVisible();
  await page.unroute('**/api/v1/income-pattern/');
  await page.getByText('Retry', { exact: true }).click();
  await expect(page.getByText('Your income pattern starts with a recorded month.', { exact: true })).toBeVisible();
  await expect(page.getByText('Add income', { exact: true })).toBeVisible();
  await assertForbiddenConclusionsAbsent(page);
  await resetScreenScroll(page);
  await page.screenshot({ path: path.join(EVIDENCE, '04-empty-pattern-after-retry.png'), fullPage: true });
});
