import { expect, Locator, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { e2eGet, e2ePost, test } from './support/fixtures';
import path from 'node:path';
import { ac } from './support/acceptance';
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

async function openRecord(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Money', exact: true }).click();
  await page.getByText('Your record', { exact: true }).last().click();
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
    await ac('AC1.1.12', 'Validate income amount format', async () => {
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
    await ac('AC1.1.8', 'Identify user-entered values', async () => {
      await expect(page.getByText(/YOUR DATA/).first()).toBeVisible();
    });
    await ac('AC1.1.11', 'Edit a recorded income entry', async () => {
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
    await expect(page.getByText(/Showing 5 possible income entries \(maximum 20\)/)).toBeVisible();
    await expect(page.getByRole('checkbox')).toHaveCount(5);
    await expect(page.getByRole('checkbox').nth(2)).toHaveAttribute('aria-checked', 'false');
    await page.getByRole('button', { name: 'Add 4 entries', exact: true }).click();
    await expect(page.getByText('4 entries added from your scan.', { exact: true })).toBeVisible();
    const response = await e2eGet(page, `${API}/income/record/`);
    const sampleEntries = (await response.json()).entries;
    expect(sampleEntries).toHaveLength(4);
    expect(sampleEntries.some((entry: { amount: string }) => entry.amount === '64.00')).toBe(false);
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
    let firstWorkCostId = '';
    let secondWorkCostId = '';
    let movedExpenseId = '';
    await addIncome(page, '3000.00', `${earlierMonth}-01`);
    await addIncome(page, '2000.00', `${currentMonth}-01`);
    await addWorkCost(page, '80.00', `${costOnlyMonth}-01`);
    await openApp(page);
    // v5 US1.3 Amendments 2 and 3: work costs are recorded on Daily expenses with the
    // "This was for work" switch and listed in their own Work costs table.
    await openMoneyScreen(page, 'Daily expenses');
    const table = page.getByTestId('work-cost-table');

    await ac('AC1.3.6', 'Display recorded work costs', async () => {
      // The cost recorded earlier is listed with its date, category and amount.
      await expect(table).toContainText('Petrol');
      await expect(table).toContainText(`1 ${monthLabel(costOnlyMonth).slice(0, 3)}`);
      await expect(table).toContainText('RM 80');
    });

    // The switch sits before the categories because it changes which categories are offered.
    const forWork = page.getByRole('switch', { name: /This was for work/ });
    const switchBox = (await forWork.boundingBox())!;
    await ac('AC1.3.12', 'Mark a daily expense as a work cost', async () => {
      await forWork.click({ position: { x: switchBox.width - 20, y: switchBox.height / 2 } });
      await expect(forWork).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByRole('button', { name: 'Platform fees', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Groceries', exact: true })).toHaveCount(0);
    });
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
    await ac('AC1.3.3', 'Enter the work-cost date', async () => {
      await chooseDay(page, 1);
      await expect(page.getByLabel('Choose date')).toContainText(`1 ${monthLabel(currentMonth)}`);
    });
    await ac('AC1.3.4', 'Add my own work-cost category', async () => {
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
      const response = await saved;
      expect(response.status()).toBe(201);
      firstWorkCostId = String((await response.json()).id);
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
    await ac('AC1.3.11', 'Record different work costs separately', async () => {
      const switchAgain = page.getByRole('switch', { name: /This was for work/ });
      const box = (await switchAgain.boundingBox())!;
      await switchAgain.click({ position: { x: box.width - 20, y: box.height / 2 } });
      await page.getByRole('button', { name: 'Equipment rental', exact: true }).click();
      await page.locator('input:visible').first().fill('35');
      await chooseDay(page, 2);
      const created = page.waitForResponse(response => (
        response.request().method() === 'POST' && response.url().endsWith('/api/v1/work-costs/entries/')
      ));
      await page.getByText('Add expense', { exact: true }).click();
      const response = await created;
      expect(response.status()).toBe(201);
      secondWorkCostId = String((await response.json()).id);
      await expect(table.getByTestId(/^work-cost-entry-/)).toHaveCount(2);
      await expect(table).toContainText('RM 200');
      await expect(table).toContainText('RM 35');
    });
    await ac('AC1.3.7', 'Edit a recorded work cost', async () => {
      const selected = table.getByTestId(`work-cost-entry-${firstWorkCostId}`);
      await selected.getByLabel('edit').click();
      const editor = page.getByTestId('entry-editor');
      await editor.getByLabel('Edit work-cost amount').fill('205');
      const saved = page.waitForResponse(response => (
        response.request().method() === 'PATCH'
        && response.url().endsWith(`/api/v1/work-costs/entries/${firstWorkCostId}/`)
      ));
      await editor.getByRole('button', { name: 'Save', exact: true }).click();
      expect((await saved).status()).toBe(200);
      await expect(selected).toContainText('RM 205');
      await expect(table.getByTestId(`work-cost-entry-${secondWorkCostId}`)).toContainText('RM 35');
      const entries = await (await e2eGet(page, `${API}/work-costs/entries/`)).json();
      expect(entries.find((entry: { id: number }) => String(entry.id) === firstWorkCostId).amount).toBe('205.00');
      expect(entries.find((entry: { id: number }) => String(entry.id) === secondWorkCostId).amount).toBe('35.00');
    });
    await ac('AC1.3.13', 'Move an entry between spending and work costs', async () => {
      const selected = table.getByTestId(`work-cost-entry-${firstWorkCostId}`);
      await selected.getByLabel('edit').click();
      const editor = page.getByTestId('entry-editor');
      const targetSwitch = editor.getByRole('switch', { name: 'This was for work' });
      const box = (await targetSwitch.boundingBox())!;
      await targetSwitch.click({ position: { x: box.width - 20, y: box.height / 2 } });
      await editor.getByText('Groceries', { exact: true }).click();
      await editor.getByLabel('Edit work-cost amount').fill('207.50');
      await pickDate(page, `${currentMonth}-03`, editor.getByLabel('Choose date'));
      const moved = page.waitForResponse(response => (
        response.request().method() === 'PATCH'
        && response.url().endsWith(`/api/v1/work-costs/entries/${firstWorkCostId}/move/`)
      ));
      await editor.getByRole('button', { name: 'Save', exact: true }).click();
      const response = await moved;
      expect(response.status()).toBe(200);
      movedExpenseId = String((await response.json()).id);
      await expect(table.getByTestId(`work-cost-entry-${firstWorkCostId}`)).toHaveCount(0);
      await expect(page.getByTestId(`expense-entry-${movedExpenseId}`)).toContainText('RM 207.50');
      const expenseResponse = await e2eGet(page, `${API}/expenses/`);
      const movedExpenses = await expenseResponse.json();
      expect(movedExpenses).toHaveLength(1);
      expect(await (await e2eGet(page, `${API}/work-costs/entries/`)).json()).toHaveLength(2);
      expect(movedExpenses[0]).toEqual(expect.objectContaining({ amount: '207.50', date: `${currentMonth}-03` }));

      await openRecord(page);
      await expect(page.getByText('Moved to spending', { exact: true })).toBeVisible();

      await openMoneyScreen(page, 'Daily expenses');
      const expense = page.getByTestId(`expense-entry-${movedExpenseId}`);
      await expense.getByLabel('edit').click();
      const expenseEditor = page.getByTestId('entry-editor');
      const backToWork = expenseEditor.getByRole('switch', { name: 'This was for work' });
      const reverseBox = (await backToWork.boundingBox())!;
      await backToWork.click({ position: { x: reverseBox.width - 20, y: reverseBox.height / 2 } });
      await expenseEditor.getByLabel('Edit work-cost amount').fill('210.25');
      await pickDate(page, `${currentMonth}-04`, expenseEditor.getByLabel('Choose date'));
      await expenseEditor.getByText('Petrol', { exact: true }).click();
      const movedBack = page.waitForResponse(response => (
        response.request().method() === 'PATCH'
        && response.url().endsWith(`/api/v1/expenses/${movedExpenseId}/move/`)
      ));
      await expenseEditor.getByRole('button', { name: 'Save', exact: true }).click();
      const reverseResponse = await movedBack;
      expect(reverseResponse.status()).toBe(200);
      const reverseEntry = await reverseResponse.json();
      expect(reverseEntry).toEqual(expect.objectContaining({ amount: '210.25', date: `${currentMonth}-04`, merchant: '' }));
      await expect(page.getByTestId('work-cost-table')).toContainText('RM 210.25');
      expect(await (await e2eGet(page, `${API}/expenses/`)).json()).toHaveLength(0);
      expect(await (await e2eGet(page, `${API}/work-costs/entries/`)).json()).toHaveLength(3);
      await openRecord(page);
      await expect(page.getByText('Moved to work costs', { exact: true })).toBeVisible();
    });
    await ac('AC1.3.8', 'Apply work costs to the correct month', async () => {
      const patternResponse = await e2eGet(page, `${API}/income-pattern/`);
      expect(patternResponse.ok()).toBeTruthy();
      const months = (await patternResponse.json()).months;
      expect(months.find((month: { month: string }) => month.month === earlierMonth).work_costs).toBe('0.00');
      expect(months.find((month: { month: string }) => month.month === currentMonth).work_costs).toBe('245.25');
      // The month with only a cost has no income, so it is not a recorded income month.
      expect(months.find((month: { month: string }) => month.month === costOnlyMonth)).toBeUndefined();
    });
    const shortMonth = (month: string) => `${monthLabel(month).slice(0, 3)} ${month.slice(2, 4)}`;
    await ac('AC1.3.9', 'Show income after work costs', async () => {
      await openMoneyScreen(page, 'Income pattern');
      await expect(page.getByTestId('pattern-month-so-far')).toContainText(
        `Month so far · ${monthLabel(currentMonth).slice(0, 3)} ${currentMonth.slice(0, 4)}: RM 1,754.75 after work costs.`,
      );
      await expect(page.getByLabel(new RegExp(`^${shortMonth(earlierMonth)}: RM 3,000.00 calculated usable income`))).toBeVisible();
      // The figure is named as income after that month's work costs.
      await expect(page.getByTestId('pattern-quietest')).toContainText(
        `Your quietest recorded month is ${monthLabel(earlierMonth).slice(0, 3)}: RM 3,000.00 after work costs.`,
      );
    });
    await ac('AC1.3.10', 'Identify calculated income', async () => {
      await expect(page.getByText(/CALCULATED$/).first()).toBeVisible();
    });
    await captureEvidence(page, 'epic-1', 'ac1.3.1-13__work-costs.png');
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
    await ac('AC1.4.3', 'Record savings', async () => {
      await expect(page.getByText('Savings', { exact: true })).toBeVisible();
      await replaceValue(inputForRow(page, 'Monthly savings'), '100');
    });
    await ac('AC1.4.4', 'Keep commitment types visually separated', async () => {
      await expect(page.getByText(/^(Living costs|Debt repayments|Savings)$/)).toHaveCount(3);
      await expect(inputForRow(page, 'Monthly savings')).toHaveValue('100');
    });
    await ac('AC1.4.5', 'Display total commitments', async () => {
      await expect(page.getByText('Total commitments', { exact: true })).toBeVisible();
      await expect(page.getByText('RM 1,220', { exact: true })).toBeVisible();
    });
    await ac('AC1.4.6', 'Identify total as calculated', async () => {
      await expect(page.getByText(/calculated/i).last()).toBeVisible();
    });
    await captureEvidence(page, 'epic-1', 'ac1.4.1-6__commitments.png');
  });

  test('TECH-CM-01 — editable commitments omit repeated provenance while the total stays calculated', { tag: ['@us1.4', '@hardening'] }, async ({ page }) => {
    await openApp(page);
    await openMoneyScreen(page, 'Commitments');

    // One provenance tag per group, not one per editable row.
    await expect(page.getByText(/YOUR DATA/)).toHaveCount(3);
    await expect(page.locator('input:visible')).toHaveCount(7);
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

    await ac('AC1.5.8', 'Offer an example without filling the field', async () => {
      await expect(amountInput).toHaveValue('');
      await expect(amountInput).toHaveAttribute('placeholder', '0');
    });

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
    await ac('AC1.5.7', 'Show the month a table is reporting', async () => {
      const monthControl = page.getByTestId('expense-month-control');
      const table = page.getByTestId('recent-expense-table');
      await expect(monthControl).toContainText(previous);
      const controlBox = (await monthControl.boundingBox())!;
      const tableBox = (await table.boundingBox())!;
      expect(controlBox.y + controlBox.height).toBeLessThan(tableBox.y);
    });
    await captureEvidence(page, 'epic-1', 'ac1.5.1-8__manual-expense-flow.png');
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

  test('US1.9 — Read a bank statement or e-statement into entries', { tag: '@us1.9' }, async ({ page }) => {
    await openApp(page);
    // Accept the product-wide disclosure through the real guest flow. Guest
    // entry intentionally clears pre-existing local state, so seeding storage
    // before openApp() would not prove that the statement notice is independent.
    await page.getByLabel('Ask Ruma').click();
    await expect(page.getByText('Before you use RuMampu AI', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Continue with AI', exact: true }).click();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect.poll(async () => page.evaluate(() => {
      const saved = JSON.parse(window.localStorage.getItem('rumampu_local_state') || '{}');
      return saved.aiDisclosureAccepted === true;
    })).toBe(true);
    await openMoneyScreen(page, 'Income');
    await page.getByText('Scan', { exact: true }).click();
    let scanCalls = 0;
    await page.route('**/api/v1/income/scan/', route => {
      scanCalls += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          is_earnings: true,
          rows: [
            { date: '2026-09-03', amount: '1200.00', low_confidence: false },
            { date: null, amount: '850.00', low_confidence: true, affordability_score: 740 },
            { date: '2026-09-01', amount: '45.00', low_confidence: true, eligibility: 'approved' },
          ],
          credibility_assessment: { score: 99 },
        }),
      });
    });

    const upload = page.getByRole('button', { name: 'Take a photo or choose a screenshot', exact: true });
    await upload.click();
    const disclosure = page.getByTestId('statement-scan-disclosure');
    await expect(disclosure).toBeVisible();
    await ac('AC1.9.1', 'Told before upload', async () => {
      await expect(disclosure).toContainText('Groq');
      await expect(disclosure).toContainText('United States');
      await expect(disclosure).toContainText('other countries');
      await expect(disclosure).toContainText('up to 30 days');
      await expect(disclosure).toContainText('Zero Data Retention disabled');
      await expect(disclosure.getByRole('link', { name: 'Groq: Your Data and retention' })).toBeVisible();
      await expect(disclosure.getByRole('link', { name: 'Groq Data Processing Addendum' })).toBeVisible();
      const saved = await page.evaluate(() => JSON.parse(window.localStorage.getItem('rumampu_local_state') || '{}'));
      expect(saved.aiDisclosureAccepted).toBe(true);
      expect(saved.statementDisclosureVersion).toBeUndefined();
    });

    const fileChooserPromise = page.waitForEvent('filechooser');
    await disclosure.getByRole('button', { name: 'Continue to choose an image', exact: true }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'synthetic-income-statement.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=', 'base64'),
    });
    await expect(page.getByText(/Showing 3 possible income entries \(maximum 20\)/)).toBeVisible();
    expect(scanCalls).toBe(1);

    await ac('AC1.9.2', 'Transactions only', async () => {
      await expect(page.getByText(/affordability|credibility|eligibility/i)).toHaveCount(0);
      const row1 = page.getByTestId('income-scan-row-1');
      const row2 = page.getByTestId('income-scan-row-2');
      const row3 = page.getByTestId('income-scan-row-3');
      await expect(row1.getByLabel('Date for row 1')).toHaveValue('2026-09-03');
      await expect(row1.getByRole('checkbox')).toHaveAttribute('aria-checked', 'true');
      await expect(row2).toContainText('No date was read');
      await expect(row2.getByRole('checkbox')).toHaveAttribute('aria-checked', 'false');
      await expect(row3).toContainText('Low confidence');
      await expect(row3.getByRole('checkbox')).toHaveAttribute('aria-checked', 'false');
    });

    await ac('AC1.9.3', 'Review before save', async () => {
      const before = await e2eGet(page, `${API}/income/record/`);
      expect((await before.json()).entries).toHaveLength(0);

      await page.getByRole('radio', { name: 'E-hailing', exact: true }).first().click();
      const row2 = page.getByTestId('income-scan-row-2');
      await row2.getByLabel('Date for row 2').fill('2026-09-02');
      await row2.getByRole('radio', { name: 'Part-time (fixed)', exact: true }).click();
      await row2.getByRole('checkbox').click();
      await expect(page.getByRole('button', { name: 'Add 2 entries', exact: true })).toBeEnabled();
      await page.getByRole('button', { name: 'Add 2 entries', exact: true }).click();
      await expect(page.getByText('2 entries added from your scan.', { exact: true })).toBeVisible();

      const after = await e2eGet(page, `${API}/income/record/`);
      const entries = (await after.json()).entries;
      expect(entries).toHaveLength(2);
      expect(entries.map((entry: { amount: string }) => entry.amount).sort()).toEqual(['1200.00', '850.00']);
      expect(entries.some((entry: { amount: string }) => entry.amount === '45.00')).toBe(false);
    });
  });

  test('US1.9 failure offers manual entry and Iteration 2 plans record Groq controls', { tag: '@us1.9' }, async ({ page }) => {
    await openApp(page);
    await openMoneyScreen(page, 'Income');
    await page.getByText('Scan', { exact: true }).click();
    await page.route('**/api/v1/income/scan/', route => route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'income_scan_failed', message: 'Synthetic reader failure.' } }),
    }));
    const upload = page.getByRole('button', { name: 'Take a photo or choose a screenshot', exact: true });
    await upload.click();
    const disclosure = page.getByTestId('statement-scan-disclosure');
    await expect(disclosure).toBeVisible();
    const fileChooserPromise = page.waitForEvent('filechooser');
    await disclosure.getByRole('button', { name: 'Continue to choose an image', exact: true }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'synthetic-unreadable-statement.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=', 'base64'),
    });
    await ac('AC1.9.5', 'Failure is not silent', async () => {
      await expect(page.getByText('We couldn’t read this statement. Nothing was added. Try again or enter income manually.', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Enter income manually', exact: true }).click();
      await expect(page.getByText('How much did you earn?', { exact: true })).toBeVisible();
      const record = await e2eGet(page, `${API}/income/record/`);
      expect((await record.json()).entries).toHaveLength(0);
    });

    await ac('AC1.9.4', 'Documented as a processor', async () => {
      const root = path.resolve(__dirname, '../..');
      const securityPlan = readFileSync(path.join(root, 'docs/privacy/ITERATION_2_SECURITY_RISK_PRIVACY_PLAN.cn.md'), 'utf8');
      const dataPlan = readFileSync(path.join(root, 'docs/privacy/ITERATION_2_DATA_MANAGEMENT_PLAN.cn.md'), 'utf8');
      for (const plan of [securityPlan, dataPlan]) {
        expect(plan).toContain('Groq');
        expect(plan).toContain('美国');
        expect(plan).toContain('其他国家');
        expect(plan).toContain('30 天');
        expect(plan).toContain('ZDR');
        expect(plan).toContain('customer-data-processing-addendum');
      }
      expect(securityPlan).toContain('Global ZDR、Inference APIs ZDR 均关闭');
    });
  });
});
