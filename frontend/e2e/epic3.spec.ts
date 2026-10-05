import { expect } from '@playwright/test';
import { e2ePost, test } from './support/fixtures';

import { ac, deferredAc } from './support/acceptance';
import { API, captureEvidence, openApp } from './support/app';

test.describe('Epic 3 — Housing Cost & Stress Test', { tag: '@epic3' }, () => {
  test('US3.1 — Test housing affordability against recorded financial history', { tag: '@us3.1' }, async ({ page }) => {
    const loaded = await e2ePost(page, `${API}/dev/scenarios/my-gig-driver-12m/load/`, {
      data: {
        confirm_reset: true,
      },
    });

    expect(loaded.status()).toBe(201);

    await openApp(page);
    await page.getByRole('tab', { name: 'House', exact: true }).click();
    await page.getByText('Test a house', { exact: true }).click();

    await test.step('Use recorded financial history', async () => {
      await expect(page.getByText(
        'Tell me the price. I’ll check it against your 12 recorded months and show you which ones would have run short.',
        { exact: true },
      )).toBeVisible();
    });

    await captureEvidence(page, 'epic-3', 'setup-e3__recorded-history.png');

    await ac('AC3.1.1', 'Enter property price', async () => {
      await expect(page.getByText('Property price', { exact: true })).toBeVisible();
      const price = page.locator('input:visible').nth(0);
      await price.fill('250000');
      await expect(price).toHaveValue('250000');
    });

    await ac('AC3.1.2', 'Enter deposit', async () => {
      await page.getByText('Other', { exact: true }).click();
      const deposit = page.getByLabel('Deposit', { exact: true });
      await deposit.fill('0');
      await page.getByText('The house', { exact: true }).click();
      await expect(page.getByText('Deposit · RM 0', { exact: true })).toBeVisible();
    });

    await expect(page.getByLabel('Ask Ruma', { exact: true })).toBeVisible();
    await page.getByText('Monthly instalment', { exact: true }).locator('xpath=../..').getByText('Edit', { exact: true }).click();
    const loan = page.getByRole('dialog');
    await expect(loan.getByText('Loan details', { exact: true })).toBeVisible();

    await ac('AC3.1.4', 'Enter financing rate', async () => {
      await expect(loan.getByText('Rate (% / year)', { exact: true })).toBeVisible();
      await loan.locator('input').nth(0).fill('4.3');
    });

    await ac('AC3.1.5', 'Enter loan tenure', async () => {
      await expect(loan.getByText('Tenure (years)', { exact: true })).toBeVisible();
      await loan.locator('input').nth(1).fill('35');
      await loan.getByRole('button', { name: 'Done', exact: true }).click();
      await expect(page.getByText('4.3% over 35 years', { exact: true })).toBeVisible();
    });

    deferredAc(
      'AC3.1.3',
      'Display financing amount',
      'The v24 house form shows the instalment worked out from the financing amount, but no longer shows the financing amount itself (the "Financing amount" label is in the string table and is not rendered). Showing it again needs a decision and a change to the app.',
    );

    await ac('AC3.1.6', 'Display monthly instalment', async () => {
      await expect(page.getByText('Monthly instalment', { exact: true }).locator('xpath=../..')).toContainText('RM 1,152.37');
    });
    await ac('AC3.1.7', 'Use a known monthly payment', async () => {
      await page.getByText('I already know my monthly payment', { exact: true }).click();
      const payment = page.locator('input:visible').nth(0);
      await payment.fill('1000');
      await expect(payment).toHaveValue('1000');
      await expect(page.getByText('RM 1,230', { exact: true })).toBeVisible();
      await page.getByText('Work it out from the price instead', { exact: true }).click();
    });

    await captureEvidence(page, 'epic-3', 'ac3.1.1-6__housing-input.png');

    await ac('AC3.2.4', 'Display total monthly cost', async () => {
      await expect(page.getByText('Total monthly cost', { exact: true })).toBeVisible();
      await expect(page.getByText('RM 1,382.37', { exact: true })).toBeVisible();
    });

    await captureEvidence(page, 'epic-3', 'ac3.2.4-5__total-monthly-cost.png');

    await ac('AC3.2.5', 'Start housing test', async () => {
      await page.getByText('Run the test', { exact: true }).last().click();
      await expect(page.getByText('2 of 12 months would run short', { exact: true })).toBeVisible();
    });

    await ac('AC3.4.1', 'Display short-month count', async () => {
      await expect(page.getByText('2 of 12 months would run short', { exact: true })).toBeVisible();
    });

    await ac('AC3.4.3', 'Display largest gap', async () => {
      await expect(page.getByText(/Largest gap RM 742\.37\./)).toBeVisible();
    });

    await captureEvidence(page, 'epic-3', 'ac3.3.1_ac3.4.1-6__historical-housing-result.png');
  });
});
