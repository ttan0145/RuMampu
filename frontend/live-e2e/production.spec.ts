import { expect, type Page } from '@playwright/test';
import type { ApiIncomeRecord, ApiIncomePattern, ApiWorkCostEntry, ApiWorkCostMonthSummary } from '../src/rumampu/api';
import type { HousingTestResult, PreHousingResult } from '../types/housing';
import {
  LIVE_API, assertHealthyNetwork, chooseDate, evidence, liveGet, monthLabel,
  openLiveApp, openMoney, previousMonth, selectMonth, test,
} from './support';

const rows = (page: Page) => page.getByTestId(/^work-cost-entry-/);
const summary = (page: Page) => page.getByTestId('work-cost-summary');

async function expectCategories(page: Page): Promise<void> {
  for (const category of ['Petrol', 'Servicing', 'Platform fees', 'Phone data', 'Road tax & insurance']) {
    await expect(page.getByText(category, { exact: true })).toBeVisible();
  }
  await expect(page.getByText('Work costs could not be synced. Try again.', { exact: true })).toHaveCount(0);
}

async function knownPayment(page: Page, amount: string): Promise<void> {
  await expect(page.getByText('The house', { exact: true })).toBeVisible();
  const switchMode = page.getByText('I already know my monthly payment', { exact: true });
  // Explicitly handle the two valid house-form modes; always assert the input result.
  if (await switchMode.isVisible()) await switchMode.click();
  const payment = page.locator('input:visible');
  await expect(payment).toHaveCount(1);
  await payment.fill(amount);
  await payment.press('Tab');
  await expect(payment).toHaveValue(amount);
  await page.getByRole('button', { name: 'Total monthly cost →', exact: true }).click();
}

async function housingCosts(page: Page): Promise<void> {
  const maintenance = page.getByText('Maintenance & sinking fund', { exact: true });
  if (!(await maintenance.isVisible())) await page.getByText('What’s inside', { exact: true }).click();
  for (const [label, amount] of [
    ['Maintenance & sinking fund', '150'], ['Home insurance', '55'],
    ['Assessment tax', '20'], ['Quit rent', '5'], ['Parking', '0'], ['Other', '0'],
  ]) {
    const input = page.getByText(label, { exact: true }).locator('..').locator('..').locator('input');
    await input.fill(amount);
    await input.press('Tab');
    await expect(input).toHaveValue(amount);
  }
}

test('TECH-LIVE-01 — production read-only financial smoke', { tag: ['@live', '@hardening'] }, async ({ page, live }, info) => {
  await openLiveApp(page);
  const income = await liveGet<ApiIncomeRecord>(page, live, '/income/record/');
  expect(income.entries).toEqual([]);
  expect(await liveGet(page, live, '/work-costs/entries/')).toEqual([]);
  expect(await liveGet(page, live, '/housing/scenarios/')).toEqual([]);

  await test.step('Categories and empty month summary are loaded from production', async () => {
    await openMoney(page, 'Work costs');
    await expectCategories(page);
    await expect(page.getByText('No work-cost entries recorded yet.', { exact: true })).toBeVisible();
    await expect(summary(page).getByText(/No income recorded for/)).toBeVisible();
    await evidence(page, info, 'work-cost-categories.png');
  });
  await test.step('Income analysis handles the empty production guest', async () => {
    await openMoney(page, 'Income pattern');
    await expect(page.getByText('Your income pattern starts with a recorded month.', { exact: true })).toBeVisible();
  });
  await test.step('Housing preview calculates RM 1,230 without saving a scenario', async () => {
    await page.getByText('Test', { exact: true }).last().click();
    await knownPayment(page, '1000');
    await housingCosts(page);
    await expect(page.getByText('RM 1,230.00', { exact: true })).toBeVisible();
    await evidence(page, info, 'housing-preview.png');
  });
  // Opening the app may create the anonymous profile/defaults, but no financial facts.
  expect((await liveGet<ApiIncomeRecord>(page, live, '/income/record/')).entries).toEqual([]);
  expect(await liveGet(page, live, '/work-costs/entries/')).toEqual([]);
  expect(await liveGet(page, live, '/housing/scenarios/')).toEqual([]);
  expect(live.events.filter(event => !['GET', 'OPTIONS', 'HEAD'].includes(event.method)
    && event.path !== '/api/v1/housing/calculate/')).toEqual([]);
  assertHealthyNetwork(live);
});

