import { expect, test as base, type Locator, type Page, type TestInfo } from '@playwright/test';
import { randomUUID } from 'node:crypto';

export const LIVE_APP = 'https://rumampu-frontend.vercel.app/';
export const LIVE_API = 'https://rumampu.vercel.app/api/v1';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type ApiEvent = { method: string; path: string; status: number };
type LiveSession = { clientId: string; events: ApiEvent[]; errors: string[] };

export const test = base.extend<{ live: LiveSession }>({
  live: [async ({ page }, use, testInfo) => {
    const live: LiveSession = { clientId: `live-smoke-${randomUUID()}`, events: [], errors: [] };
    await page.addInitScript(id => localStorage.setItem('rumampu_client_id', id), live.clientId);
    page.on('pageerror', error => live.errors.push(error.message));
    page.on('response', response => {
      const url = new URL(response.url());
      if (!url.pathname.startsWith('/api/v1/')) return;
      const request = response.request();
      live.events.push({ method: request.method(), path: url.pathname, status: response.status() });
      if (url.origin !== new URL(LIVE_API).origin) live.errors.push(`Unexpected API origin: ${url.origin}`);
      if (request.headers()['x-rumampu-client-id'] !== live.clientId) live.errors.push(`Guest ID mismatch: ${url.pathname}`);
      if (response.status() >= 400) live.errors.push(`${request.method()} ${url.pathname}: HTTP ${response.status()}`);
    });
    try {
      await use(live);
    } finally {
      // ID belongs only to this synthetic guest. Keep reports private: traces contain it.
      await testInfo.attach('live-run.json', { body: JSON.stringify({
        frontend: LIVE_APP, api: LIVE_API, clientId: live.clientId,
        writesEnabled: process.env.RUMAMPU_LIVE_WRITES === '1',
        events: live.events, errors: live.errors,
        retainedData: 'New synthetic guest only; no automatic deletion. Partial runs may leave partial records.',
      }, null, 2), contentType: 'application/json' });
    }
  }, { auto: true }],
});

export async function liveGet<T>(page: Page, live: LiveSession, path: string): Promise<T> {
  const response = await page.request.get(`${LIVE_API}${path}`, {
    headers: { 'X-RuMampu-Client-ID': live.clientId }, timeout: 30_000, maxRedirects: 0,
  });
  expect(response.status(), `Production GET ${path}`).toBe(200);
  return response.json() as Promise<T>;
}

export async function openLiveApp(page: Page): Promise<void> {
  await page.goto(LIVE_APP);
  await expect(page.getByText('Skip', { exact: true })).toBeVisible();
  await page.getByText('Skip', { exact: true }).click();
  await expect(page.getByText('Money', { exact: true }).last()).toBeVisible();
  await expect(page).toHaveURL(LIVE_APP);
}

export async function openMoney(page: Page, label: string): Promise<void> {
  await page.getByText('Money', { exact: true }).last().click();
  await page.getByText(label, { exact: true }).last().click();
}

export function monthLabel(month: string): string {
  return `${MONTHS[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`;
}

export function previousMonth(month: string): string {
  const date = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)) - 2, 1));
  return date.toISOString().slice(0, 7);
}

export async function chooseDate(page: Page, field: Locator, date: string): Promise<void> {
  const current = /(\d{1,2}) (\w{3}) (\d{4})/.exec(await field.innerText());
  expect(current, 'Date picker must display an English date').not.toBeNull();
  const start = Number(current![3]) * 12 + MONTHS.indexOf(current![2]);
  const target = Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;
  const delta = target - start;
  expect(Math.abs(delta), 'Bounded calendar traversal').toBeLessThan(120);
  await field.click();
  for (let step = 0; step < Math.abs(delta); step += 1) {
    await page.getByText(delta < 0 ? '‹' : '›', { exact: true }).last().click();
  }
  await expect(page.getByText(monthLabel(date.slice(0, 7)), { exact: true }).last()).toBeVisible();
  await page.getByText(String(Number(date.slice(8))), { exact: true }).last().click();
  await expect(field).toContainText(`${Number(date.slice(8))} ${monthLabel(date.slice(0, 7))}`);
  await expect(page.getByText('‹', { exact: true })).toHaveCount(0);
}

export async function selectMonth(page: Page, month: string): Promise<void> {
  const field = page.getByLabel('Choose month', { exact: true });
  const year = Number((await field.innerText()).match(/\d{4}/)?.[0]);
  const delta = Number(month.slice(0, 4)) - year;
  expect(Number.isFinite(delta)).toBe(true);
  expect(Math.abs(delta)).toBeLessThan(10);
  await field.click();
  for (let step = 0; step < Math.abs(delta); step += 1) {
    await page.getByRole('button', { name: delta < 0 ? 'Previous year' : 'Next year', exact: true }).click();
  }
  await page.getByRole('button', { name: monthLabel(month), exact: true }).click();
  await expect(field).toContainText(monthLabel(month));
}

export async function evidence(page: Page, info: TestInfo, name: string): Promise<void> {
  await info.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
}

export function assertHealthyNetwork(live: LiveSession): void {
  expect(live.errors, 'No page exceptions, API failures or wrong guest/origin').toEqual([]);
  for (const endpoint of ['work-costs/', 'work-costs/entries/', 'work-costs/summary/', 'income-pattern/']) {
    expect(live.events.some(event => event.path === `/api/v1/${endpoint}` && event.status === 200),
      `Real browser received ${endpoint}`).toBe(true);
  }
}
