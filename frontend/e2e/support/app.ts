import { expect, Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { e2ePost } from './fixtures';

export const API = `http://localhost:${process.env.PLAYWRIGHT_BACKEND_PORT || '8000'}/api/v1`;

/**
 * Entry point for the Epic 1 to 4 specs, which seed their record through the
 * API before the app opens. The guest entry now asks "Continue as a guest?"
 * and rotates the anonymous client id, so the id the fixture seeded is pinned
 * and the shared guest walk below is reused instead of a fixed list of taps.
 */
export async function openApp(page: Page): Promise<void> {
  await pinGuestClientId(page);
  await openGuestApp(page);
  await page.getByText('Money', { exact: true }).last().waitFor({ state: 'visible' });
}

/**
 * Completes the current entry flow as a guest: sign-in screen, the guest
 * confirmation dialog, "What RuMampu does", optional get-to-know questions (skipped),
 * and lands on Home. Uses normal clicks and waits for an actionable tab so every spec
 * starts from a clean Home; openApp() adds the pinned client id on top.
 */
/**
 * A guest keeps the record across a reload for as long as the tab is open (a marker in sessionStorage);
 * closing the tab ends it. A spec that wants a fresh visitor clears the marker before it opens the app.
 */
export async function endGuestSession(page: Page): Promise<void> {
  if (page.url() === 'about:blank') return;
  await page.evaluate(() => {
    try { window.sessionStorage.removeItem('rumampu_guest_session'); } catch { /* storage may be unavailable */ }
  });
}

export async function openGuestApp(page: Page): Promise<void> {
  await endGuestSession(page);
  await page.goto('/');
  // Normal clicks wait for the splash and bootstrap instead of bypassing them.
  await page.getByText('Continue as guest', { exact: true }).last().click({ timeout: 30000 });
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Continue as guest', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('What RuMampu does', { exact: true })).toBeVisible({ timeout: 30000 });
  await page.getByText('Next', { exact: true }).last().click();
  // Skip completes the optional get-to-know flow; it does not advance one page.
  await page.getByText(/^Skip$/i).last().click();
  await page.getByRole('tab', { name: 'Home', exact: true }).click({ trial: true, timeout: 30000 });
  await expect(page.getByText('What RuMampu does', { exact: true })).toHaveCount(0);
  await expect(page.getByText(/^Skip$/i)).toHaveCount(0);
}

/**
 * Opens the app as a guest who is already past the entry, for specs where the entry is not what is
 * tested. state.tsx restores a guest at start when sessionStorage holds 'rumampu_guest_session' = '1'
 * and no account is stored, and then reads the record under the client id the fixture put in
 * localStorage, so nothing is rotated and no pinning is needed. The marker is written once per tab:
 * a reload keeps it, and a spec that clears it (endGuestSession) still starts at the entry.
 */
export async function openGuestFast(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      if (window.sessionStorage.getItem('rumampu_e2e_fast') !== '1') {
        window.sessionStorage.setItem('rumampu_e2e_fast', '1');
        window.sessionStorage.setItem('rumampu_guest_session', '1');
      }
    } catch { /* storage may be unavailable */ }
  });
  await page.goto('/');
  await page.getByRole('tab', { name: 'Home', exact: true }).click({ trial: true, timeout: 30000 });
  await expect(page.getByText('What RuMampu does', { exact: true })).toHaveCount(0);
}

/**
 * Keeps a house test in the guest's local record without walking the House screens. The scenario and the
 * result come from the same backend calls the app makes (with the fixture's client id), and are written to
 * 'rumampu_local_state' the way keepTest() in screens/test.tsx keeps one: a keptTests entry named by the
 * price (or the monthly cost), the last test and its scenario, and ufTest pointing at it. Other fields in the
 * record are left as they are, and each seed is written once per tab, so a reload does not undo later edits.
 * Call after the record is loaded (dev scenario) and before openGuestFast(). A spec that checks the House
 * screens themselves keeps its test through the screens instead.
 */
