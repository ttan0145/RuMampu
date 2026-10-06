import { expect, Page } from '@playwright/test';
import { e2eGet, e2ePost, test } from './support/fixtures';
import { ac, deferredAc } from './support/acceptance';
import { API, captureEvidence, openGuestApp, pinGuestClientId, reloadApp } from './support/app';

/* Epic 5 — Homeownership Preparation (US5.1 to US5.4, 36 acceptance criteria, v5).

   Data strategy
   - The upfront-cash figures are worked out from the price and deposit the user
     types on the house screen, so US5.2 needs no housing-test run. "You have" is
     the one pot: the cash the user enters on Upfront cash, plus what the saving
     plan has added and what finished months moved in. Most checks use an account
     so the entered cash can be read back from the server and after a reload.
   - The cash buffer comes from the server-calculated housing test, so US5.3
     starts from the deterministic twelve-month gig-driver scenario (Aug 2025 to
     Jul 2026, recorded pre-housing residuals of RM 1,620 / 2,050 / 1,750 / 2,230
     / 3,110 / 1,220 / 640 / 2,470 / 1,460 / 2,250 / 1,760 / 2,390).
   - Amounts below are fixed values. Published-scale arithmetic is pinned
     separately in epic5-upfront-fees.spec.ts, and the buffer arithmetic in the
     backend housing tests. Nothing here re-implements either algorithm. */

// EN: Shared colour tokens (theme.ts): C.ink #3C5152 and C.short #F1592A.
const INK = 'rgb(60, 81, 82)';
const SHORT = 'rgb(241, 89, 42)';

const PREPARE_ROWS = ['Upfront cash', 'Cash buffer', 'Documents & financing'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

test.setTimeout(120_000);

function uniqueEmail(): string {
  return `epic5-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

/* The day the app stamps on cash the user reports (their local date), as the
   screen shows it and as the server stores it. */
function todayLabel(): string {
  const now = new Date();
  return `${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
}

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function rmText(amount: number): string {
  return `RM ${amount.toLocaleString('en-MY')}`;
}

/* Signs in to a fresh account, optionally already holding some cash on hand. The
   account is seeded through the API; the app is then used through its real login
   screen. Returns the API token so a test can read the account back. */
async function signInWithCash(page: Page, cashOnHand: number): Promise<{ token: string }> {
  const email = uniqueEmail();
  const password = 'Passw0rd123';
  const registered = await page.request.post(`${API}/auth/register/`, { data: { email, password } });
  expect(registered.status(), await registered.text()).toBe(201);
  const { token } = await registered.json();
  const saved = await page.request.patch(`${API}/auth/me/`, {
    headers: { Authorization: `Token ${token}` },
    data: {
      preferred_language: 'en',
      onboarding_completed: true,
      ...(cashOnHand > 0 ? { cash_on_hand: cashOnHand } : {}),
    },
  });
  expect(saved.status(), await saved.text()).toBe(200);

  await page.goto('/');
  const splash = page.getByLabel('RuMampu');
  if (await splash.isVisible().catch(() => false)) await splash.click({ force: true });
  await page.getByPlaceholder('name@example.com').fill(email);
  await page.getByPlaceholder('Your password').fill(password);
  const loggedIn = page.waitForResponse(response =>
    response.request().method() === 'POST' && response.url().endsWith('/api/v1/auth/login/'));
  await page.getByText('Log in', { exact: true }).last().click();
  expect((await loggedIn).status()).toBe(200);
  await page.getByRole('tab', { name: 'Home', exact: true }).click({ trial: true, timeout: 90_000 });
  await expect(page.getByPlaceholder('Your password')).toHaveCount(0);
  await expect(page.getByText('Getting RuMampu ready', { exact: true })).toHaveCount(0, { timeout: 90_000 });
  return { token };
}

/* A returning account: reload, wait for Home and for the record to finish loading. */
async function reloadAccountApp(page: Page): Promise<void> {
  await reloadApp(page);
  await expect(page.getByText('Getting RuMampu ready', { exact: true })).toHaveCount(0, { timeout: 90_000 });
}

/* Seeds twelve recorded months, then onboards as a guest. The guest sign-in
   rotates the client id, so it is pinned to the seeded one first. */
async function startWithTwelveMonths(page: Page): Promise<void> {
  await pinGuestClientId(page);
  const loaded = await e2ePost(page, `${API}/dev/scenarios/my-gig-driver-12m/load/`, { data: { confirm_reset: true } });
  expect(loaded.status()).toBe(201);
  await openGuestApp(page);
}

async function back(page: Page): Promise<void> {
  await page.getByLabel('Back').click();
}

async function openPrepare(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'House', exact: true }).click();
  await page.getByText('Prepare for a house', { exact: true }).click();
  await expectPrepareRows(page);
}

async function expectPrepareRows(page: Page): Promise<void> {
  for (const row of PREPARE_ROWS) await expect(page.getByText(row, { exact: true })).toBeVisible();
}

/* Types the price and picks a deposit on the house screen. The upfront-cash
   figures are read from these two values. */
async function enterHouse(page: Page, price: number, deposit: '0%' | '10%' | '20%'): Promise<void> {
  await page.getByRole('tab', { name: 'House', exact: true }).click();
  await page.getByText('Test a house', { exact: true }).click();
  await page.locator('input:visible').nth(0).fill(String(price));
  await page.getByText('The house', { exact: true }).click();
  await page.getByText(deposit, { exact: true }).click();
}

async function openUpfrontCash(page: Page): Promise<void> {
  await openPrepare(page);
  await page.getByText('Upfront cash', { exact: true }).click();
  await expect(page.getByText('You need', { exact: true })).toBeVisible();
}

/* The You have / You need / Gap rows: label on the left, figure and tag beside it. */
function figureRow(page: Page, label: string) {
  return page.getByText(label, { exact: true }).locator('xpath=..');
}

/* The (i) beside "What you pay, in the usual order", which carries the published sources. */
async function openCostSources(page: Page): Promise<void> {
  await page.getByText('What you pay, in the usual order', { exact: true }).locator('xpath=..')
    .getByLabel('What this is').click();
}

