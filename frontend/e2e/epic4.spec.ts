import { expect, Page, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const API = 'http://localhost:8000/api/v1';

const EVIDENCE = path.resolve(
  __dirname,
  '../../output/playwright/epic-4/evidence'
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

async function openPaymentComparison(page: Page): Promise<void> {
  // Load predictable test history.
  // This is test fixture data only - the real feature is not limited to 12 months.
  const loaded = await page.request.post(
    `${API}/dev/scenarios/my-gig-driver-12m/load/`,
    {
      data: {
        confirm_reset: true,
      },
    }
  );

  expect(loaded.status()).toBe(201);

  await openApp(page);

  await expect(
    page.getByText(/12 months of income recorded/)
  ).toBeVisible();

  // Open Epic 3 housing test first
  await page
    .getByText('Test', { exact: true })
    .last()
    .click();

  await page
    .getByText(/Total monthly cost/)
    .last()
    .click();

  await page
    .getByText(/Run the test/)
    .last()
    .click();

  await expect(
    page.getByText(
      /2 of your 12 recorded months would have run short/
    )
  ).toBeVisible();

  // Open US4.3 payment comparison
  await page
    .getByText('Compare payments', { exact: true })
    .click();

  await expect(
    page.getByText(
      'Same recorded months, three payments.',
      { exact: true }
    )
  ).toBeVisible();
}

test(
  'US4.3 compares RM1,000, RM1,200 and RM1,400 against the same recorded history',
  async ({ page }) => {
    await openPaymentComparison(page);

    const payment1 = page.getByLabel('Payment 1 (RM)');
    const payment2 = page.getByLabel('Payment 2 (RM)');
    const payment3 = page.getByLabel('Payment 3 (RM)');

    // AC4.3.1 - three payment scenarios are displayed
    await expect(payment1).toHaveValue('1000');
    await expect(payment2).toHaveValue('1200');
    await expect(payment3).toHaveValue('1400');

    // AC4.3.3 + AC4.3.4
    // All three scenarios use the same 12 recorded months
    // and each shows its short-month count
    const shortCounts = page.getByText(/\d+ of 12 short/);

    await expect(shortCounts).toHaveCount(3);

    // AC4.3.5 - each scenario displays its largest gap
    const largestGaps = page.getByText(/largest gap RM/i);

    await expect(largestGaps).toHaveCount(3);

    // AC4.3.6 - each scenario has its own chart
    await expect(
      page.getByLabel('Payment 1 recorded-month chart')
    ).toBeVisible();

    await expect(
      page.getByLabel('Payment 2 recorded-month chart')
    ).toBeVisible();

    await expect(
      page.getByLabel('Payment 3 recorded-month chart')
    ).toBeVisible();

    // Make sure first scenario is visible before screenshot
    await payment1.scrollIntoViewIfNeeded();

    await page.screenshot({
      path: path.join(
        EVIDENCE,
        '01-us4.3-payment-comparison.png'
      ),
      fullPage: true,
    });
  }
);

test(
  'AC4.3.2 allows a payment scenario to be edited and recalculated',
  async ({ page }) => {
    await openPaymentComparison(page);

    const payment1 = page.getByLabel('Payment 1 (RM)');
    const payment2 = page.getByLabel('Payment 2 (RM)');
    const payment3 = page.getByLabel('Payment 3 (RM)');

    // Confirm starting values
    await expect(payment1).toHaveValue('1000');
    await expect(payment2).toHaveValue('1200');
    await expect(payment3).toHaveValue('1400');

    // Edit Payment 1
    await payment1.fill('1100');
    await payment1.blur();

    // AC4.3.2 - edited payment is retained
    await expect(payment1).toHaveValue('1100');

    // Other scenarios should remain unchanged
    await expect(payment2).toHaveValue('1200');
    await expect(payment3).toHaveValue('1400');

    // Wait for the recalculated scenario result
    await expect(
      page.getByText(/\d+ of 12 short/).first()
    ).toBeVisible();

    await expect(
      page.getByText(/largest gap RM/i).first()
    ).toBeVisible();

    // Evidence 2:
    // Show edited Payment 1 = RM1,100
    await payment1.scrollIntoViewIfNeeded();

    await page.screenshot({
      path: path.join(
        EVIDENCE,
        '02-us4.3-edited-payment-1100.png'
      ),
      fullPage: true,
    });

    // Evidence 3:
    // Scroll to Payment 3 so the screenshot visibly proves
    // RM1,200 and RM1,400 remain unchanged.
    await payment3.scrollIntoViewIfNeeded();

    await expect(payment2).toHaveValue('1200');
    await expect(payment3).toHaveValue('1400');

    await page.screenshot({
      path: path.join(
        EVIDENCE,
        '03-us4.3-other-payments-unchanged.png'
      ),
      fullPage: true,
    });
  }
);