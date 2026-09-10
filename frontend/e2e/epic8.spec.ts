import { expect, Page } from '@playwright/test';
import { e2eGet, e2ePost, test } from './support/fixtures';
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
  const splash = page.getByLabel('RuMampu');
  if (await splash.isVisible().catch(() => false)) {
    await splash.click({ force: true });
    await expect(splash).toHaveCount(0, { timeout: 5000 }).catch(() => undefined);
  }

  const entryNext = page.getByText('Next', { exact: true }).last();
  if (await entryNext.isVisible().catch(() => false)) await entryNext.click();

  const meet = page.getByText('Nice to meet you →', { exact: true });
  if (await meet.isVisible().catch(() => false)) await meet.click();

  const guest = page.getByText('Continue as guest', { exact: true });
  if (await guest.isVisible().catch(() => false)) await guest.click();

  const knowNext = page.getByText('Next', { exact: true }).last();
  if (await knowNext.isVisible().catch(() => false)) await knowNext.click();

  const skip = page.getByText('Skip', { exact: true });
  if (await skip.isVisible().catch(() => false)) await skip.click();

  await expect(page.getByRole('tab', { name: 'Home', exact: true })).toBeVisible();
}

// EN: Test setup for US8.1 uses backend seed IDs instead of hard-coding database
// primary keys. expect(...).toBeTruthy() fails early if fixture data is missing.
// 中文：US8.1 的测试准备步骤从后端读取种子数据 ID，而不是写死数据库主键。
// expect(...).toBeTruthy() 会在 fixture 数据缺失时尽早让测试失败。
async function defaultIds(page: Page): Promise<{ sourceId: number; categoryId: number; workCostCategoryId: number }> {
  const record = await e2eGet(page, `${API}/income/record/`);
  expect(record.ok()).toBeTruthy();
  const payload = await record.json();
  const source = payload.sources.find((item: { slug: string }) => item.slug === 'ehail');
  expect(source).toBeTruthy();

  const categories = await e2eGet(page, `${API}/expense-categories/`);
  expect(categories.ok()).toBeTruthy();
  const categoryPayload = await categories.json();
  const category = categoryPayload.find((item: { slug: string }) => item.slug === 'meals');
  expect(category).toBeTruthy();

  const workCosts = await e2eGet(page, `${API}/work-costs/`);
  expect(workCosts.ok()).toBeTruthy();
  const workCostPayload = await workCosts.json();
  const workCostCategory = workCostPayload.find((item: { slug: string }) => item.slug === 'petrol');
  expect(workCostCategory).toBeTruthy();

  return { sourceId: source.id, categoryId: category.id, workCostCategoryId: workCostCategory.id };
}

// EN: US8.1 setup creates income through the public API so Your Record reads the
// same saved-data path a real current guest session would use.
// 中文：US8.1 通过公开 API 创建收入记录，让“记录档案”读取真实当前访客会话会使用的数据路径。
async function addIncome(page: Page, sourceId: number, date: string, amount: string): Promise<void> {
  const response = await e2ePost(page, `${API}/income/entries/`, {
    data: { amount, date, source_id: sourceId, entry_method: 'manual', confirm_outlier: true },
  });
  expect(response.status()).toBe(201);
}

// EN: Expense setup mirrors income setup so US8.1 can verify mixed income and
// expense counting without testing the manual Expense screen flow.
// 中文：支出准备方式与收入一致，让 US8.1 可以验证收入和支出的混合统计，而不测试手动支出页面流程。
async function addExpense(page: Page, categoryId: number, date: string, amount: string): Promise<void> {
  const response = await e2ePost(page, `${API}/expenses/`, {
    data: { amount, date, category_id: categoryId, entry_method: 'manual' },
  });
  expect(response.status()).toBe(201);
}

async function addWorkCost(page: Page, categoryId: number, date: string, amount: string): Promise<void> {
  const response = await e2ePost(page, `${API}/work-costs/entries/`, {
    data: { amount, date, category_id: categoryId },
  });
  expect(response.status()).toBe(201);
}

// EN: Open Your Record through the visible Money menu, proving the Epic 8 record
// screen is reachable without directly setting internal routes.
// 中文：通过可见的 Money 菜单打开“记录档案”，证明 Epic 8 记录页可从真实界面入口到达，而不是直接改内部路由。
async function openRecord(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Money', exact: true }).click();
  await page.getByText('Your record', { exact: true }).last().click();
}

async function seedHousingReadyIncome(page: Page): Promise<void> {
  const { sourceId } = await defaultIds(page);
  await addIncome(page, sourceId, '2026-01-10', '10000.00');
  await addIncome(page, sourceId, '2026-02-10', '10000.00');
  await addIncome(page, sourceId, '2026-03-10', '10000.00');
}