/* Runs the housing test from a monthly payment the user already knows. */
async function runKnownPaymentTest(page: Page, payment: number): Promise<void> {
  await page.getByRole('tab', { name: 'House', exact: true }).click();
  await page.getByText('Test a house', { exact: true }).click();
  // The link is only there while the form works from a price.
  const known = page.getByText('I already know my monthly payment', { exact: true });
  if (await known.isVisible().catch(() => false)) await known.click();
  await page.locator('input:visible').nth(0).fill(String(payment));
  await page.getByText('Monthly payment (RM)', { exact: true }).click();
  await page.getByText('Run the test', { exact: true }).last().click();
  await expect(page.getByText(/months would run short|All \d+ months would carry it/)).toBeVisible();
}

/* Runs the housing test from a property price, leaving the known-payment form. */
async function runPriceTest(page: Page, price: number): Promise<void> {
  await page.getByRole('tab', { name: 'House', exact: true }).click();
  await page.getByText('Test a house', { exact: true }).click();
  // The link is only there while the form works from a known monthly payment.
  const fromPrice = page.getByText('Work it out from the price instead', { exact: true });
  const priceLabel = page.getByText('Property price', { exact: true });
  await expect(priceLabel.or(fromPrice).first()).toBeVisible();
  if (await fromPrice.isVisible()) await fromPrice.click();
  await expect(priceLabel).toBeVisible();
  await page.locator('input:visible').nth(0).fill(String(price));
  await page.getByText('The house', { exact: true }).click();
  await page.getByText('Run the test', { exact: true }).last().click();
  await expect(page.getByText(/months would run short|All \d+ months would carry it/)).toBeVisible();
}

async function openCashBuffer(page: Page): Promise<void> {
  await openPrepare(page);
  await page.getByText('Cash buffer', { exact: true }).click();
  await expect(page.getByText('Running balance by month', { exact: true }).or(
    page.getByText('Run the housing test first so this screen can use the server-calculated result.', { exact: true }),
  )).toBeVisible();
}

/* Keeps an affordable RM 80,000 test, which opens the saving plan on Home. */
async function keepAffordableTest(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'House', exact: true }).click();
  await page.getByText('Test a house', { exact: true }).click();
  await expect(page.getByText('Property price', { exact: true })).toBeVisible();
  await page.locator('input:visible').nth(0).fill('80000');
  await page.getByText('The house', { exact: true }).click();
  await page.getByText('Run the test', { exact: true }).last().click();
  await expect(page.getByText(/All 12 months would carry it/)).toBeVisible();
  await page.getByText('Save test', { exact: true }).click();
  await expect(page.getByText('Name this test', { exact: true })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Save test', exact: true }).click();
  await expect(page.getByText('Saved tests', { exact: true }).first()).toBeVisible();
  await page.getByRole('tab', { name: 'Home', exact: true }).click();
  await expect(page.getByText('Save today', { exact: true })).toBeVisible();
}

/* Runs a price test and keeps it, which opens the saving plan on Home. */
async function keepPriceTest(page: Page, price: number): Promise<void> {
  await runPriceTest(page, price);
  await page.getByText('Save test', { exact: true }).click();
  await expect(page.getByText('Name this test', { exact: true })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Save test', exact: true }).click();
  await expect(page.getByText('Saved tests', { exact: true }).first()).toBeVisible();
  await page.getByRole('tab', { name: 'Home', exact: true }).click();
  await expect(page.getByText('Save today', { exact: true })).toBeVisible();
}

async function openSavingPlan(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Home', exact: true }).click();
  await page.getByText(/^Saving plan · /).click();
  await expect(page.getByTestId('plan-pot-total')).toBeVisible();
}

/* What the saving plan has recorded as saved, read from the snapshot the app keeps
   in the browser (written shortly after each change, so the read polls). */
async function savedByPlan(page: Page, days: number): Promise<number> {
  const read = async () => {
    const raw = await page.evaluate(() => window.localStorage.getItem('rumampu_local_state'));
    const plan = (JSON.parse(raw || '{}') as { plan?: { amounts: number[]; done: boolean[] } | null }).plan;
    return plan ?? null;
  };
  await expect.poll(async () => (await read())?.done.filter(Boolean).length ?? 0).toBe(days);
  const plan = (await read())!;
  return plan.amounts.reduce((sum, amount, index) => sum + (plan.done[index] ? amount : 0), 0);
}

function parseRm(text: string): number {
  const match = /RM\s*(-?[\d,]+(?:\.\d+)?)/.exec(text);
  if (!match) throw new Error(`No RM amount in "${text}"`);
  return Number(match[1].replace(/,/g, ''));
}

/* AC5.3.7: where the zero line sits in the running-balance plot, and whether any
   bar spills out of it. `high` and `low` are the highest and lowest monthly balance. */
async function expectZeroLine(page: Page, balances: { high: number; low: number }): Promise<void> {
  const high = Math.max(0, balances.high);
  const low = Math.min(0, balances.low);
  const span = high - low;
  const plot = (await page.getByTestId('buffer-plot').boundingBox())!;
  const expectedZero = span > 0 ? (high / span) * plot.height : plot.height / 2;
  // The line's own border is drawn to whole pixels, so its edge is read to within 1 px.
  await expect.poll(async () => {
    const line = await page.getByTestId('buffer-zero-line').boundingBox();
    return line ? Math.abs(line.y + line.height - plot.y - expectedZero) : Number.POSITIVE_INFINITY;
  }).toBeLessThanOrEqual(1);

  let top = Number.POSITIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const bar of await page.locator('[data-testid^="buffer-bar-"]').all()) {
    const box = (await bar.boundingBox())!;
    top = Math.min(top, box.y - plot.y);
    bottom = Math.max(bottom, box.y + box.height - plot.y);
  }
  // No bar is clipped by the plot...
  expect(top).toBeGreaterThanOrEqual(-0.5);
  expect(bottom).toBeLessThanOrEqual(plot.height + 0.5);
  // ...and none of the plot is wasted: the extreme bars reach its edges.
  if (high > 0) expect(top).toBeLessThan(0.5);
  if (low < 0) expect(bottom).toBeGreaterThan(plot.height - 0.5);
}

