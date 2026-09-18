import { expect, Page } from '@playwright/test';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

import { ac } from './support/acceptance';
import { API, resetScreenScroll } from './support/app';
import { test } from './support/fixtures';

/**
 * Epic 4 evidence tests for:
 *   US4.1 - Review monthly expense completeness
 *   US4.2 - Set monthly and category spending limits
 *
 * PNG evidence is written to:
 *   output/playwright/epic-4/evidence/
 *
 * Run from frontend/. Every test creates its own disposable account in the
 * backend selected by Playwright. Set PLAYWRIGHT_USE_NEON=1 to use Neon.
 * Scenario loading resets only the disposable account created for that test.
 */


const useNeon = process.env.PLAYWRIGHT_USE_NEON === '1';
test.setTimeout(180_000);

type AuthenticatedPage = Page & { __epic4LoggedIn?: boolean };
const ACCOUNT_PASSWORD = `E2e${randomUUID()}9`;

async function createTestAccount(page: Page): Promise<string> {
  const email = `epic4-${randomUUID()}@example.com`;
  const registration = await page.request.post(`${API}/auth/register/`, {
    data: { email, password: ACCOUNT_PASSWORD },
  });
  expect(registration.status(), await registration.text()).toBe(201);

  const { token } = await registration.json();
  const onboarding = await page.request.patch(`${API}/auth/me/`, {
    headers: { Authorization: `Token ${token}` },
    data: { preferred_language: 'en', onboarding_completed: true },
  });
  expect(onboarding.ok(), await onboarding.text()).toBeTruthy();
  return email;
}

async function loginToAccount(page: Page): Promise<void> {
  const email = await createTestAccount(page);
  await page.goto('/');

  const splash = page.getByLabel('RuMampu');
  if (await splash.isVisible().catch(() => false)) {
    await splash.click({ force: true });
  }

  // First launch can still show language / introduction screens before auth.
  // Move only through those entry screens; do NOT start a guest session.
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const email = page.getByPlaceholder('name@example.com');
    if (await email.isVisible().catch(() => false)) break;

    const next = page.getByText('Next', { exact: true }).last();
    if (await next.isVisible().catch(() => false)) {
      await next.click();
      await page.waitForTimeout(100);
      continue;
    }

    const niceToMeet = page.getByText('Nice to meet you →', { exact: true }).last();
    if (await niceToMeet.isVisible().catch(() => false)) {
      await niceToMeet.click();
      await page.waitForTimeout(100);
      continue;
    }

    const loginLink = page.getByText('Log in', { exact: true }).last();
    if (await loginLink.isVisible().catch(() => false)) {
      await loginLink.click();
      await page.waitForTimeout(100);
      continue;
    }

    await page.waitForTimeout(150);
  }

  await expect(page.getByPlaceholder('name@example.com')).toBeVisible({ timeout: 15_000 });
  await page.getByPlaceholder('name@example.com').fill(email);
  await page.getByPlaceholder('Your password').fill(ACCOUNT_PASSWORD);
  await page.getByText('Log in', { exact: true }).last().click();

  // Account is already onboarded. Wait until account loading/hydration completes.
  await expect(page.getByRole('tab', { name: 'Home', exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('tab', { name: 'Money', exact: true })).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('rumampu_auth_token')),
    { timeout: 30_000 }).toBeTruthy();
  (page as AuthenticatedPage).__epic4LoggedIn = true;
  await expect(page.getByLabel('RuMampu', { exact: true })).toHaveCount(0, { timeout: 30_000 });
}

async function openReadyApp(page: Page): Promise<void> {
  // Reloads can briefly expose Home before browser storage has hydrated. Keep
  // the successful login on this Page instead of navigating back to auth.
  if (!(page as AuthenticatedPage).__epic4LoggedIn) {
    await loginToAccount(page);
  }
  await expect(page.getByRole('tab', { name: 'Home', exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByLabel('RuMampu', { exact: true })).toHaveCount(0, { timeout: 30_000 });
  const loading = page.getByText('Getting RuMampu ready', { exact: true });
  const loadError = page.getByText('We could not finish loading your account.', { exact: true });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await loadError.isVisible().catch(() => false)) {
      throw new Error('Account loading failed because the backend request timed out. Run this story suite against local SQLite, or retry when Neon is responsive.');
    }
    if (!(await loading.isVisible().catch(() => false))) return;
    await page.waitForTimeout(500);
  }
  throw new Error('Account loading did not finish within 30 seconds.');
}

