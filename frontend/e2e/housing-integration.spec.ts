import { expect, Page } from '@playwright/test';
import { e2ePost, test } from './support/fixtures';
const API = 'http://localhost:8000/api/v1';
async function openApp(page: Page): Promise<void> {
  await page.goto('/');
  const splash = page.getByLabel('RuMampu');
  if (await splash.isVisible().catch(() => false)) await splash.click();
  const skip = page.getByText('Skip', { exact: true });
  if (await skip.isVisible().catch(() => false)) await skip.click();
}

test('housing uses the saved scenario and authoritative backend results', async ({ page }, testInfo) => {
  const housingRequests: string[] = [];
  page.on('request', request => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.includes('/api/v1/housing/')) housingRequests.push(pathname);
  });
  const loaded = await e2ePost(page, `${API}/dev/scenarios/my-gig-driver-12m/load/`, {
    data: { confirm_reset: true },
  });
  expect(loaded.status()).toBe(201);

  await openApp(page);

  await expect(page.getByText(/12 months of income recorded/)).toBeVisible();

  await page.getByText('Test', { exact: true }).last().click();
  await page.getByText(/Total monthly cost/).last().click();
  await page.getByText(/Run the test/).last().click();

  await expect(page.getByText(/2 of your 12 recorded months would have run short/)).toBeVisible();
  await expect(page.getByText('RM 742.37', { exact: true })).toBeVisible();
  expect(housingRequests).toContain('/api/v1/housing/scenarios/');
  expect(housingRequests).toContain('/api/v1/housing/pre-check/');
  expect(housingRequests).toContain('/api/v1/housing/test-result/');
  expect(housingRequests).not.toContain('/api/v1/housing/test/');
  await page.screenshot({
    path: testInfo.outputPath('01-stateless-housing-test.png'),
    fullPage: true,
  });
});
