import { expect, Page, test } from '@playwright/test';
const API = 'http://localhost:8000/api/v1';
async function openApp(page: Page): Promise<void> {
  await page.goto('/');
  const splash = page.getByLabel('RuMampu');
  if (await splash.isVisible().catch(() => false)) await splash.click();
  const skip = page.getByText('Skip', { exact: true });
  if (await skip.isVisible().catch(() => false)) await skip.click();
}

test('housing uses the loaded finance months with the stateless backend stress test', async ({ page }, testInfo) => {
  const loaded = await page.request.post(`${API}/dev/scenarios/my-gig-driver-12m/load/`, {
    data: { confirm_reset: true },
  });
  expect(loaded.status()).toBe(201);

  await openApp(page);

  await expect(page.getByText(/12 months of income recorded/)).toBeVisible();

  await page.getByText('Test', { exact: true }).last().click();
  await page.getByText(/Total monthly cost/).last().click();
  await page.getByText(/Run the test/).last().click();

  await expect(page.getByText(/2 of your 12 recorded months would have run short/)).toBeVisible();
  await expect(page.getByText('RM 742', { exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('01-stateless-housing-test.png'),
    fullPage: true,
  });
});