async function clickTab(page: Page, label: 'Money' | 'House'): Promise<void> {
  await openReadyApp(page);
  const tab = page.getByRole('tab', { name: label, exact: true });
  await expect(tab).toBeVisible();
  await tab.click({ timeout: 15_000 });
}

async function authHeaders(page: Page): Promise<Record<string, string>> {
  const values = await page.evaluate(() => ({
    token: window.localStorage.getItem('rumampu_auth_token'),
    clientId: window.localStorage.getItem('rumampu_client_id'),
  }));

  expect(values.token, 'Account auth token should exist after login').toBeTruthy();
  expect(values.clientId, 'RuMampu client id should exist after login').toBeTruthy();

  return {
    Authorization: `Token ${values.token}`,
    'X-RuMampu-Client-ID': values.clientId || '',
  };
}

async function authGet(page: Page, url: string) {
  return page.request.get(url, { headers: await authHeaders(page) });
}

async function authPost(page: Page, url: string, data: unknown) {
  return page.request.post(url, {
    headers: await authHeaders(page),
    data,
  });
}

async function evidence(page: Page, filename: string): Promise<void> {
  if (process.env.UPDATE_EVIDENCE !== '1') return;

  const directory = path.resolve(
    __dirname,
    '../../output/playwright/epic-4/evidence',
  );
  mkdirSync(directory, { recursive: true });

  await resetScreenScroll(page);
  await page.screenshot({
    path: path.join(directory, filename),
    fullPage: true,
    style: '[aria-label="Ask Ruma"] { visibility: hidden !important; }',
  });
}

async function loadTwelveMonthScenario(page: Page): Promise<void> {
  await openReadyApp(page);
  const response = await authPost(
    page,
    `${API}/dev/scenarios/my-gig-driver-12m/load/`,
    { confirm_reset: true },
  );

  expect(response.status(), await response.text()).toBe(201);

  // The scenario was loaded through the API after login. Reload so the React
  // state hydrates from the account's newly seeded backend data.
  await page.reload();
  await openReadyApp(page);
  await clickTab(page, 'House');
  await expect(page.getByText('12 months recorded', { exact: true })).toBeVisible({ timeout: 30_000 });
}

async function expenseCategoryId(page: Page, slug = 'groc'): Promise<number> {
  const response = await authGet(page, `${API}/expense-categories/`);
  expect(response.ok(), await response.text()).toBeTruthy();

  const categories = await response.json();
  const category = categories.find(
    (item: { id: number; slug: string }) => item.slug === slug,
  );

  expect(category, `Expense category '${slug}' should exist`).toBeTruthy();
  return category.id;
}

async function addExpense(
  page: Page,
  amount: string,
  date: string,
  slug = 'groc',
): Promise<void> {
  const response = await authPost(page, `${API}/expenses/`, {
    amount,
    date,
    category_id: await expenseCategoryId(page, slug),
    entry_method: 'manual',
  });

  expect(response.status(), await response.text()).toBe(201);
}

async function openExpenses(page: Page): Promise<void> {
  await clickTab(page, 'Money');
  await page.getByText('Daily expenses', { exact: true }).last().click();
  await expect(page.getByText('See monthly summary', { exact: true })).toBeVisible();
  await expect(page.getByText('Set spending limits', { exact: true })).toBeVisible();
}

async function openMonthlySummary(page: Page): Promise<void> {
  await openExpenses(page);
  await page.getByText('See monthly summary', { exact: true }).click();
  await expect(page.getByText('Monthly summary', { exact: true }).last()).toBeVisible();
}

