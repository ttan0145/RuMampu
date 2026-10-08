import { expect, Page } from '@playwright/test';
import { e2eGet, e2ePost, e2ePut, test } from './support/fixtures';
import { ac } from './support/acceptance';
import { API, captureEvidence, openApp, openMoneyScreen } from './support/app';

async function loadTwelveMonthScenario(page: Page): Promise<void> {
  const response = await e2ePost(page, `${API}/dev/scenarios/my-gig-driver-12m/load/`, {
    data: { confirm_reset: true },
  });
  expect(response.status()).toBe(201);
}

async function addIncomeMonth(page: Page, date: string, amount: string): Promise<void> {
  const record = await e2eGet(page, `${API}/income/record/`);
  expect(record.ok()).toBeTruthy();
  const payload = await record.json();
  const source = payload.sources.find((item: { slug: string }) => item.slug === 'ehail');
  const created = await e2ePost(page, `${API}/income/entries/`, {
    data: { amount, date, source_id: source.id, entry_method: 'manual', confirm_outlier: true },
  });
  expect(created.status()).toBe(201);
}

async function addPetrolWorkCost(page: Page, date: string, amount: string): Promise<void> {
  const response = await e2eGet(page, `${API}/work-costs/`);
  expect(response.ok()).toBeTruthy();
  const categories = await response.json();
  const petrol = categories.find((item: { slug: string }) => item.slug === 'petrol');
  const created = await e2ePost(page, `${API}/work-costs/entries/`, {
    data: { category_id: petrol.id, amount, date },
  });
  expect(created.status()).toBe(201);
}

async function assertForbiddenConclusionsAbsent(page: Page): Promise<void> {
  const body = page.locator('body');
  await expect(body).not.toContainText('75%');
  await expect(body).not.toContainText(/\bCV\b/);
  await expect(body).not.toContainText(/risk band/i);
  await expect(body).not.toContainText(/stable income/i);
}

/* The v24 coverage callouts, worded for an English record that runs {a} to {b}. */
function gapCallout(page: Page, months: string) {
  return page.getByText(`Your record has not seen ${months} yet`, { exact: true });
}

function coveredCallout(page: Page) {
  return page.getByText('Your record covers your quiet months', { exact: true });
}

function barsForChart(page: Page) {
  return page.locator(
    '[aria-label*="calculated usable income"]:not([aria-label="Month-by-month calculated usable income"])',
  );
}

