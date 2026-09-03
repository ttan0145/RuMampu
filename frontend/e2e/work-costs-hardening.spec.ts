import { expect, Page } from '@playwright/test';
import { e2eGet, e2ePost, test } from './support/fixtures';
import { API, openApp, openMoneyScreen } from './support/app';
import { currentWorkCostMonth, monthLabel, previousMonth, selectWorkCostMonth } from './support/work-costs';

async function seedIncome(page: Page, month: string, amount = '1000.00') {
  const record = await (await e2eGet(page, `${API}/income/record/`)).json();
  const response = await e2ePost(page, `${API}/income/entries/`, {
    data: { source_id: record.sources[0].id, amount, date: `${month}-01`, confirm_outlier: true },
  });
  expect(response.status()).toBe(201);
}

async function seedWorkCost(page: Page, month: string) {
  const categories = await (await e2eGet(page, `${API}/work-costs/`)).json();
  const petrol = categories.find((category: { slug: string }) => category.slug === 'petrol');
  expect(petrol).toBeDefined();
  const response = await e2ePost(page, `${API}/work-costs/entries/`, {
    data: { category_id: petrol.id, amount: '10.00', date: `${month}-01` },
  });
  expect(response.status()).toBe(201);
}

async function openCosts(page: Page) {
  await openApp(page);
  await openMoneyScreen(page, 'Work costs');
}

const rows = (page: Page) => page.getByTestId(/^work-cost-entry-/);
const summary = (page: Page) => page.getByTestId('work-cost-summary');