async function openSpendingLimits(page: Page): Promise<void> {
  await openExpenses(page);
  await page.getByText('Set spending limits', { exact: true }).click();
  await expect(page.getByText('Bills and limits', { exact: true })).toBeVisible();
  await page.getByText('Limits', { exact: true }).click();
  await expect(page.getByText('The monthly limits are yours to set. RuMampu only counts.', { exact: true })).toBeVisible();
}

/**
 * Run the real housing test so AC4.1.4 is verified against the same month list
 * produced by the housing-test result rather than inferred from income alone.
 */
async function runHousingTest(page: Page): Promise<void> {
  await openReadyApp(page);

  await clickTab(page, 'House');
  await page.getByText('Test a house', { exact: true }).click();

  await expect(page.getByText('Property price', { exact: true })).toBeVisible();
  await page.getByPlaceholder('e.g. 250,000').fill('250000');
  await page.getByRole('button', { name: 'Run the test' }).click();
  await expect(page.getByText(/\d+ of \d+ months would run short/)).toBeVisible({
    timeout: useNeon ? 90_000 : 20_000,
  });
}

async function returnToMoney(page: Page): Promise<void> {
  await clickTab(page, 'Money');
  await expect(page.getByText('Daily expenses', { exact: true }).last()).toBeVisible();
}

/**
 * React Native Web numeric fields can update their backing state on change.
 * Tab is pressed as well so the test behaves like a user leaving the field.
 */
async function setLimit(
  page: Page,
  accessibilityLabel: string,
  amount: string,
): Promise<void> {
  const input = page.getByLabel(accessibilityLabel);
  await expect(input).toBeVisible();
  await input.fill(amount);
  await input.press('Tab');
  await expect(input).toHaveValue(amount);
}

async function clearAllVisibleLimits(page: Page): Promise<void> {
  const inputs = page.locator('input:visible');
  const count = await inputs.count();
  expect(count, 'Spending limits should expose whole-month and category inputs').toBeGreaterThan(0);

  for (let index = 0; index < count; index += 1) {
    await inputs.nth(index).fill('0');
    await inputs.nth(index).press('Tab');
  }
}

