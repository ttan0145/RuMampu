import { expect, Page, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { captureEvidence } from './support/app';

const API = 'http://localhost:8000/api/v1';
async function openApp(page: Page): Promise<void> {
  await page.goto('/');
  const splash = page.getByLabel('RuMampu');
  if (await splash.isVisible().catch(() => false)) await splash.click();
  const skip = page.getByText('Skip', { exact: true });
  if (await skip.isVisible().catch(() => false)) await skip.click();
}

async function defaultIds(page: Page): Promise<{ sourceId: number; categoryId: number }> {
  const record = await page.request.get(`${API}/income/record/`);
  expect(record.ok()).toBeTruthy();
  const payload = await record.json();
  const source = payload.sources.find((item: { slug: string }) => item.slug === 'ehail');
  expect(source).toBeTruthy();

  const categories = await page.request.get(`${API}/expense-categories/`);
  expect(categories.ok()).toBeTruthy();
  const categoryPayload = await categories.json();
  const category = categoryPayload.find((item: { slug: string }) => item.slug === 'meals');
  expect(category).toBeTruthy();
  return { sourceId: source.id, categoryId: category.id };
}

async function addIncome(page: Page, sourceId: number, date: string, amount: string): Promise<void> {
  const response = await page.request.post(`${API}/income/entries/`, {
    data: { amount, date, source_id: sourceId, entry_method: 'manual', confirm_outlier: true },
  });
  expect(response.status()).toBe(201);
}

async function addExpense(page: Page, categoryId: number, date: string, amount: string): Promise<void> {
  const response = await page.request.post(`${API}/expenses/`, {
    data: { amount, date, category_id: categoryId, entry_method: 'manual' },
  });
  expect(response.status()).toBe(201);
}

async function openRecord(page: Page): Promise<void> {
  await page.getByText('Money', { exact: true }).last().click();
  await page.getByText('Your record', { exact: true }).last().click();
}

test('US8.1 summarises mixed dated income and expenses without using array order', async ({ page }) => {
  const { sourceId, categoryId } = await defaultIds(page);
  await addIncome(page, sourceId, '2026-01-10', '1000.00');
  await addIncome(page, sourceId, '2026-02-10', '1200.00');
  await addExpense(page, categoryId, '2026-01-15', '20.00');
  await addExpense(page, categoryId, '2026-03-05', '30.00');

  await openApp(page);
  await openRecord(page);

  await expect(page.getByText('Financial record', { exact: true })).toBeVisible();
  await expect(page.getByLabel('3 months recorded')).toBeVisible();
  await expect(page.getByLabel('4 financial entries')).toBeVisible();
  await expect(page.getByText('Latest entry', { exact: true })).toBeVisible();
  await expect(page.getByText('5 Mar 2026', { exact: true })).toBeVisible();
  await expect(page.getByText(/not saved to a RuMampu account/)).toBeVisible();
  await captureEvidence(page, 'epic-8', '01-record-mixed-summary.png');
});

test('US8.1 counts one represented month with multiple same-month entries', async ({ page }) => {
  const { sourceId, categoryId } = await defaultIds(page);
  await addIncome(page, sourceId, '2026-04-02', '900.00');
  await addExpense(page, categoryId, '2026-04-25', '45.00');

  await openApp(page);
  await openRecord(page);

  await expect(page.getByLabel('1 month recorded')).toBeVisible();
  await expect(page.getByLabel('2 financial entries')).toBeVisible();
  await expect(page.getByText('25 Apr 2026', { exact: true })).toBeVisible();
});

test('US8.1 handles an empty current record without an invalid latest date', async ({ page }) => {
  await openApp(page);
  await openRecord(page);

  await expect(page.getByLabel('0 months recorded')).toBeVisible();
  await expect(page.getByLabel('0 financial entries')).toBeVisible();
  await expect(page.getByText('No dated income or expense entries yet.', { exact: true })).toBeVisible();
  await expect(page.getByText('No test kept yet', { exact: true })).toBeVisible();
  await expect(page.getByText('Run a housing test and keep the result here for this session.', { exact: true })).toBeVisible();
  await expect(page.getByText('Go to Test', { exact: true })).toBeVisible();
  await expect(page.getByText(/not saved to a RuMampu account/)).toBeVisible();
  await captureEvidence(page, 'epic-8', '02-record-empty-state.png');
});

test('US8.2 keeps a completed housing test only once in the current frontend session', async ({ page }) => {
  const loaded = await page.request.post(`${API}/dev/scenarios/my-gig-driver-12m/load/`, {
    data: { confirm_reset: true },
  });
  expect(loaded.status()).toBe(201);

  await openApp(page);
  await openRecord(page);
  await expect(page.getByText('No test kept yet', { exact: true })).toBeVisible();

  await page.getByText('Test', { exact: true }).last().click();
  await page.getByText(/Total monthly cost/).last().click();
  await page.getByText(/Run the test/).last().click();

  await expect(page.getByText('Keep this test', { exact: true })).toBeVisible();
  await expect(page.getByText('Add this result to Your record for this session.', { exact: true })).toBeVisible();
  await page.getByText('Keep this test', { exact: true }).click();
  await expect(page.getByText('Test kept', { exact: true })).toBeVisible();
  await expect(page.getByText('Kept for this session.', { exact: true })).toBeVisible();
  await expect(page.getByText('Keep this test', { exact: true })).toHaveCount(0);

  await openRecord(page);
  await expect(page.getByText('Kept housing tests', { exact: true })).toBeVisible();
  await expect(page.getByText(/\/ month/)).toBeVisible();
  await expect(page.getByText('Short months', { exact: true })).toBeVisible();
  await expect(page.getByText('Largest gap', { exact: true })).toBeVisible();
  await expect(page.getByText('Kept for this session.', { exact: true })).toHaveCount(1);
  await expect(page.locator('body')).not.toContainText(/permanent|cloud backup/i);
  await captureEvidence(page, 'epic-8', '03-kept-test-session-record.png');
});

test('US8.3 lets the user select an available interface language', async ({ page }) => {
  await openApp(page);

  await page.getByLabel('Language').click();
  await expect(page.getByText('English', { exact: true })).toBeVisible();
  await expect(page.getByText('Bahasa Melayu', { exact: true })).toBeVisible();
  await expect(page.getByText('中文', { exact: true })).toBeVisible();

  await page.getByText('Bahasa Melayu', { exact: true }).click();
  await expect(page.getByText('Utama', { exact: true }).last()).toBeVisible();
  await expect(page.getByText(/^MS/)).toBeVisible();
});

test('US8.4 exposes the four main areas and returns with Back', async ({ page }) => {
  await openApp(page);

  await expect(page.getByText('Home', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('Money', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('Test', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('Prepare', { exact: true }).last()).toBeVisible();

  await page.getByText('Money', { exact: true }).last().click();
  await expect(page.getByText('Income', { exact: true }).last()).toBeVisible();
  await page.getByText('Income', { exact: true }).last().click();
  await expect(page.getByText('Add income', { exact: true })).toBeVisible();
  await page.getByLabel('Back').click();
  await expect(page.getByText('Your record', { exact: true }).last()).toBeVisible();

  await page.getByText('Test', { exact: true }).last().click();
  await expect(page.getByText('The house', { exact: true })).toBeVisible();

  await page.getByText('Prepare', { exact: true }).last().click();
  await expect(page.getByText('Upfront cash', { exact: true })).toBeVisible();

  await page.getByText('Home', { exact: true }).last().click();
  await expect(page.getByText('RuMampu', { exact: true })).toBeVisible();
});

test('US8.5 keeps the documented colour tokens and shortfall chart treatment wired centrally', async () => {
  const theme = readFileSync(path.resolve(__dirname, '../src/rumampu/theme.ts'), 'utf8');
  const charts = readFileSync(path.resolve(__dirname, '../src/rumampu/charts.tsx'), 'utf8');

  expect(theme).toContain("ink: '#3C5152'");
  expect(theme).toContain("paper: '#FFFFFF'");
  expect(theme).toContain("brand: '#4A9195'");
  expect(theme).toContain("short: '#F1592A'");
  expect(theme).toContain("card: '#EFF3F2'");
  expect(charts).toContain('backgroundColor: C.ink');
  expect(charts).toContain('backgroundColor: C.short');
});
