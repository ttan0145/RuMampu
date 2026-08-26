import { expect, Page, test } from '@playwright/test';
import { ac } from './support/acceptance';
import { API, captureEvidence, openApp, openMoneyScreen } from './support/app';

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
    data: { amount, date, source_id: source.id, entry_method: 'manual', confirm_outlier: true },
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

async function openTwelveMonthPattern(page: Page): Promise<void> {
  await loadTwelveMonthScenario(page);
  await openApp(page);
  await openMoneyScreen(page, 'Income pattern');
}

test.describe('Epic 2 — Income Pattern Analysis', { tag: '@epic2' }, () => {
  test('US2.1 — View income month by month', { tag: '@us2.1' }, async ({ page }) => {
    await openTwelveMonthPattern(page);
    const bars = page.locator(
      '[aria-label*="calculated usable income"]:not([aria-label="Month-by-month calculated usable income"])',
    );

    await ac('AC2.1.1', 'Display monthly income chart', async () => {
      await expect(page.getByLabel('Month-by-month calculated usable income')).toBeVisible();
      await expect(bars).toHaveCount(12);
    });
    await ac('AC2.1.2', 'Display month labels', async () => {
      await expect(page.getByLabel(/Aug 25: RM 4,030.00 calculated usable income/)).toBeVisible();
      await expect(page.getByLabel(/Feb 26: RM 3,160.00 calculated usable income/)).toBeVisible();
      await expect(page.getByText('Scroll horizontally to see all recorded months.', { exact: true })).toBeVisible();
    });
    await ac('AC2.1.3', 'Reflect different monthly amounts', async () => {
      const augustHeight = await page.getByTestId('income-bar-2025-08').evaluate(
        element => Number.parseFloat(getComputedStyle(element).height),
      );
      const februaryHeight = await page.getByTestId('income-bar-2026-02').evaluate(
        element => Number.parseFloat(getComputedStyle(element).height),
      );
      expect(augustHeight).toBeGreaterThan(februaryHeight);
    });
    await captureEvidence(page, 'epic-2', '01-income-pattern-12m.png');
  });

  test('US2.2 — Understand typical and extreme income months', { tag: '@us2.2' }, async ({ page }) => {
    await openTwelveMonthPattern(page);

    await ac('AC2.2.1', 'Display average income', async () => {
      await expect(page.getByText('RM 4,437.50', { exact: true })).toBeVisible();
    });
    await ac('AC2.2.2', 'Display median income', async () => {
      await expect(page.getByText('RM 4,385.00', { exact: true })).toBeVisible();
    });
    await ac('AC2.2.3', 'Display highest income', async () => {
      await expect(page.getByText('RM 5,870.00', { exact: true }).last()).toBeVisible();
    });
    await ac('AC2.2.4', 'Display lowest income', async () => {
      await expect(page.getByText('RM 3,160.00', { exact: true }).last()).toBeVisible();
    });
    await ac('AC2.2.5', 'Identify calculated figures', async () => {
      await expect(page.getByText(/calculated/i).first()).toBeVisible();
    });
    await ac('AC2.2.6', 'Explain variation', async () => {
      await expect(page.getByText('RM 2,710.00', { exact: true })).toBeVisible();
      await expect(page.getByText('RM 699.16', { exact: true })).toBeVisible();
    });
    await assertForbiddenConclusionsAbsent(page);
  });

  test('US2.3 — Identify lower-income months', { tag: '@us2.3' }, async ({ page }) => {
    await openTwelveMonthPattern(page);

    await ac('AC2.3.1', 'Use the recorded-history rule', async () => {
      await expect(page.getByLabel(/Feb 26: RM 3,160.00 calculated usable income, lowest recorded month/)).toBeVisible();
      await expect(page.getByText(/Lowest in your current record: Feb 2026/)).toBeVisible();
    });
    await ac('AC2.3.2', 'Explain the identification', async () => {
      await expect(page.getByText(/not a financial standard or a prediction/i)).toBeVisible();
      await assertForbiddenConclusionsAbsent(page);
    });
  });

  test('US2.4 — Check whether history covers slower periods', { tag: '@us2.4' }, async ({ page }) => {
    await addIncomeMonth(page, '2026-01-05', '1000.00');
    await addIncomeMonth(page, '2026-08-05', '1600.00');
    await openApp(page);
    await openMoneyScreen(page, 'Coverage check');

    await ac('AC2.4.1', 'Ask about quieter periods', async () => {
      await expect(page.getByText(/times of year when you usually earn less/i)).toBeVisible();
    });
    await ac('AC2.4.2', 'Provide three answer choices', async () => {
      await expect(page.getByRole('radio', { name: 'Yes' })).toBeVisible();
      await expect(page.getByRole('radio', { name: 'No', exact: true })).toBeVisible();
      await expect(page.getByRole('radio', { name: 'Not sure' })).toBeVisible();
    });
    await ac('AC2.4.3', 'Select slower months', async () => {
      await page.getByRole('radio', { name: 'Yes' }).click();
      await expect(page.getByRole('checkbox')).toHaveCount(12);
    });
    await ac('AC2.4.4', 'Select multiple slower months', async () => {
      await page.getByRole('checkbox', { name: 'Jan' }).click();
      await page.getByRole('checkbox', { name: 'Mar' }).click();
      await page.getByRole('checkbox', { name: 'Aug' }).click();
      await expect(page.getByRole('checkbox', { name: 'Jan' })).toBeChecked();
      await expect(page.getByRole('checkbox', { name: 'Mar' })).toBeChecked();
      await expect(page.getByRole('checkbox', { name: 'Aug' })).toBeChecked();
      await expect(page.getByText(/Represented in your recorded income/)).toHaveCount(0);
    });
    await page.getByRole('button', { name: 'Check coverage' }).click();
    await ac('AC2.4.5', 'Warn about uncovered slower months', async () => {
      await expect(page.getByText('Not yet represented in your recorded income: Mar.', { exact: true })).toBeVisible();
    });
    await ac('AC2.4.6', 'Confirm represented slower months', async () => {
      await expect(page.getByText('Represented in your recorded income: Jan, Aug.', { exact: true })).toBeVisible();
      await page.reload();
      await openApp(page);
      await openMoneyScreen(page, 'Coverage check');
      await expect(page.getByText('Not yet represented in your recorded income: Mar.', { exact: true })).toBeVisible();
    });
    await ac('AC2.4.7', 'Respond to No or Not sure', async () => {
      await page.getByRole('radio', { name: 'No', exact: true }).click();
      await page.getByRole('button', { name: 'Check coverage' }).click();
      await expect(page.getByText(/Across 2 recorded months, usable income ranges from RM 1,000.00 to RM 1,600.00/)).toBeVisible();
      await page.getByRole('radio', { name: 'Not sure' }).click();
      await page.getByRole('button', { name: 'Check coverage' }).click();
      await expect(page.getByText(/These facts cannot confirm whether your usual slower periods are represented/)).toBeVisible();
    });
    await assertForbiddenConclusionsAbsent(page);
    await captureEvidence(page, 'epic-2', '03-coverage-factual-observation.png');
  });

  test('TECH-E2-01 — limited history preserves zero and negative values', { tag: '@hardening' }, async ({ page }) => {
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
    await captureEvidence(page, 'epic-2', '05-limited-zero-negative.png');
  });

  test('TECH-E2-02 — coverage waits for one authoritative initial response', { tag: '@hardening' }, async ({ page }) => {
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

  test('TECH-E2-03 — failed coverage save keeps confirmed state and a retryable draft', { tag: '@hardening' }, async ({ page }) => {
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
    await captureEvidence(page, 'epic-2', '06-coverage-save-failure.png');

    await page.getByRole('button', { name: 'Check coverage' }).click();
    await expect(page.getByText(/Across 1 recorded months, usable income ranges from RM 1,000.00/)).toBeVisible();
    await page.reload();
    await openApp(page);
    await openMoneyScreen(page, 'Coverage check');
    await expect(page.getByRole('radio', { name: 'No', exact: true })).toBeChecked();
  });

  test('TECH-E2-04 — empty and failed pattern states have a bounded retry', { tag: '@hardening' }, async ({ page }) => {
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
    await captureEvidence(page, 'epic-2', '04-empty-pattern-after-retry.png');
  });
});