test('TECH-LIVE-02 — production dated costs to housing result', { tag: ['@live', '@hardening'] }, async ({ page, live }, info) => {
  // A direct Playwright invocation cannot accidentally enable the writing flow.
  expect(process.env.RUMAMPU_LIVE_WRITES, 'Use npm run test:live -- --allow-writes').toBe('1');
  await openLiveApp(page);
  expect((await liveGet<ApiIncomeRecord>(page, live, '/income/record/')).entries).toEqual([]);
  expect(await liveGet(page, live, '/work-costs/entries/')).toEqual([]);
  expect(await liveGet(page, live, '/housing/scenarios/')).toEqual([]);
  const initial = await liveGet<ApiWorkCostMonthSummary>(page, live, '/work-costs/summary/');
  const month = initial.month;
  const prior = previousMonth(month);
  const date = `${month}-01`;

  await test.step('Record one RM 3,000 income through the live form', async () => {
    await openMoney(page, 'Income');
    await page.locator('input:visible').first().fill('3000');
    await chooseDate(page, page.getByLabel('Choose date', { exact: true }), date);
    await page.getByText('E-hailing', { exact: true }).click();
    await page.getByRole('button', { name: 'Add income', exact: true }).click();
    await expect(page.getByText('RM 3,000.00', { exact: true })).toBeVisible();
    expect((await liveGet<ApiIncomeRecord>(page, live, '/income/record/')).entries).toHaveLength(1);
  });

  await test.step('Reject zero then append two separate Petrol costs', async () => {
    await openMoney(page, 'Work costs');
    await expectCategories(page);
    await page.getByText('Petrol', { exact: true }).click();
    const amount = page.getByLabel('Work-cost amount', { exact: true });
    await amount.fill('0');
    await page.getByRole('button', { name: 'Add work cost', exact: true }).click();
    await expect(page.getByText('Select a category and enter a valid amount and date.', { exact: true })).toBeVisible();
    await expect(rows(page)).toHaveCount(0);
    expect(await liveGet(page, live, '/work-costs/entries/')).toEqual([]);
    for (const [value, net, count] of [['50', 'RM 2,950.00', 1], ['25', 'RM 2,925.00', 2]] as const) {
      await amount.fill(value);
      await chooseDate(page, page.getByLabel('Choose date', { exact: true }), date);
      await page.getByRole('button', { name: 'Add work cost', exact: true }).click();
      await expect(rows(page)).toHaveCount(count);
      await expect(summary(page).getByText(net, { exact: true })).toBeVisible();
    }
  });

  const saved = await liveGet<ApiWorkCostEntry[]>(page, live, '/work-costs/entries/');
  expect(saved).toHaveLength(2);
  const first = saved.find(entry => entry.amount === '50.00');
  expect(first).toBeDefined();
  const firstRow = page.getByTestId(`work-cost-entry-${first!.id}`);

  await test.step('Edit only the RM 50 entry to RM 60, then move it to the previous month', async () => {
    await firstRow.getByText('Edit', { exact: true }).click();
    await page.getByLabel('Edit work-cost amount', { exact: true }).fill('60');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(firstRow.getByText('RM 60.00', { exact: true })).toBeVisible();
    await expect(summary(page).getByText('RM 2,915.00', { exact: true })).toBeVisible();
    await firstRow.getByText('Edit', { exact: true }).click();
    await chooseDate(page, firstRow.getByLabel('Choose date', { exact: true }), `${prior}-01`);
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(firstRow.getByText(`${prior}-01 · Petrol`, { exact: true })).toBeVisible();
    await expect(summary(page).getByText('RM 2,975.00', { exact: true })).toBeVisible();
    await expect(rows(page)).toHaveCount(2);
    const current = await liveGet<ApiWorkCostMonthSummary>(page, live, `/work-costs/summary/?month=${month}`);
    expect(current).toMatchObject({ gross_income: '3000.00', work_cost_total: '25.00', income_after_work_costs: '2975.00' });
    await selectMonth(page, prior);
    await expect(summary(page).getByText(`No income recorded for ${monthLabel(prior)}. Add income before RuMampu can calculate this figure.`, { exact: true })).toBeVisible();
    await expect(summary(page)).toContainText('RM 60.00');
    expect(await liveGet(page, live, `/work-costs/summary/?month=${prior}`)).toMatchObject({ work_cost_total: '60.00', income_recorded: false, income_after_work_costs: null });
    await selectMonth(page, month);
    await expect(summary(page).getByText(/CALCULATED$/)).toBeVisible();
    await evidence(page, info, 'work-costs-saved.png');
  });

  await test.step('Reload and verify saved records plus downstream RM 2,975 income analysis', async () => {
    await openLiveApp(page);
    await openMoney(page, 'Work costs');
    await expect(rows(page)).toHaveCount(2);
    await expect(firstRow.getByText(`${prior}-01 · Petrol`, { exact: true })).toBeVisible();
    await expect(firstRow.getByText('RM 60.00', { exact: true })).toBeVisible();
    await expect(summary(page).getByText('RM 2,975.00', { exact: true })).toBeVisible();
    await openMoney(page, 'Income pattern');
    await expect(page.getByLabel('Month-by-month calculated usable income')).toBeVisible();
    await expect(page.getByLabel(/RM 2,975.00 calculated usable income/)).toBeVisible();
    const pattern = await liveGet<ApiIncomePattern>(page, live, '/income-pattern/');
    expect(pattern.recorded_month_count).toBe(1);
    expect(pattern.months).toEqual([expect.objectContaining({ month, work_costs: '25.00', usable_income: '2975.00' })]);
    await evidence(page, info, 'income-pattern.png');
  });

  await test.step('Complete two live housing tests: no shortfall, then an RM 55 gap', async () => {
    await page.getByText('Test', { exact: true }).last().click();
    for (const [payment, cost, gap] of [['1000', 1230, 0], ['2800', 3030, 55]] as const) {
      await knownPayment(page, payment);
      await housingCosts(page);
      await expect(page.getByText(cost === 1230 ? 'RM 1,230.00' : 'RM 3,030.00', { exact: true })).toBeVisible();
      const precheckResponse = page.waitForResponse(r => r.url() === `${LIVE_API}/housing/pre-check/` && r.request().method() === 'POST');
      const resultResponse = page.waitForResponse(r => r.url() === `${LIVE_API}/housing/test-result/` && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Run the test →', exact: true }).click();
      const [preResponse, response] = await Promise.all([precheckResponse, resultResponse]);
      expect(preResponse.status()).toBe(200);
      const pre = await preResponse.json() as PreHousingResult;
      expect(pre).toMatchObject({ tested_months: 1, has_existing_shortfall: false, work_cost_basis: 'recorded_entries_by_month' });
      expect(pre.months[0].usable_income).toBe(2975);
      expect(response.status()).toBe(200);
      const result = await response.json() as HousingTestResult;
      expect(result).toMatchObject({ tested_home_cost: cost, tested_months: 1, largest_gap: gap, short_month_count: gap ? 1 : 0 });
      await expect(page.getByText(gap ? '1 of your 1 recorded months would have run short.' : 'None of your 1 recorded months would have run short.', { exact: true })).toBeVisible();
      if (gap) await expect(page.getByText('RM 55.00', { exact: true })).toBeVisible();
      await evidence(page, info, `housing-result-${cost}.png`);
      if (!gap) {
        await page.getByText('Home', { exact: true }).last().click();
        await page.getByText('Re-test the house', { exact: true }).click();
      }
    }
    expect(await liveGet(page, live, '/housing/scenarios/')).toHaveLength(1);
  });
  expect((await liveGet<ApiIncomeRecord>(page, live, '/income/record/')).entries).toHaveLength(1);
  expect(await liveGet(page, live, '/work-costs/entries/')).toHaveLength(2);
  assertHealthyNetwork(live);
});
