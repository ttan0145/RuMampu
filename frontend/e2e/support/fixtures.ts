import { test as base } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';

type E2EPage = Page & { __rumampuE2EClientId?: string };

type GetOptions = Parameters<APIRequestContext['get']>[1];
type PostOptions = Parameters<APIRequestContext['post']>[1];
type PatchOptions = Parameters<APIRequestContext['patch']>[1];
type PutOptions = Parameters<APIRequestContext['put']>[1];
type DeleteOptions = Parameters<APIRequestContext['delete']>[1];

function clientIdFor(page: Page): string {
  const clientId = (page as E2EPage).__rumampuE2EClientId;
  if (!clientId) throw new Error('RuMampu E2E client ID was not initialised for this test.');
  return clientId;
}

function headersFor(page: Page, headers?: Record<string, string>): Record<string, string> {
  return {
    ...(headers || {}),
    'X-RuMampu-Client-ID': clientIdFor(page),
  };
}

export function e2eGet(page: Page, url: string, options: GetOptions = {}) {
  return page.request.get(url, { ...options, headers: headersFor(page, options.headers) });
}

export function e2ePost(page: Page, url: string, options: PostOptions = {}) {
  return page.request.post(url, { ...options, headers: headersFor(page, options.headers) });
}

export function e2ePatch(page: Page, url: string, options: PatchOptions = {}) {
  return page.request.patch(url, { ...options, headers: headersFor(page, options.headers) });
}

export function e2ePut(page: Page, url: string, options: PutOptions = {}) {
  return page.request.put(url, { ...options, headers: headersFor(page, options.headers) });
}

export function e2eDelete(page: Page, url: string, options: DeleteOptions = {}) {
  return page.request.delete(url, { ...options, headers: headersFor(page, options.headers) });
}

export const test = base.extend<{ e2eClientId: string }>({
  e2eClientId: [
    async ({ page }, use, testInfo) => {
      const safeTestId = testInfo.testId.replace(/[^a-zA-Z0-9_-]/g, '-');
      const clientId = `playwright-${safeTestId}-${Date.now()}`;

      // Keep the ID directly on this Page for explicit API helper calls.
      (page as E2EPage).__rumampuE2EClientId = clientId;

      // Seed the same ID before the app's first navigation/fetch.
      await page.addInitScript((id: string) => {
        window.localStorage.setItem('rumampu_client_id', id);
      }, clientId);

      await use(clientId);
    },
    { auto: true },
  ],
});
