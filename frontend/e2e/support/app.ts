import { Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

export const API = 'http://localhost:8000/api/v1';

export async function openApp(page: Page): Promise<void> {
  await page.goto('/');

  const splash = page.getByLabel('RuMampu');
  if (await splash.isVisible().catch(() => false)) await splash.click();

  const skip = page.getByText('Skip', { exact: true });
  if (await skip.isVisible().catch(() => false)) await skip.click();
}

export async function openMoneyScreen(page: Page, label: string): Promise<void> {
  await page.getByText('Money', { exact: true }).last().click();
  await page.getByText(label, { exact: true }).last().click();
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
