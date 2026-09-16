import { expect, Page } from '@playwright/test';
import { e2eGet, e2ePatch, e2ePost, test } from './support/fixtures';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { captureEvidence } from './support/app';

const API = 'http://localhost:8000/api/v1';

// EN: This spec uses top-level test() calls rather than a test.describe() group.
// test.describe() would group related tests; here each US8.x scenario is already
// named explicitly, so the current project structure keeps them flat.
// 中文：这个 spec 使用顶层 test()，没有使用 test.describe() 分组。test.describe() 通常用来组织相关测试；
// 这里每个 US8.x 场景已经在测试名中写清楚，所以当前项目结构保持扁平。

// EN: Shared setup for Epic 8 journeys. async ({ page }) gives each test a
// Playwright Page, await waits for navigation/clicks, and getByText/getByLabel
// create locators that find UI elements by visible text or accessibility labels.
// 中文：Epic 8 测试共用的启动步骤。async ({ page }) 为每个测试提供 Playwright Page，
// await 等待导航或点击完成，getByText/getByLabel 按可见文本或无障碍标签创建 locator。
async function openApp(page: Page): Promise<void> {
  await page.goto('/');
  await completeVisibleOnboarding(page);
}

async function confirmGuestDialogIfVisible(page: Page): Promise<boolean> {
  const guestDialog = page.getByRole('dialog');
  const confirmGuest = guestDialog.getByRole('button', { name: 'Continue as guest', exact: true });
  const appeared = await confirmGuest.waitFor({ state: 'visible', timeout: 1500 }).then(() => true).catch(() => false);
  if (!appeared) return false;
  await confirmGuest.click({ force: true, timeout: 3000 });
  await page.waitForTimeout(150);
  return true;
}

async function completeVisibleOnboarding(page: Page): Promise<void> {
  const splash = page.getByLabel('RuMampu');
  if (await splash.isVisible().catch(() => false)) {
    await splash.click({ force: true });
    await expect(splash).toHaveCount(0, { timeout: 5000 }).catch(() => undefined);
  }

  const clickIfVisible = async (locator: ReturnType<Page['getByText']>): Promise<boolean> => {
    if (!(await locator.isVisible().catch(() => false))) return false;
    try {
      await locator.click({ force: true, timeout: 3000 });
    } catch {
      const box = await locator.boundingBox().catch(() => null);
      if (!box) return false;
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    }
    await page.waitForTimeout(150);
    return true;
  };

  for (let step = 0; step < 12; step += 1) {
    const guest = page.getByText('Continue as guest', { exact: true });
    const meet = page.getByText('Nice to meet you →', { exact: true });
    const skip = page.getByText(/^Skip$/i).last();
    const next = page.getByText(/^Next$/i).last();

    if (await confirmGuestDialogIfVisible(page)) {
      continue;
    }
    if (await clickIfVisible(guest)) {
      continue;
    }
    if (await clickIfVisible(meet)) {
      continue;
    }
    if (await clickIfVisible(skip)) {
      continue;
    }
    if (await clickIfVisible(next)) {
      continue;
    }
    if (await page.getByRole('tab', { name: 'Home', exact: true }).isVisible().catch(() => false)) {
      break;
    }
    await page.waitForTimeout(150);
  }

  await expect(page.getByRole('tab', { name: 'Home', exact: true })).toBeVisible();
}

async function dismissSplashIfVisible(page: Page): Promise<void> {
  const splash = page.getByLabel('RuMampu');
  if (await splash.isVisible().catch(() => false)) {
    await splash.click({ force: true });
    await expect(splash).toHaveCount(0, { timeout: 5000 }).catch(() => undefined);
  }
}

async function continueAsGuestFromLogin(page: Page): Promise<void> {
  await page.getByText('Continue as guest', { exact: true }).click();
  await confirmGuestDialogIfVisible(page);
  await expect(page.getByText('What RuMampu does', { exact: true })).toBeVisible();
  await syncClientIdFromBrowser(page);
}

// EN: Test setup for US8.1 uses backend seed IDs instead of hard-coding database
// primary keys. expect(...).toBeTruthy() fails early if fixture data is missing.
// 中文：US8.1 的测试准备步骤从后端读取种子数据 ID，而不是写死数据库主键。
// expect(...).toBeTruthy() 会在 fixture 数据缺失时尽早让测试失败。
function authHeaders(token?: string): Record<string, string> | undefined {
  return token ? { Authorization: `Token ${token}` } : undefined;
}

async function defaultIds(page: Page, token?: string): Promise<{ sourceId: number; categoryId: number; workCostCategoryId: number }> {
  const headers = authHeaders(token);
  const record = await e2eGet(page, `${API}/income/record/`, { headers });
  expect(record.ok()).toBeTruthy();
  const payload = await record.json();
  const source = payload.sources.find((item: { slug: string }) => item.slug === 'ehail');
  expect(source).toBeTruthy();

  const categories = await e2eGet(page, `${API}/expense-categories/`, { headers });
  expect(categories.ok()).toBeTruthy();
  const categoryPayload = await categories.json();
  const category = categoryPayload.find((item: { slug: string }) => item.slug === 'meals');
  expect(category).toBeTruthy();

  const workCosts = await e2eGet(page, `${API}/work-costs/`, { headers });
  expect(workCosts.ok()).toBeTruthy();
  const workCostPayload = await workCosts.json();
  const workCostCategory = workCostPayload.find((item: { slug: string }) => item.slug === 'petrol');
  expect(workCostCategory).toBeTruthy();

  return { sourceId: source.id, categoryId: category.id, workCostCategoryId: workCostCategory.id };
}

// EN: US8.1 setup creates income through the public API so Your Record reads the
// same saved-data path a real current guest session would use.
// 中文：US8.1 通过公开 API 创建收入记录，让“记录档案”读取真实当前访客会话会使用的数据路径。
async function addIncome(page: Page, sourceId: number, date: string, amount: string, token?: string): Promise<void> {
  const response = await e2ePost(page, `${API}/income/entries/`, {
    headers: authHeaders(token),
    data: { amount, date, source_id: sourceId, entry_method: 'manual', confirm_outlier: true },
  });
  expect(response.status()).toBe(201);
}

// EN: Expense setup mirrors income setup so US8.1 can verify mixed income and
// expense counting without testing the manual Expense screen flow.
// 中文：支出准备方式与收入一致，让 US8.1 可以验证收入和支出的混合统计，而不测试手动支出页面流程。
async function addExpense(page: Page, categoryId: number, date: string, amount: string, token?: string): Promise<void> {
  const response = await e2ePost(page, `${API}/expenses/`, {
    headers: authHeaders(token),
    data: { amount, date, category_id: categoryId, entry_method: 'manual' },
  });
  expect(response.status()).toBe(201);
}

async function addWorkCost(page: Page, categoryId: number, date: string, amount: string, token?: string): Promise<void> {
  const response = await e2ePost(page, `${API}/work-costs/entries/`, {
    headers: authHeaders(token),
    data: { amount, date, category_id: categoryId },
  });
  expect(response.status()).toBe(201);
}

async function accountToken(page: Page): Promise<string> {
  await expect
    .poll(async () => page.evaluate(() => window.localStorage.getItem('rumampu_auth_token')), { timeout: 15000 })
    .not.toBeNull();
  const token = await page.evaluate(() => window.localStorage.getItem('rumampu_auth_token'));
  return token || '';
}