test.describe('US1.3 engineering regression', { tag: ['@us1.3', '@hardening'] }, () => {
  test('TECH-WC-01 — confirmed save survives failed refresh; retry never reposts', async ({ page }) => {
    const month = await currentWorkCostMonth(page);
    await seedIncome(page, month);
    await openCosts(page);
    await expect(summary(page).getByText('RM 1,000.00', { exact: true })).toBeVisible();
    let posts = 0;
    page.on('request', request => {
      if (request.method() === 'POST' && request.url().endsWith('/work-costs/entries/')) posts += 1;
    });
    await page.route('**/work-costs/summary/**', route => route.fulfill({ status: 503, json: {} }));
    await page.getByLabel('Work-cost amount', { exact: true }).fill('10');
    await page.getByRole('button', { name: 'Add work cost', exact: true }).click();
    await expect(rows(page)).toHaveCount(1);
    await expect(page.getByLabel('Work-cost amount', { exact: true })).toHaveValue('');
    await expect(page.getByText('Work costs could not be synced. Try again.', { exact: true })).toBeVisible();
    await expect(summary(page).getByText('RM 1,000.00', { exact: true })).toHaveCount(0);
    await expect(summary(page).getByText(/No income recorded/)).toHaveCount(0);
    await page.unroute('**/work-costs/summary/**');
    await page.getByText('Retry', { exact: true }).click();
    await expect(summary(page).getByText('RM 990.00', { exact: true })).toBeVisible();
    expect(posts).toBe(1);
    expect((await (await e2eGet(page, `${API}/work-costs/entries/`)).json())).toHaveLength(1);

    // Two equal payments in the same category are two facts, not an overwrite.
    await page.getByLabel('Work-cost amount', { exact: true }).fill('10');
    await page.getByRole('button', { name: 'Add work cost', exact: true }).click();
    await expect(rows(page)).toHaveCount(2);
    await expect(summary(page).getByText('RM 980.00', { exact: true })).toBeVisible();
    await openCosts(page);
    await expect(rows(page)).toHaveCount(2);
    await expect(summary(page).getByText('RM 980.00', { exact: true })).toBeVisible();
    expect(posts).toBe(2);
  });

  test('TECH-WC-02 — failed save retains draft and confirmed data', async ({ page }) => {
    const month = await currentWorkCostMonth(page);
    await seedIncome(page, month);
    await openCosts(page);
    await expect(summary(page).getByText('RM 1,000.00', { exact: true })).toBeVisible();
    await page.route('**/work-costs/entries/', route => route.request().method() === 'POST'
      ? route.fulfill({ status: 503, json: {} }) : route.continue());
    await page.getByLabel('Work-cost amount', { exact: true }).fill('25.50');
    await page.getByRole('button', { name: 'Add work cost', exact: true }).click();
    await expect(page.getByText('Work cost could not be saved. Please try again.', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Work-cost amount', { exact: true })).toHaveValue('25.50');
    await expect(rows(page)).toHaveCount(0);
    await expect(summary(page).getByText('RM 1,000.00', { exact: true })).toBeVisible();
    await page.unroute('**/work-costs/entries/');
    await page.getByRole('button', { name: 'Add work cost', exact: true }).click();
    await expect(rows(page)).toHaveCount(1);
    await expect(summary(page).getByText('RM 974.50', { exact: true })).toBeVisible();
  });

  test('TECH-WC-03 — late month response cannot replace the latest selection', async ({ page }) => {
    const month = await currentWorkCostMonth(page);
    const past = previousMonth(month);
    await seedIncome(page, month);
    await seedIncome(page, past, '2000');
    await openCosts(page);
    await expect(summary(page).getByText('RM 1,000.00', { exact: true })).toBeVisible();
    let release!: () => void;
    let started!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const seen = new Promise<void>(resolve => { started = resolve; });
    await page.route(`**/work-costs/summary/?month=${past}`, async route => {
      const response = await route.fetch();
      started();
      await gate;
      await route.fulfill({ response });
    });
    await selectWorkCostMonth(page, past);
    await seen;
    await expect(summary(page).getByText('RM 1,000.00', { exact: true })).toHaveCount(0);
    await selectWorkCostMonth(page, month);
    await expect(summary(page).getByText('RM 1,000.00', { exact: true })).toBeVisible();
    const lateResponse = page.waitForResponse(response => response.url().endsWith(`summary/?month=${past}`));
    release();
    await (await lateResponse).finished();
    // Wait for the response-driven React render, not a time-based sleep.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(page.getByLabel('Choose month', { exact: true })).toContainText(monthLabel(month));
    await expect(summary(page).getByText('RM 1,000.00', { exact: true })).toBeVisible();
    await expect(summary(page).getByText('RM 2,000.00', { exact: true })).toHaveCount(0);
  });

  test('TECH-WC-04 — income edits refresh net; empty months are disabled', async ({ page }) => {
    const month = await currentWorkCostMonth(page);
    await seedIncome(page, month);
    await openCosts(page);
    await expect(summary(page).getByText('RM 1,000.00', { exact: true })).toBeVisible();
    await expect(page.getByText('Current month: recorded so far, not a forecast or a full-month total.', { exact: true })).toBeVisible();
    await expect(summary(page).getByText(/No work costs recorded/)).toBeVisible();
    await page.getByLabel('Choose month', { exact: true }).click();
    const absentMonth = `${month.slice(0, 4)}-${month.endsWith('01') ? '02' : '01'}`;
    await expect(page.getByRole('button', { name: monthLabel(absentMonth), exact: true })).toBeDisabled();
    await page.getByRole('button', { name: monthLabel(month), exact: true }).click();

    await openMoneyScreen(page, 'Income');
    await page.getByText('Edit', { exact: true }).click();
    await page.locator('input:visible').last().fill('1200');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(page.getByText('RM 1,200.00', { exact: true })).toBeVisible();
    await openMoneyScreen(page, 'Work costs');
    await expect(summary(page).getByText('RM 1,200.00', { exact: true })).toBeVisible();
  });

  test('TECH-WC-05 — cold-load entry failures do not hide late category responses', async ({ page }) => {
    const month = await currentWorkCostMonth(page);
    await seedIncome(page, month);
    await seedWorkCost(page, month);
    let writes = 0;
    page.on('request', request => {
      if (request.method() === 'POST' && request.url().includes('/work-costs/')) writes += 1;
    });
    let releaseCategories!: () => void;
    const categoryGate = new Promise<void>(resolve => { releaseCategories = resolve; });
    await page.route('**/work-costs/', async route => {
      const response = await route.fetch();
      await categoryGate;
      await route.fulfill({ response });
    });
    await page.route('**/work-costs/entries/', route => route.fulfill({ status: 500, json: {} }));
    await page.route('**/work-costs/summary/**', route => route.fulfill({ status: 500, json: {} }));
    try {
      await openCosts(page);
      await expect(page.getByText('Work costs could not be synced. Try again.', { exact: true })).toBeVisible();
    } finally {
      releaseCategories();
    }
    await expect(page.getByText('Petrol', { exact: true })).toBeVisible();
    await expect(page.getByText('Servicing', { exact: true })).toBeVisible();
    await expect(page.getByText('Road tax & insurance', { exact: true })).toBeVisible();
    await page.getByText('Platform fees', { exact: true }).click();
    await page.getByLabel('Work-cost amount', { exact: true }).fill('25.50');
    await expect(rows(page)).toHaveCount(0);
    await expect(page.getByText('No work-cost entries recorded yet.', { exact: true })).toHaveCount(0);
    await expect(summary(page).getByText(/The monthly result is unavailable/)).toBeVisible();
    await expect(summary(page).getByText(/No income recorded|No work costs recorded|RM 0\.00/)).toHaveCount(0);

    await page.unroute('**/work-costs/entries/');
    await page.unroute('**/work-costs/summary/**');
    await page.getByText('Retry', { exact: true }).click();
    await expect(summary(page).getByText('RM 990.00', { exact: true })).toBeVisible();
    await expect(rows(page)).toHaveCount(1);
    await expect(page.getByLabel('Work-cost amount', { exact: true })).toHaveValue('25.50');
    await expect(page.getByText('Work costs could not be synced. Try again.', { exact: true })).toHaveCount(0);
    expect(writes).toBe(0);
  });

  test('TECH-WC-06 — cold-load summary failure keeps confirmed entries visible', async ({ page }) => {
    const month = await currentWorkCostMonth(page);
    await seedIncome(page, month);
    await seedWorkCost(page, month);
    await page.route('**/work-costs/summary/**', route => route.fulfill({ status: 503, json: {} }));
    await openCosts(page);
    await expect(page.getByText('Work costs could not be synced. Try again.', { exact: true })).toBeVisible();
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).getByText(`${month}-01 · Petrol`, { exact: true })).toBeVisible();
    await expect(rows(page).getByText('RM 10.00', { exact: true })).toBeVisible();
    await expect(page.getByText('Petrol', { exact: true })).toBeVisible();
    await expect(summary(page).getByText(/The monthly result is unavailable/)).toBeVisible();
    await expect(summary(page).getByText(/No income recorded|No work costs recorded|RM 990\.00/)).toHaveCount(0);
    await page.unroute('**/work-costs/summary/**');
    await page.getByText('Retry', { exact: true }).click();
    await expect(summary(page).getByText('RM 990.00', { exact: true })).toBeVisible();
    await expect(rows(page)).toHaveCount(1);
  });

  test('TECH-WC-07 — category failure preserves saved entry names and recovers on retry', async ({ page }) => {
    const month = await currentWorkCostMonth(page);
    await seedIncome(page, month);
    await seedWorkCost(page, month);
    await page.route('**/work-costs/', route => route.fulfill({ status: 503, json: {} }));
    await openCosts(page);
    await expect(page.getByText('Work costs could not be synced. Try again.', { exact: true })).toBeVisible();
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).getByText(`${month}-01 · Petrol`, { exact: true })).toBeVisible();
    await expect(rows(page).getByText('RM 10.00', { exact: true })).toBeVisible();
    await expect(page.getByText('Petrol', { exact: true })).toHaveCount(0);
    await expect(summary(page).getByText(/The monthly result is unavailable/)).toBeVisible();
    await page.unroute('**/work-costs/');
    await page.getByText('Retry', { exact: true }).click();
    await expect(page.getByText('Petrol', { exact: true })).toBeVisible();
    await expect(rows(page).getByText(`${month}-01 · Petrol`, { exact: true })).toBeVisible();
    await expect(summary(page).getByText('RM 990.00', { exact: true })).toBeVisible();
  });
});
