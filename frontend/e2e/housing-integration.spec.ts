import { expect } from '@playwright/test';
import { e2ePost, test } from './support/fixtures';
import { API, openApp } from './support/app';

/* ADR 0004: the formal housing flow saves the scenario, asks the server for the
   pre-check and reads the result by scenario id. It never calls the stateless
   /housing/test/ endpoint. The twelve-month fixture with a RM 250,000 home costs
   RM 1,382.37 a month, which runs short in January and February. */
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
  await page.getByRole('tab', { name: 'House', exact: true }).click();
  await page.getByText('Test a house', { exact: true }).click();
  await expect(page.getByText(
    'Tell me the price. I’ll check it against your 12 recorded months and show you which ones would have run short.',
    { exact: true },
  )).toBeVisible();
  await page.locator('input:visible').nth(0).fill('250000');
  await page.getByText('The house', { exact: true }).click();
  await page.getByText('Run the test', { exact: true }).last().click();

  await expect(page.getByText('2 of 12 months would run short', { exact: true })).toBeVisible();
  await expect(page.getByText(/Largest gap RM 742\.37\./)).toBeVisible();
  expect(housingRequests).toContain('/api/v1/housing/scenarios/');
  expect(housingRequests).toContain('/api/v1/housing/pre-check/');
  expect(housingRequests).toContain('/api/v1/housing/test-result/');
  expect(housingRequests).not.toContain('/api/v1/housing/test/');
  await page.screenshot({
    path: testInfo.outputPath('01-stateless-housing-test.png'),
    fullPage: true,
  });
});