test.describe('Epic 5 — Homeownership Preparation', { tag: '@epic5' }, () => {
  test('US5.1 — Access homeownership preparation tools', { tag: '@us5.1' }, async ({ page }) => {
    // An account that already holds RM 8,000, so the House card can show what is set aside.
    await signInWithCash(page, 8000);
    await page.getByRole('tab', { name: 'House', exact: true }).click();
    await page.getByText('Prepare for a house', { exact: true }).click();

    await ac('AC5.1.1', 'Show Upfront cash', async () => {
      await expect(page.getByText('Upfront cash', { exact: true })).toBeVisible();
    });

    await ac('AC5.1.2', 'Show Cash buffer', async () => {
      await expect(page.getByText('Cash buffer', { exact: true })).toBeVisible();
    });

    await ac('AC5.1.3', 'Show Documents & financing', async () => {
      await expect(page.getByText('Documents & financing', { exact: true })).toBeVisible();
      await captureEvidence(page, 'epic-5', 'ac5.1__prepare-options.png');
    });

    await ac('AC5.1.4', 'Navigate to preparation tools', async () => {
      // Each option opens its own screen, recognised by content that only that screen shows.
      await page.getByText('Upfront cash', { exact: true }).click();
      await expect(page.getByText('You need', { exact: true })).toBeVisible();
      await expect(page.getByText('You have', { exact: true })).toBeVisible();
      await back(page);
      await expectPrepareRows(page);

      await page.getByText('Cash buffer', { exact: true }).click();
      await expect(page.getByText(
        'Run the housing test first so this screen can use the server-calculated result.',
        { exact: true },
      )).toBeVisible();
      await back(page);
      await expectPrepareRows(page);

      await page.getByText('Documents & financing', { exact: true }).click();
      await expect(page.getByText(/^☐ Bank statements, 6 months$/)).toBeVisible();
      await back(page);
      await expectPrepareRows(page);
    });

    await ac('AC5.1.5', 'Show what is set aside so far', async () => {
      // RM 8,000 held against the RM 44,125 a RM 300,000 home needs.
      await enterHouse(page, 300000, '10%');
      await back(page);
      await expect(page.getByText('RM 8,000 of RM 44,125 set aside', { exact: true })).toBeVisible();
      await captureEvidence(page, 'epic-5', 'ac5.1.5__set-aside-card.png');

      // With nothing entered, the card says nothing is set aside yet.
      await openUpfrontCash(page);
      await page.getByLabel('Cash I already have').fill('');
      await page.getByRole('tab', { name: 'House', exact: true }).click();
      await expect(page.getByText('Nothing set aside yet', { exact: true })).toBeVisible();
    });
  });

  test('US5.2 — Check upfront cash readiness', { tag: '@us5.2' }, async ({ page }) => {
    // RM 300,000 with a 10% deposit: deposit 30,000 + transfer duty 5,000 + loan duty 1,350
    // + legal fees 3,750 and 3,375 + valuation 650 = RM 44,125 needed against RM 8,000 held.
    await signInWithCash(page, 8000);
    await enterHouse(page, 300000, '10%');
    await back(page);
    await openUpfrontCash(page);

    await ac('AC5.2.1', 'Display cash available', async () => {
      await expect(figureRow(page, 'You have')).toContainText('RM 8,000');
    });

    await ac('AC5.2.2', 'Identify cash available as user data', async () => {
      await expect(figureRow(page, 'You have')).toContainText('YOUR DATA');
    });

    await ac('AC5.2.3', 'Display cash required', async () => {
      await expect(figureRow(page, 'You need')).toContainText('RM 44,125');
      await expect(figureRow(page, 'You need')).toContainText('CALCULATED');
    });

    await ac('AC5.2.4', 'Display upfront gap', async () => {
      await expect(figureRow(page, 'Gap')).toContainText('RM 36,125');
      await expect(figureRow(page, 'Gap')).toContainText('CALCULATED');
    });

    await ac('AC5.2.5', 'Visualise available versus required', async () => {
      await expect(page.getByRole('img', { name: 'You have RM 8,000 of the RM 44,125 needed.' })).toBeVisible();
      // The chart ceiling is 112% of the larger figure, so the 120 px plot shows
      // RM 8,000 as 8,000 / (44,125 x 1.12) of its height.
      await expect.poll(async () => (await page.getByTestId('upfront-available').boundingBox())?.height ?? 0)
        .toBeCloseTo(19.43, 0);
    });

    await ac('AC5.2.6', 'Highlight an upfront shortfall', async () => {
      const gap = page.getByTestId('upfront-gap');
      await expect(gap).toBeVisible();
      await expect(gap).toHaveCSS('background-color', SHORT);
      await expect(page.getByTestId('upfront-available')).toHaveCSS('background-color', INK);
      // The gap is the stretch between the cash bar and the requirement line.
      await expect.poll(async () => (await gap.boundingBox())?.height ?? 0).toBeCloseTo(87.71, 0);
      const cash = await page.getByTestId('upfront-available').boundingBox();
      const shortfall = await gap.boundingBox();
      expect(Math.abs(shortfall!.y + shortfall!.height - cash!.y)).toBeLessThan(1);
    });

    await ac('AC5.2.7', 'Display upfront cost components', async () => {
      const components: [string, string, string, string][] = [
        ['baldp', 'Balance of the down payment', 'RM 30,000', 'CALCULATED'],
        ['spa', 'Sale agreement legal fees', 'RM 3,750', 'OFFICIAL'],
        ['stampT', 'Stamp duty (transfer)', 'RM 5,000', 'OFFICIAL'],
        ['loanlegal', 'Loan agreement legal fees', 'RM 3,375', 'OFFICIAL'],
        ['stampL', 'Stamp duty (loan)', 'RM 1,350', 'OFFICIAL'],
        ['val', 'Valuation', 'RM 650', 'ASSUMPTION'],
      ];
      let listed = 0;
      for (const [id, label, amount, tag] of components) {
        const row = page.getByTestId(`upfront-row-${id}`);
        await expect(row).toContainText(label);
        await expect(row).toContainText(amount);
        await expect(row).toContainText(tag);
        listed += parseRm(amount);
      }
      // The listed items add up to the amount the screen says is needed.
      expect(listed).toBe(parseRm(await figureRow(page, 'You need').innerText()));
      await captureEvidence(page, 'epic-5', 'ac5.2__upfront-cash.png');
    });

    await ac('AC5.2.8', 'Handle a zero deposit', async () => {
      await enterHouse(page, 300000, '0%');
      await back(page);
      await openUpfrontCash(page);
      await expect(page.getByText('Deposit RM 0: upfront cash is fees and setting up, not the deposit.', { exact: true }))
        .toBeVisible();
      // With no deposit the requirement is still the fees: 5,000 + 1,500 + 3,750 + 3,750 + 650.
      await expect(figureRow(page, 'You need')).toContainText('RM 14,650');
      await captureEvidence(page, 'epic-5', 'ac5.2.8__zero-deposit.png');
    });
  });

  test('US5.2 — Enter the cash I have and read how the list is built', { tag: '@us5.2' }, async ({ page }) => {
    // A new account with no cash yet, and a RM 300,000 home with a 10% deposit (RM 44,125 needed).
    const { token } = await signInWithCash(page, 0);
    await enterHouse(page, 300000, '10%');
    await back(page);
    await openUpfrontCash(page);
    const account = async () => (await (await page.request.get(`${API}/auth/me/`, {
      headers: { Authorization: `Token ${token}` },
    })).json()) as { cash_on_hand: number; cash_on_hand_date: string | null };
    const cashField = page.getByLabel('Cash I already have', { exact: true });

    await ac('AC5.2.9', 'Enter available upfront cash', async () => {
      // RuMampu fills nothing in: the field starts empty and "You have" starts at RM 0.
      await expect(cashField).toHaveValue('');
      await expect(figureRow(page, 'You have')).toContainText('RM 0');

      const saved = page.waitForResponse(response =>
        response.request().method() === 'PATCH'
        && response.url().endsWith('/api/v1/auth/me/')
        && (response.request().postData() ?? '').includes('"cash_on_hand":12000'));
      await cashField.click();
      await cashField.pressSequentially('12000', { delay: 25 });
      await expect(cashField).toBeFocused();
      await expect(cashField).toHaveValue('12000');
      expect((await saved).status()).toBe(200);

      // The amount is in "You have" and the gap, marked as my data, and the server holds it.
      await expect(figureRow(page, 'You have')).toContainText('RM 12,000');
      await expect(figureRow(page, 'Gap')).toContainText('RM 32,125');
      await expect(page.getByTestId('upfront-row-cash')).toContainText('YOUR DATA');
      expect((await account()).cash_on_hand).toBe(12000);
    });

    await ac('AC5.2.10', 'Record the cash snapshot date', async () => {
      // The day it was reported is shown beside the amount, and the server keeps it.
      await expect(page.getByTestId('upfront-row-cash')).toContainText(`Reported on ${todayLabel()}`);
      expect((await account()).cash_on_hand_date).toBe(todayIso());
      await captureEvidence(page, 'epic-5', 'ac5.2.9-10__cash-i-already-have.png');

      // Coming back later, the amount and its date are still there.
      await reloadAccountApp(page);
      await openUpfrontCash(page);
      await expect(cashField).toHaveValue('12000');
      await expect(page.getByTestId('upfront-row-cash')).toContainText(`Reported on ${todayLabel()}`);
      await expect(figureRow(page, 'You have')).toContainText('RM 12,000');

      // The house price is not kept across a reload, so put it back for the checks below.
      await enterHouse(page, 300000, '10%');
      await back(page);
      await openUpfrontCash(page);
      await expect(figureRow(page, 'You need')).toContainText('RM 44,125');
    });

    await ac('AC5.2.11', 'Group the costs by when they fall due', async () => {
      // Headings and the rows under them run down the screen in this order.
      const order = [
        'To sign', 'Earnest deposit',
        'To complete', 'Balance of the down payment', 'Stamp duty (loan)', 'Mortgage insurance',
        'To move in', 'Utility deposits', 'Maintenance or strata deposit', 'Furnishing the basics',
      ];
      const tops: number[] = [];
      for (const text of order) tops.push((await page.getByText(text, { exact: true }).boundingBox())!.y);
      expect(tops).toEqual([...tops].sort((a, b) => a - b));
      expect(new Set(tops).size).toBe(order.length);
    });

    await ac('AC5.2.16', 'Ask for the figures that have no published scale', async () => {
      // Each starts empty with an example behind it, and none adds a figure of its own.
      const unscaled: [string, string][] = [
        ['Earnest deposit', '5000'],
        ['Mortgage insurance', '12000'],
        ['Utility deposits', '900'],
        ['Maintenance or strata deposit', '1200'],
        ['Furnishing the basics', '6000'],
      ];
      for (const [label, example] of unscaled) {
        const field = page.getByLabel(label, { exact: true });
        await expect(field).toHaveValue('');
        await expect(field).toHaveAttribute('placeholder', `e.g. ${example}`);
      }
      await expect(figureRow(page, 'You need')).toContainText('RM 44,125');
    });

    await ac('AC5.2.12', 'Treat the earnest deposit as part of the deposit', async () => {
      await page.getByLabel('Earnest deposit', { exact: true }).fill('5000');
      // The balance of the down payment is the deposit less the earnest deposit (30,000 - 5,000)...
      await expect(page.getByTestId('upfront-row-baldp')).toContainText('RM 25,000');
      // ...and the total does not move.
      await expect(figureRow(page, 'You need')).toContainText('RM 44,125');
      await expect(figureRow(page, 'Gap')).toContainText('RM 32,125');
    });

    await ac('AC5.2.13', 'Work out the legal fees from the published scale', async () => {
      // 1.25% of the RM 300,000 price and of the RM 270,000 loan, both labelled official.
      await expect(page.getByTestId('upfront-row-spa')).toContainText('RM 3,750');
      await expect(page.getByTestId('upfront-row-spa')).toContainText('OFFICIAL');
      await expect(page.getByTestId('upfront-row-loanlegal')).toContainText('RM 3,375');
      await expect(page.getByTestId('upfront-row-loanlegal')).toContainText('OFFICIAL');
      // The source is named.
      await openCostSources(page);
      await expect(page.getByText(/Source: Solicitors.{1,2} Remuneration Order 2023, P\.U\. \(A\) 207\/2023/)).toBeVisible();
      await page.getByText('Done', { exact: true }).click();
    });

    await ac('AC5.2.14', 'Work out stamp duty from the published scale', async () => {
      await expect(page.getByTestId('upfront-row-stampT')).toContainText('RM 5,000');
      await expect(page.getByTestId('upfront-row-stampT')).toContainText('OFFICIAL');
      await expect(page.getByTestId('upfront-row-stampL')).toContainText('RM 1,350');
      await expect(page.getByTestId('upfront-row-stampL')).toContainText('OFFICIAL');
      await openCostSources(page);
      await expect(page.getByText(/Source: Stamp Act 1949 \(Act 378\), First Schedule items 32\(a\) and 27\(a\)/)).toBeVisible();
      await page.getByText('Done', { exact: true }).click();
    });

    await ac('AC5.2.15', 'Apply the first-home exemption as a switch I control', async () => {
      const exemption = page.getByRole('switch', { name: /first home/i });
      await expect(exemption).toHaveAttribute('aria-checked', 'false');
      const box = await exemption.boundingBox();
      await exemption.click({ position: { x: box!.width - 24, y: box!.height / 2 } });
      await expect(exemption).toHaveAttribute('aria-checked', 'true');
      // RM 300,000 is within the RM 500,000 limit: both duties are RM 0 and say why.
      for (const id of ['stampT', 'stampL']) {
        await expect(page.getByTestId(`upfront-row-${id}`)).toContainText('RM 0');
        await expect(page.getByTestId(`upfront-row-${id}`)).toContainText('Exempt, first home RM 500,000 or less');
      }

      // At RM 600,000 the switch is still on, but both duties show in full and the note says why.
      await enterHouse(page, 600000, '10%');
      await back(page);
      await openUpfrontCash(page);
      await expect(page.getByRole('switch', { name: /first home/i })).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByTestId('upfront-row-stampT')).toContainText('RM 12,000');
      await expect(page.getByTestId('upfront-row-stampL')).toContainText('RM 2,700');
      for (const id of ['stampT', 'stampL']) {
        await expect(page.getByTestId(`upfront-row-${id}`)).toContainText('Above RM 500,000, so the exemption does not apply');
      }
    });
  });

  test('US5.2 — "You have" is one pot, stated once', { tag: '@us5.2' }, async ({ page }) => {
    // A kept RM 80,000 test needs RM 3,600 with no deposit. The pot is the RM 1,000 entered
    // plus whatever one saved day in the plan adds.
    await startWithTwelveMonths(page);
    await keepAffordableTest(page);
    await page.getByText('Save today', { exact: true }).click();
    const planAdded = await savedByPlan(page, 1);
    expect(planAdded).toBeGreaterThan(0);
    await openUpfrontCash(page);
    await page.getByLabel('Cash I already have', { exact: true }).fill('1000');

    await ac('AC5.2.17', 'State the pot once', async () => {
      const pot = 1000 + planAdded;
      const gap = Math.max(0, 3600 - pot);
      // "You have" appears once, and it is the whole pot.
      await expect(page.getByText('You have', { exact: true })).toHaveCount(1);
      await expect(figureRow(page, 'You have')).toContainText(rmText(pot));

      // Its working names each part once, and the parts sum to the pot.
      await figureRow(page, 'You have').getByLabel('How this adds up').click();
      await expect(page.getByText('What I already had', { exact: true }).locator('xpath=..')).toContainText('RM 1,000');
      await expect(page.getByText('What the plan has added', { exact: true }).locator('xpath=..')).toContainText(rmText(planAdded));
      await expect(page.getByText('Moved in from finished months', { exact: true }).locator('xpath=..')).toContainText('RM 0');
      await expect(page.getByText('In the pot', { exact: true }).locator('xpath=..')).toContainText(rmText(pot));
      await captureEvidence(page, 'epic-5', 'ac5.2.17__pot-adds-up.png');
      await page.getByText('Done', { exact: true }).click();

      // The gap is what I need less what I have, here and on Home (this test needs no buffer).
      await expect(figureRow(page, 'Gap')).toContainText(rmText(gap));
      await page.getByRole('tab', { name: 'Home', exact: true }).click();
      await expect(page.getByText(`${rmText(gap)} more to go for your safety buffer and upfront cash`, { exact: true })).toBeVisible();
    });
  });

  test('TECH-5.2 — Edits recalculate the need and gap, and a covered need shows no gap', { tag: '@hardening' }, async ({ page }) => {
    await signInWithCash(page, 8000);
    await enterHouse(page, 80000, '0%');
    await back(page);
    await openUpfrontCash(page);

    // RM 80,000, no deposit: duty 800 + 400, legal 1,000 + 1,000, valuation 400 = RM 3,600.
    await expect(figureRow(page, 'You need')).toContainText('RM 3,600');
    await expect(figureRow(page, 'Gap')).toContainText('RM 0');
    await expect(page.getByTestId('upfront-gap')).toHaveCount(0);

    // A figure the user enters is added to the need and is tagged as theirs.
    await page.getByLabel('Mortgage insurance').fill('6000');
    await expect(figureRow(page, 'You need')).toContainText('RM 9,600');
    await expect(figureRow(page, 'Gap')).toContainText('RM 1,600');
    await expect(page.getByTestId('upfront-gap')).toBeVisible();
    await expect(page.getByRole('img', { name: 'You have RM 8,000 of the RM 9,600 needed.' })).toBeVisible();

    // The first-home exemption removes both stamp duties and the need falls with it.
    const exemption = page.getByRole('switch', { name: /first home/i });
    const box = await exemption.boundingBox();
    await exemption.click({ position: { x: box!.width - 24, y: box!.height / 2 } });
    await expect(figureRow(page, 'You need')).toContainText('RM 8,400');
    await expect(page.getByTestId('upfront-row-stampT')).toContainText('Exempt, first home RM 500,000 or less');
    await expect(page.getByTestId('upfront-row-stampT')).toContainText('RM 0');
  });

  test('US5.3 — Estimate a cash buffer from recorded short months', { tag: '@us5.3' }, async ({ page }) => {
    // A RM 1,670 payment plus the default RM 230 of other costs is RM 1,900 a month. The
    // running balance falls from RM 1,260 in December to RM -680 in February, so the
    // buffer is RM 1,940 (ADR 0005); counting only from August would have said RM 680.
    await startWithTwelveMonths(page);
    await runKnownPaymentTest(page, 1670);
    await openCashBuffer(page);

    const balances: [string, string, string, string][] = [
      ['2025-08', 'Aug 2025: running balance RM -280', 'AUG', SHORT],
      ['2025-09', 'Sep 2025: running balance RM -130', 'SEP', SHORT],
      ['2025-10', 'Oct 2025: running balance RM -280', 'OCT', SHORT],
      ['2025-11', 'Nov 2025: running balance RM 50', 'NOV', INK],
      ['2025-12', 'Dec 2025: running balance RM 1,260', 'DEC', INK],
      ['2026-01', 'Jan 2026: running balance RM 580', 'JAN', INK],
      ['2026-02', 'Feb 2026: running balance RM -680', 'FEB', SHORT],
      ['2026-03', 'Mar 2026: running balance RM -110', 'MAR', SHORT],
      ['2026-04', 'Apr 2026: running balance RM -550', 'APR', SHORT],
      ['2026-05', 'May 2026: running balance RM -200', 'MAY', SHORT],
      ['2026-06', 'Jun 2026: running balance RM -340', 'JUN', SHORT],
      ['2026-07', 'Jul 2026: running balance RM 150', 'JUL', INK],
    ];

    await ac('AC5.3.1', 'Display cash-buffer amount', async () => {
      await expect(page.getByText('RM 1,940', { exact: true })).toBeVisible();
      // The same figure comes straight from the server's housing test.
      const scenarios = await (await e2eGet(page, `${API}/housing/scenarios/`)).json();
      const scenario = scenarios.find((item: { known_monthly_payment: string | null }) =>
        Number(item.known_monthly_payment) === 1670);
      expect(scenario).toBeTruthy();
      const result = await (await e2ePost(page, `${API}/housing/test-result/`, { data: { scenario_id: scenario.id } })).json();
      expect(result.starting_liquidity.required_amount).toBe(1940);
      expect(result.starting_liquidity.fall_start).toEqual({ year: 2025, month: 12 });
      expect(result.starting_liquidity.fall_end).toEqual({ year: 2026, month: 2 });
      expect(result.starting_liquidity.months.map((row: { closing_balance: number }) => row.closing_balance))
        .toEqual([-280, -130, -280, 50, 1260, 580, -680, -110, -550, -200, -340, 150]);
    });

    await ac('AC5.3.2', 'Explain what the buffer represents', async () => {
      await expect(page.getByText(
        'The smallest amount you’d have needed at the start to get through the short months in your record without going below zero, whichever month you had started in.',
        { exact: true },
      )).toBeVisible();
    });

    await ac('AC5.3.8', 'Mark where the deepest fall starts and ends', async () => {
      // The figure is traced to the bars: the biggest drop, from the December high to the February low.
      await expect(page.getByTestId('buffer-fall-text')).toHaveText('The biggest drop ran from Dec 2025 to Feb 2026.');
      const box = async (id: string) => (await page.getByTestId(id).boundingBox())!;
      const fall = await box('buffer-fall');
      const [dec, jan, feb, mar] = await Promise.all(
        ['2025-12', '2026-01', '2026-02', '2026-03'].map(month => box(`buffer-bar-${month}`)),
      );
      // The shaded months are January and February, and neither December nor March.
      expect(fall.x).toBeLessThanOrEqual(jan.x);
      expect(fall.x + fall.width).toBeGreaterThanOrEqual(feb.x + feb.width);
      expect(fall.x).toBeGreaterThanOrEqual(dec.x + dec.width);
      expect(fall.x + fall.width).toBeLessThanOrEqual(mar.x);
    });

    await ac('AC5.3.3', 'Display running balance by month', async () => {
      await expect(page.getByText('Running balance by month', { exact: true })).toBeVisible();
      await expect(page.locator('[data-testid^="buffer-bar-"]')).toHaveCount(12);
      for (const [month, label, abbreviation, colour] of balances) {
        await expect(page.getByLabel(label, { exact: true })).toBeVisible();
        await expect(page.getByTestId(`buffer-bar-${month}`)).toHaveCSS('background-color', colour);
        const monthLabel = page.getByText(abbreviation, { exact: true });
        await expect(monthLabel).toBeVisible();
        // Each abbreviation stays on one line under its bar (a wrapped one is about 26 px tall).
        await expect.poll(async () => (await monthLabel.boundingBox())?.height ?? 0).toBeLessThan(16);
      }
      // The amount and the chart are both marked as calculated.
      await expect(page.getByText(/CALCULATED$/)).toHaveCount(2);
      await captureEvidence(page, 'epic-5', 'ac5.3__cash-buffer.png');
    });

    await ac('AC5.3.4', 'State record basis', async () => {
      await page.getByLabel('What this is').click();
      // The period is read from the recorded months, August 2025 to July 2026.
      await expect(page.getByText('From your own record, Aug to Jul. Not a general rule.', { exact: true })).toBeVisible();
    });

    await ac('AC5.3.5', 'State that it is not a general rule', async () => {
      await expect(page.getByText(/Not a general rule\./)).toBeVisible();
      await page.getByText('Done', { exact: true }).click();
      await expect(page.getByText(/Not a general rule\./)).toHaveCount(0);
      // No one-size-fits-all benchmark appears next to the personal figure.
      await expect(page.getByText(/three to six months|3 to 6 months|3-6 months|six months of/i)).toHaveCount(0);
    });

    await ac('AC5.3.6', 'Explain the displayed buffer result', async () => {
      // Figure first, then what it represents.
      await expect(page.getByText('RM 1,940', { exact: true })).toBeVisible();
      await expect(page.getByText(/^The smallest amount you’d have needed/)).toBeVisible();

      // Every recorded month carries a RM 80,000 house, so the balance never falls, and the screen says so.
      await runPriceTest(page, 80000);
      await openCashBuffer(page);
      await expect(page.getByText('RM 0', { exact: true })).toBeVisible();
      await expect(page.getByText(
        'With this house, your recorded months never went below zero. The figure works out to RM 0.',
        { exact: true },
      )).toBeVisible();
      await expect(page.getByTestId('buffer-fall-text')).toHaveCount(0);
      await expect(page.getByTestId('buffer-fall')).toHaveCount(0);
      await captureEvidence(page, 'epic-5', 'ac5.3.6__zero-buffer.png');
    });

    await ac('AC5.3.7', 'Place the zero line where zero falls', async () => {
      // Every month above zero (a RM 250,000 house, highest RM 6,361.56):
      // the line sits on the floor of the plot and the tallest bar fills it.
      await runPriceTest(page, 250000);
      await openCashBuffer(page);
      await expectZeroLine(page, { high: 6361.56, low: 0 });
      await captureEvidence(page, 'epic-5', 'ac5.3.7__zero-line-all-above.png');

      // Every month below zero (RM 2,300 a month, lowest RM -4,740): the line sits at the top.
      await runKnownPaymentTest(page, 2070);
      await openCashBuffer(page);
      await expectZeroLine(page, { high: 0, low: -4740 });
      await captureEvidence(page, 'epic-5', 'ac5.3.7__zero-line-all-below.png');

      // Months on both sides (RM 1,900 a month, RM 1,260 down to RM -680): the line sits between.
      await runKnownPaymentTest(page, 1670);
      await openCashBuffer(page);
      await expectZeroLine(page, { high: 1260, low: -680 });
    });

    await ac('AC5.3.9', 'Say when the months do not catch up', async () => {
      // RM 1,900 a month ends the year RM 150 up, so nothing is said.
      await expect(page.getByTestId('buffer-short')).toHaveCount(0);
      // RM 2,300 a month ends it RM 4,650 down: the shortfall is stated in ringgit, with no verdict.
      await runKnownPaymentTest(page, 2070);
      await openCashBuffer(page);
      await expect(page.getByTestId('buffer-short')).toHaveText(
        'Over these 12 months, what was left fell short by RM 4,650 in total. A one-off buffer would not cover another year like this one.');
      await expect(page.getByText(/can(not|'t)? afford/i)).toHaveCount(0);
      await captureEvidence(page, 'epic-5', 'ac5.3.9__months-do-not-catch-up.png');
    });
  });

  test('US5.4 — Review financing preparation documents', { tag: '@us5.4' }, async ({ page }) => {
    await openGuestApp(page);
    await openPrepare(page);
    await page.getByText('Documents & financing', { exact: true }).click();

    const documents = [
      'Bank statements, 6 months',
      'E-hailing earnings summary',
      'Statutory declaration of income',
      'EPF statement',
      'List of existing commitments',
    ];

    await ac('AC5.4.1', 'Display document checklist', async () => {
      await expect(page.getByText(/^☐ /)).toHaveCount(documents.length);
    });

    await ac('AC5.4.2', 'Include visible document types', async () => {
      for (const document of documents) {
        await expect(page.getByText(`☐ ${document}`, { exact: true })).toBeVisible();
      }
    });

    await ac('AC5.4.3', 'Toggle checklist items', async () => {
      await page.getByText('☐ Bank statements, 6 months', { exact: true }).click();
      await expect(page.getByText('☑ Bank statements, 6 months', { exact: true })).toBeVisible();
      await expect(page.getByText('☐ Bank statements, 6 months', { exact: true })).toHaveCount(0);
      // Only the selected item changes.
      await expect(page.getByText(/^☑ /)).toHaveCount(1);
      await page.getByText('☑ Bank statements, 6 months', { exact: true }).click();
      await expect(page.getByText('☐ Bank statements, 6 months', { exact: true })).toBeVisible();
      await expect(page.getByText(/^☑ /)).toHaveCount(0);
    });

    await ac('AC5.4.4', 'Display SJKP published criteria', async () => {
      await expect(page.getByText('SJKP published criteria', { exact: true })).toBeVisible();
      for (const criterion of [
        '· Malaysian citizen, age 18 to 70',
        '· Gross income within SJKP’s published limit',
        '· First home',
      ]) {
        await expect(page.getByText(criterion, { exact: true })).toBeVisible();
      }
    });

    await ac('AC5.4.5', 'Display source and date', async () => {
      await page.getByLabel('What this is').click();
      await expect(page.getByText('Source: sjkp.com.my, Aug 2026', { exact: true })).toBeVisible();
      await page.getByText('Done', { exact: true }).click();
    });

    await ac('AC5.4.6', 'Avoid displaying unsupported approval status', async () => {
      await expect(page.getByText('65% check: needs review', { exact: true })).toBeVisible();
      await expect(page.getByText(
        'SJKP measures gross income; RuMampu measures income after work costs. Until that gap is settled, no pass or fail is shown here.',
        { exact: true },
      )).toBeVisible();
      // No verdict is shown for the check.
      await expect(page.getByText(/^(pass|passed|fail|failed|approved|eligible)$/i)).toHaveCount(0);
      await captureEvidence(page, 'epic-5', 'ac5.4__documents-and-financing.png');
    });

    await ac('AC5.4.7', 'Display financing disclaimer', async () => {
      await page.getByLabel('What this is').click();
      await expect(page.getByText(
        'RuMampu does not apply for you and cannot tell you whether a bank will say yes.',
        { exact: true },
      )).toBeVisible();
      await page.getByText('Done', { exact: true }).click();
    });
  });

  test('TECH-5.1 — The Money tab shortcut opens Cash buffer', { tag: '@hardening' }, async ({ page }) => {
    await openGuestApp(page);
    await page.getByRole('tab', { name: 'Money', exact: true }).click();
    await page.getByText('Cash buffer', { exact: true }).click();
    await expect(page.getByText(
      'Run the housing test first so this screen can use the server-calculated result.',
      { exact: true },
    )).toBeVisible();
    await back(page);
    await expect(page.getByText('Your record', { exact: true }).last()).toBeVisible();
  });

  test('TECH-5.3 — A record that never goes below zero can still need a buffer', { tag: '@hardening' }, async ({ page }) => {
    // RM 250,000 costs RM 1,382.37 a month. The running balance stays above zero from
    // August, but a year started in January would fall RM 904.74 by February.
    await startWithTwelveMonths(page);
    await runPriceTest(page, 250000);
    await openCashBuffer(page);
    await expect(page.getByText('RM 904.74', { exact: true })).toBeVisible();
    await expect(page.getByTestId('buffer-fall-text')).toHaveText('The biggest drop ran from Dec 2025 to Feb 2026.');
    await expect(page.getByText(/never went below zero/)).toHaveCount(0);
  });

  test('US5.8 — Count my savings once across the cash buffer and the upfront costs', { tag: '@us5.8' }, async ({ page }) => {
    // RM 250,000 costs RM 1,382.37 a month and needs a RM 904.74 buffer (RM 905 as a saving
    // target). The pot is the cash I already have; the buffer is held from it first.
    await startWithTwelveMonths(page);
    await openUpfrontCash(page);
    await page.getByLabel('Cash I already have', { exact: true }).fill('1000');

    await ac('AC5.8.5', 'Nothing is held without a buffer', async () => {
      // No house test is kept yet, so the whole pot counts towards the upfront cash.
      await expect(figureRow(page, 'You have')).toContainText('RM 1,000');
      await expect(page.getByTestId('upfront-held')).toHaveCount(0);
    });

    await keepPriceTest(page, 250000);
    await openUpfrontCash(page);
    const need = parseRm(await figureRow(page, 'You need').innerText());

    await ac('AC5.8.1', 'Hold the buffer first', async () => {
      // RM 905 of the RM 1,000 pot is held; only RM 95 counts towards the upfront cash.
      await expect(figureRow(page, 'You have')).toContainText('RM 95');
      await expect(figureRow(page, 'Gap')).toContainText(rmText(need - 95));
    });

    await ac('AC5.8.3', 'Say what is held', async () => {
      await expect(page.getByTestId('upfront-held')).toHaveText(
        'RM 905 of your pot is held as your safety buffer, so it is not counted here.');
      await figureRow(page, 'You have').getByLabel('How this adds up').click();
      await expect(page.getByText('In the pot', { exact: true }).locator('xpath=..')).toContainText('RM 1,000');
      await expect(page.getByText('Held as your safety buffer', { exact: true }).locator('xpath=..')).toContainText('RM 905');
      await page.getByText('Done', { exact: true }).click();
      await captureEvidence(page, 'epic-5', 'ac5.8.1-3__buffer-held-first.png');
    });

    await ac('AC5.8.2', 'One reading on every screen', async () => {
      // House reads the same RM 95 towards the upfront cash and the same RM 905 held.
      await page.getByRole('tab', { name: 'House', exact: true }).click();
      await expect(page.getByText(
        `RM 95 of ${rmText(need)} set aside · RM 905 held as your safety buffer`, { exact: true },
      )).toBeVisible();
      // The saving plan splits the same pot the same way, and Home's line is the same gap
      // (the buffer is covered, so only the upfront cash is still short).
      await openSavingPlan(page);
      await expect(page.getByTestId('plan-pot-total')).toHaveText('RM 1,000');
      await expect(page.getByText('Safety buffer RM 905 · Upfront cash RM 95', { exact: true })).toBeVisible();
      await page.getByRole('tab', { name: 'Home', exact: true }).click();
      await expect(page.getByText(`${rmText(need - 95)} more to go for your safety buffer and upfront cash`, { exact: true })).toBeVisible();
    });

    await ac('AC5.8.4', 'Show how much of the buffer is covered', async () => {
      await openCashBuffer(page);
      await expect(page.getByTestId('buffer-covered')).toHaveText(
        'Your pot already covers all of this. It is held here first, before anything counts towards your upfront cash.');
      // With RM 500 in the pot, RM 500 is covered and RM 404.74 is still to set aside.
      await openUpfrontCash(page);
      await page.getByLabel('Cash I already have', { exact: true }).fill('500');
      await expect(figureRow(page, 'You have')).toContainText('RM 0');
      await openCashBuffer(page);
      await expect(page.getByTestId('buffer-covered')).toHaveText(
        'Your pot already covers RM 500 of this. RM 404.74 is still to set aside.');
      await captureEvidence(page, 'epic-5', 'ac5.8.4__buffer-covered.png');
    });

    await ac('AC5.8.8', 'Go on to the saving plan', async () => {
      await page.getByText('Open the saving plan', { exact: true }).click();
      await expect(page.getByTestId('plan-pot-total')).toHaveText('RM 500');
      await expect(page.getByText('Safety buffer RM 500 · Upfront cash RM 0', { exact: true })).toBeVisible();
    });

    await ac('AC5.8.6', 'Amounts, not a verdict', async () => {
      // The pot covers neither goal in full: the shortfall is ringgit only, with no verdict.
      await page.getByRole('tab', { name: 'Home', exact: true }).click();
      await expect(page.getByText(`${rmText(905 + need - 500)} more to go for your safety buffer and upfront cash`, { exact: true })).toBeVisible();
      await expect(page.getByText(/can(not|'t)? afford|not affordable|you qualify/i)).toHaveCount(0);
      await openUpfrontCash(page);
      await expect(figureRow(page, 'Gap')).toContainText(rmText(need));
      await expect(page.getByText(/can(not|'t)? afford|not affordable|you qualify/i)).toHaveCount(0);
    });

    await ac('AC5.8.7', 'Say when the held amount changes', async () => {
      // A newer kept test at RM 300,000 needs a different buffer; Upfront cash says so and
      // the pot itself stays RM 500.
      await keepPriceTest(page, 300000);
      await openUpfrontCash(page);
      await expect(page.getByTestId('upfront-held-moved')).toHaveText(
        /^Your newer house test moved the safety buffer from RM 905 to RM [\d,]+, so the amount held changed\. Your pot itself has not changed\.$/);
      await figureRow(page, 'You have').getByLabel('How this adds up').click();
      await expect(page.getByText('In the pot', { exact: true }).locator('xpath=..')).toContainText('RM 500');
      await page.getByText('Done', { exact: true }).click();
    });

    deferredAc(
      'AC5.8.9',
      'Using the buffer takes it off the pot',
      'No screen uses the safety buffer yet. The rule (drawDownBuffer records the amount as used and takes it off the pot, and the buffer refills from the rest) is pinned by TECH-BUFFER-03 and TECH-BUFFER-06 in epic5-upfront-fees.spec.ts; the browser check follows when the screen is built.',
    );
  });

  test('TECH-5.5 — Money moved in from a finished month is still in the pot after a reload', { tag: '@hardening' }, async ({ page }) => {
    // AC10.13.1: the plan is kept as the record is. The amount used to be dropped on
    // reload while its month stayed marked as moved, so the money vanished.
    const { token } = await signInWithCash(page, 0);
    const loaded = await page.request.post(`${API}/dev/scenarios/my-gig-driver-12m/load/`, {
      headers: { Authorization: `Token ${token}` },
      data: { confirm_reset: true },
    });
    expect(loaded.status(), await loaded.text()).toBe(201);
    await reloadAccountApp(page);
    await keepAffordableTest(page);
    await openSavingPlan(page);

    // The first finished month offered: its label, what it left, and its Add button.
    const firstRow = page.getByRole('button', { name: 'Add', exact: true }).first().locator('xpath=..');
    const rowText = (await firstRow.innerText()).trim();
    const month = /^[A-Z][a-z]{2} \d{4}/.exec(rowText)?.[0];
    expect(month, rowText).toBeTruthy();
    const moved = parseRm(rowText);
    expect(moved).toBeGreaterThan(0);
    await firstRow.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Added', exact: true })).toHaveCount(1);
    await expect(page.getByTestId('plan-pot-total')).toHaveText(rmText(moved));

    // The account keeps the amount with its month.
    await expect.poll(async () => {
      const me = await page.request.get(`${API}/auth/me/`, { headers: { Authorization: `Token ${token}` } });
      const body = await me.json();
      return [body.pot_moved, body.pot_moved_months.length];
    }).toEqual([moved, 1]);

    await reloadAccountApp(page);
    await openSavingPlan(page);
    await expect(page.getByTestId('plan-pot-total')).toHaveText(rmText(moved));
    // The month stays marked as moved in, so it is not added a second time.
    await expect(page.getByText(month!, { exact: true }).locator('xpath=..')
      .getByRole('button', { name: 'Added', exact: true })).toBeVisible();
  });
});
