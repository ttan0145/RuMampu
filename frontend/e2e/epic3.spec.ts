import { expect } from '@playwright/test';
import { e2ePost, test } from './support/fixtures';

import { ac } from './support/acceptance';
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

    await ac('AC3.1.1', 'Use recorded financial history', async () => {
      await expect(page.getByText(/12 months of income recorded/)).toBeVisible();
    });

    await captureEvidence(page, 'epic-3', '01-pre-housing-check.png');

    await page.getByText('Test', { exact: true }).last().click();

    await expect(page.getByText('Property price (RM)', { exact: true })).toBeVisible();

    const inputs = page.locator('input:visible');

    await ac('AC3.1.2', 'Enter property price', async () => {
      await expect(inputs.nth(0)).toBeVisible();
      await inputs.nth(0).fill('250000');
    });

    await ac('AC3.1.3', 'Enter deposit amount', async () => {
      await expect(inputs.nth(1)).toBeVisible();
      await inputs.nth(1).fill('0');
    });

    await ac('AC3.1.4', 'Enter interest or profit rate', async () => {
      await expect(inputs.nth(2)).toBeVisible();
      await inputs.nth(2).fill('4.3');
    });

    await ac('AC3.1.5', 'Enter loan tenure', async () => {
      await expect(inputs.nth(3)).toBeVisible();
      await inputs.nth(3).fill('35');
    });

    await page.getByText('The house', { exact: true }).click();

    await ac('AC3.1.6', 'Calculate financing amount', async () => {
      await expect(page.getByText('RM 250,000.00', { exact: true })).toBeVisible();
    });

    await captureEvidence(page, 'epic-3', '02-housing-input.png');

    await page.getByText(/Total monthly cost/).last().click();

    await ac('AC3.1.7', 'Display total monthly housing cost', async () => {
      await expect(page.getByText('Total monthly cost', { exact: true })).toBeVisible();
    });

    await captureEvidence(page, 'epic-3', '03-before-running-test.png');

    await page.getByText(/Run the test/).last().click();

    await ac('AC3.1.8', 'Test housing cost against recorded history', async () => {
      await expect(
        page.getByText(/2 of your 12 recorded months would have run short/)
      ).toBeVisible();
    });

    await ac('AC3.1.9', 'Display historical shortfall amount', async () => {
      await expect(page.getByText('RM 742.37', { exact: true })).toBeVisible();
    });

    await captureEvidence(page, 'epic-3', '04-historical-housing-result.png');
  });
});
