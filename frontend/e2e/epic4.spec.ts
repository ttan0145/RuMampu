import { expect, Page } from '@playwright/test';
import { e2eGet, e2ePost, test } from './support/fixtures';

import { ac, deferredAc } from './support/acceptance';
import { API, captureEvidence, openApp } from './support/app';

async function openHousingResult(page: Page): Promise<void> {
  const loaded = await e2ePost(page, `${API}/dev/scenarios/my-gig-driver-12m/load/`, {
    data: {
      confirm_reset: true,
    },
  });

  expect(loaded.status()).toBe(201);

  await openApp(page);

  // v24 house test: the price, then the default deposit, rate and tenure
  // (RM 250,000 costs RM 1,382.37 a month with them).
  await page.getByRole('tab', { name: 'House', exact: true }).click();
  await page.getByText('Test a house', { exact: true }).click();
  await expect(page.getByText('Property price', { exact: true })).toBeVisible();
  await page.locator('input:visible').nth(0).fill('250000');
  await page.getByText('The house', { exact: true }).click();
  await expect(page.getByText('Total monthly cost', { exact: true })).toBeVisible();
  await expect(page.getByText('RM 1,382.37', { exact: true })).toBeVisible();
  await page.getByText('Run the test', { exact: true }).last().click();
  await expect(page.getByText('2 of 12 months would run short', { exact: true })).toBeVisible();
}

async function openPaymentComparison(page: Page): Promise<void> {
  await openHousingResult(page);

  await page.getByText('Compare payments', { exact: true }).click();

  await expect(
    page.getByText('Same recorded months, three payments.', { exact: true })
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
    await openHousingResult(page);
    // v24 keeps the income drop as one quiet row on the result's chart card:
    // "If income drops" with 0%, -10% and -20%, and the result above it is re-run.
    const row = page.getByText('If income drops', { exact: true }).locator('xpath=..');
    const option = (label: string) => row.getByText(label, { exact: true });

    await ac('AC4.4.1', 'Provide 0% scenario', async () => {
      await expect(option('0%')).toBeVisible();
    });
    await ac('AC4.4.2', 'Provide 10% scenario', async () => {
      await expect(option('−10%')).toBeVisible();
    });
    await ac('AC4.4.3', 'Provide 20% scenario', async () => {
      await expect(option('−20%')).toBeVisible();
    });
    deferredAc(
      'AC4.4.4',
      'Provide custom percentage',
      'The v24 result offers 0%, -10% and -20% only. The If income drops screen that took a custom percentage is still in the code but nothing links to it, so restoring Custom needs a decision and a change to the app.',
    );

    // The server's figures for the same saved scenario at a 20% drop.
    const scenarios = await (await e2eGet(page, `${API}/housing/scenarios/`)).json();
    const scenario = scenarios.find((item: { property_price: string | null }) => Number(item.property_price) === 250000);
    expect(scenario).toBeTruthy();
    const stressed = await (await e2ePost(page, `${API}/housing/test-result/`, {
      data: { scenario_id: scenario.id, income_shock_percent: '20.00' },
    })).json();
    expect(stressed.short_month_count).toBeGreaterThan(2);
    const money = (value: number) => `RM ${value.toLocaleString('en-MY', {
      minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
      maximumFractionDigits: 2,
    })}`;

    await option('−20%').click();
    await ac('AC4.4.5', 'Display stressed short-month count', async () => {
      await expect(page.getByText(`${stressed.short_month_count} of 12 months would run short`, { exact: true })).toBeVisible();
      await expect(page.getByText('2 of 12 months would run short', { exact: true })).toHaveCount(0);
    });
    await ac('AC4.4.6', 'Display largest stressed gap', async () => {
      await expect(page.getByText(new RegExp(`Largest gap ${money(stressed.largest_gap).replace(/[.]/g, '\\.')}\\.`))).toBeVisible();
    });
    await ac('AC4.4.7', 'Display month-by-month stressed chart', async () => {
      for (const month of ['AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL']) {
        await expect(page.getByText(month, { exact: true }).first()).toBeVisible();
      }
      await expect(page.getByText('This home’s monthly cost', { exact: true })).toBeVisible();
    });
    deferredAc(
      'AC4.4.8',
      'Identify the scenario as an assumption',
      'The v24 result re-runs at the chosen drop but no longer marks it as an assumption; that note lived on the If income drops screen, which nothing links to now.',
    );
    deferredAc(
      'AC4.4.9',
      'Avoid presenting the stress test as a prediction',
      'The "hypothetical about your recorded months, not about what lies ahead" wording sits on the unlinked If income drops screen and is not shown on the v24 result.',
    );
    await captureEvidence(page, 'epic-4', '06-us4.4-income-20-lower.png');

    // Back to the recorded income.
    await option('0%').click();
    await expect(page.getByText('2 of 12 months would run short', { exact: true })).toBeVisible();
  });
});