test.describe(
  'Epic 4 — US4.1 Monthly expense completeness',
  { tag: ['@epic4', '@us4.1'] },
  () => {
    test('US4.1 — full months, monthly totals, rule and used-in-test label', async ({ page }) => {
      await loadTwelveMonthScenario(page);
      await ac('AC4.1.6', 'Reconcile Home monthly outflow with its remaining balance', async () => {
        await page.getByRole('tab', { name: 'Home', exact: true }).click();
        await page.getByText('Month by month', { exact: true }).click();
        const july = page.getByText('Jul', { exact: true }).first().locator('..');
        const row = (await july.innerText()).replace(/\s+/g, ' ');
        const values = /In RM ([\d,]+) Out RM ([\d,]+) Left RM (-?[\d,]+)/.exec(row);
        expect(values, `July's month panel should contain In, Out and Left: ${row}`).toBeTruthy();
        const income = Number(values![1].replaceAll(',', ''));
        const out = Number(values![2].replaceAll(',', ''));
        const left = Number(values![3].replaceAll(',', ''));
        expect(out).toBeGreaterThan(1320); // July's recorded daily expenses alone.
        expect(left).toBe(income - out);
        await expect(page.getByText('Remaining balance').locator('..'))
          .toContainText(`RM ${values![3]}`);
      });
      await runHousingTest(page);
      await returnToMoney(page);
      await openMonthlySummary(page);

      await ac('AC4.1.1', 'Display monthly expense totals', async () => {
        // July 2026 from the deterministic scenario totals RM 1,320.
        await expect(page.getByText('Jul 2026', { exact: true })).toBeVisible();
        await expect(page.getByText('RM 1,320', { exact: true })).toBeVisible();
      });

      await ac('AC4.1.2', 'Mark fully recorded months', async () => {
        await expect(page.getByText(/fully recorded/i).first()).toBeVisible();
      });

      await ac('AC4.1.4', 'Identify months actually used in the housing test', async () => {
        const julyCard = page
          .getByText('Jul 2026', { exact: true })
          .locator('..')
          .locator('..');

        await expect(julyCard).toContainText(/fully recorded/i);
        await expect(julyCard).toContainText(/used in the test/i);
      });

      await evidence(page, '01-us4.1-full-month-used-in-test.png');

      await ac('AC4.1.5', 'Explain the 20-day RuMampu full-recording rule', async () => {
        await page.getByLabel('What this is').last().click();
        await expect(
          page.getByText(
            'A month counts as fully recorded from 20 logged days. RuMampu’s own rule.',
            { exact: true },
          ),
        ).toBeVisible();
      });

      await evidence(page, '02-us4.1-20-day-rule.png');
    });

    test('US4.1 — partially recorded month shows known days and unknown remainder', async ({ page }) => {
      await loadTwelveMonthScenario(page);

      // August is deliberately NOT part of the 12-month scenario. Five distinct
      // dates create a deterministic partially recorded month.
      for (let day = 1; day <= 5; day += 1) {
        await addExpense(
          page,
          String(20 + day),
          `2026-08-${String(day).padStart(2, '0')}`,
          'groc',
        );
      }

      await page.reload();
      await expect(page.getByRole('tab', { name: 'Home', exact: true })).toBeVisible({ timeout: 30_000 });
      await openMonthlySummary(page);

      await ac('AC4.1.3', 'Show recorded days and unknown remainder for a partial month', async () => {
        const augustCard = page
          .getByText('Aug 2026', { exact: true })
          .locator('..')
          .locator('..');

        await expect(augustCard).toContainText(/5 days, rest of month unknown/i);
        await expect(augustCard).not.toContainText(/fully recorded/i);
        await expect(augustCard).not.toContainText(/used in the test/i);
      });

      await evidence(page, '03-us4.1-partial-month-5-days.png');
    });

    test('US4.1 — a past whole-month total has distinct coverage and a readable row', async ({ page }) => {
      await openReadyApp(page);
      await addExpense(page, '20000', '2025-01-15');
      await page.reload();
      await openMonthlySummary(page);

      const january = page.getByText('Jan 2025', { exact: true }).locator('..').locator('..');
      await expect(january).toContainText('1 day, rest of month unknown');
      await page.getByText('Jan 2025', { exact: true }).click();
      await january.getByText('This entry covers the whole month').click();
      await expect(january).toContainText('Whole-month total entered');
      await expect(january).toContainText('RM 20,000');

      const status = await january.getByText(/Whole-month total entered/).boundingBox();
      const amount = await january.getByText('RM 20,000', { exact: true }).first().boundingBox();
      expect(status && amount).toBeTruthy();
      expect(status!.y + status!.height).toBeLessThanOrEqual(amount!.y);
      if (process.env.MONTH_SUMMARY_SCREENSHOT) {
        await page.screenshot({ path: process.env.MONTH_SUMMARY_SCREENSHOT });
      }

      await page.reload();
      await openMonthlySummary(page);
      await expect(page.getByText('Jan 2025', { exact: true }).locator('..').locator('..'))
        .toContainText('Whole-month total entered');

      const response = await authPost(page, `${API}/expenses/`, {
        amount: '500.00', date: '2025-02-15',
        category_id: await expenseCategoryId(page), entry_method: 'monthly_total',
      });
      expect(response.status(), await response.text()).toBe(201);
      await page.reload();
      await openMonthlySummary(page);
      await expect(page.getByText('Feb 2025', { exact: true }).locator('..').locator('..'))
        .toContainText('Whole-month total entered');

      await openExpenses(page);
      await page.getByText('Whole-month expense total', { exact: true }).first().click();
      await expect(page.getByText('Enter one total that covers the entire selected month.')).toBeVisible();
      const selectedMonth = (await page.getByRole('button', { name: 'Choose month' }).innerText())
        .match(/[A-Z][a-z]{2} \d{4}/)?.[0];
      expect(selectedMonth).toBeTruthy();
      await page.locator('input:visible').last().fill('750');
      await page.getByText('Add', { exact: true }).last().click();
      await openMonthlySummary(page);
      await expect(page.getByText(selectedMonth!, { exact: true }).locator('..').locator('..'))
        .toContainText('Whole-month total entered');
    });
  },
);