/* Adds a whole past month from the quiet link on Income (v24 R7). */
async function addPastMonth(page: Page, monthLabel: string, amount: string): Promise<void> {
  await page.getByText('Add a month I did not record', { exact: true }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('Choose month').click();
  const year = monthLabel.slice(4);
  const field = sheet.getByLabel('Choose month');
  for (let i = 0; i < 3 && !(await page.getByRole('button', { name: monthLabel, exact: true }).isVisible().catch(() => false)); i += 1) {
    const shown = Number((await field.innerText()).match(/\d{4}/)?.[0]);
    await page.getByRole('button', { name: Number(year) < shown ? 'Previous year' : 'Next year', exact: true }).click();
  }
  await page.getByRole('button', { name: monthLabel, exact: true }).click();
  await sheet.locator('input').fill(amount);
  await sheet.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(sheet).toHaveCount(0);
}

async function openTwelveMonthPattern(page: Page): Promise<void> {
  await loadTwelveMonthScenario(page);
  await openApp(page);
  await openMoneyScreen(page, 'Income pattern');
}

test.describe('Epic 2 — Income Pattern Analysis', { tag: '@epic2' }, () => {
  test('TECH-E2-05 — reopening the pattern fetches newly recorded income', { tag: '@hardening' }, async ({ page }) => {
    await addIncomeMonth(page, '2026-01-05', '1000.00');
    await openApp(page);
    await openMoneyScreen(page, 'Income pattern');
    await expect(page.getByText('RM 1,000.00', { exact: true }).first()).toBeVisible();
    await page.getByLabel('Back').click();
    await addIncomeMonth(page, '2026-02-05', '2000.00');
    const refreshed = page.waitForResponse(response => response.request().method() === 'GET' && response.url().endsWith('/income-pattern/'));
    await openMoneyScreen(page, 'Income pattern');
    expect((await (await refreshed).json()).recorded_month_count).toBe(2);
    await expect(page.getByText('RM 1,500.00', { exact: true }).first()).toBeVisible();
  });

  test('TECH-E2-06 — recording a named quiet month refreshes coverage', { tag: '@hardening' }, async ({ page }) => {
    await addIncomeMonth(page, '2026-01-05', '1000.00');
    const saved = await e2ePut(page, `${API}/income-coverage/`, { data: { answer: 'yes', slower_months: [3] } });
    expect(saved.ok()).toBeTruthy();
    await openApp(page);
    await openMoneyScreen(page, 'Coverage check');
    await expect(gapCallout(page, 'Mar')).toBeVisible();
    await openMoneyScreen(page, 'Income');
    await addPastMonth(page, 'Mar 2026', '1500');
    await expect(page.getByText('Monthly total', { exact: true })).toBeVisible();
    await openMoneyScreen(page, 'Coverage check');
    await expect(coveredCallout(page)).toBeVisible();
    await expect(gapCallout(page, 'Mar')).toHaveCount(0);
  });

  test('US2.1 — View income month by month', { tag: '@us2.1' }, async ({ page }) => {
    await openTwelveMonthPattern(page);
    const bars = barsForChart(page);

    await ac('AC2.1.1', 'View income month by month', async () => {
      await expect(page.getByLabel('Month-by-month calculated usable income')).toBeVisible();
      await expect(bars).toHaveCount(12);
    });
    await ac('AC2.1.2', 'Display month labels', async () => {
      await expect(page.getByLabel(/Aug 25: RM 4,030.00 calculated usable income/)).toBeVisible();
      await expect(page.getByLabel(/Feb 26: RM 3,160.00 calculated usable income/)).toBeVisible();
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
    await captureEvidence(page, 'epic-2', 'ac2.1.1-3__income-month-chart.png');
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
      await expect(page.getByText('Recorded range', { exact: true }).locator('xpath=..')).toContainText('RM 2,710.00');
    });
    await ac('AC2.2.7', 'Show the recorded range', async () => {
      const rangeLabel = page.getByText('Recorded range', { exact: true });
      await expect(rangeLabel).toBeVisible();
      await expect(rangeLabel.locator('xpath=..')).toContainText('RM 2,710.00');
    });
    await ac('AC2.2.8', 'Show every recorded month', async () => {
      await expect(page.getByTestId('income-pattern-scroll-hint')).toBeVisible();
      await expect(barsForChart(page)).toHaveCount(12);
    });
    await assertForbiddenConclusionsAbsent(page);
    await page.getByText('Recorded range', { exact: true }).scrollIntoViewIfNeeded();
    await captureEvidence(page, 'epic-2', 'ac2.2.1-8__income-statistics.png');
  });

  test('US2.3 — Identify lower-income months', { tag: '@us2.3' }, async ({ page }) => {
    await openTwelveMonthPattern(page);

    const quietest = page.getByText('Your quietest recorded month is Feb: RM 3,160.00 after work costs.', { exact: true });
    await ac('AC2.3.1', 'Use the RuMampu low income rule', async () => {
      await expect(page.getByLabel(/Feb 26: RM 3,160.00 calculated usable income, lowest recorded month/)).toBeVisible();
      await expect(quietest).toBeVisible();
    });
    await ac('AC2.3.2', 'Explain how lower income months are identified', async () => {
      await page.getByTestId('pattern-quietest').getByLabel('What this is').click();
      await expect(page.getByText(
        'A lower-income month here means the lowest usable-income month in your current record. It is not a financial standard or a prediction.',
        { exact: true },
      )).toBeVisible();
      await page.getByText('Done', { exact: true }).last().click();
      await assertForbiddenConclusionsAbsent(page);
    });
    await quietest.scrollIntoViewIfNeeded();
    await captureEvidence(page, 'epic-2', 'ac2.3.1-2__lower-income-month.png', { resetScroll: false });
  });

  test('AC2.3.3 — Leave the unfinished month out of the count', { tag: '@us2.3' }, async ({ page }) => {
    const today = new Date();
    const currentMonthDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const previousMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 5);
    const earlierMonthDate = new Date(today.getFullYear(), today.getMonth() - 2, 5);
    const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const isoMonth = (date: Date) => isoDate(date).slice(0, 7);
    const monthName = currentMonthDate.toLocaleString('en', { month: 'short' });
    const currentMonthNumber = currentMonthDate.getMonth() + 1;

    await addIncomeMonth(page, isoDate(earlierMonthDate), '2000.00');
    await addIncomeMonth(page, isoDate(previousMonthDate), '1000.00');
    await addIncomeMonth(page, isoDate(currentMonthDate), '100.00');
    await addPetrolWorkCost(page, isoDate(currentMonthDate), '25.00');

    const coverageSaved = await e2ePut(page, `${API}/income-coverage/`, {
      data: { answer: 'yes', slower_months: [currentMonthNumber] },
    });
    expect(coverageSaved.ok()).toBeTruthy();
    const coverage = await e2eGet(page, `${API}/income-coverage/`);
    const coveragePayload = await coverage.json();
    expect(coveragePayload.recorded_calendar_months).not.toContain(currentMonthNumber);
    expect(coveragePayload.unrepresented_slower_months).toContain(currentMonthNumber);
    expect(coveragePayload.current_month_so_far.month).toBe(isoMonth(currentMonthDate));

    const houseCheck = await e2ePost(page, `${API}/housing/pre-check/`, { data: {} });
    expect(houseCheck.ok()).toBeTruthy();
    const housePayload = await houseCheck.json();
    expect(housePayload.tested_months).toBe(2);
    expect(housePayload.months.map((row: { month: number }) => row.month)).not.toContain(currentMonthNumber);

    await openApp(page);
    await openMoneyScreen(page, 'Income pattern');
    await ac('AC2.3.3', 'Leave the unfinished month out of the count', async () => {
      await expect(page.getByText('RM 1,500.00', { exact: true }).first()).toBeVisible();
      await expect(page.getByTestId('pattern-month-so-far')).toContainText('Month so far');
      await expect(page.getByTestId('pattern-month-so-far')).toContainText(`${monthName} ${today.getFullYear()}`);
      await expect(page.getByTestId(`income-bar-${isoMonth(currentMonthDate)}`)).toHaveCount(0);
      await expect(barsForChart(page)).toHaveCount(2);
    });
    await openMoneyScreen(page, 'Coverage check');
    await expect(gapCallout(page, monthName)).toBeVisible();
    await expect(page.getByTestId('coverage-month-so-far')).toContainText('Month so far');
    await expect(page.getByTestId('coverage-month-so-far')).toContainText('RM 75.00');
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
    await page.getByRole('radio', { name: 'Yes' }).click();
    await expect(page.getByRole('checkbox')).toHaveCount(12);
    await ac('AC2.4.4', 'Select multiple slower months', async () => {
      await page.getByRole('checkbox', { name: 'Jan' }).click();
      await page.getByRole('checkbox', { name: 'Mar' }).click();
      await page.getByRole('checkbox', { name: 'Aug' }).click();
      await expect(page.getByRole('checkbox', { name: 'Jan' })).toBeChecked();
      await expect(page.getByRole('checkbox', { name: 'Mar' })).toBeChecked();
      await expect(page.getByRole('checkbox', { name: 'Aug' })).toBeChecked();
    });
    await ac('AC2.4.3', 'Report only the quiet months that are genuinely missing', async () => {
      await expect(gapCallout(page, 'Mar')).toBeVisible();
      await expect(gapCallout(page, 'Jan')).toHaveCount(0);
      await expect(gapCallout(page, 'Aug')).toHaveCount(0);
    });
    await ac('AC2.4.5', 'Warn about uncovered slower months', async () => {
      // The record runs Jan to Aug 2026, so March has not been recorded yet.
      await expect(gapCallout(page, 'Mar')).toBeVisible();
      await expect(page.getByText(
        'You said Mar is usually slower, but your record only runs Jan to Aug. Until then the test may look better than a real slow month.',
        { exact: true },
      )).toBeVisible();
      // The warning comes from the saved answer, so it is still there when the app is opened again.
      await page.reload();
      await openApp(page);
      await openMoneyScreen(page, 'Coverage check');
      await expect(gapCallout(page, 'Mar')).toBeVisible();
    });
    await ac('AC2.4.6', 'Confirm represented slower months', async () => {
      await page.getByRole('checkbox', { name: 'Mar' }).click();
      await expect(coveredCallout(page)).toBeVisible();
      await expect(page.getByText('Jan, Aug are inside Jan to Aug, so the house test already counts them.', { exact: true })).toBeVisible();
    });
    await captureEvidence(page, 'epic-2', 'ac2.4.1-6__coverage-months.png');
    await ac('AC2.4.7', 'Respond to No or Not sure', async () => {
      await page.getByRole('radio', { name: 'No', exact: true }).click();
      await expect(page.getByText('Every month counts the same', { exact: true })).toBeVisible();
      await expect(page.getByText(/Your recorded amounts differ month to month\. The test still only knows Jan to Aug\./)).toBeVisible();
      await page.getByRole('radio', { name: 'Not sure' }).click();
      await expect(page.getByRole('radio', { name: 'Not sure' })).toBeChecked();
      await expect(page.getByText('Every month counts the same', { exact: true })).toBeVisible();
    });
    await assertForbiddenConclusionsAbsent(page);
    await captureEvidence(page, 'epic-2', 'ac2.4.7__coverage-factual-observation.png');
  });

  test('TECH-E2-01 — limited history preserves zero and negative values', { tag: '@hardening' }, async ({ page }) => {
    await addIncomeMonth(page, '2026-01-05', '800.00');
    await addIncomeMonth(page, '2026-02-05', '400.00');
    await addPetrolWorkCost(page, '2026-01-05', '800.00');
    await addPetrolWorkCost(page, '2026-02-05', '800.00');
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
    await captureEvidence(page, 'epic-2', 'tech-e2-01__limited-zero-negative.png');
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
    await expect(coveredCallout(page)).toBeVisible();

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
    await expect(page.getByText(/last server-confirmed answer/)).toBeVisible();
    await expect(coveredCallout(page)).toBeVisible();
    await expect(page.getByRole('radio', { name: 'No', exact: true })).toBeChecked();
    await captureEvidence(page, 'epic-2', 'tech-e2-03__coverage-save-failure.png');

    // Choosing the answer again retries the save.
    await page.getByRole('radio', { name: 'No', exact: true }).click();
    await expect(page.getByText('Every month counts the same', { exact: true })).toBeVisible();
    await expect(page.getByText(/last server-confirmed answer/)).toHaveCount(0);
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
    await expect(page.getByText('Your income pattern starts with a completed month.', { exact: true })).toBeVisible();
    await expect(page.getByText('Add income', { exact: true })).toBeVisible();
    await assertForbiddenConclusionsAbsent(page);
    await captureEvidence(page, 'epic-2', 'tech-e2-04__empty-pattern-after-retry.png');
  });
});