// EN: US8.1 / AC8.1.1-AC8.1.5. Setup creates dated income and expenses out of
// chronological order; the user action opens Your Record; toBeVisible() checks
// that the expected summary text is rendered; captureEvidence is shared project
// test infrastructure, not uniquely Epic 8 code.
// 中文：US8.1 / AC8.1.1-AC8.1.5。测试先创建非时间顺序的收入和支出；用户动作是打开“记录档案”；
// toBeVisible() 验证预期摘要文本已渲染；captureEvidence 是项目共享测试基础设施，不是 Epic 8 专属代码。
test('US8.1 summarises mixed dated income and expenses without using array order', async ({ page }) => {
  const { sourceId, categoryId, workCostCategoryId } = await defaultIds(page);
  await addIncome(page, sourceId, '2026-01-10', '1000.00');
  await addIncome(page, sourceId, '2026-02-10', '1200.00');
  await addExpense(page, categoryId, '2026-01-15', '20.00');
  await addExpense(page, categoryId, '2026-03-05', '30.00');
  await addWorkCost(page, workCostCategoryId, '2026-08-31', '99.00');

  await openApp(page);
  await openRecord(page);

  // EN: These locators assert the visible summary: distinct months, entry count,
  // latest income/expense business date, and browser/device account-scope copy.
  // 中文：这些 locator 验证可见摘要：去重月份数、记录条数、最新业务日期，以及浏览器/设备与账号范围说明。
  await expect(page.getByText('Financial record', { exact: true })).toBeVisible();
  await expect(page.getByLabel('3 months recorded')).toBeVisible();
  await expect(page.getByLabel('4 financial entries')).toBeVisible();
  await expect(page.getByText('Latest entry', { exact: true })).toBeVisible();
  await expect(page.getByText('5 Mar 2026', { exact: true })).toBeVisible();
  await expect(page.getByText('Your financial record may remain available on this browser/device. It is linked to an anonymous guest ID, not a RuMampu account.', { exact: true })).toBeVisible();
  await captureEvidence(page, 'epic-8', '01-record-mixed-summary.png');
});

// EN: US8.1 edge case: same-month income and expense entries are two individual
// entries but only one represented calendar month.
// 中文：US8.1 边界情况：同月的一笔收入和一笔支出算两条单笔记录，但只代表一个日历月份。
test('US8.1 counts one represented month with multiple same-month entries', async ({ page }) => {
  const { sourceId, categoryId } = await defaultIds(page);
  await addIncome(page, sourceId, '2026-04-02', '900.00');
  await addExpense(page, categoryId, '2026-04-25', '45.00');

  await openApp(page);
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
  await seedHousingReadyIncome(page);

  await openApp(page);
  await openRecord(page);
  await expect(page.getByText('No test kept yet', { exact: true })).toBeVisible();

  // EN: These clicks are user actions through the current UI. The housing engine
  // belongs to earlier epics; this test uses it only to reach a completed Result.
  // 中文：这些点击通过当前 UI 完成用户操作。住房计算引擎属于前面 epic；这里仅用它进入完成后的 Result 页。
  await page.getByRole('tab', { name: 'House', exact: true }).click();
  await page.getByPlaceholder('e.g. 250,000').fill('250000');
  await page.getByRole('button', { name: 'Run the test', exact: true }).click();

  await expect(page.getByRole('button', { name: 'Save test', exact: true })).toBeVisible();
  await expect(page.getByText('Add this result to Your record for this session.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save test', exact: true }).click();
  await expect(page.getByText('Name (saved for this session only)', { exact: true })).toBeVisible();
  await page.locator('input:visible').last().fill('Epic 8 session check');
  await page.getByRole('button', { name: 'Save test', exact: true }).last().click();
  await expect(page.getByText('Saved for this session in House › Saved tests.', { exact: true })).toBeVisible();
  await expect(page.getByText('Epic 8 session check', { exact: true })).toBeVisible();

  await openRecord(page);
  // EN: The kept card checks compact fields shown in the record, not the whole
  // backend result object or permanent saved-history behaviour.
  // 中文：留存卡片验证记录页展示的精简字段，不验证完整后端结果对象，也不验证永久历史保存。
  await expect(page.getByText('Kept tests', { exact: true })).toBeVisible();
  await expect(page.getByText(/\/ month/)).toBeVisible();
  await expect(page.getByText('Short months', { exact: true })).toBeVisible();
  await expect(page.getByText('Largest gap', { exact: true })).toBeVisible();
  await expect(page.getByText('Kept for this session.', { exact: true })).toHaveCount(1);
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
  await expect(page.getByText('Documents & financing', { exact: true })).toBeVisible();
  await expect(page.getByText('Coming soon', { exact: true })).toHaveCount(0);

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
