import { expect, Page, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const API = 'http://localhost:8000/api/v1';

const EVIDENCE = path.resolve(
  __dirname,
  '../../output/playwright/epic-3/evidence'
);

test.beforeAll(() => {
  mkdirSync(EVIDENCE, { recursive: true });
});

async function openApp(page: Page): Promise<void> {
  await page.goto('/');

  const splash = page.getByLabel('RuMampu');

  if (await splash.isVisible().catch(() => false)) {
    await splash.click();
  }

  const skip = page.getByText('Skip', { exact: true });

  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
  }
}

test('US3 housing stress test uses recorded financial history', async ({ page }) => {
  // Load the 12-month test scenario into the backend
  const loaded = await page.request.post(
    `${API}/dev/scenarios/my-gig-driver-12m/load/`,
    {
      data: {
        confirm_reset: true,
      },
    }
  );

  expect(loaded.status()).toBe(201);

  // Open RuMampu
  await openApp(page);

  // Confirm the historical income data was loaded
  await expect(
    page.getByText(/12 months of income recorded/)
  ).toBeVisible();

  // Evidence 1:
  // Screen before entering the housing stress test
  await page.screenshot({
    path: path.join(
      EVIDENCE,
      '01-pre-housing-check.png'
    ),
    fullPage: true,
  });

// Open the Housing Test
await page
  .getByText('Test', { exact: true })
  .last()
  .click();

// Wait until The house screen has loaded
await expect(
  page.getByText('Property price (RM)', { exact: true })
).toBeVisible();

// The house screen has these inputs in order:
// 0 = Property price
// 1 = Deposit
// 2 = Interest / profit rate
// 3 = Loan tenure

const inputs = page.locator('input');

// Enter the Epic 3 housing scenario
await inputs.nth(0).fill('250000');
await inputs.nth(1).fill('0');
await inputs.nth(2).fill('4.3');
await inputs.nth(3).fill('35');

// Remove focus so NumInput commits the entered values
await page.getByText('The house', { exact: true }).click();

// Wait for the backend calculation.
// RM250,000 property - RM0 deposit = RM250,000 financing.
await expect(
  page.getByText('RM 250,000', { exact: true })
).toBeVisible();

// Screenshot the completed housing input
await page.screenshot({
  path: path.join(
    EVIDENCE,
    '02-housing-input.png'
  ),
  fullPage: true,
});

// Go to Total monthly cost
await page
  .getByText(/Total monthly cost/)
  .last()
  .click();

// Make sure the page calculation is ready
await expect(
  page.getByText('Total monthly cost', { exact: true })
).toBeVisible();

// Screenshot before running the historical test
await page.screenshot({
  path: path.join(
    EVIDENCE,
    '03-before-running-test.png'
  ),
  fullPage: true,
});

// Run the test
await page
  .getByText(/Run the test/)
  .last()
  .click();

  // Confirm the expected historical result
  await expect(
    page.getByText(
      /2 of your 12 recorded months would have run short/
    )
  ).toBeVisible();

  // Confirm the expected shortfall amount
  await expect(
    page.getByText('RM 742', { exact: true })
  ).toBeVisible();

  // Evidence 4:
  // Final historical housing stress-test result
  await page.screenshot({
    path: path.join(
      EVIDENCE,
      '04-historical-housing-result.png'
    ),
    fullPage: true,
  });
});