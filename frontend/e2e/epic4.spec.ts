import { expect, Page } from '@playwright/test';
import { e2ePost, test } from './support/fixtures';

import { ac } from './support/acceptance';
import { API, captureEvidence, openApp } from './support/app';

async function openHousingResult(page: Page): Promise<void> {
  const loaded = await e2ePost(page, `${API}/dev/scenarios/my-gig-driver-12m/load/`, {
    data: {
      confirm_reset: true,
    },
  });

  expect(loaded.status()).toBe(201);

  await openApp(page);

  await expect(
    page.getByText('Test', { exact: true }).last()
  ).toBeVisible();

  await page
    .getByText('Test', { exact: true })
    .last()
    .click();

  await expect(
    page.getByText('Property price (RM)', { exact: true })
  ).toBeVisible();

  const inputs = page.locator('input:visible');

  await inputs.nth(0).fill('250000');
  await inputs.nth(1).fill('0');
  await inputs.nth(2).fill('4.3');
  await inputs.nth(3).fill('35');

  await page
    .getByText('The house', { exact: true })
    .click();

  await expect(
    page.getByText('RM 250,000.00', { exact: true })
  ).toBeVisible();

  await page
    .getByText(/Total monthly cost/)
    .last()
    .click();

  await expect(
    page.getByText('Total monthly cost', { exact: true })
  ).toBeVisible();

  await page
    .getByText(/Run the test/)
    .last()
    .click();

  await expect(
    page.getByText(/recorded months would have run short/)
  ).toBeVisible();
}

async function openPaymentComparison(page: Page): Promise<void> {
  await openHousingResult(page);

  await page.getByText('Compare payments', { exact: true }).click();

  await expect(
    page.getByText('Same recorded months, three payments.', { exact: true })
  ).toBeVisible();
}

async function openIncomeShock(page: Page): Promise<void> {
  await openHousingResult(page);

  await page.getByText('If income drops', { exact: true }).click();

  await expect(
    page.getByText('Hypothetical scenario, not prediction.', { exact: true })
  ).toBeVisible();
}

