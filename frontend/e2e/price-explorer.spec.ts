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
  await page.getByTestId('fh-px').click();

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

  // any state: Johor's districts, then back to Selangor
  await page.getByTestId('px-state').click();
  await page.getByText('Johor', { exact: true }).last().click();
  await expect(page.getByText('Johor Bahru', { exact: true })).toBeVisible();
  await page.getByTestId('px-state').click();
  await page.getByText('Selangor', { exact: true }).last().click();

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

/* House costs on a street map. "All homes" needs the raw NAPIC sales table, which
   only exists on Neon, so the area and district figures are stubbed with the real
   response shapes; map tiles are not fetched in tests. */
test('house costs map: list, district detail, budget, search', async ({ page }) => {
  await page.route('**/tile.openstreetmap.org/**', route => route.abort());
  const area = (district: string, typical: number | null, sales: number) => ({
    district, sales, share_under: typical ? 0.4 : null, typical, low: typical ? typical * 0.6 : null, high: typical ? typical * 1.8 : null,
  });
  await page.route('**/api/v1/housing/price-explorer/areas/**', route => {
    const state = new URL(route.request().url()).searchParams.get('state');
    const areas = state === 'SGR' ? [area('Klang', 480000, 852), area('Petaling', 670000, 1034), area('Sabak Bernam', null, 3)]
      : state === 'KUL' ? [area('Kuala Lumpur', 710000, 2000)] : [];
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({
      model_version: 'pm-test', budget: 450000, window: { from: '2025Q3', to: '2026Q2' }, income: 10726, areas,
    }) });
  });
  await page.route('**/api/v1/housing/price-explorer/home/**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
    model_version: 'pm-test', district: 'Klang', state_code: 'SGR', property_type: 'all', tenure: 'F', tenures_available: [],
    size_band: 'typical', sizes: {}, size_m2: 0, storeys: 0, n_sales_2y: 852,
    today: { p10: 260000, p50: 480000, p90: 950000 },
    future: [1, 2, 3].map(y => ({ years: y, p10: null, p50: 480000 + y * 13000, p90: null, prob_lower: 0.1 })),
    trend_band: [1, 2, 3].map(y => ({ low: 470000 + y * 4000, high: 500000 + y * 20000 })),
    history: ['2025Q1', '2025Q2', '2025Q3', '2025Q4', '2026Q1', '2026Q2'].map((q, i) => ({ quarter: q, value: 465000 + i * 3000 })),
    last_year: 471000, income: 10726, trend: null, accuracy: { median_APE: 0.11, within_10pct: 0.5, within_20pct: 0.74, coverage80: 0.77 },
    drivers: [{ feature: 'dist_rail_km', description: 'Rail station', band: '<1 km', reference: '5 km+', effect_pct: 6.2 }],
    meta: { price_level_quarter: '2026Q2', test_window: ['2025Q3', '2026Q2'], test_sales: 100, overall: null, notes: '' },
  }) }));

  await openGuestApp(page);
  await page.getByRole('tab', { name: 'House', exact: true }).click();
  await page.getByText('House costs', { exact: true }).first().click();

  // the list: cheapest first, thin districts named below
  await expect(page.getByText('Selangor & KL', { exact: true })).toBeVisible();
  await expect(page.getByText('3 areas · cheapest first', { exact: true })).toBeVisible();
  const rows = page.locator('[data-testid^="hp-row-"]');
  await expect(rows.first()).toHaveAttribute('data-testid', 'hp-row-Klang');
  await expect(page.getByText('Not enough sales to show: Sabak Bernam.', { exact: true })).toBeVisible();
  // the busiest area gets a price pin; one that would overlap it becomes a dot
  await expect(page.getByTestId('pin-Kuala Lumpur')).toContainText('RM 710k');
  await expect(page.getByTestId('dot-Petaling')).toBeVisible();

  // a district: last year, now, in 3 years, and more details
  await page.getByTestId('hp-row-Klang').click();
  await expect(page.getByTestId('hp-now')).toHaveText('RM 480k');
  await expect(page.getByText('RM 471k', { exact: true })).toBeVisible();
  await expect(page.getByText('RM 519k', { exact: true })).toBeVisible();
  // hovering the chart shows that point's numbers
  const chart = page.getByTestId('hp-chart');
  await chart.scrollIntoViewIfNeeded();
  const box = (await chart.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.9, box.y + box.height / 2);   // clear of the Ask Ruma button at the edge
  await expect(page.getByTestId('hp-tip')).toContainText('in 3 years');
  await expect(page.getByTestId('hp-tip')).toContainText('RM 519k');
  await page.mouse.move(box.x + 2, box.y + box.height / 2);
  await expect(page.getByTestId('hp-tip')).toContainText('2025 Q1');
  await page.getByTestId('hp-more').click();
  await expect(page.getByText('Years of family income', { exact: true })).toBeVisible();
  await expect(page.getByText('3.7 years', { exact: true })).toBeVisible();
  await page.getByTestId('hp-back').click();

  // a budget tags each area
  await page.getByTestId('hp-budget').click();
  await page.getByTestId('hp-bud-in').fill('500000');
  await page.getByTestId('hp-bud-go').click();
  await expect(page.getByText('Within your budget', { exact: true })).toBeVisible();
  await expect(page.getByText('A stretch', { exact: true })).toHaveCount(2);

  // search opens a district from the list of every state
  await page.getByTestId('fh-search').fill('petal');
  await page.getByTestId('hp-hit-Petaling').click();
  await expect(page.getByText('Selangor · All homes', { exact: true })).toBeVisible();
  await page.getByTestId('hp-back').click();

  await page.getByTestId('fh-px').click();
  await expect(page.getByText('Find areas with homes at your price, then test one.', { exact: true })).toBeVisible();
});
