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

async function openHousingResult(page: Page): Promise<void> {
  // Predictable test fixture only.
  // The real feature is not limited to 12 months.
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
}

async function openPaymentComparison(page: Page): Promise<void> {
  await openHousingResult(page);

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

async function openIncomeShock(page: Page): Promise<void> {
  await openHousingResult(page);

  await page
    .getByText('If income drops', { exact: true })
    .click();

  await expect(
    page.getByText(
      'Hypothetical scenario, not prediction.',
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

    // AC4.3.1
    await expect(payment1).toHaveValue('1000');
    await expect(payment2).toHaveValue('1200');
    await expect(payment3).toHaveValue('1400');

    // AC4.3.3 + AC4.3.4
    const shortCounts = page.getByText(/\d+ of 12 short/);
    await expect(shortCounts).toHaveCount(3);

    // AC4.3.5
    const largestGaps = page.getByText(/largest gap RM/i);
    await expect(largestGaps).toHaveCount(3);

    // AC4.3.6
    await expect(
      page.getByLabel('Payment 1 recorded-month chart')
    ).toBeVisible();

    await expect(
      page.getByLabel('Payment 2 recorded-month chart')
    ).toBeVisible();

    await expect(
      page.getByLabel('Payment 3 recorded-month chart')
    ).toBeVisible();

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

    await expect(payment1).toHaveValue('1000');
    await expect(payment2).toHaveValue('1200');
    await expect(payment3).toHaveValue('1400');

    await payment1.fill('1100');
    await payment1.blur();

    // AC4.3.2
    await expect(payment1).toHaveValue('1100');

    await expect(payment2).toHaveValue('1200');
    await expect(payment3).toHaveValue('1400');

    await expect(
      page.getByText(/\d+ of 12 short/).first()
    ).toBeVisible();

    await expect(
      page.getByText(/largest gap RM/i).first()
    ).toBeVisible();

    await payment1.scrollIntoViewIfNeeded();

    await page.screenshot({
      path: path.join(
        EVIDENCE,
        '02-us4.3-edited-payment-1100.png'
      ),
      fullPage: true,
    });

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

test(
  'US4.4 stress-tests current income, 10% lower and 20% lower as hypothetical scenarios',
  async ({ page }) => {
    await openIncomeShock(page);

    const current = page.getByRole('radio', {
      name: '0%',
      exact: true,
    });

    const lower10 = page.getByRole('radio', {
      name: '−10%',
      exact: true,
    });

    const lower20 = page.getByRole('radio', {
      name: '−20%',
      exact: true,
    });

    // AC4.4.1
    await expect(current).toBeVisible();

    // AC4.4.2
    await expect(lower10).toBeVisible();

    // AC4.4.3
    await expect(lower20).toBeVisible();

    // AC4.4.8 + AC4.4.9
    await expect(
      page.getByText(
        'Hypothetical scenario, not prediction.',
        { exact: true }
      )
    ).toBeVisible();

    // ------------------------------------------------
    // 0% - current recorded income
    // ------------------------------------------------

    await current.click();

    await expect(current).toHaveAttribute(
      'aria-checked',
      'true'
    );

    // AC4.4.5
    await expect(
      page.getByLabel('Income shock 0% result')
    ).toBeVisible();

    // AC4.4.7
    await expect(
      page.getByLabel(
        'Income shock 0% recorded-month chart'
      )
    ).toBeVisible();

    // AC4.4.6
    const gap0 = page.getByText(/largest gap RM/i);

    if (await gap0.isVisible().catch(() => false)) {
      await expect(gap0).toBeVisible();
    }

    await page.screenshot({
      path: path.join(
        EVIDENCE,
        '04-us4.4-current-income.png'
      ),
      fullPage: true,
    });

    // ------------------------------------------------
    // 10% lower income
    // ------------------------------------------------

    await lower10.click();

    await expect(lower10).toHaveAttribute(
      'aria-checked',
      'true'
    );

    // AC4.4.5
    await expect(
      page.getByLabel('Income shock 10% result')
    ).toBeVisible();

    // AC4.4.7
    await expect(
      page.getByLabel(
        'Income shock 10% recorded-month chart'
      )
    ).toBeVisible();

    // AC4.4.6
    const gap10 = page.getByText(/largest gap RM/i);

    if (await gap10.isVisible().catch(() => false)) {
      await expect(gap10).toBeVisible();
    }

    await page.screenshot({
      path: path.join(
        EVIDENCE,
        '05-us4.4-income-10-lower.png'
      ),
      fullPage: true,
    });

    // ------------------------------------------------
    // 20% lower income
    // ------------------------------------------------

    await lower20.click();

    await expect(lower20).toHaveAttribute(
      'aria-checked',
      'true'
    );

    // AC4.4.5
    await expect(
      page.getByLabel('Income shock 20% result')
    ).toBeVisible();

    // AC4.4.7
    await expect(
      page.getByLabel(
        'Income shock 20% recorded-month chart'
      )
    ).toBeVisible();

    // AC4.4.6
    const gap20 = page.getByText(/largest gap RM/i);

    if (await gap20.isVisible().catch(() => false)) {
      await expect(gap20).toBeVisible();
    }

    await page.screenshot({
      path: path.join(
        EVIDENCE,
        '06-us4.4-income-20-lower.png'
      ),
      fullPage: true,
    });
  }
);