import { expect } from '@playwright/test';
import { test } from './support/fixtures';
import { openGuestApp } from './support/app';

/* Price Explorer: the price model page. The local test backend runs on SQLite
   with the model export loaded (playwright.config.ts), so ranges and typical
   prices are real model output. The raw NAPIC sales table is Neon-only, so the
   map's share-of-sales figures show as "few sales" here. */

test('open from house costs, set a price, pick Petaling, send its typical price to the stress test', async ({ page }) => {
  await openGuestApp(page);
  await page.getByRole('tab', { name: 'House', exact: true }).click();
  await page.getByText('House costs', { exact: true }).first().click();
  await page.getByText('See where my price fits', { exact: true }).click();

  // a new user is told what the page does, and a default price is not called theirs
  await expect(page.getByText('Find areas with homes at your price, then test one.', { exact: true })).toBeVisible();
  await expect(page.getByText('A price to explore', { exact: true })).toBeVisible();
  await expect(page.getByText('Pick an area below ↓', { exact: true })).toBeVisible();

  // dragging the safe price changes it, in RM 10,000 steps
  const before = await page.getByTestId('px-budget').inputValue();
  const box = (await page.getByLabel('Slide the price').boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.22, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByTestId('px-budget')).not.toHaveValue(before);
  await expect(page.getByTestId('px-budget')).toHaveValue(/^[\d,]*0,000$/);

  // or typed exactly
  await page.getByTestId('px-budget').fill('520000');
  await page.getByTestId('px-budget').press('Enter');
  await expect(page.getByTestId('px-budget')).toHaveValue('520,000');

  // the list opens first; the map is one tab away
  await expect(page.getByText('typical RM 634k', { exact: true })).toBeVisible();
  await expect(page.getByLabel('District map of Selangor, Kuala Lumpur and Putrajaya')).toHaveCount(0);
  await page.getByText('Petaling', { exact: true }).first().click();

  await expect(page.getByRole('heading', { name: 'A terrace in Petaling' })).toBeVisible();
  await expect(page.getByTestId('px-range')).toHaveText('RM 519k – 923k');
  await expect(page.getByText('Typical RM 634,000', { exact: false }).first()).toBeVisible();

  // a what-if, never a single future price
  await expect(page.getByText('If recent trends continue. Not a prediction.', { exact: true })).toBeVisible();

  await page.getByTestId('px-cta').click();
  await expect(page.getByPlaceholder('e.g. 250,000')).toHaveValue('634000');
});

/* House costs as search results: the raw NAPIC sales table is Neon-only, so
   these figures come from a stubbed response with the real response shape. */
test('house costs: filter chips, search across states, sort', async ({ page }) => {
  await page.route('**/api/v1/housing/house-costs/**', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      window: { from: '2025Q3', to: '2026Q2', quarters: 4 }, income_year: 2024, affordable_threshold: 300000,
      states: {
        sgr: { name: 'Selangor', income: 10726, types: { all: { Klang: [852, 480000, 120], 'Kuala Langat': [293, 440000, 56], Petaling: [1034, 700000, 40] }, terr: {}, condo: {}, flat: {}, lch: {}, lcf: {} } },
        kul: { name: 'W.P. Kuala Lumpur', income: 13325, types: { all: { 'Kuala Lumpur': [2000, 620000, 300] }, terr: {}, condo: {}, flat: {}, lch: {}, lcf: {} } },
      },
    }),
  }));
  await openGuestApp(page);
  await page.getByRole('tab', { name: 'House', exact: true }).click();
  await page.getByText('House costs', { exact: true }).first().click();

  await expect(page.getByText('3 districts in Selangor', { exact: true })).toBeVisible();
  await expect(page.getByText('Homes sold Jul 2025 to Jun 2026', { exact: true })).toBeVisible();
  // most affordable first
  const names = page.locator('[data-testid^="fh-card-"]');
  await expect(names.first()).toHaveAttribute('data-testid', 'fh-card-Kuala Langat');

  await page.getByTestId('fh-sort').click();
  await page.getByText('Highest price', { exact: true }).click();
  await expect(names.first()).toHaveAttribute('data-testid', 'fh-card-Petaling');

  // the map uses the real district outlines; tapping one shows its numbers
  await page.getByRole('tab', { name: 'Map', exact: true }).click();
  await expect(page.getByLabel('Map of districts in Selangor')).toBeVisible();
  await page.getByLabel('Klang', { exact: true }).click();
  await expect(page.getByText('Middle sale price', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'List', exact: true }).click();

  // a name search looks in every state, and says which state each result is in
  await page.getByTestId('fh-search').fill('kuala');
  await expect(page.getByText('2 results for “kuala”', { exact: true })).toBeVisible();
  await expect(page.getByText('W.P. Kuala Lumpur', { exact: true })).toBeVisible();
  await page.getByTestId('fh-search').fill('zzz');
  await expect(page.getByText('No district matches “zzz”.', { exact: true })).toBeVisible();

  await page.getByTestId('fh-search').fill('');
  await page.getByTestId('fh-px').click();
  await expect(page.getByText('Find areas with homes at your price, then test one.', { exact: true })).toBeVisible();
});
