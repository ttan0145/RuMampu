import { expect, Locator, Page } from '@playwright/test';
import { e2eGet, e2ePost, test } from './support/fixtures';
import path from 'node:path';
import { ac, deferredAc } from './support/acceptance';
import { API, captureEvidence, openApp, openMoneyScreen } from './support/app';
import { currentWorkCostMonth, monthLabel, previousMonth } from './support/work-costs';

async function incomeSourceId(page: Page, slug = 'ehail'): Promise<number> {
  const response = await e2eGet(page, `${API}/income/record/`);
  expect(response.ok()).toBeTruthy();
  const record = await response.json();
  return record.sources.find((source: { slug: string }) => source.slug === slug).id;
}

async function expenseCategoryId(page: Page, slug = 'groc'): Promise<number> {
  const response = await e2eGet(page, `${API}/expense-categories/`);
  expect(response.ok()).toBeTruthy();
  const categories = await response.json();
  return categories.find((category: { slug: string }) => category.slug === slug).id;
}

async function workCostCategoryId(page: Page, slug = 'petrol'): Promise<number> {
  const response = await e2eGet(page, `${API}/work-costs/`);
  expect(response.ok()).toBeTruthy();
  const categories = await response.json();
  return categories.find((category: { slug: string }) => category.slug === slug).id;
}

async function addWorkCost(page: Page, amount: string, date: string, slug = 'petrol'): Promise<void> {
  const response = await e2ePost(page, `${API}/work-costs/entries/`, {
    data: { amount, date, category_id: await workCostCategoryId(page, slug) },
  });
  expect(response.status()).toBe(201);
}

async function addIncome(page: Page, amount: string, date: string, slug = 'ehail'): Promise<void> {
  const response = await e2ePost(page, `${API}/income/entries/`, {
    data: {
      amount,
      date,
      source_id: await incomeSourceId(page, slug),
      entry_method: 'manual',
      confirm_outlier: true,
    },
  });
  expect(response.status()).toBe(201);
}

async function addExpense(
  page: Page,
  amount: string,
  date: string,
  slug = 'groc',
): Promise<void> {
  const response = await e2ePost(page, `${API}/expenses/`, {
    data: {
      amount,
      date,
      category_id: await expenseCategoryId(page, slug),
      entry_method: 'manual',
    },
  });
  expect(response.status()).toBe(201);
}

function isoMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function lastMonth(): string {
  const now = new Date();
  return isoMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));
}

function inputForRow(page: Page, label: string): Locator {
  return page.getByText(label, { exact: true }).locator('..').locator('..').locator('input');
}

async function replaceValue(input: Locator, value: string): Promise<void> {
  await input.fill(value);
  await input.press('Tab');
}

