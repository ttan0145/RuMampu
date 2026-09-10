import { expect } from '@playwright/test';
import path from 'node:path';
import { API, openApp, openMoneyScreen } from './support/app';
import { e2eGet, test } from './support/fixtures';

test.describe('US1.8 comprehensive fixture regression', { tag: ['@us1.8', '@hardening'] }, () => {
  test('TECH-IMPORT-01 — mixed 12-month CSV previews, confirms, aggregates, and persists', async ({ page }) => {
    await openApp(page);
    await openMoneyScreen(page, 'Income');
    await page.getByText('Import', { exact: true }).click();

    const chooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Select CSV file', exact: true }).click();
    const chooser = await chooserPromise;
    await chooser.setFiles(path.resolve(__dirname, 'fixtures/us1.8-comprehensive-12-month-income.csv'));

    await test.step('Preview classifies all valid and invalid row types without saving income', async () => {
      await expect(page.getByText('us1.8-comprehensive-12-month-income.csv: 67 rows', { exact: true })).toBeVisible();
      await expect(page.getByText(/^60 ready$/i)).toBeVisible();
      await expect(page.getByText(/^7 need attention$/i)).toBeVisible();
      await expect(page.getByText('RM 956 · 2025-08-03 · E-hailing', { exact: true })).toBeVisible();
      await expect(page.getByText('RM 621.40 · 2025-08-27 · Food delivery', { exact: true })).toBeVisible();
      await expect(page.getByText('RM 759.20 · 2026-03-27 · Food delivery', { exact: true })).toBeVisible();
      await expect(page.getByText('Amount must be a positive number with at most two decimal places.', { exact: true })).toHaveCount(3);
      await expect(page.getByText('Date must be a valid YYYY-MM-DD calendar date.', { exact: true })).toHaveCount(2);
      await expect(page.getByText('Date must be earlier than today.', { exact: true })).toHaveCount(1);
      await expect(page.getByText('Source is required and must be at most 120 characters.', { exact: true })).toHaveCount(1);
      const beforeConfirm = await e2eGet(page, `${API}/income/record/`);
      expect((await beforeConfirm.json()).entries).toEqual([]);
    });

    await page.getByRole('button', { name: 'Confirm and add 60 records', exact: true }).click();
    await expect(page.getByText('60 income records added. Your analyses now use them.', { exact: true })).toBeVisible();

    await test.step('Confirmation imports only valid rows and creates/reuses sources correctly', async () => {
      const response = await e2eGet(page, `${API}/income/record/`);
      expect(response.status()).toBe(200);
      const record = await response.json();
      expect(record.recorded_month_count).toBe(12);
      expect(record.entries).toHaveLength(60);
      expect(record.entries.every((entry: { entry_method: string }) => entry.entry_method === 'import')).toBe(true);
      expect(record.sources.filter((source: { name: string }) => source.name.toLowerCase() === 'e-hailing')).toHaveLength(1);
      expect(record.sources.filter((source: { name: string }) => source.name.toLowerCase() === 'food delivery'))
        .toEqual([expect.objectContaining({ name: 'Food delivery', is_custom: true })]);
    });

    await page.getByText('View income pattern', { exact: true }).click();
    await test.step('Twelve imported months feed the authoritative analysis with exact aggregates', async () => {
      await expect(page.locator('[aria-label*="calculated usable income"]:not([aria-label="Month-by-month calculated usable income"])')).toHaveCount(12);
      for (const value of ['RM 5,187.50', 'RM 5,135.00', 'RM 6,620.00', 'RM 3,910.00', 'RM 2,710.00']) {
        await expect(page.getByText(value, { exact: true }).first()).toBeVisible();
      }
      const response = await e2eGet(page, `${API}/income-pattern/`);
      expect(response.status()).toBe(200);
      const pattern = await response.json();
      expect(pattern).toMatchObject({
        recorded_month_count: 12,
        history_depth: 'three_or_more',
        statistics: {
          average: '5187.50', median: '5135.00', highest: '6620.00',
          lowest: '3910.00', range: '2710.00',
        },
        lower_income: { basis: 'recorded_minimum', months: ['2026-02'] },
      });
      expect(pattern.months.map((month: { month: string; usable_income: string }) => [month.month, month.usable_income])).toEqual([
        ['2025-08', '4780.00'], ['2025-09', '5260.00'], ['2025-10', '4930.00'],
        ['2025-11', '5480.00'], ['2025-12', '6620.00'], ['2026-01', '4380.00'],
        ['2026-02', '3910.00'], ['2026-03', '5840.00'], ['2026-04', '4690.00'],
        ['2026-05', '5560.00'], ['2026-06', '5010.00'], ['2026-07', '5790.00'],
      ]);
    });

    await page.reload();
    await openApp(page);
    await openMoneyScreen(page, 'Income pattern');
    await expect(page.locator('[aria-label*="calculated usable income"]:not([aria-label="Month-by-month calculated usable income"])')).toHaveCount(12);
    const persisted = await e2eGet(page, `${API}/income/record/`);
    expect((await persisted.json()).entries).toHaveLength(60);
  });
});
