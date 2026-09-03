import { expect, Page } from '@playwright/test';
import { API } from './app';
import { e2eGet } from './fixtures';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function monthLabel(month: string): string {
  return `${MONTH_NAMES[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`;
}

export function previousMonth(month: string, offset = 1): string {
  const date = new Date(Number(month.slice(0, 4)), Number(month.slice(5)) - 1 - offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export async function currentWorkCostMonth(page: Page): Promise<string> {
  const response = await e2eGet(page, `${API}/work-costs/summary/`);
  expect(response.ok()).toBeTruthy();
  return (await response.json()).month;
}

export async function selectWorkCostMonth(page: Page, month: string): Promise<void> {
  const field = page.getByLabel('Choose month', { exact: true });
  const viewYear = Number((await field.innerText()).match(/\d{4}/)?.[0]);
  const year = Number(month.slice(0, 4));
  expect(Number.isFinite(viewYear)).toBeTruthy();
  expect(Math.abs(viewYear - year)).toBeLessThan(10);
  await field.click();
  for (let i = 0; i < Math.abs(viewYear - year); i += 1) {
    await page.getByRole('button', { name: year < viewYear ? 'Previous year' : 'Next year', exact: true }).click();
  }
  await page.getByRole('button', { name: monthLabel(month), exact: true }).click();
  await expect(field).toContainText(monthLabel(month));
}
