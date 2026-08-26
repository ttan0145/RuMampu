import { expect, Locator, Page, test } from '@playwright/test';
import path from 'node:path';
import { ac } from './support/acceptance';
import { API, captureEvidence, openApp, openMoneyScreen } from './support/app';

async function incomeSourceId(page: Page, slug = 'ehail'): Promise<number> {
  const response = await page.request.get(`${API}/income/record/`);
  expect(response.ok()).toBeTruthy();
  const record = await response.json();
  return record.sources.find((source: { slug: string }) => source.slug === slug).id;
}

async function expenseCategoryId(page: Page, slug = 'groc'): Promise<number> {
  const response = await page.request.get(`${API}/expense-categories/`);
  expect(response.ok()).toBeTruthy();
  const categories = await response.json();
  return categories.find((category: { slug: string }) => category.slug === slug).id;
}

async function addIncome(page: Page, amount: string, date: string, slug = 'ehail'): Promise<void> {
  const response = await page.request.post(`${API}/income/entries/`, {
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
  const response = await page.request.post(`${API}/expenses/`, {
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

test.describe('Epic 1 — Income Builder', { tag: '@epic1' }, () => {
  test('US1.1 — Record income from different sources', { tag: '@us1.1' }, async ({ page }) => {
    await openApp(page);
    await openMoneyScreen(page, 'Income');
    const inputs = page.locator('input:visible');

    await ac('AC1.1.1', 'Enter income amount', async () => {
      await expect(page.getByText('Amount (RM)', { exact: true })).toBeVisible();
      await expect(inputs.nth(0)).toBeVisible();
    });
    await ac('AC1.1.2', 'Enter income date', async () => {
      await expect(page.getByText('Date', { exact: true })).toBeVisible();
      await expect(inputs.nth(1)).toHaveAttribute('placeholder', 'YYYY-MM-DD');
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
      await inputs.nth(0).fill('-10');
      await inputs.nth(1).fill('2026-08-01');
      await page.getByRole('button', { name: 'Add income' }).click();
      await expect(page.getByText('An amount below zero can’t be saved.', { exact: true })).toBeVisible();
    });

    await inputs.nth(0).fill('100');
    await inputs.nth(1).fill('2026-08-01');
    await page.getByText('E-hailing', { exact: true }).click();
    await ac('AC1.1.6', 'Save an income entry', async () => {
      await page.getByRole('button', { name: 'Add income' }).click();
      await expect(page.getByText(/1 Aug · E-hailing/)).toBeVisible();
    });
    await ac('AC1.1.4', 'Use multiple income sources', async () => {
      await inputs.nth(0).fill('120');
      await inputs.nth(1).fill('2026-08-02');
      await page.getByText('Freelance', { exact: true }).click();
      await page.getByRole('button', { name: 'Add income' }).click();
      await expect(page.getByText(/2 Aug · Freelance/)).toBeVisible();
      await expect(page.getByText(/1 Aug · E-hailing/)).toBeVisible();
    });
    await ac('AC1.1.7', 'Display existing entries', async () => {
      await expect(page.getByText('RM 120', { exact: true })).toBeVisible();
      await expect(page.getByText('RM 100', { exact: true })).toBeVisible();
    });
    await ac('AC1.1.8', 'Identify user-entered values', async () => {
      await expect(page.getByText(/your data/i).first()).toBeVisible();
    });

    await inputs.nth(0).fill('140');
    await inputs.nth(1).fill('2026-08-03');
    await page.getByRole('button', { name: 'Add income' }).click();
    await expect(page.getByText(/3 Aug · Freelance/)).toBeVisible();
    await ac('AC1.1.10', 'Warn about an unusually high income entry', async () => {
      await inputs.nth(0).fill('1000');
      await inputs.nth(1).fill('2026-08-04');
      await page.getByRole('button', { name: 'Add income' }).click();
      await expect(page.getByText('Well above your usual entries. Keep it?', { exact: true })).toBeVisible();
      await expect(page.getByText('Keep', { exact: true })).toBeVisible();
    });
    await captureEvidence(page, 'epic-1', '01-income-entry.png');
  });

  test('US1.2 — Add historical income', { tag: '@us1.2' }, async ({ page }) => {
    await openApp(page);
    await openMoneyScreen(page, 'Income');

    await ac('AC1.2.1', 'Access past-month entry', async () => {
      await page.getByText('Add a past month', { exact: true }).click();
      await expect(page.getByText('Add a past month', { exact: true }).last()).toBeVisible();
    });
    const inputs = page.getByRole('dialog').locator('input');
    await ac('AC1.2.2', 'Enter a monthly total', async () => {
      await expect(page.getByText('One total for that month is enough.', { exact: true })).toBeVisible();
      await inputs.nth(0).fill('2019-01');
      await inputs.nth(1).fill('2750');
      await page.getByRole('button', { name: 'Add', exact: true }).click();
      await expect(page.getByText(/Jan 2019 · Monthly total/)).toBeVisible();
      await expect(page.getByText('RM 2,750', { exact: true })).toBeVisible();
    });
    await ac('AC1.2.3', 'Include past income in analysis', async () => {
      const response = await page.request.get(`${API}/income-pattern/`);
      expect(response.ok()).toBeTruthy();
      expect((await response.json()).recorded_month_count).toBe(1);
    });
    await ac('AC1.2.4', 'Allow any available history', async () => {
      await page.getByText('Add a past month', { exact: true }).click();
      await expect(page.getByText('Add whatever history you have. There is no 6 or 12 month minimum.', { exact: true })).toBeVisible();
    });
    await captureEvidence(page, 'epic-1', '02-historical-income.png');
  });

  test('US1.3 — Record direct work-related costs', { tag: '@us1.3' }, async ({ page }) => {
    await addIncome(page, '3000.00', '2026-08-05');
    await openApp(page);
    await openMoneyScreen(page, 'Work costs');

    await ac('AC1.3.1', 'View work-cost categories', async () => {
      await expect(page.getByText('Petrol', { exact: true })).toBeVisible();
      await expect(page.getByText('Servicing', { exact: true })).toBeVisible();
      await expect(page.getByText('Platform fees', { exact: true })).toBeVisible();
    });
    await ac('AC1.3.2', 'Edit work-cost amounts', async () => {
      await replaceValue(inputForRow(page, 'Petrol'), '500');
      await expect(inputForRow(page, 'Petrol')).toHaveValue('500');
    });
    await ac('AC1.3.3', 'Record different work costs separately', async () => {
      await replaceValue(inputForRow(page, 'Phone data'), '0');
      await expect(inputForRow(page, 'Petrol')).toHaveValue('500');
      await expect(inputForRow(page, 'Phone data')).toHaveValue('0');
    });
    await ac('AC1.3.4', 'Add my own work cost', async () => {
      await page.getByText('+ Your own cost', { exact: true }).click();
      const inputs = page.getByRole('dialog').locator('input');
      await inputs.nth(0).fill('Equipment rental');
      await inputs.nth(1).fill('200');
      await page.getByRole('button', { name: 'Add', exact: true }).click();
      await expect(page.getByText('Equipment rental', { exact: true })).toBeVisible();
    });
    await ac('AC1.3.5', 'Show income after work costs', async () => {
      await expect(page.getByText('Income after work costs', { exact: true })).toBeVisible();
      await expect(page.getByText('RM 2,300', { exact: true })).toBeVisible();
    });
    await ac('AC1.3.6', 'Identify calculated income', async () => {
      await expect(page.getByText(/calculated/i).last()).toBeVisible();
    });
    await captureEvidence(page, 'epic-1', '03-work-costs.png');
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
      await expect(page.getByText('RM 1,220', { exact: true })).toBeVisible();
    });
    await ac('AC1.4.6', 'Identify total as calculated', async () => {
      await expect(page.getByText(/calculated/i).last()).toBeVisible();
    });
    await captureEvidence(page, 'epic-1', '04-commitments.png');
  });

  test('US1.5 — Record daily expenses manually', { tag: '@us1.5' }, async ({ page }) => {
    await openApp(page);
    await openMoneyScreen(page, 'Daily expenses');
    await page.getByRole('button', { name: 'Add expense', exact: true }).click();
    const inputs = page.locator('input:visible');

    await ac('AC1.5.1', 'Enter an expense amount', async () => {
      await expect(page.getByText('Amount (RM)', { exact: true })).toBeVisible();
      await inputs.nth(0).fill('55');
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
      await inputs.nth(1).fill('2026-08-25');
      await expect(inputs.nth(1)).toHaveValue('2026-08-25');
    });
    await ac('AC1.5.6', 'Add the expense', async () => {
      await page.getByRole('button', { name: 'Add expense', exact: true }).click();
      await expect(page.getByText(/25 Aug · Pet supplies/)).toBeVisible();
      await expect(page.getByText('RM 55', { exact: true }).first()).toBeVisible();
    });
    await captureEvidence(page, 'epic-1', '05-manual-expense.png');
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
    await captureEvidence(page, 'epic-1', '06-expense-review.png');
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
      const response = await page.request.get(`${API}/expenses/`);
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
      const response = await page.request.get(`${API}/expenses/`);
      const entries = await response.json();
      expect(entries[0]).toMatchObject({
        entry_method: 'receipt',
        merchant: 'Kedai Maju edited',
        user_confirmed: true,
      });
    });
    await captureEvidence(page, 'epic-1', '07-receipt-expense.png');
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
      await expect(page.getByText(/RM 900 · 2026-05-03 · E-hailing/)).toBeVisible();
    });
    await ac('AC1.8.7', 'Handle records that cannot be recognised', async () => {
      await expect(page.getByText(/2 need attention/i)).toBeVisible();
      await expect(page.getByText('Row 5', { exact: true })).toBeVisible();
      await expect(page.getByText('Row 6', { exact: true })).toBeVisible();
    });
    await ac('AC1.8.8', 'Do not add imported records without confirmation', async () => {
      const response = await page.request.get(`${API}/income/record/`);
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
    await captureEvidence(page, 'epic-1', '08-income-import.png');
  });
});