async function chooseDay(page: Page, day: number): Promise<void> {
  const chooseDate = page.locator('[aria-label="Choose date"]:visible').last();
  if (!await chooseDate.isVisible().catch(() => false)) {
    await page.getByText('Pick a date', { exact: true }).click();
  }
  await page.locator('[aria-label="Choose date"]:visible').last().click();
  await page.getByText(String(day), { exact: true }).last().click();
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* Opens a date field (the last visible one unless given), moves the calendar to the
   month of `iso` and picks its day. */
async function pickDate(page: Page, iso: string, field?: Locator): Promise<void> {
  const target = field ?? page.locator('[aria-label="Choose date"]:visible').last();
  await target.click();
  const picker = page.getByRole('dialog').last();
  const targetKey = Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1;
  for (let step = 0; step < 36; step += 1) {
    const [name, year] = (await picker.getByText(/^[A-Z][a-z]{2} \d{4}$/).innerText()).split(' ');
    const shownKey = Number(year) * 12 + MONTH_NAMES.indexOf(name);
    if (shownKey === targetKey) break;
    await picker.getByText(shownKey > targetKey ? '‹' : '›', { exact: true }).click();
  }
  await picker.getByText(String(Number(iso.slice(8, 10))), { exact: true }).click();
  await expect(target).toContainText(
    `${Number(iso.slice(8, 10))} ${MONTH_NAMES[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`,
  );
}

async function choosePreviousMonthDay(page: Page, day: number): Promise<void> {
  const chooseDate = page.locator('[aria-label="Choose date"]:visible').last();
  if (!await chooseDate.isVisible().catch(() => false)) {
    await page.getByText('Pick a date', { exact: true }).last().click();
  }
  await chooseDate.click();
  await page.getByText('‹', { exact: true }).last().click();
  await page.getByText(String(day), { exact: true }).last().click();
}

test.describe('Epic 1 — Income Builder', { tag: '@epic1' }, () => {
  test('US1.1 — Record income from different sources', { tag: '@us1.1' }, async ({ page, e2eClientId }) => {
    await openApp(page);
    await openMoneyScreen(page, 'Income');
    const amountInput = page.locator('input:visible').first();
    const month = lastMonth();
    const day = (n: number) => `${month}-${String(n).padStart(2, '0')}`;

    await ac('AC1.1.1', 'Enter income amount', async () => {
      await expect(page.getByText('How much did you earn?', { exact: true })).toBeVisible();
      await expect(amountInput).toBeVisible();
      await expect(amountInput).toHaveAttribute('inputmode', 'decimal');
    });
    await ac('AC1.1.2', 'Enter income date', async () => {
      await expect(page.getByText('When?', { exact: true })).toBeVisible();
      await expect(page.getByLabel('Choose date')).toBeVisible();
      await pickDate(page, day(1));
      await expect(page.getByLabel('Choose date')).toContainText(`1 ${monthLabel(month)}`);
    });
    await ac('AC1.1.3', 'Select an income source', async () => {
      await expect(page.getByText('E-hailing', { exact: true })).toBeVisible();
      await expect(page.getByText('Freelance', { exact: true })).toBeVisible();
      await expect(page.getByText('Part-time (fixed)', { exact: true })).toBeVisible();
    });
    await ac('AC1.1.5', 'Add a custom income source', async () => {
      await page.getByText('Your own source', { exact: true }).click();
      await page.locator('input:visible').last().fill('Weekend market');
      const sourceResponsePromise = page.waitForResponse(response => (
        response.request().method() === 'POST' && response.url().endsWith('/api/v1/income/sources/')
      ));
      await page.getByRole('button', { name: 'Add', exact: true }).click();
      const sourceResponse = await sourceResponsePromise;
      await expect(page.getByText('Weekend market', { exact: true })).toBeVisible();
      expect(await page.evaluate(() => window.localStorage.getItem('rumampu_client_id'))).toBe(e2eClientId);
      expect(await sourceResponse.request().headerValue('x-rumampu-client-id')).toBe(e2eClientId);
      const response = await e2eGet(page, `${API}/income/record/`);
      expect((await response.json()).sources).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'Weekend market', is_custom: true }),
      ]));
    });
    await ac('AC1.1.12', 'Reject an invalid monetary format until corrected', async () => {
      await amountInput.fill('3oops');
      await page.getByRole('button', { name: 'Add income' }).click();
      await expect(page.getByText(
        'Enter a valid cash amount using numbers only, with up to 2 decimal places.',
        { exact: true },
      )).toBeVisible();
      const response = await e2eGet(page, `${API}/income/record/`);
      expect((await response.json()).entries).toHaveLength(0);
    });
    await ac('AC1.1.9', 'Prevent negative income entry', async () => {
      await amountInput.fill('-10');
      await pickDate(page, day(1));
      await page.getByRole('button', { name: 'Add income' }).click();
      await expect(page.getByText('An amount below zero can’t be saved.', { exact: true })).toBeVisible();
    });

    await amountInput.fill('100.55');
    await pickDate(page, day(1));
    await page.getByText('E-hailing', { exact: true }).click();
    await ac('AC1.1.6', 'Save an income entry', async () => {
      const savedResponse = page.waitForResponse(response => (
        response.request().method() === 'POST' && response.url().endsWith('/api/v1/income/entries/')
      ));
      await page.getByRole('button', { name: 'Add income' }).click();
      const response = await savedResponse;
      expect(response.status(), await response.text()).toBe(201);
      const entry = page.getByText('RM 100.55', { exact: true }).locator('..');
      await expect(entry).toContainText('E-hailing');
      await expect(entry).toContainText(/^.*1 [A-Za-z]+.*$/);
    });
    await ac('AC1.1.4', 'Use multiple income sources', async () => {
      await amountInput.fill('120');
      await pickDate(page, day(2));
      await page.getByText('Freelance', { exact: true }).click();
      await page.getByRole('button', { name: 'Add income' }).click();
      await expect(page.getByText('RM 120', { exact: true }).locator('..')).toContainText('Freelance');
      await expect(page.getByText('RM 100.55', { exact: true }).locator('..')).toContainText('E-hailing');
    });
    await ac('AC1.1.7', 'Display existing entries', async () => {
      await expect(page.getByText('RM 120', { exact: true })).toBeVisible();
      await expect(page.getByText('RM 100.55', { exact: true })).toBeVisible();
    });
    deferredAc(
      'AC1.1.8',
      'Identify user-entered values',
      'The Your Data provenance treatment is explicitly deferred from this UI adaptation.',
    );
    await ac('AC1.1.11', 'Edit a recorded income amount, date, and source', async () => {
      await page.getByLabel('edit').first().click();
      const sheet = page.getByRole('dialog');
      await expect(sheet.getByText('Edit Income', { exact: true })).toBeVisible();
      await sheet.locator('input').fill('125.50');
      await pickDate(page, day(5), sheet.getByLabel('Choose date'));
      await sheet.getByText('E-hailing', { exact: true }).click();
      await sheet.getByRole('button', { name: 'Done', exact: true }).click();
      // v24 asks before moving an entry to another day.
      await expect(sheet.getByText('Change the date this entry is for?', { exact: true })).toBeVisible();
      await sheet.getByText('Yes, change the date', { exact: true }).click();
      await expect(sheet).toHaveCount(0);
      await expect(page.getByText('RM 125.50', { exact: true })).toBeVisible();
      await expect(page.getByText('RM 125.50', { exact: true }).locator('..')).toContainText('E-hailing');
      await expect(page.getByText('RM 125.50', { exact: true }).locator('..')).toContainText(/^.*5 [A-Za-z]+.*$/);
    });

    await amountInput.fill('140');
    await pickDate(page, day(3));
    await page.getByRole('button', { name: 'Add income' }).click();
    await expect(page.getByText('RM 140', { exact: true }).locator('..')).toContainText('Freelance');
    await ac('AC1.1.10', 'Warn about an unusually high income entry', async () => {
      await amountInput.fill('1000');
      await pickDate(page, day(4));
      await page.getByRole('button', { name: 'Add income' }).click();
      await expect(page.getByText('Well above your usual entries. Keep it?', { exact: true })).toBeVisible();
      await expect(page.getByText('Keep', { exact: true })).toBeVisible();
    });
    await captureEvidence(page, 'epic-1', 'ac1.1.1-10__income-entry-flow.png');
  });

  test('US1.2 — Add historical income', { tag: '@us1.2' }, async ({ page }) => {
    await openApp(page);
    await openMoneyScreen(page, 'Income');
    const currentMonthIso = isoMonth(new Date());
    const previousMonthLabel = monthLabel(lastMonth());
    const sheet = page.getByRole('dialog');

    await ac('AC1.2.1', 'Access past-month entry', async () => {
      await page.getByText('Add a month I did not record', { exact: true }).click();
      await expect(sheet.getByText('Add a month I did not record', { exact: true })).toBeVisible();
      await expect(sheet.getByLabel('Choose month')).toContainText(previousMonthLabel);
    });
    await ac('AC1.2.2', 'Enter a monthly total', async () => {
      await sheet.getByLabel('Choose month').click();
      await expect(page.getByRole('button', { name: monthLabel(currentMonthIso), exact: true })).toBeDisabled();
      await page.getByRole('button', { name: previousMonthLabel, exact: true }).click();
      await sheet.locator('input').fill('2750');
      await sheet.getByRole('button', { name: 'Add', exact: true }).click();
      await expect(sheet).toHaveCount(0);
      await expect(page.getByText('Monthly total', { exact: true })).toBeVisible();
      await expect(page.getByText('RM 2,750', { exact: true })).toBeVisible();
    });
    await ac('AC1.2.3', 'Include past income in analysis', async () => {
      const response = await e2eGet(page, `${API}/income-pattern/`);
      expect(response.ok()).toBeTruthy();
      expect((await response.json()).recorded_month_count).toBe(1);
    });
    await ac('AC1.2.4', 'Allow any available history', async () => {
      const response = await e2eGet(page, `${API}/income/record/`);
      const record = await response.json();
      expect(record.recorded_month_count).toBe(1);
      expect(record.entries).toHaveLength(1);
    });
    await captureEvidence(page, 'epic-1', 'ac1.2.1-4__historical-income-flow.png');
  });

  test('TECH-E1-02 — the v22 income scan preview saves confirmed sample rows', { tag: '@hardening' }, async ({ page }) => {
    await openApp(page);
    await openMoneyScreen(page, 'Income');
    await page.getByText('Scan', { exact: true }).click();
    await expect(page.getByText('Works with Grab, foodpanda and Lalamove earnings pages.', { exact: true })).toBeVisible();
    await page.getByText('Try a sample', { exact: true }).click();
    await expect(page.getByText('Reading your earnings…', { exact: true })).toBeVisible();
    await expect(page.getByText('5 entries found. Untick any you do not want.', { exact: true })).toBeVisible();
    await expect(page.getByRole('checkbox')).toHaveCount(5);
    await page.getByRole('button', { name: 'Add 5 entries', exact: true }).click();
    await expect(page.getByText('5 entries added from your scan.', { exact: true })).toBeVisible();
    const response = await e2eGet(page, `${API}/income/record/`);
    expect((await response.json()).entries).toHaveLength(5);
  });

  test('TECH-E1-03 — the v22 expense CSV sample maps and persists its rows', { tag: '@hardening' }, async ({ page }) => {
    await openApp(page);
    await openMoneyScreen(page, 'Daily expenses');
    await page.getByText('Import', { exact: true }).click();
    await page.getByText('Try a sample file', { exact: true }).click();
    await expect(page.getByText('Check the columns', { exact: true })).toBeVisible();
    await page.getByText('Import 8 rows', { exact: true }).click();
    await expect(page.getByText('8 expenses added, Aug 2026 to Aug 2026.', { exact: true })).toBeVisible();
    const response = await e2eGet(page, `${API}/expenses/`);
    expect(await response.json()).toHaveLength(8);
  });

  test('US1.3 — Record direct work-related costs', { tag: '@us1.3' }, async ({ page }) => {
    const currentMonth = await currentWorkCostMonth(page);
    const earlierMonth = previousMonth(currentMonth);
    const costOnlyMonth = previousMonth(currentMonth, 2);
    await addIncome(page, '3000.00', `${earlierMonth}-01`);
    await addIncome(page, '2000.00', `${currentMonth}-01`);
    await addWorkCost(page, '80.00', `${costOnlyMonth}-01`);
    await openApp(page);
    // v5 US1.3 Amendments 2 and 3: work costs are recorded on Daily expenses with the
    // "This was for work" switch and listed in their own Work costs table.
    await openMoneyScreen(page, 'Daily expenses');
    const table = page.getByTestId('work-cost-table');

    await ac('AC1.3.6', 'Display recorded entries', async () => {
      // The cost recorded earlier is listed with its date, category and amount.
      await expect(table).toContainText('Petrol');
      await expect(table).toContainText(`1 ${monthLabel(costOnlyMonth).slice(0, 3)}`);
      await expect(table).toContainText('RM 80');
    });

    // The switch sits before the categories because it changes which categories are offered.
    const forWork = page.getByRole('switch', { name: /This was for work/ });
    const switchBox = (await forWork.boundingBox())!;
    await forWork.click({ position: { x: switchBox.width - 20, y: switchBox.height / 2 } });
    await ac('AC1.3.1', 'Select a work-cost category', async () => {
      for (const name of ['Petrol', 'Servicing', 'Platform fees']) {
        await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
      }
      await expect(page.getByRole('button', { name: 'Groceries', exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: 'Platform fees', exact: true }).click();
    });
    const amountInput = page.locator('input:visible').first();
    await ac('AC1.3.2', 'Enter a work-cost amount', async () => {
      await expect(page.getByText('How much did you spend?', { exact: true })).toBeVisible();
      await amountInput.fill('200');
      await expect(amountInput).toHaveValue('200');
    });
    await ac('AC1.3.3', 'Enter a work-cost date', async () => {
      await chooseDay(page, 1);
      await expect(page.getByLabel('Choose date')).toContainText(`1 ${monthLabel(currentMonth)}`);
    });
    await ac('AC1.3.4', 'Add a custom category', async () => {
      await page.getByRole('button', { name: 'Your own cost', exact: true }).click();
      const sheet = page.getByRole('dialog');
      await sheet.locator('input').fill('Equipment rental');
      await sheet.getByRole('button', { name: 'Add', exact: true }).click();
      await expect(sheet).toHaveCount(0);
      await page.getByRole('button', { name: 'Equipment rental', exact: true }).click();
    });
    await ac('AC1.3.5', 'Save a work-cost entry', async () => {
      const saved = page.waitForResponse(response => (
        response.request().method() === 'POST' && response.url().endsWith('/api/v1/work-costs/entries/')
      ));
      await page.getByText('Add expense', { exact: true }).click();
      expect((await saved).status()).toBe(201);
      await expect(page.getByText('Recorded as a work cost, not spending.', { exact: true })).toBeVisible();
      await expect(table).toContainText('Equipment rental');
      await expect(table).toContainText(`1 ${monthLabel(currentMonth).slice(0, 3)}`);
      await expect(table).toContainText('RM 200');
      // It is a work cost, not daily spending, and it is still there when the app is opened again.
      const expenses = await e2eGet(page, `${API}/expenses/`);
      expect(await expenses.json()).toHaveLength(0);
      await openApp(page);
      await openMoneyScreen(page, 'Daily expenses');
      await expect(page.getByTestId('work-cost-table')).toContainText('Equipment rental');
    });
    deferredAc(
      'AC1.3.7',
      'Edit a work-cost record',
      'The v24 port moved work costs onto Daily expenses, and its Work costs table has no edit action; the old Work costs screen that could edit is no longer reachable. Restoring editing needs a decision and a change to the app.',
    );
    await ac('AC1.3.8', 'Apply work costs to the correct month', async () => {
      const patternResponse = await e2eGet(page, `${API}/income-pattern/`);
      expect(patternResponse.ok()).toBeTruthy();
      const months = (await patternResponse.json()).months;
      expect(months.find((month: { month: string }) => month.month === earlierMonth).work_costs).toBe('0.00');
      expect(months.find((month: { month: string }) => month.month === currentMonth).work_costs).toBe('200.00');
      // The month with only a cost has no income, so it is not a recorded income month.
      expect(months.find((month: { month: string }) => month.month === costOnlyMonth)).toBeUndefined();
    });
    const shortMonth = (month: string) => `${monthLabel(month).slice(0, 3)} ${month.slice(2, 4)}`;
    await ac('AC1.3.9', 'Show income after work costs', async () => {
      await openMoneyScreen(page, 'Income pattern');
      await expect(page.getByLabel(new RegExp(`^${shortMonth(currentMonth)}: RM 1,800.00 calculated usable income`))).toBeVisible();
      await expect(page.getByLabel(new RegExp(`^${shortMonth(earlierMonth)}: RM 3,000.00 calculated usable income`))).toBeVisible();
      // The figure is named as income after that month's work costs.
      await expect(page.getByText(
        `Your quietest recorded month is ${monthLabel(currentMonth).slice(0, 3)}: RM 1,800.00 after work costs.`,
        { exact: true },
      )).toBeVisible();
    });
    await ac('AC1.3.10', 'Identify calculated income', async () => {
      await expect(page.getByText(/CALCULATED$/).first()).toBeVisible();
    });
    await captureEvidence(page, 'epic-1', 'ac1.3.1-10__work-costs.png');
  });

  test('US1.4 — Record regular financial commitments', { tag: '@us1.4' }, async ({ page }) => {
    await openApp(page);
    await openMoneyScreen(page, 'Commitments');

    await ac('AC1.4.1', 'Record living costs', async () => {
      await expect(page.getByText('Living costs', { exact: true })).toBeVisible();
      await replaceValue(inputForRow(page, 'Rent'), '700');
    });
    await ac('AC1.4.2', 'Record debt payments', async () => {
      await expect(page.getByText('Debt repayments', { exact: true })).toBeVisible();
      await replaceValue(inputForRow(page, 'Motor loan'), '420');
    });
    deferredAc(
      'AC1.4.3',
      'Record savings',
      'The v24 Bills screen keeps living costs and debt repayments only (commit a1e6fbf); there is no savings section to enter a regular amount in. Requirement and design disagree, so the product owner decides whether to bring the section back or amend the criterion.',
    );
    deferredAc(
      'AC1.4.4',
      'Keep commitment types visually separated',
      'Asks for living costs, debt payments and savings as separate groups. The first two are separate groups on the v24 screen; the savings group was removed with AC1.4.3, so the criterion waits on the same decision.',
    );
    // The two groups the screen does carry are still kept apart.
    await expect(page.getByText(/^(Living costs|Debt repayments)$/)).toHaveCount(2);
    await ac('AC1.4.5', 'Display total commitments', async () => {
      await expect(page.getByText('Total commitments', { exact: true })).toBeVisible();
      await expect(page.getByText('RM 1,120', { exact: true })).toBeVisible();
    });
    await ac('AC1.4.6', 'Identify total as calculated', async () => {
      await expect(page.getByText(/calculated/i).last()).toBeVisible();
    });
    await captureEvidence(page, 'epic-1', 'ac1.4.1-6__commitments.png');
  });

  test('TECH-CM-01 — editable commitments omit repeated provenance while the total stays calculated', { tag: ['@us1.4', '@hardening'] }, async ({ page }) => {
    await openApp(page);
    await openMoneyScreen(page, 'Commitments');

    // One provenance tag per group (Living costs, Debt repayments), not one per editable row.
    await expect(page.getByText(/YOUR DATA/)).toHaveCount(2);
    await expect(page.locator('input:visible')).toHaveCount(6);
    await expect(page.getByText('Total commitments', { exact: true })).toBeVisible();
    await expect(page.getByText(/CALCULATED$/)).toBeVisible();
  });

  test('TECH-CM-02 — mobile commitment inputs accept and persist decimal amounts', { tag: ['@us1.4', '@hardening'] }, async ({ page }) => {
    await openApp(page);
    await openMoneyScreen(page, 'Commitments');
    const rent = inputForRow(page, 'Rent');

    await expect(rent).toHaveAttribute('inputmode', 'decimal');
    const updated = page.waitForResponse(response => (
      response.request().method() === 'PATCH'
      && /\/commitments\/\d+\/$/.test(response.url())
    ));
    await rent.fill('700.55');
    await rent.press('Tab');
    const response = await updated;
    expect(response.status()).toBe(200);
    expect((await response.json()).monthly_amount).toBe('700.55');
    await expect(page.getByText('RM 700.55', { exact: true })).toBeVisible();

    await openApp(page);
    await openMoneyScreen(page, 'Commitments');
    await expect(inputForRow(page, 'Rent')).toHaveValue('700.55');
    await expect(page.getByText('RM 700.55', { exact: true })).toBeVisible();
  });

  test('US1.5 — Record daily expenses manually', { tag: '@us1.5' }, async ({ page }) => {
    await openApp(page);
    await openMoneyScreen(page, 'Daily expenses');
    const amountInput = page.locator('input:visible').first();

    await ac('AC1.5.1', 'Enter an expense amount', async () => {
      await expect(page.getByText('How much did you spend?', { exact: true })).toBeVisible();
      await expect(amountInput).toHaveAttribute('inputmode', 'decimal');
      await amountInput.fill('55.45');
    });
    await ac('AC1.5.2', 'Select an expense category', async () => {
      await expect(page.getByText('What was it for?', { exact: true })).toBeVisible();
      await page.getByText('Groceries', { exact: true }).click();
    });
    await ac('AC1.5.3', 'Use predefined categories', async () => {
      await expect(page.getByText('Meals', { exact: true })).toBeVisible();
      await expect(page.getByText('Tolls & parking', { exact: true })).toBeVisible();
    });
    await ac('AC1.5.4', 'Add a custom category', async () => {
      await page.getByText('Your own category', { exact: true }).click();
      await page.locator('input:visible').last().fill('Pet supplies');
      await page.getByRole('button', { name: 'Add', exact: true }).click();
      await expect(page.getByText('Pet supplies', { exact: true })).toBeVisible();
      await page.getByText('Pet supplies', { exact: true }).click();
    });
    const previous = monthLabel(lastMonth());
    const previousDay = `25 ${previous.slice(0, 3)}`;
    await ac('AC1.5.5', 'Enter expense date', async () => {
      await choosePreviousMonthDay(page, 25);
      await expect(page.getByLabel('Choose date')).toContainText(`25 ${previous}`);
    });
    await ac('AC1.5.6', 'Add the expense', async () => {
      await page.getByText('Add expense', { exact: true }).click();
      await expect(page.getByText(previousDay, { exact: true }).locator('..').locator('..')).toContainText('Pet supplies');
      await expect(page.getByText(previousDay, { exact: true })).toBeVisible();
      await expect(page.getByText('RM 55.45', { exact: true }).first()).toBeVisible();
    });
    await captureEvidence(page, 'epic-1', 'ac1.5.1-6__manual-expense-flow.png');
  });

  test('US1.6 — Review recorded daily expenses', { tag: '@us1.6' }, async ({ page }) => {
    await addExpense(page, '18.40', '2026-08-24');
    await addExpense(page, '36.60', '2026-08-25', 'meals');
    await addExpense(page, '20.00', '2026-07-10');
    await openApp(page);
    await openMoneyScreen(page, 'Daily expenses');

    await ac('AC1.6.1', 'Display current monthly spending', async () => {
      await expect(page.getByText('RM 55', { exact: true }).first()).toBeVisible();
      await expect(page.getByText(/Aug so far/)).toBeVisible();
    });
    await ac('AC1.6.2', 'Display recorded days', async () => {
      await expect(page.getByText(/2 days recorded/)).toBeVisible();
    });
    await ac('AC1.6.3', 'Display individual expenses', async () => {
      await expect(page.getByText('Groceries', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('24 Aug', { exact: true })).toBeVisible();
      await expect(page.getByText('Meals', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('25 Aug', { exact: true })).toBeVisible();
    });
    await ac('AC1.6.4', 'Access manual expense entry', async () => {
      await expect(page.getByText('Manual', { exact: true })).toBeVisible();
      await expect(page.getByText('Add expense', { exact: true })).toBeVisible();
    });
    await ac('AC1.6.5', 'Access receipt-entry flow', async () => {
      await page.getByText('Scan', { exact: true }).click();
      await expect(page.getByText('Take a photo', { exact: true })).toBeVisible();
      await expect(page.getByText('Use a sample receipt', { exact: true })).toBeVisible();
    });
    await ac('AC1.6.6', 'Access monthly expense summary', async () => {
      await page.getByText('Manual', { exact: true }).click();
      await page.getByText('See monthly summary', { exact: true }).click();
      await expect(page.getByText('Aug 2026', { exact: true })).toBeVisible();
      await expect(page.getByText('Jul 2026', { exact: true })).toBeVisible();
    });
    await captureEvidence(page, 'epic-1', 'ac1.6.1-6__expense-review-flow.png');
  });

  test('US1.7 — Use a receipt as the starting point for an expense', { tag: '@us1.7' }, async ({ page }) => {
    await openApp(page);
    await openMoneyScreen(page, 'Daily expenses');
    await page.getByText('Scan', { exact: true }).click();

    await ac('AC1.7.1', 'Select a receipt image', async () => {
      await expect(page.getByText('Take a photo', { exact: true })).toBeVisible();
      await expect(page.getByText('Scan a receipt', { exact: true })).toBeVisible();
      await expect(page.getByText('Take or choose a photo of the receipt.', { exact: true })).toBeVisible();
      await page.getByText('Use a sample receipt', { exact: true }).click();
    });
    await ac('AC1.7.2', 'Show receipt-reading state', async () => {
      await expect(page.getByText('Reading the receipt…', { exact: true }).first()).toBeVisible();
    });
    await expect(page.getByText('Read from your receipt. Check it before saving.', { exact: true })).toBeVisible();
    const inputs = page.locator('input:visible');
    await ac('AC1.7.3', 'Present values for confirmation', async () => {
      await expect(page.getByText('Shop', { exact: true })).toBeVisible();
      await expect(page.getByText('Date', { exact: true })).toBeVisible();
      await expect(page.getByText('Total (RM)', { exact: true })).toBeVisible();
    });
    await ac('AC1.7.4', 'Display receipt-derived merchant', async () => {
      await expect(inputs.nth(0)).toHaveValue('Kedai Runcit Maju');
      await expect(page.getByText(/^from receipt$/i).first()).toBeVisible();
    });
    await ac('AC1.7.5', 'Display receipt-derived date', async () => {
      await expect(inputs.nth(1)).toHaveValue(/\d{4}-\d{2}-\d{2}/);
    });
    await ac('AC1.7.6', 'Display receipt-derived total', async () => {
      await expect(inputs.nth(2)).toHaveValue('34.7');
    });
    await ac('AC1.7.7', 'Choose an expense category', async () => {
      await page.getByText('Meals', { exact: true }).click();
      await expect(page.getByText('Meals', { exact: true })).toBeVisible();
    });
    await ac('AC1.7.8', 'Edit before saving', async () => {
      await inputs.nth(0).fill('Kedai Maju edited');
      await inputs.nth(1).fill('2026-08-25');
      await inputs.nth(2).fill('35.20');
    });
    await ac('AC1.7.9', 'Retake receipt', async () => {
      await page.getByText('Retake', { exact: true }).click();
      await expect(page.getByText('Use a sample receipt', { exact: true })).toBeVisible();
      const response = await e2eGet(page, `${API}/expenses/`);
      expect(await response.json()).toHaveLength(0);
      await page.getByText('Use a sample receipt', { exact: true }).click();
      await expect(page.getByText('Read from your receipt. Check it before saving.', { exact: true })).toBeVisible();
    });
    await ac('AC1.7.10', 'Save the confirmed expense', async () => {
      const confirmationInputs = page.locator('input:visible');
      await confirmationInputs.nth(0).fill('Kedai Maju edited');
      await confirmationInputs.nth(1).fill('2026-08-25');
      await confirmationInputs.nth(2).fill('35.20');
      await page.getByText('Meals', { exact: true }).click();
      await page.getByText('Add expense', { exact: true }).click();
      await expect(page.getByText('25 Aug · Kedai Maju edited', { exact: true }).locator('..').locator('..')).toContainText('Meals');
      await expect(page.getByText('RM 35.20', { exact: true }).first()).toBeVisible();
      const response = await e2eGet(page, `${API}/expenses/`);
      const entries = await response.json();
      expect(entries[0]).toMatchObject({
        entry_method: 'receipt',
        merchant: 'Kedai Maju edited',
        user_confirmed: true,
      });
    });
    await captureEvidence(page, 'epic-1', 'ac1.7.1-10__receipt-expense-flow.png');
  });

  test('US1.8 — Import historical financial records', { tag: '@us1.8' }, async ({ page }) => {
    await openApp(page);
    await openMoneyScreen(page, 'Income');

    await ac('AC1.8.1', 'Access historical import', async () => {
      await page.getByText('Import', { exact: true }).click();
      await expect(page.getByRole('button', { name: 'Choose a .csv file', exact: true })).toBeVisible();
    });
    await ac('AC1.8.2', 'Import historical income records', async () => {
      const chooserPromise = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: 'Choose a .csv file', exact: true }).click();
      const chooser = await chooserPromise;
      await chooser.setFiles(path.resolve(__dirname, 'fixtures/epic1-income.csv'));
      await expect(page.getByText('epic1-income.csv: 5 rows', { exact: true })).toBeVisible();
    });
    await ac('AC1.8.3', 'Preview imported records', async () => {
      await expect(page.getByText(/3 ready/i)).toBeVisible();
      await expect(page.getByText('Row 2', { exact: true })).toBeVisible();
      await expect(page.getByText('RM 900 · 2026-05-03 · E-hailing', { exact: true })).toBeVisible();
    });
    await ac('AC1.8.7', 'Handle records that cannot be recognised', async () => {
      await expect(page.getByText(/2 need attention/i)).toBeVisible();
      await expect(page.getByText('Row 5', { exact: true })).toBeVisible();
      await expect(page.getByText('Row 6', { exact: true })).toBeVisible();
    });
    await ac('AC1.8.8', 'Do not add imported records without confirmation', async () => {
      const response = await e2eGet(page, `${API}/income/record/`);
      expect((await response.json()).entries).toHaveLength(0);
    });
    await ac('AC1.8.4', 'Confirm imported records', async () => {
      await page.getByRole('button', { name: 'Confirm and add 3 records', exact: true }).click();
      await expect(page.getByText('3 income records added. Your analyses now use them.', { exact: true })).toBeVisible();
    });
    await ac('AC1.8.5', 'Include imported periods in analysis', async () => {
      await page.getByText('View income pattern', { exact: true }).click();
      await expect(page.locator('[aria-label*="calculated usable income"]:not([aria-label="Month-by-month calculated usable income"])')).toHaveCount(2);
    });
    await ac('AC1.8.6', 'Allow import with limited history', async () => {
      await expect(page.getByText(/This is two recorded months/)).toBeVisible();
    });
    await captureEvidence(page, 'epic-1', 'ac1.8.1-8__income-import-flow.png');
  });
});
