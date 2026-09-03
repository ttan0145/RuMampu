import { expect, Locator, Page } from '@playwright/test';
import { e2eGet, e2ePost, test } from './support/fixtures';
import path from 'node:path';
import { ac } from './support/acceptance';
import { API, captureEvidence, openApp, openMoneyScreen } from './support/app';
import { currentWorkCostMonth, monthLabel, previousMonth, selectWorkCostMonth } from './support/work-costs';

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

function inputForRow(page: Page, label: string): Locator {
  return page.getByText(label, { exact: true }).locator('..').locator('..').locator('input');
}

async function replaceValue(input: Locator, value: string): Promise<void> {
  await input.fill(value);
  await input.press('Tab');
}

async function chooseDay(page: Page, day: number): Promise<void> {
  await page.getByLabel('Choose date').click();
  await page.getByText(String(day), { exact: true }).last().click();
}

test.describe('Epic 1 — Income Builder', { tag: '@epic1' }, () => {
  test('US1.1 — Record income from different sources', { tag: '@us1.1' }, async ({ page }) => {
    await openApp(page);
    await openMoneyScreen(page, 'Income');
    const amountInput = page.locator('input:visible').first();

    await ac('AC1.1.1', 'Enter income amount', async () => {
      await expect(page.getByText('Amount (RM)', { exact: true })).toBeVisible();
      await expect(amountInput).toBeVisible();
    });
    await ac('AC1.1.2', 'Enter income date', async () => {
      await expect(page.getByText('Date', { exact: true })).toBeVisible();
      await expect(page.getByLabel('Choose date')).toBeVisible();
      await chooseDay(page, 1);
      await expect(page.getByLabel('Choose date')).toContainText('1 Aug 2026');
    });
    await ac('AC1.1.3', 'Select an income source', async () => {
      await expect(page.getByText('E-hailing', { exact: true })).toBeVisible();
      await expect(page.getByText('Freelance', { exact: true })).toBeVisible();
      await expect(page.getByText('Part-time (fixed)', { exact: true })).toBeVisible();
    });
    await ac('AC1.1.5', 'Add a custom income source', async () => {
      await page.getByText('+ Your own source', { exact: true }).click();
      await page.locator('input:visible').last().fill('Weekend market');
      await page.getByRole('button', { name: 'Add', exact: true }).click();
      await expect(page.getByText('Weekend market', { exact: true })).toBeVisible();
    });
    await ac('AC1.1.9', 'Prevent negative income entry', async () => {
      await amountInput.fill('-10');
      await chooseDay(page, 1);
      await page.getByRole('button', { name: 'Add income' }).click();
      await expect(page.getByText('An amount below zero can’t be saved.', { exact: true })).toBeVisible();
    });

    await amountInput.fill('100');
    await chooseDay(page, 1);
    await page.getByText('E-hailing', { exact: true }).click();
    await ac('AC1.1.6', 'Save an income entry', async () => {
      await page.getByRole('button', { name: 'Add income' }).click();
      await expect(page.getByText(/1 Aug · E-hailing/)).toBeVisible();
    });
    await ac('AC1.1.4', 'Use multiple income sources', async () => {
      await amountInput.fill('120');
      await chooseDay(page, 2);
      await page.getByText('Freelance', { exact: true }).click();
      await page.getByRole('button', { name: 'Add income' }).click();
      await expect(page.getByText(/2 Aug · Freelance/)).toBeVisible();
      await expect(page.getByText(/1 Aug · E-hailing/)).toBeVisible();
    });
    await ac('AC1.1.7', 'Display existing entries', async () => {
      await expect(page.getByText('RM 120.00', { exact: true })).toBeVisible();
      await expect(page.getByText('RM 100.00', { exact: true })).toBeVisible();
    });
    await ac('AC1.1.8', 'Identify user-entered values', async () => {
      await expect(page.getByText(/your data/i).first()).toBeVisible();
    });

    await amountInput.fill('140');
    await chooseDay(page, 3);
    await page.getByRole('button', { name: 'Add income' }).click();
    await expect(page.getByText(/3 Aug · Freelance/)).toBeVisible();
    await ac('AC1.1.10', 'Warn about an unusually high income entry', async () => {
      await amountInput.fill('1000');
      await chooseDay(page, 4);
      await page.getByRole('button', { name: 'Add income' }).click();
      await expect(page.getByText('Well above your usual entries. Keep it?', { exact: true })).toBeVisible();
      await expect(page.getByText('Keep', { exact: true })).toBeVisible();
    });
    await captureEvidence(page, 'epic-1', 'ac1.1.1-10__income-entry-flow.png');
  });

  test('US1.2 — Add historical income', { tag: '@us1.2' }, async ({ page }) => {
    await openApp(page);
    await openMoneyScreen(page, 'Income');

    await ac('AC1.2.1', 'Access past-month entry', async () => {
      await page.getByText('Add a past month', { exact: true }).click();
      await expect(page.getByText('Add a past month', { exact: true }).last()).toBeVisible();
    });
    const amountInput = page.locator('input:visible').last();
    await ac('AC1.2.2', 'Enter a monthly total', async () => {
      await expect(page.getByText('One total for that month is enough.', { exact: true })).toBeVisible();
      await expect(page.getByLabel('Choose month')).toBeVisible();
      await amountInput.fill('2750');
      await page.getByRole('button', { name: 'Add', exact: true }).click();
      await expect(page.getByText(/Monthly total/)).toBeVisible();
      await expect(page.getByText('RM 2,750.00', { exact: true })).toBeVisible();
    });
    await ac('AC1.2.3', 'Include past income in analysis', async () => {
      const response = await e2eGet(page, `${API}/income-pattern/`);
      expect(response.ok()).toBeTruthy();
      expect((await response.json()).recorded_month_count).toBe(1);
    });
    await ac('AC1.2.4', 'Allow any available history', async () => {
      await page.getByText('Add a past month', { exact: true }).click();
      await expect(page.getByText('Add whatever history you have. There is no 6 or 12 month minimum.', { exact: true })).toBeVisible();
    });
    await captureEvidence(page, 'epic-1', 'ac1.2.1-4__historical-income-flow.png');
  });

  test('US1.3 — Record direct work-related costs', { tag: '@us1.3' }, async ({ page }) => {
    const currentMonth = await currentWorkCostMonth(page);
    const earlierMonth = previousMonth(currentMonth);
    const costOnlyMonth = previousMonth(currentMonth, 2);
    const entryDate = `${currentMonth}-01`;
    await addIncome(page, '3000.00', `${earlierMonth}-01`);
    await addIncome(page, '2000.00', entryDate);
    await addWorkCost(page, '80.00', `${costOnlyMonth}-01`);
    await openApp(page);
    await openMoneyScreen(page, 'Work costs');

    await ac('AC1.3.1', 'Select a work-cost category', async () => {
      await expect(page.getByText('Petrol', { exact: true })).toBeVisible();
      await expect(page.getByText('Servicing', { exact: true })).toBeVisible();
      await expect(page.getByText('Platform fees', { exact: true })).toBeVisible();
      await page.getByText('Platform fees', { exact: true }).click();
    });
    const amountInput = page.locator('input:visible').first();
    await ac('AC1.3.2', 'Enter a work-cost amount', async () => {
      await expect(page.getByText('Amount (RM)', { exact: true })).toBeVisible();
      await amountInput.fill('200');
      await expect(amountInput).toHaveValue('200');
    });
    await ac('AC1.3.3', 'Enter a work-cost date', async () => {
      await chooseDay(page, 1);
      await expect(page.getByLabel('Choose date')).toContainText(`1 ${monthLabel(currentMonth)}`);
    });
    await ac('AC1.3.4', 'Add a custom category', async () => {
      await page.getByText('+ Your own category', { exact: true }).click();
      await page.locator('input:visible').last().fill('Equipment rental');
      await page.getByRole('button', { name: 'Add', exact: true }).click();
      await expect(page.getByText('Equipment rental', { exact: true })).toBeVisible();
      await page.getByText('Equipment rental', { exact: true }).click();
    });
    await ac('AC1.3.5', 'Save a work-cost entry', async () => {
      await page.getByRole('button', { name: 'Add work cost', exact: true }).click();
      await expect(page.getByText(`${entryDate} · Equipment rental`, { exact: true })).toBeVisible();
      await openApp(page);
      await openMoneyScreen(page, 'Work costs');
      await expect(page.getByText(`${entryDate} · Equipment rental`, { exact: true })).toBeVisible();
    });
    await ac('AC1.3.6', 'Display recorded entries', async () => {
      await expect(page.getByText(`${costOnlyMonth}-01 · Petrol`, { exact: true })).toBeVisible();
      await expect(page.getByText('RM 200.00', { exact: true })).toBeVisible();
    });
    await ac('AC1.3.7', 'Edit a work-cost record', async () => {
      const equipmentRecord = page.getByTestId(/^work-cost-entry-/).filter({ hasText: 'Equipment rental' });
      await equipmentRecord.getByText('Edit', { exact: true }).click();
      const editAmount = page.locator('input:visible').last();
      await editAmount.fill('250');
      await page.getByRole('button', { name: 'Done', exact: true }).click();
      await expect(page.getByText('RM 250.00', { exact: true })).toBeVisible();
    });
    await ac('AC1.3.8', 'Apply work costs to the correct month', async () => {
      const patternResponse = await e2eGet(page, `${API}/income-pattern/`);
      expect(patternResponse.ok()).toBeTruthy();
      const months = (await patternResponse.json()).months;
      expect(months.find((month: { month: string }) => month.month === earlierMonth).work_costs).toBe('0.00');
      expect(months.find((month: { month: string }) => month.month === currentMonth).work_costs).toBe('250.00');
    });
    await ac('AC1.3.9', 'Show income after work costs', async () => {
      await expect(page.getByText('Income after work costs', { exact: true })).toBeVisible();
      await expect(page.getByText('RM 1,750.00', { exact: true })).toBeVisible();
      await selectWorkCostMonth(page, costOnlyMonth);
      await expect(page.getByText(`No income recorded for ${monthLabel(costOnlyMonth)}. Add income before RuMampu can calculate this figure.`, { exact: true })).toBeVisible();
    });
    await ac('AC1.3.10', 'Identify calculated income', async () => {
      await selectWorkCostMonth(page, currentMonth);
      await expect(page.getByTestId('work-cost-summary').getByText(/CALCULATED$/)).toBeVisible();
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
    await ac('AC1.4.3', 'Record savings', async () => {
      await expect(page.getByText('Savings', { exact: true }).first()).toBeVisible();
      await replaceValue(inputForRow(page, 'Monthly savings'), '100');
    });
    await ac('AC1.4.4', 'Keep commitment types visually separated', async () => {
      const headings = page.getByText(/Living costs|Debt repayments|Savings/, { exact: true });
      await expect(headings).toHaveCount(3);
    });
    await ac('AC1.4.5', 'Display total commitments', async () => {
      await expect(page.getByText('Total commitments', { exact: true })).toBeVisible();
      await expect(page.getByText('RM 1,220.00', { exact: true })).toBeVisible();
    });
    await ac('AC1.4.6', 'Identify total as calculated', async () => {
      await expect(page.getByText(/calculated/i).last()).toBeVisible();
    });
    await captureEvidence(page, 'epic-1', 'ac1.4.1-6__commitments.png');
  });

  test('US1.5 — Record daily expenses manually', { tag: '@us1.5' }, async ({ page }) => {
    await openApp(page);
    await openMoneyScreen(page, 'Daily expenses');
    await page.getByRole('button', { name: 'Add expense', exact: true }).click();
    const amountInput = page.locator('input:visible').first();

    await ac('AC1.5.1', 'Enter an expense amount', async () => {
      await expect(page.getByText('Amount (RM)', { exact: true })).toBeVisible();
      await amountInput.fill('55');
    });
    await ac('AC1.5.2', 'Select an expense category', async () => {
      await expect(page.getByText('Category', { exact: true })).toBeVisible();
      await page.getByText('Groceries', { exact: true }).click();
    });
    await ac('AC1.5.3', 'Use predefined categories', async () => {
      await expect(page.getByText('Meals', { exact: true })).toBeVisible();
      await expect(page.getByText('Tolls & parking', { exact: true })).toBeVisible();
    });
    await ac('AC1.5.4', 'Add a custom category', async () => {
      await page.getByText('+ Your own category', { exact: true }).click();
      await page.locator('input:visible').last().fill('Pet supplies');
      await page.getByRole('button', { name: 'Add', exact: true }).click();
      await expect(page.getByText('Pet supplies', { exact: true })).toBeVisible();
      await page.getByText('Pet supplies', { exact: true }).click();
    });
    await ac('AC1.5.5', 'Enter expense date', async () => {
      await chooseDay(page, 25);
      await expect(page.getByLabel('Choose date')).toContainText('25 Aug 2026');
    });
    await ac('AC1.5.6', 'Add the expense', async () => {
      await page.getByRole('button', { name: 'Add expense', exact: true }).click();
      await expect(page.getByText(/25 Aug · Pet supplies/)).toBeVisible();
      await expect(page.getByText('RM 55.00', { exact: true }).first()).toBeVisible();
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
      await expect(page.getByText('RM 55.00', { exact: true }).first()).toBeVisible();
      await expect(page.getByText(/Aug so far/)).toBeVisible();
    });
    await ac('AC1.6.2', 'Display recorded days', async () => {
      await expect(page.getByText(/2 days recorded/)).toBeVisible();
    });
    await ac('AC1.6.3', 'Display individual expenses', async () => {
      await expect(page.getByText(/24 Aug · Groceries/)).toBeVisible();
      await expect(page.getByText(/25 Aug · Meals/)).toBeVisible();
    });
    await ac('AC1.6.4', 'Access manual expense entry', async () => {
      await expect(page.getByRole('button', { name: 'Add expense', exact: true })).toBeVisible();
    });
    await ac('AC1.6.5', 'Access receipt-entry flow', async () => {
      await expect(page.getByText('Scan a receipt', { exact: true })).toBeVisible();
    });
    await ac('AC1.6.6', 'Access monthly expense summary', async () => {
      await page.getByText('Monthly summary', { exact: true }).click();
      await expect(page.getByText('Aug 2026', { exact: true })).toBeVisible();
      await expect(page.getByText('Jul 2026', { exact: true })).toBeVisible();
    });
    await captureEvidence(page, 'epic-1', 'ac1.6.1-6__expense-review-flow.png');
  });

  test('US1.7 — Use a receipt as the starting point for an expense', { tag: '@us1.7' }, async ({ page }) => {
    await openApp(page);
    await openMoneyScreen(page, 'Daily expenses');
    await page.getByText('Scan a receipt', { exact: true }).click();

    await ac('AC1.7.1', 'Select a receipt image', async () => {
      await expect(page.getByText('Take a photo', { exact: true })).toBeVisible();
      await expect(page.getByText('Choose a photo', { exact: true })).toBeVisible();
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
      await expect(page.getByText('FROM RECEIPT', { exact: true }).first()).toBeVisible();
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
      await page.getByRole('button', { name: 'Add', exact: true }).click();
      await expect(page.getByText(/25 Aug · Meals/)).toBeVisible();
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
      await page.getByText('Import income from CSV', { exact: true }).click();
      await expect(page.getByText('Import income', { exact: true })).toBeVisible();
    });
    await ac('AC1.8.2', 'Import historical income records', async () => {
      const chooserPromise = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: 'Select CSV file', exact: true }).click();
      const chooser = await chooserPromise;
      await chooser.setFiles(path.resolve(__dirname, 'fixtures/epic1-income.csv'));
      await expect(page.getByText('epic1-income.csv: 5 rows', { exact: true })).toBeVisible();
    });
    await ac('AC1.8.3', 'Preview imported records', async () => {
      await expect(page.getByText(/3 ready/i)).toBeVisible();
      await expect(page.getByText('Row 2', { exact: true })).toBeVisible();
      await expect(page.getByText(/RM 900.00 · 2026-05-03 · E-hailing/)).toBeVisible();
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