async function accountIncomeRecord(page: Page): Promise<{
  sources: Array<{ id: number; slug: string | null; name: string; is_custom: boolean }>;
  entries: Array<{ amount: string; date: string; source_id: number | null; entry_method: string }>;
}> {
  const response = await e2eGet(page, `${API}/income/record/`, {
    headers: { Authorization: `Token ${await accountToken(page)}` },
  });
  expect(response.status()).toBe(200);
  return response.json();
}

async function accountAuthState(page: Page): Promise<{ last_record_exported_at: string | null }> {
  const response = await e2eGet(page, `${API}/auth/me/`, {
    headers: { Authorization: `Token ${await accountToken(page)}` },
  });
  expect(response.status()).toBe(200);
  return response.json();
}

async function guestIncomeRecord(page: Page, clientId?: string | null): Promise<{
  sources: Array<{ id: number; slug: string | null; name: string; is_custom: boolean }>;
  entries: Array<{ amount: string; date: string; source_id: number | null; entry_method: string }>;
}> {
  const response = clientId
    ? await page.request.get(`${API}/income/record/`, { headers: { 'X-RuMampu-Client-ID': clientId } })
    : await e2eGet(page, `${API}/income/record/`);
  expect(response.status()).toBe(200);
  return response.json();
}

async function accountExpenses(page: Page): Promise<Array<{ amount: string; date: string; category_id: number }>> {
  const response = await e2eGet(page, `${API}/expenses/`, {
    headers: { Authorization: `Token ${await accountToken(page)}` },
  });
  expect(response.status()).toBe(200);
  return response.json();
}

async function accountWorkCostEntries(page: Page): Promise<Array<{ amount: string; date: string; category_id: number }>> {
  const response = await e2eGet(page, `${API}/work-costs/entries/`, {
    headers: { Authorization: `Token ${await accountToken(page)}` },
  });
  expect(response.status()).toBe(200);
  return response.json();
}

async function accountCommitments(page: Page): Promise<Array<{ monthly_amount: string; slug: string }>> {
  const response = await e2eGet(page, `${API}/commitments/`, {
    headers: { Authorization: `Token ${await accountToken(page)}` },
  });
  expect(response.status()).toBe(200);
  return response.json();
}

async function completeGuestOnboardingWithSelectedWorkAndIncome(page: Page, amount: string): Promise<void> {
  await page.goto('/');
  const splash = page.getByLabel('RuMampu');
  if (await splash.isVisible().catch(() => false)) await splash.click({ force: true });

  await continueAsGuestFromLogin(page);
  await page.getByText('Next', { exact: true }).last().click();
  await expect(page.getByText('What do you do?', { exact: true })).toBeVisible();

  // E-hailing is the default selected job; select the two extra jobs from the manual report.
  await page.getByText('Food delivery', { exact: true }).click();
  await page.getByText('Freelancer', { exact: true }).click();
  await page.getByText('Next', { exact: true }).last().click();
  await page.locator('input:visible').last().fill(amount);

  const responsePromise = page.waitForResponse(response =>
    response.request().method() === 'POST'
    && response.url().endsWith('/api/v1/income/entries/')
  );
  await page.getByText('Start using RuMampu', { exact: true }).click();
  const response = await responsePromise;
  expect(response.status(), await response.text()).toBe(201);
  await expect(page.getByRole('tab', { name: 'Home', exact: true })).toBeVisible();
  await syncClientIdFromBrowser(page);
}

async function addIncomeThroughUi(page: Page, amount: string): Promise<void> {
  await page.getByRole('tab', { name: 'Money', exact: true }).click();
  await page.getByText('Income', { exact: true }).last().click();
  await expect(page.getByText('E-hailing', { exact: true })).toBeVisible();
  await page.locator('input:visible').first().fill(amount);
  await page.getByText('E-hailing', { exact: true }).click();
  const responsePromise = page.waitForResponse(response =>
    response.request().method() === 'POST'
    && response.url().endsWith('/api/v1/income/entries/')
  );
  await page.getByRole('button', { name: 'Add income', exact: true }).click();
  const response = await responsePromise;
  expect(response.status(), await response.text()).toBe(201);
}

async function addExpenseThroughUi(page: Page, amount: string): Promise<void> {
  await page.getByRole('tab', { name: 'Money', exact: true }).click();
  await page.getByText('Daily expenses', { exact: true }).last().click();
  await expect(page.getByText('Meals', { exact: true })).toBeVisible();
  await page.locator('input:visible').first().fill(amount);
  await page.getByText('Meals', { exact: true }).click();
  const responsePromise = page.waitForResponse(response =>
    response.request().method() === 'POST'
    && response.url().endsWith('/api/v1/expenses/')
  );
  await page.getByText('Add expense', { exact: true }).click();
  const response = await responsePromise;
  expect(response.status(), await response.text()).toBe(201);
}

// EN: Open Your Record through the visible Money menu, proving the Epic 8 record
// screen is reachable without directly setting internal routes.
// 中文：通过可见的 Money 菜单打开“记录档案”，证明 Epic 8 记录页可从真实界面入口到达，而不是直接改内部路由。
async function openRecord(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Money', exact: true }).click();
  await page.getByText('Your record', { exact: true }).last().click();
}