export async function seedKeptTest(
  page: Page,
  price: number,
  opts: { deposit?: number; knownPayment?: number } = {},
): Promise<void> {
  const known = opts.knownPayment ?? null;
  const created = await e2ePost(page, `${API}/housing/scenarios/`, { data: {
    property_price: known == null ? price : 0,
    deposit: opts.deposit ?? 0,
    financing_rate: 4.3,
    tenure_years: 35,
    known_monthly_payment: known,
    // the app's starting list of home costs (mock.ts)
    additional_costs: [
      { category: 'maint', amount: 150 }, { category: 'insure', amount: 55 }, { category: 'assess', amount: 20 },
      { category: 'quit', amount: 5 }, { category: 'parking', amount: 0 }, { category: 'other', amount: 0 },
    ],
  } });
  expect(created.status()).toBe(201);
  const scenario = await created.json();
  const ran = await e2ePost(page, `${API}/housing/test-result/`, { data: { scenario_id: scenario.id, income_shock_percent: 0 } });
  expect(ran.status()).toBe(200);
  const result = await ran.json();
  // the app's rm(): whole ringgit, sen only when present
  const money = (v: number) => `RM ${(Math.round(v * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(Math.round(v * 100) / 100) ? 0 : 2, maximumFractionDigits: 2 })}`;
  const pay = Math.round(result.tested_home_cost);
  const kept = {
    name: known == null ? money(price) : `${money(pay)} / month`,
    pay,
    s: result.short_month_count,
    n: result.tested_months,
    g: Math.round(result.largest_gap),
    scenarioId: scenario.id,
    scenario,
    result,
    propertyPrice: known == null ? price : null,
    incomeShockPercent: result.income_shock_percent,
  };
  await page.addInitScript(({ kept, result, scenario }) => {
    try {
      const flag = `rumampu_e2e_seeded_${scenario.id}`;
      if (window.sessionStorage.getItem(flag) === '1') return;
      window.sessionStorage.setItem(flag, '1');
      const raw = window.localStorage.getItem('rumampu_local_state');
      const state = raw ? JSON.parse(raw) : { version: 1 };
      const tests = Array.isArray(state.keptTests) ? state.keptTests : [];
      tests.push(kept);
      state.keptTests = tests;
      state.ufTest = tests.length - 1;
      state.housingTestResult = result;
      state.housingScenario = scenario;
      window.localStorage.setItem('rumampu_local_state', JSON.stringify(state));
    } catch { /* storage may be unavailable */ }
  }, { kept, result, scenario });
}

/**
 * The guest sign-in rotates the anonymous client id, so API calls made through
 * the fixtures after onboarding must use the id the browser now holds.
 */
export async function syncClientIdFromBrowser(page: Page): Promise<void> {
  const clientId = await page.evaluate(() => window.localStorage.getItem('rumampu_client_id'));
  if (!clientId) throw new Error('The app has not stored a client id yet.');
  (page as Page & { __rumampuE2EClientId?: string }).__rumampuE2EClientId = clientId;
}

/**
 * "Continue as guest" rotates the anonymous client id (enterGuestMode in
 * state.tsx) and then loads the record for the new id. Pinning the generator
 * to the id the fixture seeded lets a test load a scenario through the API
 * first and still see it after onboarding. Call before page.goto().
 */
export async function pinGuestClientId(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const pinned = window.localStorage.getItem('rumampu_client_id');
    if (pinned && typeof crypto !== 'undefined') {
      Object.defineProperty(crypto, 'randomUUID', { value: () => pinned, configurable: true });
    }
  });
}

/** Reloads a returning session and waits until overlays stop intercepting Home. */
export async function reloadApp(page: Page): Promise<void> {
  await page.reload();
  await page.getByRole('tab', { name: 'Home', exact: true }).click({ trial: true, timeout: 30000 });
}

export async function openMoneyScreen(page: Page, label: string): Promise<void> {
  await page.getByText('Money', { exact: true }).last().click();
  // The requirement calls this Coverage check; v22 names its navigation Quiet months.
  const navigationLabel = label === 'Coverage check' ? 'Quiet months' : label;
  await page.getByText(navigationLabel, { exact: true }).last().click();
}

export async function resetScreenScroll(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.querySelectorAll('*').forEach(element => { element.scrollLeft = 0; });
  });

  const screen = page.getByTestId('screen-scroll');
  if (await screen.count()) {
    await screen.evaluate(element => {
      element.scrollTop = 0;
      element.scrollLeft = 0;
    });
  }
}

/**
 * Evidence is deliberately opt-in so a normal regression run cannot dirty Git.
 * Run with UPDATE_EVIDENCE=1 when an approved evidence refresh is required.
 */
export async function captureEvidence(
  page: Page,
  epic: string,
  filename: string,
  options: { resetScroll?: boolean } = {},
): Promise<void> {
  if (process.env.UPDATE_EVIDENCE !== '1') return;

  const directory = path.resolve(__dirname, `../../../output/playwright/${epic}/evidence`);
  mkdirSync(directory, { recursive: true });
  if (options.resetScroll !== false) await resetScreenScroll(page);
  await page.screenshot({ path: path.join(directory, filename), fullPage: true });
}
