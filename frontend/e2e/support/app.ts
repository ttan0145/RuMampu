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