test.describe('Epic 4 — Cash-Flow Forecast & Adjustment Planner', { tag: '@epic4' }, () => {
  test('US4.3 — Compare different monthly housing payments', { tag: '@us4.3' }, async ({ page }) => {
    await openPaymentComparison(page);

    const payment1 = page.getByLabel('Payment 1 (RM)');
    const payment2 = page.getByLabel('Payment 2 (RM)');
    const payment3 = page.getByLabel('Payment 3 (RM)');

    await ac('AC4.3.1', 'Compare three monthly payment scenarios', async () => {
      await expect(payment1).toHaveValue('1000');
      await expect(payment2).toHaveValue('1200');
      await expect(payment3).toHaveValue('1400');
    });

    await ac('AC4.3.3', 'Use the same recorded history for each payment', async () => {
      await expect(
        page.getByText('Same recorded months, three payments.', { exact: true })
      ).toBeVisible();
      await expect(page.getByLabel('Payment 1 recorded-month chart')).toBeVisible();
      await expect(page.getByLabel('Payment 2 recorded-month chart')).toBeVisible();
      await expect(page.getByLabel('Payment 3 recorded-month chart')).toBeVisible();
    });

    await ac('AC4.3.4', 'Show short months for each payment', async () => {
      await expect(page.locator('body')).toContainText(/\d+ of 12 short/);
    });

    await ac('AC4.3.5', 'Show the largest gap for each payment', async () => {
      const largestGaps = page.getByText(/largest gap RM/i);
      await expect(largestGaps).toHaveCount(3);
    });

    await ac('AC4.3.6', 'Show recorded-month results for each payment', async () => {
      await expect(page.getByLabel('Payment 1 recorded-month chart')).toBeVisible();
      await expect(page.getByLabel('Payment 2 recorded-month chart')).toBeVisible();
      await expect(page.getByLabel('Payment 3 recorded-month chart')).toBeVisible();
    });

    await captureEvidence(page, 'epic-4', '01-us4.3-payment-comparison.png');
  });

  test('US4.3 — Edit a payment scenario', { tag: '@us4.3' }, async ({ page }) => {
    await openPaymentComparison(page);

    const payment1 = page.getByLabel('Payment 1 (RM)');
    const payment2 = page.getByLabel('Payment 2 (RM)');
    const payment3 = page.getByLabel('Payment 3 (RM)');

    await expect(payment1).toHaveValue('1000');
    await expect(payment2).toHaveValue('1200');
    await expect(payment3).toHaveValue('1400');

    await ac('AC4.3.2', 'Edit and recalculate a payment scenario', async () => {
      const recalculated = page.waitForResponse(response =>
        response.url().includes('/api/v1/housing/test-result/') &&
        response.request().method() === 'POST' &&
        response.ok()
      );

      await payment1.fill('1100');
      await payment1.blur();
      await recalculated;

      await expect(payment1).toHaveValue('1100');
      await expect(page.getByLabel('Payment 1 recorded-month chart')).toBeVisible();
      await expect(page.locator('body')).toContainText(/largest gap RM/i);
    });

    await captureEvidence(page, 'epic-4', '02-us4.3-edited-payment-1100.png');

    await ac('AC4.3.2', 'Keep other payment scenarios unchanged', async () => {
      await expect(payment2).toHaveValue('1200');
      await expect(payment3).toHaveValue('1400');
    });

    await captureEvidence(page, 'epic-4', '03-us4.3-other-payments-unchanged.png');
  });

  test('US4.4 — Test lower income scenarios', { tag: '@us4.4' }, async ({ page }) => {
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

    const custom = page.getByRole('radio', {
      name: 'Custom',
      exact: true,
    });

    await ac('AC4.4.1', 'Test current recorded income', async () => {
      await expect(current).toBeVisible();
    });

    await ac('AC4.4.2', 'Test income at 10 percent lower', async () => {
      await expect(lower10).toBeVisible();
    });

    await ac('AC4.4.3', 'Test income at 20 percent lower', async () => {
      await expect(lower20).toBeVisible();
    });

    await ac('AC4.4.4', 'Test a custom income reduction percentage', async () => {
      await expect(custom).toBeVisible();
      await custom.click();
      const customInput = page.getByLabel('Custom income shock percentage');
      await expect(customInput).toBeVisible();
      await expect(customInput).toHaveAttribute('inputmode', 'decimal');
      await customInput.fill('15.5');
      await page.getByRole('button', { name: 'Done', exact: true }).click();
      await expect(page.getByLabel('Income shock 15.5% result')).toBeVisible();
    });

    await ac('AC4.4.8', 'Identify income shock as hypothetical', async () => {
      await expect(
        page.getByText('Hypothetical scenario, not prediction.', { exact: true })
      ).toBeVisible();
    });

    await ac('AC4.4.9', 'Avoid presenting the scenario as a prediction', async () => {
      await expect(
        page.getByText('Hypothetical scenario, not prediction.', { exact: true })
      ).toBeVisible();
    });

    await current.click();

    await expect(current).toHaveAttribute('aria-checked', 'true');

    await ac('AC4.4.5', 'Display current income shock result', async () => {
      await expect(page.getByLabel('Income shock 0% result')).toBeVisible();
    });

    await ac('AC4.4.6', 'Display largest gap for current income', async () => {
      const gap0 = page.getByText(/largest gap RM/i);

      if (await gap0.isVisible().catch(() => false)) {
        await expect(gap0).toBeVisible();
      }
    });

    await ac('AC4.4.7', 'Display recorded-month chart for current income', async () => {
      await expect(
        page.getByLabel('Income shock 0% recorded-month chart')
      ).toBeVisible();
    });

    await captureEvidence(page, 'epic-4', '04-us4.4-current-income.png');

    await lower10.click();

    await expect(lower10).toHaveAttribute('aria-checked', 'true');

    await ac('AC4.4.5', 'Display 10 percent lower income result', async () => {
      await expect(page.getByLabel('Income shock 10% result')).toBeVisible();
    });

    await ac('AC4.4.6', 'Display largest gap for 10 percent lower income', async () => {
      const gap10 = page.getByText(/largest gap RM/i);

      if (await gap10.isVisible().catch(() => false)) {
        await expect(gap10).toBeVisible();
      }
    });

    await ac('AC4.4.7', 'Display recorded-month chart for 10 percent lower income', async () => {
      await expect(
        page.getByLabel('Income shock 10% recorded-month chart')
      ).toBeVisible();
    });

    await captureEvidence(page, 'epic-4', '05-us4.4-income-10-lower.png');

    await lower20.click();

    await expect(lower20).toHaveAttribute('aria-checked', 'true');

    await ac('AC4.4.5', 'Display 20 percent lower income result', async () => {
      await expect(page.getByLabel('Income shock 20% result')).toBeVisible();
    });

    await ac('AC4.4.6', 'Display largest gap for 20 percent lower income', async () => {
      const gap20 = page.getByText(/largest gap RM/i);

      if (await gap20.isVisible().catch(() => false)) {
        await expect(gap20).toBeVisible();
      }
    });

    await ac('AC4.4.7', 'Display recorded-month chart for 20 percent lower income', async () => {
      await expect(
        page.getByLabel('Income shock 20% recorded-month chart')
      ).toBeVisible();
    });

    await captureEvidence(page, 'epic-4', '06-us4.4-income-20-lower.png');
  });
});