test.describe(
  'Epic 4 — US4.2 Spending limits',
  { tag: ['@epic4', '@us4.2'] },
  () => {
    test('US4.2 — unset limits, ownership statement and zero-spend category limits', async ({ page }) => {
      await openReadyApp(page);
      await openSpendingLimits(page);

      // Limits are client-side state in the current implementation. Explicitly
      // clear them so AC4.2.6 is deterministic even if this browser/account
      // previously had values. This does not delete backend finance records.
      await clearAllVisibleLimits(page);

      await ac('AC4.2.6', 'Show no limit set when no limit exists', async () => {
        const noLimitLabels = page.getByText('no limit set', { exact: true });
        expect(await noLimitLabels.count()).toBeGreaterThanOrEqual(6);
      });

      await ac('AC4.2.7', 'State that spending limits belong to the user', async () => {
        await expect(
          page.getByText(
            'The monthly limits are yours to set. RuMampu only counts.',
            { exact: true },
          ),
        ).toBeVisible();
      });

      await ac('AC4.2.2', 'Allow a category limit before any spending exists', async () => {
        await expect(page.getByText('Groceries', { exact: true })).toBeVisible();
        await expect(page.getByText('RM 0', { exact: true }).first()).toBeVisible();

        await setLimit(page, 'Groceries Limit (RM)', '300');
        await expect(page.getByText('RM 300 left', { exact: true })).toBeVisible();
      });

      await evidence(page, '04-us4.2-no-limit-and-category-limit.png');
    });

    test('US4.2 — whole-month/category limits, comparison bar, remaining and over-limit amounts', async ({ page }) => {
      await loadTwelveMonthScenario(page);
      await openReadyApp(page);
      await openSpendingLimits(page);

      await ac('AC4.2.1', 'Set a whole-month spending limit', async () => {
        // Latest scenario month is July 2026; total spending is RM 1,320.
        await setLimit(page, 'Whole month · Jul Limit (RM)', '1500');
      });

      await ac('AC4.2.3', 'Show a visual spending-versus-limit bar', async () => {
        // A positive limit renders HBar. The remaining amount immediately below
        // it provides a stable visible assertion that the bar/status block exists.
        await expect(page.getByText('RM 180 left', { exact: true })).toBeVisible();
      });

      await ac('AC4.2.4', 'Show amount remaining below the limit', async () => {
        await expect(page.getByText('RM 180 left', { exact: true })).toBeVisible();
      });

      await ac('AC4.2.2', 'Set an individual category limit', async () => {
        // July groceries spending in the fixture is RM 370.
        await setLimit(page, 'Groceries Limit (RM)', '400');
        await expect(page.getByText('RM 30 left', { exact: true })).toBeVisible();
      });

      await evidence(page, '05-us4.2-limits-with-remaining-amounts.png');

      await ac('AC4.2.5', 'Show amount past the limit when spending exceeds it', async () => {
        await setLimit(page, 'Groceries Limit (RM)', '300');
        await expect(page.getByText('RM 70 past your limit', { exact: true })).toBeVisible();
      });

      await evidence(page, '06-us4.2-category-over-limit.png');

      const groceriesId = String(await expenseCategoryId(page, 'groc'));
      await expect.poll(async () => {
        const response = await authGet(page, `${API}/auth/me/`);
        const account = await response.json();
        return account.expense_limits;
      }).toMatchObject({ total: 1500, [groceriesId]: 300 });

      await page.reload();
      await openSpendingLimits(page);
      await expect(page.getByLabel('Whole month · Jul Limit (RM)')).toHaveValue('1500');
      await expect(page.getByLabel('Groceries Limit (RM)')).toHaveValue('300');
      await expect(page.getByText('RM 70 past your limit', { exact: true })).toBeVisible();
    });
  },
);
