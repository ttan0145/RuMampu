import { Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

export const API = `http://localhost:${process.env.PLAYWRIGHT_BACKEND_PORT || '8000'}/api/v1`;

export async function openApp(page: Page): Promise<void> {
  await page.goto('/');

  const splash = page.getByLabel('RuMampu');
  if (await splash.isVisible().catch(() => false)) await splash.click();

  // The v22 UI adds language, introduction, and guest-auth steps before the
  // existing optional profile questions. Complete that real flow so every
  // acceptance test starts from the same app state without bypassing the UI.
  for (const label of ['Next', 'Nice to meet you →', 'Continue as guest', 'Next', 'Skip']) {
    const control = page.getByText(label, { exact: true }).last();
    if (await control.isVisible().catch(() => false)) await control.click();
  }

  await page.getByText('Money', { exact: true }).last().waitFor({ state: 'visible' });
}

/**
 * Completes the current entry flow as a guest: sign-in screen, the guest
 * confirmation dialog, "What RuMampu does", the two get-to-know steps (skipped),
 * and lands on Home. Mirrors the Epic 8 spec's onboarding walk so tests written
 * after the Epic 8 flow change start from a clean Home without touching the
 * older openApp() that Epics 1 to 4 still rely on.
 */
export async function openGuestApp(page: Page): Promise<void> {
  await page.goto('/');
  const splash = page.getByLabel('RuMampu');
  if (await splash.isVisible().catch(() => false)) {
    await splash.click({ force: true });
    await splash.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => undefined);
  }
  const clickIfVisible = async (locator: ReturnType<Page['getByText']>): Promise<boolean> => {
    if (!(await locator.isVisible().catch(() => false))) return false;
    await locator.click({ force: true, timeout: 3000 }).catch(() => undefined);
    await page.waitForTimeout(150);
    return true;
  };
  for (let step = 0; step < 14; step += 1) {
    const dialogConfirm = page.getByRole('dialog').getByRole('button', { name: 'Continue as guest', exact: true });
    if (await dialogConfirm.isVisible().catch(() => false)) {
      await dialogConfirm.click({ force: true, timeout: 3000 });
      await page.waitForTimeout(150);
      continue;
    }
    if (await clickIfVisible(page.getByText('Continue as guest', { exact: true }).last())) continue;
    if (await clickIfVisible(page.getByText('Nice to meet you →', { exact: true }))) continue;
    if (await clickIfVisible(page.getByText(/^Skip$/i).last())) continue;
    if (await clickIfVisible(page.getByText(/^Next$/i).last())) continue;
    if (await clickIfVisible(page.getByText('Start using RuMampu', { exact: true }).last())) continue;
    if (await page.getByRole('tab', { name: 'Home', exact: true }).isVisible().catch(() => false)) break;
    await page.waitForTimeout(150);
  }
  await page.getByRole('tab', { name: 'Home', exact: true }).waitFor({ state: 'visible' });
  // Any leftover sheet (guest confirmation) would block taps on the tab bar.
  await page.getByRole('dialog').waitFor({ state: 'hidden', timeout: 3000 }).catch(() => undefined);
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

/** Reloads a returning guest straight to Home (splash dismissed if shown). */
export async function reloadApp(page: Page): Promise<void> {
  await page.reload();
  const splash = page.getByLabel('RuMampu');
  if (await splash.isVisible().catch(() => false)) {
    await splash.click({ force: true });
    await splash.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => undefined);
  }
  await page.getByRole('tab', { name: 'Home', exact: true }).waitFor({ state: 'visible', timeout: 15000 });
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