async function clickThroughFirstAccountOnboarding(page: Page): Promise<void> {
  await page.getByText('Next', { exact: true }).last().click();
  await page.getByText('Next', { exact: true }).last().click();
  await page.getByText('Skip', { exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Home', exact: true })).toBeVisible();
}

async function createDirectAccountThroughOnboarding(
  page: Page,
  email: string,
  password: string,
  lastMonthAmount?: string,
): Promise<void> {
  await page.goto('/');
  await dismissSplashIfVisible(page);
  await page.getByText('Create an account', { exact: true }).click();
  await page.getByPlaceholder('name@example.com').fill(email);
  await page.getByPlaceholder('At least 8 characters').fill(password);
  await page.getByPlaceholder('Type it again').fill(password);
  await page.getByText('Create account', { exact: true }).last().click();

  await expect(page.getByText('Step 1 of 3', { exact: true })).toBeVisible();
  await page.getByText('Next', { exact: true }).last().click();
  await expect(page.getByText('What do you do?', { exact: true })).toBeVisible();
  await page.getByText('Food delivery', { exact: true }).click();
  await page.getByText('Next', { exact: true }).last().click();
  await expect(page.getByText('How much did you earn last month?', { exact: true })).toBeVisible();
  if (lastMonthAmount) {
    await page.locator('input:visible').last().fill(lastMonthAmount);
    await page.getByText('Start using RuMampu', { exact: true }).click();
  } else {
    await page.getByText('Skip', { exact: true }).click();
  }
  await expect(page.getByRole('tab', { name: 'Home', exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Step 1 of 3', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Step 2 of 3', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Step 3 of 3', { exact: true })).toHaveCount(0);
}

async function logoutCurrentAccount(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Profile', exact: true }).click();
  await page.getByText('Log out', { exact: true }).click();
  await expect(page.getByText('Your record remains with your account. This only ends the current session on this browser/device.', { exact: true })).toBeVisible();
  await page.getByText('Log out', { exact: true }).last().click();
  await expect(page.getByPlaceholder('name@example.com')).toBeVisible();
}

async function loginThroughUi(page: Page, email: string, password: string): Promise<void> {
  await page.getByPlaceholder('name@example.com').fill(email);
  await page.getByPlaceholder('Your password').fill(password);
  await page.getByText('Log in', { exact: true }).last().click();
  await expect(page.getByRole('tab', { name: 'Home', exact: true })).toBeVisible({ timeout: 15000 });
}

function expectedLastMonthIso(): string {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}-01`;
}

async function syncClientIdFromBrowser(page: Page): Promise<void> {
  const clientId = await page.evaluate(() => window.localStorage.getItem('rumampu_client_id'));
  expect(clientId).toBeTruthy();
  (page as Page & { __rumampuE2EClientId?: string }).__rumampuE2EClientId = clientId || undefined;
}

async function seedHousingReadyIncome(page: Page): Promise<void> {
  const { sourceId } = await defaultIds(page);
  await addIncome(page, sourceId, '2026-01-10', '10000.00');
  await addIncome(page, sourceId, '2026-02-10', '10000.00');
  await addIncome(page, sourceId, '2026-03-10', '10000.00');
}

async function completedAccountForUi(page: Page): Promise<string> {
  const token = await registerAccountForTest(
    page,
    `epic8-complete-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
    'Passw0rd123',
  );
  const response = await e2ePatch(page, `${API}/auth/me/`, {
    headers: { Authorization: `Token ${token}` },
    data: { preferred_language: 'en', onboarding_completed: true },
  });
  expect(response.status()).toBe(200);
  await page.addInitScript((authToken: string) => {
    window.localStorage.setItem('rumampu_auth_token', authToken);
  }, token);
  return token;
}

async function registerAccountForTest(page: Page, email: string, password: string): Promise<string> {
  const response = await e2ePost(page, `${API}/auth/register/`, {
    data: { email, password },
  });
  expect(response.status()).toBe(201);
  const payload = await response.json();
  expect(payload.token).toBeTruthy();
  const state = await e2ePatch(page, `${API}/auth/me/`, {
    headers: { Authorization: `Token ${payload.token}` },
    data: { preferred_language: 'en', onboarding_completed: true },
  });
  expect(state.status()).toBe(200);
  return payload.token;
}

async function createAccountSavedTest(page: Page, token: string, name: string): Promise<void> {
  const response = await e2ePost(page, `${API}/housing/saved-tests/`, {
    headers: { Authorization: `Token ${token}` },
    data: {
      name,
      monthly_payment: 1111,
      short_month_count: 0,
      tested_months: 1,
      largest_gap: 0,
      income_shock_percent: 0,
      result: { source: 'account fixture', stable: true },
    },
  });
  expect(response.status()).toBe(201);
}

async function fetchAccountSavedTests(page: Page, token: string): Promise<Array<{ name: string }>> {
  const response = await e2eGet(page, `${API}/housing/saved-tests/`, {
    headers: { Authorization: `Token ${token}` },
  });
  expect(response.status()).toBe(200);
  return response.json();
}

async function saveGuestHousingTestThroughUi(page: Page, name: string): Promise<void> {
  await page.getByRole('tab', { name: 'House', exact: true }).click();
  await page.getByText('Test a house', { exact: true }).click();
  await page.getByPlaceholder('e.g. 250,000').fill('250000');
  await page.getByRole('button', { name: 'Run the test', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save test', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save test', exact: true }).click();
  await page.locator('input:visible').last().fill(name);
  await page.getByRole('button', { name: 'Save test', exact: true }).last().click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
}

async function openSignupFromProfile(page: Page, guestChoice: 'keep' | 'fresh' = 'fresh'): Promise<void> {
  await page.getByRole('tab', { name: 'Profile', exact: true }).click();
  await page.getByText('Sign up', { exact: true }).first().click();
  await page.getByText(guestChoice === 'keep' ? 'Keep my guest record' : 'Start fresh', { exact: true }).click();
}

async function loginExistingAccountFromGuest(page: Page, email: string, password: string): Promise<void> {
  await openSignupFromProfile(page);
  await page.getByText('Log in', { exact: true }).last().click();
  await page.getByPlaceholder('name@example.com').fill(email);
  await page.getByPlaceholder('Your password').fill(password);
  await page.getByText('Log in', { exact: true }).last().click();
  await expect(page.getByText('Keep your guest record?', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Home', exact: true })).toBeVisible({ timeout: 15000 });
}

test('US8.16 first-launch onboarding explains RuMampu and reaches get-to-know', async ({ page }) => {
  await page.goto('/');
  const splash = page.getByLabel('RuMampu');
  if (await splash.isVisible().catch(() => false)) await splash.click({ force: true });

  const email = `epic8-onboarding-${Date.now()}@example.com`;
  const password = 'Passw0rd123';
  await page.getByText('Create an account', { exact: true }).click();
  await page.getByPlaceholder('name@example.com').fill(email);
  await page.getByPlaceholder('At least 8 characters').fill(password);
  await page.getByPlaceholder('Type it again').fill(password);
  await page.getByText('Create account', { exact: true }).last().click();

  await expect(page.getByText('Step 1 of 3', { exact: true })).toBeVisible();
  await expect(page.getByText('What RuMampu does', { exact: true })).toBeVisible();
  await expect(page.getByText('RuMampu blends rumah and mampu: can I afford a home?', { exact: true })).toBeVisible();
  await expect(page.getByText('I test a home against your recorded months', { exact: true })).toBeVisible();
  await expect(page.getByText('It is not a loan or home approval', { exact: true })).toBeVisible();

  await page.getByText('Next', { exact: true }).last().click();
  await expect(page.getByText('Step 2 of 3', { exact: true })).toBeVisible();
  await expect(page.getByText('What do you do?', { exact: true })).toBeVisible();
  await page.getByText('Next', { exact: true }).last().click();
  await expect(page.getByText('Step 3 of 3', { exact: true })).toBeVisible();
  await expect(page.getByText('How much did you earn last month?', { exact: true })).toBeVisible();
  await page.locator('input:visible').last().fill('1234');
  await page.getByText('Start using RuMampu', { exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Home', exact: true })).toBeVisible({ timeout: 15000 });

  await page.reload();
  await dismissSplashIfVisible(page);
  await expect(page.getByRole('tab', { name: 'Home', exact: true })).toBeVisible();
  await expect(page.getByText('Step 1 of 3', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Step 2 of 3', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Step 3 of 3', { exact: true })).toHaveCount(0);
  await expect(page.getByText('What RuMampu does', { exact: true })).toHaveCount(0);
  await expect(page.getByText('What do you do?', { exact: true })).toHaveCount(0);
  await expect(page.getByText('How much did you earn last month?', { exact: true })).toHaveCount(0);
});

test('US8.16 first-launch guest onboarding runs once and reaches Home', async ({ page }) => {
  await completeGuestOnboardingWithSelectedWorkAndIncome(page, '1234');
  await expect(page.getByRole('tab', { name: 'Home', exact: true })).toBeVisible();
});

test('US8.16 Home How it works opens purpose content without replaying onboarding', async ({ page }) => {
  await completedAccountForUi(page);
  await page.goto('/');
  const splash = page.getByLabel('RuMampu');
  if (await splash.isVisible().catch(() => false)) await splash.click({ force: true });
  await expect(page.getByRole('tab', { name: 'Home', exact: true })).toBeVisible();
  const assistantIntro = page.getByText('Hi! Ask me about your record, your saving plan, or a house you have in mind. I only answer from your own numbers.', { exact: true });
  await assistantIntro.waitFor({ state: 'visible', timeout: 1000 }).catch(() => undefined);
  if (await assistantIntro.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Done', exact: true }).last().click({ force: true });
    await expect(assistantIntro).toHaveCount(0);
  }

  await page.getByRole('button', { name: /How it works/i }).click();
  await expect(page.getByText('What RuMampu does', { exact: true })).toBeVisible();
  await expect(page.getByText('RuMampu tests homes against the months you have recorded.', { exact: true })).toBeVisible();
  await expect(page.getByText('It shows how a housing payment would have behaved across those months.', { exact: true })).toBeVisible();
  await expect(page.getByText('It does not approve a loan or a home.')).toBeVisible();
  await expect(page.getByText('It does not predict whether a bank or lender will approve financing.', { exact: true })).toBeVisible();
  await expect(page.getByText('What do you do?', { exact: true })).toHaveCount(0);
  await expect(page.getByText('How much did you earn last month?', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Home', exact: true })).toBeVisible();
  await expect(page.getByText('It does not predict whether a bank or lender will approve financing.', { exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Home', exact: true })).toBeVisible();
  await expect(page.getByText('What do you do?', { exact: true })).toHaveCount(0);
  await expect(page.getByText('How much did you earn last month?', { exact: true })).toHaveCount(0);
});

test('US8.17 skipped get-to-know creates no fake income and leaves Home guidance', async ({ page }) => {
  await page.goto('/');
  const splash = page.getByLabel('RuMampu');
  if (await splash.isVisible().catch(() => false)) await splash.click({ force: true });

  await continueAsGuestFromLogin(page);
  await expect(page.getByText('What RuMampu does', { exact: true })).toBeVisible();
  await page.getByText('Next', { exact: true }).last().click();
  await page.getByText('Skip', { exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Home', exact: true })).toBeVisible();
  await expect(page.getByText('Add last week’s earnings. That’s enough to start.', { exact: true })).toBeVisible();

  const record = await e2eGet(page, `${API}/income/record/`);
  expect(record.status()).toBe(200);
  const payload = await record.json();
  expect(payload.entries).toEqual([]);
});

test('US8.17 get-to-know accepts custom work and saves one editable rough monthly income', async ({ page }) => {
  await page.goto('/');
  const splash = page.getByLabel('RuMampu');
  if (await splash.isVisible().catch(() => false)) await splash.click({ force: true });

  await continueAsGuestFromLogin(page);
  await page.getByText('Next', { exact: true }).last().click();
  await expect(page.getByText('What do you do?', { exact: true })).toBeVisible();
  await page.getByText('＋ Add your own', { exact: true }).click();
  await page.locator('input:visible').last().fill('Night market stall');
  await page.getByText('Add', { exact: true }).click();
  await expect(page.getByText('Night market stall', { exact: true })).toBeVisible();
  await page.getByText('Next', { exact: true }).last().click();
  await page.locator('input:visible').last().fill('3000');
  await page.getByText('Start using RuMampu', { exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Home', exact: true })).toBeVisible();

  await syncClientIdFromBrowser(page);
  let payload: { entries: Array<{ amount: string; date: string; entry_method: string }> } | undefined;
  await expect
    .poll(async () => {
      const record = await e2eGet(page, `${API}/income/record/`);
      if (record.status() !== 200) return `status:${record.status()}`;
      const body = (await record.json()) as { entries: Array<{ amount: string; date: string; entry_method: string }> };
      payload = body;
      return String(body.entries.length);
    })
    .toBe('1');
  const finalPayload = payload;
  expect(finalPayload).toBeTruthy();
  expect(finalPayload!.entries).toHaveLength(1);
  expect(finalPayload!.entries[0].amount).toBe('3000.00');
  expect(finalPayload!.entries[0].date).toBe(expectedLastMonthIso());
  expect(finalPayload!.entries[0].entry_method).toBe('historical_total');
});

test('US8.17 direct account can add income after saving rough onboarding income', async ({ page }) => {
  const email = `epic8-direct-income-${Date.now()}@example.com`;
  const password = 'Passw0rd123';

  await createDirectAccountThroughOnboarding(page, email, password, '3000');

  await expect
    .poll(async () => (await accountIncomeRecord(page)).entries.some(entry => (
      entry.amount === '3000.00'
      && entry.date === expectedLastMonthIso()
      && entry.entry_method === 'historical_total'
    )))
    .toBe(true);
  let record = await accountIncomeRecord(page);
  expect(record.sources.some(source => source.name === 'Food delivery' && source.is_custom)).toBe(true);

  await addIncomeThroughUi(page, '3333');
  await expect(page.locator('body')).toContainText(/3,333|3333/);
  record = await accountIncomeRecord(page);
  expect(record.entries.map(entry => entry.amount)).toEqual(['3000.00', '3333.00']);
  expect(record.entries.find(entry => entry.amount === '3333.00')).toEqual(expect.objectContaining({
    entry_method: 'manual',
  }));

  await openRecord(page);
  await expect(page.locator('body')).toContainText('2 entries');

  await page.reload();
  await dismissSplashIfVisible(page);
  await expect(page.getByRole('tab', { name: 'Home', exact: true })).toBeVisible();
  expect((await accountIncomeRecord(page)).entries.map(entry => entry.amount)).toEqual(['3000.00', '3333.00']);

  await logoutCurrentAccount(page);
  await loginThroughUi(page, email, password);
  expect((await accountIncomeRecord(page)).entries.map(entry => entry.amount)).toEqual(['3000.00', '3333.00']);
  await openRecord(page);
  await expect(page.locator('body')).toContainText('2 entries');
});

test('US8.17 direct account can add income after skipping rough onboarding income', async ({ page }) => {
  const email = `epic8-direct-skip-income-${Date.now()}@example.com`;
  const password = 'Passw0rd123';

  await createDirectAccountThroughOnboarding(page, email, password);

  let record = await accountIncomeRecord(page);
  expect(record.entries).toEqual([]);
  await expect
    .poll(async () => (await accountIncomeRecord(page)).sources.some(source => source.name === 'Food delivery' && source.is_custom))
    .toBe(true);

  await addIncomeThroughUi(page, '3333');
  await expect(page.locator('body')).toContainText(/3,333|3333/);
  record = await accountIncomeRecord(page);
  expect(record.entries).toEqual([
    expect.objectContaining({
      amount: '3333.00',
      entry_method: 'manual',
    }),
  ]);

  await openRecord(page);
  await expect(page.locator('body')).toContainText('1 entries');

  await page.reload();
  await dismissSplashIfVisible(page);
  await expect(page.getByRole('tab', { name: 'Home', exact: true })).toBeVisible();
  expect((await accountIncomeRecord(page)).entries.map(entry => entry.amount)).toEqual(['3333.00']);

  await logoutCurrentAccount(page);
  await loginThroughUi(page, email, password);
  expect((await accountIncomeRecord(page)).entries.map(entry => entry.amount)).toEqual(['3333.00']);
  await openRecord(page);
  await expect(page.locator('body')).toContainText('1 entries');
});

test('US8.14.5 delete confirmation offers optional export first for a never-exported account', async ({ page }) => {
  const email = `epic8-delete-export-${Date.now()}@example.com`;
  const password = 'Passw0rd123';

  await createDirectAccountThroughOnboarding(page, email, password);
  expect((await accountAuthState(page)).last_record_exported_at).toBeNull();

  await page.getByRole('tab', { name: 'Profile', exact: true }).click();
  await page.getByText('Delete account and record', { exact: true }).first().click();

  await expect(page.getByText('Delete account and record?', { exact: true })).toBeVisible();
  await expect(page.getByText('This removes your account, income entries, work costs, bills, expenses, saved home tests and plans.', { exact: true })).toBeVisible();
  await expect(page.getByText(/backup copies/i)).toBeVisible();
  await expect(page.getByText('Export my record', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('Delete account and record', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('Cancel', { exact: true }).last()).toBeVisible();

  await page.getByText('Cancel', { exact: true }).last().click();
  await expect(page.getByText('Delete account and record?', { exact: true })).toHaveCount(0);
});

test('US8.14.5 export first keeps deletion optional and persists exported state', async ({ page }) => {
  const email = `epic8-delete-export-first-${Date.now()}@example.com`;
  const password = 'Passw0rd123';

  await createDirectAccountThroughOnboarding(page, email, password);
  await page.getByRole('tab', { name: 'Profile', exact: true }).click();
  await page.getByText('Delete account and record', { exact: true }).first().click();
  await expect(page.getByText('Delete account and record?', { exact: true })).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByText('Export my record', { exact: true }).last().click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/RuMampu_Record_.*\.xlsx$/);

  await expect.poll(async () => (await accountAuthState(page)).last_record_exported_at).not.toBeNull();
  await expect(page.getByText('Delete account and record?', { exact: true })).toBeVisible();
  await expect(page.getByText('Delete account and record', { exact: true }).last()).toBeVisible();
  await page.getByText('Cancel', { exact: true }).last().click();

  await page.getByText('Delete account and record', { exact: true }).first().click();
  await expect(page.getByText('Delete account and record?', { exact: true })).toBeVisible();
  await expect(page.getByText('Delete account and record', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('Cancel', { exact: true }).last()).toBeVisible();
});

test('US8.14.5 guest delete confirmation does not expose account export', async ({ page }) => {
  await page.goto('/');
  await dismissSplashIfVisible(page);
  await continueAsGuestFromLogin(page);
  await clickThroughFirstAccountOnboarding(page);

  await page.getByRole('tab', { name: 'Profile', exact: true }).click();
  await expect(page.getByText('Export my record', { exact: true })).toHaveCount(0);
  await page.getByText('Delete guest record', { exact: true }).click();

  await expect(page.getByText('Delete guest record?', { exact: true })).toBeVisible();
  await expect(page.getByText('Export my record', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Delete guest record', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('Cancel', { exact: true }).last()).toBeVisible();
});

test('US8.12 guest entry does not call authenticated-only account endpoints', async ({ page }) => {
  const savedTestRequests: string[] = [];
  const authOnlyRequests: string[] = [];
  const unauthorizedResponses: string[] = [];

  page.on('request', request => {
    const url = request.url();
    if (url.includes('/housing/saved-tests/')) savedTestRequests.push(url);
    if (url.includes('/auth/me/')) authOnlyRequests.push(url);
  });
  page.on('response', response => {
    const url = response.url();
    if (response.status() === 401 && (url.includes('/housing/saved-tests/') || url.includes('/auth/me/'))) {
      unauthorizedResponses.push(url);
    }
  });

  await page.goto('/');
  const splash = page.getByLabel('RuMampu');
  if (await splash.isVisible().catch(() => false)) await splash.click({ force: true });

  await continueAsGuestFromLogin(page);
  await expect(page.getByRole('tab', { name: 'Home', exact: true })).toBeVisible();
  await page.waitForLoadState('networkidle').catch(() => undefined);

  expect(savedTestRequests).toEqual([]);
  expect(authOnlyRequests).toEqual([]);
  expect(unauthorizedResponses).toEqual([]);
});

test('US8.12 delete account then create account opens real registration first', async ({ page }) => {
  const unauthorizedResponses: string[] = [];
  page.on('response', response => {
    const url = response.url();
    if (response.status() === 401 && (url.includes('/housing/saved-tests/') || url.includes('/auth/me/'))) {
      unauthorizedResponses.push(url);
    }
  });

  await page.goto('/');
  const splash = page.getByLabel('RuMampu');
  if (await splash.isVisible().catch(() => false)) await splash.click({ force: true });

  await page.getByText('Create an account', { exact: true }).click();
  const firstEmail = `epic8-delete-${Date.now()}@example.com`;
  const firstPassword = 'Passw0rd123';
  await page.getByPlaceholder('name@example.com').fill(firstEmail);
  await page.getByPlaceholder('At least 8 characters').fill(firstPassword);
  await page.getByPlaceholder('Type it again').fill(firstPassword);
  await page.getByText('Create account', { exact: true }).last().click();
  await clickThroughFirstAccountOnboarding(page);

  await page.getByRole('tab', { name: 'Profile', exact: true }).click();
  await page.getByText('Delete account and record', { exact: true }).first().click();
  await expect(page.getByText('Delete account and record?', { exact: true })).toBeVisible();
  await page.getByText('Delete account and record', { exact: true }).last().click();
  await expect(page.getByText('Add last week’s earnings. That’s enough to start.', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Home', exact: true }).click();
  await page.getByRole('tab', { name: 'Profile', exact: true }).click();
  await expect(page.getByText('Welcome, guest', { exact: true }).first()).toBeVisible();

  await openSignupFromProfile(page, 'fresh');
  await expect(page.getByPlaceholder('name@example.com')).toBeVisible();
  await expect(page.getByText('What RuMampu does', { exact: true })).toHaveCount(0);

  const secondEmail = `epic8-recreate-${Date.now()}@example.com`;
  const secondPassword = 'Passw0rd123';
  await page.getByPlaceholder('name@example.com').fill(secondEmail);
  await page.getByPlaceholder('At least 8 characters').fill(secondPassword);
  await page.getByPlaceholder('Type it again').fill(secondPassword);
  await page.getByText('Create account', { exact: true }).last().click();
  await expect(page.getByRole('tab', { name: 'Home', exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('What do you do?', { exact: true })).toHaveCount(0);

  expect(unauthorizedResponses).toEqual([]);
});

test('US8.12 transfers guest saved housing tests to a new account on Keep', async ({ page }) => {
  await seedHousingReadyIncome(page);
  await openApp(page);

  const savedName = `Guest transfer ${Date.now()}`;
  await saveGuestHousingTestThroughUi(page, savedName);

  await openSignupFromProfile(page, 'keep');
  const email = `epic8-transfer-${Date.now()}@example.com`;
  const password = 'Passw0rd123';
  await page.getByPlaceholder('name@example.com').fill(email);
  await page.getByPlaceholder('At least 8 characters').fill(password);
  await page.getByPlaceholder('Type it again').fill(password);
  await page.getByText('Create account', { exact: true }).last().click();

  await clickThroughFirstAccountOnboarding(page);

  await page.getByRole('tab', { name: 'House', exact: true }).click();
  await page.getByLabel('Saved tests').click();
  await expect(page.getByText(savedName, { exact: true })).toBeVisible();
  await page.getByText('Open this result').click();
  await expect(page.getByText('Result', { exact: true }).first()).toBeVisible();

  await page.getByRole('tab', { name: 'Profile', exact: true }).click();
  await page.getByText('Log out', { exact: true }).click();
  await expect(page.getByText('Your record remains with your account. This only ends the current session on this browser/device.', { exact: true })).toBeVisible();
  await page.getByText('Log out', { exact: true }).last().click();
  await page.getByPlaceholder('name@example.com').fill(email);
  await page.getByPlaceholder('Your password').fill(password);
  await page.getByText('Log in', { exact: true }).last().click();
  await expect(page.getByRole('tab', { name: 'Home', exact: true })).toBeVisible({ timeout: 15000 });

  await page.getByRole('tab', { name: 'House', exact: true }).click();
  await page.getByLabel('Saved tests').click();
  await expect(page.getByText(savedName, { exact: true })).toBeVisible();
  await page.getByText('Open this result').click();
  await expect(page.getByText('Result', { exact: true }).first()).toBeVisible();
});

test('US8.12 Keep transfers onboarding-derived guest income to a new account', async ({ page }) => {
  await completeGuestOnboardingWithSelectedWorkAndIncome(page, '5555');
  const guestBefore = await guestIncomeRecord(page);
  expect(guestBefore.entries.map(entry => entry.amount)).toContain('5555.00');
  expect(guestBefore.sources.some(source => source.name === 'Food delivery' && source.is_custom)).toBe(true);

  await openSignupFromProfile(page, 'keep');
  const email = `epic8-keep-onboarding-${Date.now()}@example.com`;
  const password = 'Passw0rd123';
  await page.getByPlaceholder('name@example.com').fill(email);
  await page.getByPlaceholder('At least 8 characters').fill(password);
  await page.getByPlaceholder('Type it again').fill(password);
  await page.getByText('Create account', { exact: true }).last().click();
  await clickThroughFirstAccountOnboarding(page);

  const accountRecord = await accountIncomeRecord(page);
  expect(accountRecord.entries).toEqual([
    expect.objectContaining({
      amount: '5555.00',
      date: expectedLastMonthIso(),
      entry_method: 'historical_total',
    }),
  ]);
  expect(accountRecord.sources.some(source => source.name === 'Food delivery' && source.is_custom)).toBe(true);
});

test('US8.12 login to existing account does not show retired guest-transfer prompt', async ({ page }) => {
  const password = 'Passw0rd123';
  const email = `epic8-existing-${Date.now()}@example.com`;
  const accountName = `Account test ${Date.now()}`;
  const guestName = `Guest existing ${Date.now()}`;
  const token = await registerAccountForTest(page, email, password);
  await createAccountSavedTest(page, token, accountName);

  await seedHousingReadyIncome(page);
  await openApp(page);
  await saveGuestHousingTestThroughUi(page, guestName);
  await loginExistingAccountFromGuest(page, email, password);

  await page.getByRole('tab', { name: 'House', exact: true }).click();
  await page.getByLabel('Saved tests').click();
  await expect(page.getByText(accountName, { exact: true })).toBeVisible();
  await expect(page.getByText(guestName, { exact: true })).toHaveCount(0);

  const records = await fetchAccountSavedTests(page, token);
  expect(records.filter(record => record.name === accountName)).toHaveLength(1);
  expect(records.filter(record => record.name === guestName)).toHaveLength(0);
});

test('US8.12 existing-account login leaves guest saved test out of the account', async ({ page }) => {
  const password = 'Passw0rd123';
  const email = `epic8-decline-existing-${Date.now()}@example.com`;
  const accountName = `Account decline ${Date.now()}`;
  const guestName = `Guest declined ${Date.now()}`;
  const token = await registerAccountForTest(page, email, password);
  await createAccountSavedTest(page, token, accountName);

  await seedHousingReadyIncome(page);
  await openApp(page);
  await saveGuestHousingTestThroughUi(page, guestName);
  await loginExistingAccountFromGuest(page, email, password);

  await page.getByRole('tab', { name: 'House', exact: true }).click();
  await page.getByLabel('Saved tests').click();
  await expect(page.getByText(accountName, { exact: true })).toBeVisible();
  await expect(page.getByText(guestName, { exact: true })).toHaveCount(0);

  const records = await fetchAccountSavedTests(page, token);
  expect(records.filter(record => record.name === accountName)).toHaveLength(1);
  expect(records.filter(record => record.name === guestName)).toHaveLength(0);
});

test('US8.12 cancel from guest sign-up choice leaves the guest record unchanged', async ({ page }) => {
  await openApp(page);
  await syncClientIdFromBrowser(page);
  const guestClientId = await page.evaluate(() => window.localStorage.getItem('rumampu_client_id'));
  expect(guestClientId).toBeTruthy();
  const { sourceId } = await defaultIds(page);
  await addIncome(page, sourceId, '2026-06-03', '444.00');

  await page.getByRole('tab', { name: 'Profile', exact: true }).click();
  await page.getByText('Sign up', { exact: true }).first().click();
  await page.getByText('Cancel', { exact: true }).click();

  await expect(page.getByText('Welcome, guest', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Create account', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => window.localStorage.getItem('rumampu_auth_token'))).toBeNull();
  expect(await page.evaluate(() => window.localStorage.getItem('rumampu_client_id'))).toBe(guestClientId);

  const record = await e2eGet(page, `${API}/income/record/`);
  expect(record.status()).toBe(200);
  expect((await record.json()).entries.map((entry: { amount: string }) => entry.amount)).toContain('444.00');
});

test('US8.12 Start fresh goes directly Home without replaying onboarding or transferring guest data', async ({ page }) => {
  await completeGuestOnboardingWithSelectedWorkAndIncome(page, '5555');
  const guestClientId = await page.evaluate(() => window.localStorage.getItem('rumampu_client_id'));
  expect(guestClientId).toBeTruthy();

  const guestIncomeBefore = await guestIncomeRecord(page);
  expect(guestIncomeBefore.entries).toEqual([
    expect.objectContaining({
      amount: '5555.00',
      date: expectedLastMonthIso(),
      entry_method: 'historical_total',
    }),
  ]);
  expect(guestIncomeBefore.sources.some(source => source.slug === 'ehail')).toBe(true);
  expect(guestIncomeBefore.sources.some(source => source.slug === 'freelance')).toBe(true);
  expect(guestIncomeBefore.sources.some(source => source.name === 'Food delivery' && source.is_custom)).toBe(true);

  await page.getByRole('tab', { name: 'Money', exact: true }).click();
  await page.getByText('Income', { exact: true }).last().click();
  await expect(page.locator('body')).toContainText(/5,555|5555/);
  await expect(page.getByText('Food delivery', { exact: true })).toBeVisible();

  await openSignupFromProfile(page, 'fresh');
  const email = `epic8-startfresh-isolation-${Date.now()}@example.com`;
  const password = 'Passw0rd123';
  await page.getByPlaceholder('name@example.com').fill(email);
  await page.getByPlaceholder('At least 8 characters').fill(password);
  await page.getByPlaceholder('Type it again').fill(password);
  await page.getByText('Create account', { exact: true }).last().click();

  await expect(page.getByRole('tab', { name: 'Home', exact: true })).toBeVisible({ timeout: 15000 });
  expect(await accountToken(page)).toBeTruthy();
  await expect(page.getByText('Step 1 of 3', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Step 2 of 3', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Step 3 of 3', { exact: true })).toHaveCount(0);
  await expect(page.getByText('What RuMampu does', { exact: true })).toHaveCount(0);
  await expect(page.getByText('What do you do?', { exact: true })).toHaveCount(0);
  await expect(page.getByText('How much did you earn last month?', { exact: true })).toHaveCount(0);

  const emptyAccountIncome = await accountIncomeRecord(page);
  const emptyAccountExpenses = await accountExpenses(page);
  const emptyAccountWorkCosts = await accountWorkCostEntries(page);
  const accountCommitmentDefaults = await accountCommitments(page);
  expect(emptyAccountIncome.entries).toEqual([]);
  expect(emptyAccountExpenses).toEqual([]);
  expect(emptyAccountWorkCosts).toEqual([]);
  expect(accountCommitmentDefaults.every(item => item.monthly_amount === '0.00')).toBe(true);
  expect(emptyAccountIncome.sources.some(source => source.name === 'Food delivery' && source.is_custom)).toBe(false);
  expect(emptyAccountIncome.sources.every(source => !source.is_custom)).toBe(true);

  await page.getByRole('tab', { name: 'Money', exact: true }).click();
  await page.getByText('Income', { exact: true }).last().click();
  await expect(page.locator('body')).not.toContainText(/5,555|5555|Food delivery|Freelancer/);
  await openRecord(page);
  await expect(page.getByLabel('0 months recorded')).toBeVisible();
  await expect(page.getByLabel('0 financial entries')).toBeVisible();
  await expect(page.locator('body')).toContainText('Nothing changed yet. Every entry you add or edit shows up here.');
  await expect(page.locator('body')).not.toContainText(/5,555|5555|Food delivery|Freelancer/);

  await page.getByRole('tab', { name: 'House', exact: true }).click();
  await page.getByText('Test a house', { exact: true }).click();
  await expect(page.locator('body')).not.toContainText(/5,555|5555/);

  await page.reload();
  await dismissSplashIfVisible(page);
  await expect(page.getByRole('tab', { name: 'Home', exact: true })).toBeVisible();
  await expect(page.getByText('Step 1 of 3', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Step 2 of 3', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Step 3 of 3', { exact: true })).toHaveCount(0);
  await expect(page.getByText('What do you do?', { exact: true })).toHaveCount(0);
  await expect(page.getByText('How much did you earn last month?', { exact: true })).toHaveCount(0);
  expect((await accountIncomeRecord(page)).entries).toEqual([]);
  await openRecord(page);
  await expect(page.getByLabel('0 months recorded')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/5,555|5555|Food delivery|Freelancer/);

  await addIncomeThroughUi(page, '3333');
  await openRecord(page);
  await expect(page.getByLabel('1 month recorded')).toBeVisible();
  await expect(page.locator('body')).toContainText(/3,333|3333/);
  await expect(page.locator('body')).not.toContainText(/5,555|5555/);

  const accountAfter = await accountIncomeRecord(page);
  expect(accountAfter.entries.map(entry => entry.amount)).toEqual(['3333.00']);
  expect(accountAfter.entries.map(entry => entry.amount)).not.toContain('5555.00');

  const guestIncomeAfter = await guestIncomeRecord(page, guestClientId);
  expect(guestIncomeAfter.entries.map(entry => entry.amount)).toContain('5555.00');
  expect(guestIncomeAfter.sources.some(source => source.name === 'Food delivery' && source.is_custom)).toBe(true);
});

// EN: US8.1 / AC8.1.1-AC8.1.5. Setup creates dated income and expenses out of
// chronological order; the user action opens Your Record; toBeVisible() checks
// that the expected summary text is rendered; captureEvidence is shared project
// test infrastructure, not uniquely Epic 8 code.
// 中文：US8.1 / AC8.1.1-AC8.1.5。测试先创建非时间顺序的收入和支出；用户动作是打开“记录档案”；
// toBeVisible() 验证预期摘要文本已渲染；captureEvidence 是项目共享测试基础设施，不是 Epic 8 专属代码。
test('US8.1 summarises mixed dated income and expenses without using array order', async ({ page }) => {
  const token = await completedAccountForUi(page);
  const { sourceId, categoryId, workCostCategoryId } = await defaultIds(page, token);
  await addIncome(page, sourceId, '2026-01-10', '1000.00', token);
  await addIncome(page, sourceId, '2026-02-10', '1200.00', token);
  await addExpense(page, categoryId, '2026-01-15', '20.00', token);
  await addExpense(page, categoryId, '2026-03-05', '30.00', token);
  await addWorkCost(page, workCostCategoryId, '2026-08-31', '99.00', token);

  await page.goto('/');
  await expect(page.getByRole('tab', { name: 'Home', exact: true })).toBeVisible();
  await openRecord(page);

  // EN: These locators assert the visible summary: distinct months, entry count,
  // latest income/expense business date, and signed-in account-scope copy.
  // 中文：这些 locator 验证可见摘要：去重月份数、记录条数、最新业务日期，以及已登录账号范围说明。
  await expect(page.getByText('Financial record', { exact: true })).toBeVisible();
  await expect(page.getByLabel('3 months recorded')).toBeVisible();
  await expect(page.getByLabel('4 financial entries')).toBeVisible();
  await expect(page.getByText('Latest entry', { exact: true })).toBeVisible();
  await expect(page.getByText('5 Mar 2026', { exact: true })).toBeVisible();
  await expect(page.getByText('Every screen updates as you add. Signed in: your record is kept for next time.', { exact: true })).toBeVisible();
  await expect(page.getByText('Your financial record may remain available on this browser/device. It is linked to an anonymous guest ID, not a RuMampu account.', { exact: true })).not.toBeVisible();
  await captureEvidence(page, 'epic-8', '01-record-mixed-summary.png');
});

// EN: US8.1 edge case: same-month income and expense entries are two individual
// entries but only one represented calendar month.
// 中文：US8.1 边界情况：同月的一笔收入和一笔支出算两条单笔记录，但只代表一个日历月份。
test('US8.1 counts one represented month with multiple same-month entries', async ({ page }) => {
  const token = await completedAccountForUi(page);
  const { sourceId, categoryId } = await defaultIds(page, token);
  await addIncome(page, sourceId, '2026-04-02', '900.00', token);
  await addExpense(page, categoryId, '2026-04-25', '45.00', token);

  await page.goto('/');
  await expect(page.getByRole('tab', { name: 'Home', exact: true })).toBeVisible();
  await openRecord(page);

  // EN: Accessibility-label assertions stay stable even when number and label
  // are rendered in nested React Native text views.
  // 中文：使用无障碍标签断言数字指标，即使数字和标签由嵌套 React Native 文本视图渲染也更稳定。
  await expect(page.getByLabel('1 month recorded')).toBeVisible();
  await expect(page.getByLabel('2 financial entries')).toBeVisible();
  await expect(page.getByText('25 Apr 2026', { exact: true })).toBeVisible();
});

// EN: US8.1 empty-state coverage plus AC8.2.4. With no setup records, Your
// Record should show zero counts, no fake latest date, and a route to Test.
// 中文：US8.1 空状态和 AC8.2.4。没有预先创建记录时，“记录档案”应显示 0、无伪造最近日期，
// 并提供前往测试页的入口。
test('US8.1 handles an empty current record without an invalid latest date', async ({ page }) => {
  await openApp(page);
  await openRecord(page);

  // EN: These expect() assertions verify both financial-record empty state and
  // kept-test empty state, including copy that avoids permanent-storage language.
  // 中文：这些 expect() 断言同时验证财务记录空状态和留存测试空状态，并检查文案没有暗示永久保存。
  await expect(page.getByLabel('0 months recorded')).toBeVisible();
  await expect(page.getByLabel('0 financial entries')).toBeVisible();
  await expect(page.getByText('No dated income or expense entries yet.', { exact: true })).toBeVisible();
  await expect(page.getByText('No test kept yet', { exact: true })).toBeVisible();
  await expect(page.getByText('Run a housing test and keep the result here for this session.', { exact: true })).toBeVisible();
  await expect(page.getByText('Go to Test', { exact: true })).toBeVisible();
  await expect(page.getByText('Your financial record may remain available on this browser/device. It is linked to an anonymous guest ID, not a RuMampu account.', { exact: true })).toBeVisible();
  await captureEvidence(page, 'epic-8', '02-record-empty-state.png');
});

// EN: US8.2 / AC8.2.1-AC8.2.5. Setup loads a known scenario so the existing
// housing flow can produce a result; Epic 8 only owns the keep action and the
// kept summary shown in Your Record.
// 中文：US8.2 / AC8.2.1-AC8.2.5。测试先加载已知场景，让现有住房测试流程产生结果；
// Epic 8 只负责留存操作，以及“记录档案”里显示的留存摘要。
test('US8.2 keeps a completed housing test only once in the current frontend session', async ({ page }) => {
  const token = await completedAccountForUi(page);
  const { sourceId } = await defaultIds(page, token);
  await addIncome(page, sourceId, '2026-01-10', '10000.00', token);
  await addIncome(page, sourceId, '2026-02-10', '10000.00', token);
  await addIncome(page, sourceId, '2026-03-10', '10000.00', token);

  await page.goto('/');
  await expect(page.getByRole('tab', { name: 'Home', exact: true })).toBeVisible();
  await openRecord(page);
  await expect(page.getByText('No test kept yet', { exact: true })).toBeVisible();

  // EN: These clicks are user actions through the current UI. The housing engine
  // belongs to earlier epics; this test uses it only to reach a completed Result.
  // 中文：这些点击通过当前 UI 完成用户操作。住房计算引擎属于前面 epic；这里仅用它进入完成后的 Result 页。
  await page.getByRole('tab', { name: 'House', exact: true }).click();
  await page.getByText('Test a house', { exact: true }).click();
  await page.getByPlaceholder('e.g. 250,000').fill('250000');
  await page.getByRole('button', { name: 'Run the test', exact: true }).click();

  await expect(page.getByRole('button', { name: 'Save test', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save test', exact: true }).click();
  await expect(page.getByText('Name this test', { exact: true })).toBeVisible();
  await page.locator('input:visible').last().fill('Epic 8 session check');
  await page.getByRole('button', { name: 'Save test', exact: true }).last().click();
  await expect(page.getByText('Saved for this session in House › Saved tests.', { exact: true })).toBeVisible();
  await expect(page.getByText('Epic 8 session check', { exact: true })).toBeVisible();

  await openRecord(page);
  // EN: The kept card checks compact fields shown in the record, not the whole
  // backend result object or permanent saved-history behaviour.
  // 中文：留存卡片验证记录页展示的精简字段，不验证完整后端结果对象，也不验证永久历史保存。
  await expect(page.getByText('Kept tests', { exact: true })).toBeVisible();
  await expect(page.getByText(/RM\s*1,382\s*·\s*0 of 3 short/)).toBeVisible();
  await expect(page.getByText('Largest gap', { exact: true })).toHaveCount(1);
  await expect(page.locator('body')).not.toContainText(/permanent|cloud backup/i);
  await captureEvidence(page, 'epic-8', '03-kept-test-session-record.png');
});

// EN: US8.3 / AC8.3.1-AC8.3.3. The user opens the Language control, sees all
// supported options, selects Bahasa Melayu, and expects visible UI text to update.
// 中文：US8.3 / AC8.3.1-AC8.3.3。用户打开语言控件，看到全部支持选项，选择马来文，
// 然后预期界面可见文本随之更新。
test('US8.3 lets the user select an available interface language', async ({ page }) => {
  await openApp(page);

  await page.getByRole('tab', { name: 'Profile', exact: true }).click();
  await page.getByText('Language', { exact: true }).click();
  const languageSheet = page.getByRole('dialog');
  // EN: getByText(..., { exact: true }) avoids matching longer unrelated copy.
  // 中文：getByText(..., { exact: true }) 避免匹配到更长的无关文案。
  await expect(languageSheet.getByText('English', { exact: true })).toBeVisible();
  await expect(languageSheet.getByText('Bahasa Melayu', { exact: true })).toBeVisible();
  await expect(languageSheet.getByText('中文', { exact: true })).toBeVisible();

  await languageSheet.getByText('Bahasa Melayu', { exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Rumah', exact: true })).toBeVisible();
  await expect(page.getByText('Bahasa Melayu', { exact: true })).toBeVisible();

  await page.getByText('Bahasa', { exact: true }).click();
  await page.getByRole('dialog').getByText('中文', { exact: true }).click();
  await expect(page.getByRole('tab', { name: '房屋', exact: true })).toBeVisible();
  await expect(page.getByText('语言', { exact: true })).toBeVisible();

  await page.getByText('语言', { exact: true }).click();
  await page.getByRole('dialog').getByText('English', { exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Profile', exact: true })).toBeVisible();
});

// EN: US8.4 / AC8.4.1-AC8.4.6. This checks bottom navigation and Back behaviour.
// The Prepare assertion uses the accepted v22 House-internal segment without
// testing detailed Epic 5 preparation behaviour.
// 中文：US8.4 / AC8.4.1-AC8.4.6。这里检查底部导航和返回行为。
// Prepare 断言使用已接受的 v22 房屋内部切换，不检查 Epic 5 的具体准备功能。
test('US8.4 exposes the four main areas and returns with Back', async ({ page }) => {
  await openApp(page);

  // EN: AC8.4.1 verifies that the four main bottom-nav options are visible.
  // 中文：AC8.4.1 验证底部导航的四个主入口可见。
  await expect(page.getByRole('tab', { name: 'Home', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Money', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'House', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Profile', exact: true })).toBeVisible();

  await page.getByRole('tab', { name: 'Money', exact: true }).click();
  // EN: Money navigation is Epic 8; the detailed Income screen itself belongs
  // to earlier finance-entry scope.
  // 中文：进入 Money 属于 Epic 8 导航；Income 页的具体功能属于前面 epic 的财务录入范围。
  await expect(page.getByText('Income', { exact: true }).last()).toBeVisible();
  await page.getByText('Income', { exact: true }).last().click();
  await expect(page.getByText('Add income', { exact: true })).toBeVisible();
  await page.getByLabel('Back').click();
  await expect(page.getByText('Your record', { exact: true }).last()).toBeVisible();

  await page.getByRole('tab', { name: 'House', exact: true }).click();
  // EN: Opening Test is Epic 8 navigation; the housing-test details belong to
  // earlier housing epics.
  // 中文：进入 Test 属于 Epic 8 导航；住房测试细节属于前面的住房 epic。
  await expect(page.getByText('Test a house', { exact: true })).toBeVisible();

  await page.getByText('Prepare for a house', { exact: true }).click();
  // EN: Epic 8 owns navigation into the Prepare area, not the detailed contents
  // of upfront-cash or document tools.
  // 中文：Epic 8 负责进入 Prepare 区域，不负责购房现金或文件工具的具体功能。
  await expect(page.getByText(/coming soon/i)).toBeVisible();
  await expect(page.getByText('This feature is not finished yet. Please look forward to it.', { exact: true })).toBeVisible();
  await expect(page.getByText('It will be completed in Iteration 3.', { exact: true })).toBeVisible();
  await page.getByText('Back', { exact: true }).click();
  await expect(page.getByText('Prepare for a house', { exact: true })).toBeVisible();

  await page.getByRole('tab', { name: 'Profile', exact: true }).click();
  await expect(page.getByText('Language', { exact: true })).toBeVisible();

  await page.getByRole('tab', { name: 'Home', exact: true }).click();
  await expect(page.getByText('Add last week’s earnings. That’s enough to start.', { exact: true })).toBeVisible();
});

// EN: US8.5 / AC8.5.1-AC8.5.5. This reads source files directly to guard the
// shared colour tokens and chart shortfall colours. It documents Epic 8's visual
// consistency requirement without claiming chart calculations as Epic 8.
// 中文：US8.5 / AC8.5.1-AC8.5.5。此测试直接读取源码，保护共享颜色 token 和图表短缺颜色。
// 它验证 Epic 8 的视觉一致性要求，但不把图表计算声明为 Epic 8。
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
