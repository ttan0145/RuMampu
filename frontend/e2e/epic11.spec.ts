import { expect, Locator, Page, Route } from '@playwright/test';
import { e2eGet, e2ePost, test } from './support/fixtures';
import { ac } from './support/acceptance';
import { API, openGuestApp, pinGuestClientId } from './support/app';
import type { PxAreasResponse, PxHomeResponse } from '../types/housing';

/* Epic 11 — Market Context / House costs (US/AC v7, 8 October 2026).
   11.4.6 and 11.4.7 are retired in v7 and are not tested.

   The local test backend runs on SQLite with the price model export loaded
   (playwright.config.ts), so every single home type (Terrace, Condo, ...) is
   priced by the real model here. Two Neon-only tables are missing on SQLite:
   - property_transaction (NAPIC raw sales): "All homes" typical prices, the
     quarters window and the share of sales under a budget come from it;
   - state_income (DOSM): the household income behind years of family income.
   Where an AC is about how the screen presents those figures, the API
   responses are answered with the real response shapes: "All homes" areas
   and district details come from the fixture below, single types pass
   through to the real backend and only a missing income (or, on Where my
   price fits, a missing share of sales) is filled in from TEST_INCOME /
   TEST_SHARE. The incomes are the published DOSM 2024 medians; the shares are test fixtures.
   Map tiles are never fetched in tests. */

const AREAS = '**/api/v1/housing/price-explorer/areas/**';
const HOME = '**/api/v1/housing/price-explorer/home/**';
const HOUSE_COSTS = '**/api/v1/housing/house-costs/**';

/* DOSM 2024 median household income by state, from backend/data/state_income.csv,
   the same figures the Neon state_income table holds. */
const TEST_INCOME: Record<string, number> = { SGR: 10726, KUL: 10802, PJY: 10769, JHR: 7712, PLS: 4950 };

type Area = PxAreasResponse['areas'][number];
const k1000 = (v: number) => Math.round(v / 1000) * 1000;
const area = (district: string, typical: number | null, sales: number, share = 0.4): Area => ({
  district, sales, share_under: typical ? share : null, typical,
  low: typical ? k1000(typical * 0.6) : null, high: typical ? k1000(typical * 1.8) : null,
});

/* "All homes" as the Neon backend returns it: the median of the last four
   quarters of NAPIC sales, no price where fewer than eight homes sold. */
const ALL_HOMES: Record<string, Area[]> = {
  SGR: [
    area('Gombak', 600000, 520, 0.3), area('Hulu Langat', 560000, 700, 0.35), area('Hulu Selangor', 350000, 180, 0.7),
    area('Klang', 480000, 852, 0.4), area('Kuala Langat', 390000, 240, 0.6), area('Kuala Selangor', 420000, 200, 0.55),
    area('Petaling', 670000, 1034, 0.2), area('Sabak Bernam', null, 7), area('Sepang', 520000, 300, 0.38),
  ],
  KUL: [area('Kuala Lumpur', 710000, 2000, 0.15)],
  PJY: [area('Putrajaya', 750000, 40, 0.1)],
};
const ALL_WINDOW = { from: '2025Q3', to: '2026Q2' };
const DRIVERS = [
  { feature: 'dist_kl_km', description: 'Distance to KL centre', band: '<10 km', reference: '50 km+', effect_pct: 20.8 },
  { feature: 'dist_kl_km', description: 'Distance to KL centre', band: '10-25 km', reference: '50 km+', effect_pct: 11.0 },
  { feature: 'dist_state_capital_km', description: 'Distance to state capital', band: '<10 km', reference: '50 km+', effect_pct: 10.4 },
  { feature: 'n_shop_2km', description: 'Shops / malls within 2 km', band: '31+', reference: '0-2', effect_pct: 6.8 },
  { feature: 'dist_rail_km', description: 'Rail station (open at sale date)', band: '<1 km', reference: '5 km+', effect_pct: 1.9 },
];

function allHomesDetail(district: string): PxHomeResponse | null {
  const state = Object.keys(ALL_HOMES).find(s => ALL_HOMES[s].some(a => a.district === district));
  const a = state ? ALL_HOMES[state].find(x => x.district === district) : undefined;
  if (!state || !a?.typical) return null;
  const T = a.typical;
  const quarters: string[] = [];
  for (let y = 2021; y <= 2026; y += 1) for (let q = 1; q <= 4; q += 1) if (!(y === 2021 && q < 4) && !(y === 2026 && q > 2)) quarters.push(`${y}Q${q}`);
  const history = quarters.map((quarter, i) => ({ quarter, value: k1000(T * (0.85 + (0.15 * i) / (quarters.length - 1))) }));
  const future = ([1, 2, 3] as const).map(years => ({ years, p10: null as unknown as number, p50: k1000(T * (1 + 0.025 * years)), p90: null as unknown as number, prob_lower: 0.12 }));
  return {
    model_version: 'pm-test', district, state_code: state, property_type: 'all',
    history, last_year: history[history.length - 5].value,
    trend_band: future.map(f => ({ low: k1000(f.p50 * 0.95), high: k1000(f.p50 * 1.06) })),
    income: TEST_INCOME[state] ?? null, tenure: 'F', tenures_available: [], size_band: 'typical', sizes: {},
    size_m2: 0, storeys: 0, n_sales_2y: a.sales,
    today: { p10: a.low!, p50: T, p90: a.high! }, future, trend: null,
    accuracy: { median_APE: 0.11, within_10pct: 0.5, within_20pct: 0.74, coverage80: 0.77 },
    drivers: DRIVERS,
    meta: { price_level_quarter: '2026Q2', test_window: ['2025Q3', '2026Q2'], test_sales: 32070, overall: null, notes: '' },
  };
}

/* Keeps calls on this run's backend even if a cached bundle still points at :8000. */
const backendUrl = (url: string) => url.replace('://localhost:8000/', `://localhost:${process.env.PLAYWRIGHT_BACKEND_PORT || '8000'}/`);

async function passThrough<T>(route: Route, patch: (body: T) => void): Promise<void> {
  try {
    const response = await route.fetch({ url: backendUrl(route.request().url()) });
    if (response.status() !== 200) return await route.fulfill({ response });
    const body = await response.json() as T;
    patch(body);
    return await route.fulfill({ response, json: body });
  } catch (error) {
    // a request still in flight when the test ends has nobody left to answer
    if (!/Test ended|Target page, context or browser has been closed/.test(String(error))) throw error;
  }
}

/* Answers the price explorer API as described at the top of this file. */
async function stubMarket(page: Page, options: { allHomes?: boolean; share?: Record<string, Record<string, number>> } = {}): Promise<void> {
  const allHomes = options.allHomes ?? true;
  await page.route('**/tile.openstreetmap.org/**', route => route.abort());
  await page.route(AREAS, route => {
    const params = new URL(route.request().url()).searchParams;
    const state = params.get('state') ?? '';
    const type = params.get('property_type');
    if (type === 'all' && allHomes) {
      return route.fulfill({ json: {
        model_version: 'pm-test', budget: Number(params.get('budget')), window: ALL_WINDOW,
        income: TEST_INCOME[state] ?? null, areas: ALL_HOMES[state] ?? [],
      } });
    }
    return passThrough<PxAreasResponse>(route, body => {
      if (body.income == null && TEST_INCOME[state]) body.income = TEST_INCOME[state];
      const share = options.share?.[state];
      if (share) body.areas.forEach(a => { if (a.share_under == null && share[a.district] != null) a.share_under = share[a.district]; });
    });
  });
  await page.route(HOME, route => {
    const params = new URL(route.request().url()).searchParams;
    if (params.get('property_type') === 'all' && allHomes) {
      const detail = allHomesDetail(params.get('district') ?? '');
      return detail ? route.fulfill({ json: detail })
        : route.fulfill({ status: 404, json: { detail: 'not enough sales for this district and type' } });
    }
    return passThrough<PxHomeResponse>(route, body => {
      if (body.income == null && TEST_INCOME[body.state_code]) body.income = TEST_INCOME[body.state_code];
    });
  });
}

/* ---------- reading the real backend ---------- */

async function apiAreas(page: Page, state: string, type: string, budget = 400000): Promise<PxAreasResponse> {
  const res = await e2eGet(page, `${API}/housing/price-explorer/areas/?state=${state}&property_type=${type}&budget=${budget}`);
  expect(res.status()).toBe(200);
  return res.json();
}
async function apiHome(page: Page, district: string, type: string, size = 'typical'): Promise<PxHomeResponse> {
  const res = await e2eGet(page, `${API}/housing/price-explorer/home/?district=${encodeURIComponent(district)}&property_type=${type}&tenure=F&size=${size}`);
  expect(res.status()).toBe(200);
  return res.json();
}

/* the app's own display formats (priceExplorer.ts rmK, homecosts.tsx pct) */
const rmK = (v: number) => (v >= 1e6 ? `RM ${(v / 1e6).toFixed(2).replace(/\.?0+$/, '')}m` : `RM ${Math.round(v / 1000)}k`);
const pctChange = (a: number, b: number) => {
  const g = (a / b - 1) * 100;
  return `${g >= 0 ? '+' : '−'}${Math.abs(g).toFixed(Math.abs(g) < 10 ? 1 : 0)}%`;
};
const fromRmK = (s: string) => {
  const m = s.match(/RM ([\d.]+)(k|m)/);
  if (!m) throw new Error(`no RM figure in "${s}"`);
  return Math.round(Number(m[1]) * (m[2] === 'm' ? 1e6 : 1e3));
};
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ---------- House costs on screen ---------- */

const rows = (page: Page) => page.locator('[data-testid^="hp-row-"]');
const sheetHandle = (page: Page) => page.getByLabel('Drag to see more', { exact: true });
const FIT_DOTS: Record<string, string> = { 'rgb(47, 168, 79)': 'Within your budget', 'rgb(233, 164, 0)': 'A stretch', 'rgb(229, 83, 42)': 'Above your budget' };
const SHADE = ['#cdebe4', '#8fcfc4', '#4a9195', '#2c5f62'];

async function openHouseCosts(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'House', exact: true }).click();
  await page.getByText('House costs', { exact: true }).first().click();
  await expect(page.getByTestId('hp-state')).toBeVisible();
}

async function rowList(page: Page): Promise<{ d: string; price: number; text: string }[]> {
  return (await rows(page).evaluateAll(els => els.map(e => ({ d: e.getAttribute('data-testid')!.slice(7), text: (e as HTMLElement).innerText }))))
    .map(r => ({ ...r, price: fromRmK(r.text) }));
}

async function pickKind(page: Page, kind: string, caption: RegExp): Promise<void> {
  await page.getByTestId(`hp-kind-${kind}`).click();
  // the list has reloaded for this type
  await expect(page.getByText(/^\d+ areas · cheapest first$|^No sales for this home type here\. Try another type\.$/).first()).toBeVisible();
  await expect(page.getByText(caption)).toBeVisible();
}

async function pickState(page: Page, label: string): Promise<void> {
  await page.getByTestId('hp-state').click();
  await expect(page.getByText('Choose a state', { exact: true })).toBeVisible();
  await page.getByText(label, { exact: true }).last().click();
  await expect(page.getByText('Choose a state', { exact: true })).toHaveCount(0);
  await expect(page.getByTestId('hp-state')).toHaveText(label);
}

/* the fill of a district outline, as a lower-case hex colour (or url(...) for a pattern) */
async function fillOf(locator: Locator): Promise<string> {
  return locator.evaluate(el => {
    const v = el.getAttribute('fill') ?? '';
    if (v.startsWith('url')) return v;
    const c = document.createElement('canvas').getContext('2d')!;
    c.fillStyle = v;
    return String(c.fillStyle).toLowerCase();
  });
}

/* the budget dot on a price pin, read back as the fit it stands for */
async function pinFit(pin: Locator): Promise<string | null> {
  const colour = await pin.evaluate((el, dots) => {
    for (const n of Array.from(el.querySelectorAll('div'))) {
      const c = getComputedStyle(n).backgroundColor;
      if (dots.includes(c)) return c;
    }
    return null;
  }, Object.keys(FIT_DOTS));
  return colour ? FIT_DOTS[colour] : null;
}

async function areaWidth(page: Page, district: string): Promise<number> {
  return (await page.getByTestId(`area-${district}`).boundingBox())?.width ?? 0;
}

/* drags the list sheet's handle to a screen height and lets it settle on the nearest stop */
async function dragSheetTo(page: Page, y: number): Promise<void> {
  const box = (await sheetHandle(page).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  const y0 = box.y + box.height / 2;
  for (let i = 1; i <= 20; i += 1) {
    await page.mouse.move(box.x + box.width / 2, y0 + ((y - y0) * i) / 20);
  }
  await page.mouse.up();
  await page.waitForTimeout(400);
}
async function tapSheetHandle(page: Page): Promise<void> {
  const box = (await sheetHandle(page).boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(400);
}
const handleY = async (page: Page) => (await sheetHandle(page).boundingBox())!.y;
/* the handle's position once the sheet has stopped moving */
async function settledY(page: Page): Promise<number> {
  let last = await handleY(page);
  for (let i = 0; i < 30; i += 1) {
    await page.waitForTimeout(120);
    const y = await handleY(page);
    if (Math.abs(y - last) < 0.5) return y;
    last = y;
  }
  return last;
}

async function openInfo(page: Page): Promise<void> {
  await page.getByText('Where these numbers come from', { exact: true }).first().click();
  await expect(page.getByText('This is about places, not about you.', { exact: true })).toBeVisible();
}
async function closeSheet(page: Page): Promise<void> {
  await page.getByText('✕', { exact: true }).last().click();
}

const CAP_ALL = 'Typical prices from real sales recorded by NAPIC, 2025 Q3 to 2026 Q2.';
const CAP_TYPE = 'Typical prices from the RuMampu price model, built on NAPIC sales.';
const KINDS: [string, string][] = [
  ['all', 'All homes'], ['terrace', 'Terrace'], ['condo', 'Condo'], ['semi_detached', 'Semi-D'], ['low_cost_house', 'Low-cost house'],
  ['flat', 'Flat'], ['townhouse', 'Townhouse'], ['detached', 'Bungalow'], ['cluster', 'Cluster'], ['low_cost_flat', 'Low-cost flat'],
];
const KV_DISTRICTS = ['Gombak', 'Hulu Langat', 'Hulu Selangor', 'Klang', 'Kuala Langat', 'Kuala Lumpur', 'Kuala Selangor', 'Petaling', 'Putrajaya', 'Sabak Bernam', 'Sepang'];

test.describe('Epic 11 — Market Context (House costs)', { tag: '@epic11' }, () => {
  test('US11.1 / US11.4 / US11.7 — House costs opens as a guest on a district map', { tag: ['@us11.1', '@us11.4', '@us11.7'] }, async ({ page }) => {
    test.setTimeout(240_000);
    await stubMarket(page);
    /* the published figures behind the House tab card (Neon-only house-costs view) */
    await page.route(HOUSE_COSTS, route => route.fulfill({ json: {
      window: { from: '2025Q3', to: '2026Q2', quarters: 4 }, income_year: 2024, affordable_threshold: 300000,
      states: { sgr: { name: 'Selangor', income: 10726, types: {
        all: { 'Sabak Bernam': [60, 335000, 40], Klang: [852, 480000, 200], Petaling: [1034, 670000, 100] },
        terr: {}, condo: {}, flat: {}, lch: {}, lcf: {},
      } } },
    } }));
    await openGuestApp(page);

    await ac('AC11.4.9', 'A state summary on the House tab', async () => {
      await page.getByRole('tab', { name: 'House', exact: true }).click();
      // 335,000 / (10,726 x 12) = 2.6 years; 670,000 / (10,726 x 12) = 5.2 years
      await expect(page.getByText('2.6 to 5.2 years across Selangor', { exact: true })).toBeVisible();
      await expect(page.getByText('House costs', { exact: true }).first()).toBeVisible();
    });

    await ac('AC11.1.2', 'Available as a guest', async () => {
      expect(await page.evaluate(() => window.localStorage.getItem('rumampu_auth_token'))).toBeNull();
      await page.getByText('House costs', { exact: true }).first().click();
      await expect(page.getByTestId('hp-state')).toHaveText('Selangor & KL');
      await expect(rows(page)).toHaveCount(10);
      await expect(page.getByTestId('pin-Kuala Lumpur')).toBeVisible();
      await expect(page.getByText(/sign in|create an account/i)).toHaveCount(0);
    });

    await ac('AC11.1.1', 'Works with no recorded data', async () => {
      await expect(page.getByText('10 areas · cheapest first', { exact: true })).toBeVisible();
      await expect(page.locator('[data-testid^="area-"]')).toHaveCount(KV_DISTRICTS.length);
      await expect(page.getByText('No sales for this home type here. Try another type.', { exact: true })).toHaveCount(0);
      await expect(page.getByText(/Record a month to begin|Could not load the published figures/)).toHaveCount(0);
    });

    await ac('AC11.7.5', 'Map attribution', async () => {
      await expect(page.getByText('© OpenStreetMap contributors', { exact: true })).toBeVisible();
    });

    await ac('AC11.7.6', 'Zoom the map', async () => {
      const zoomIn = page.getByRole('button', { name: 'Zoom in', exact: true });
      const zoomOut = page.getByRole('button', { name: 'Zoom out', exact: true });
      await expect(zoomIn).toBeVisible();
      await expect(zoomOut).toBeVisible();
      // A district outline doubles in size with each step in, and comes back with each step out.
      const area = page.getByTestId('area-Petaling');
      const before = (await area.boundingBox())!.width;
      await zoomIn.click();
      await expect.poll(async () => (await area.boundingBox())!.width / before).toBeGreaterThan(1.9);
      await zoomOut.click();
      // ends at the starting zoom, so the next steps see every pin
      await expect.poll(async () => Math.abs((await area.boundingBox())!.width / before - 1)).toBeLessThan(0.05);
    });

    await ac('AC11.7.1', 'District outlines with price pins', async () => {
      for (const d of KV_DISTRICTS) await expect(page.getByTestId(`area-${d}`)).toHaveCount(1);
      const priced = await rowList(page);
      expect(priced).toHaveLength(10);
      let pins = 0;
      for (const r of priced) {
        const pin = page.getByTestId(`pin-${r.d}`);
        if (await pin.count()) {
          pins += 1;
          await expect(pin).toHaveText(rmK(r.price));
        } else {
          // a pin that would overlap a busier district's pin is drawn as a dot
          await expect(page.getByTestId(`dot-${r.d}`)).toHaveCount(1);
        }
      }
      expect(pins).toBeGreaterThan(0);
    });

    let wholeState = 0;
    await ac('AC11.7.3', 'The list sheet moves', async () => {
      const yPeek = await settledY(page);
      await tapSheetHandle(page);                          // low -> full
      await expect.poll(() => handleY(page)).toBeLessThan(yPeek - 200);
      const yFull = await settledY(page);
      await tapSheetHandle(page);                          // full -> low
      await expect.poll(() => handleY(page)).toBeGreaterThan(yPeek - 4);
      expect(Math.abs(await settledY(page) - yPeek)).toBeLessThan(2);
      // the stops are H/3, 0.56 H and H - 70; drag to the middle one
      const H = 1.5 * (yPeek - yFull + 70);
      const yHalf = yPeek - (0.56 * H - H / 3);
      await dragSheetTo(page, yHalf);
      const sheetTop = await settledY(page);
      expect(Math.abs(sheetTop - yHalf)).toBeLessThan(15);
      expect(sheetTop).toBeLessThan(yPeek - 60);
      expect(sheetTop).toBeGreaterThan(yFull + 60);
      // the map above the middle sheet still answers a tap
      const pin = page.getByTestId('pin-Kuala Lumpur');
      await expect.poll(async () => (await pin.boundingBox())?.y ?? 9999).toBeLessThan(sheetTop - 30);
      await pin.click();
      await expect(page.getByTestId('hp-back')).toBeVisible();
      await expect(page.getByText('Kuala Lumpur · All homes', { exact: true })).toBeVisible();
      await page.getByTestId('hp-back').click();
      await expect(page.getByText('10 areas · cheapest first', { exact: true })).toBeVisible();
      await expect.poll(() => handleY(page)).toBeGreaterThan(yPeek - 4);
      await page.waitForTimeout(400);
      wholeState = await areaWidth(page, 'Klang');
      expect(wholeState).toBeGreaterThan(0);
      // leave the sheet at its middle height for the record
      await dragSheetTo(page, yHalf);
      expect(Math.abs(await settledY(page) - yHalf)).toBeLessThan(15);
    });

    await ac('AC11.7.2', 'Open a district from the map or the list', async () => {
      // a row
      await page.getByTestId('hp-row-Klang').click();
      await expect(page.getByText('Selangor · All homes', { exact: true })).toBeVisible();
      await expect(page.getByTestId('hp-now')).toHaveText('RM 480k');
      await expect.poll(() => areaWidth(page, 'Klang')).toBeGreaterThan(wholeState * 1.5);
      await page.getByTestId('hp-back').click();
      // an outline
      await expect.poll(() => areaWidth(page, 'Klang')).toBeLessThan(wholeState * 1.2);
      await page.getByTestId('area-Hulu Selangor').dispatchEvent('click');
      await expect(page.getByTestId('hp-back')).toBeVisible();
      await expect(page.getByText('Hulu Selangor', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('Selangor · All homes', { exact: true })).toBeVisible();
      await expect(page.getByTestId('hp-now')).toHaveText('RM 350k');
      await page.getByTestId('hp-back').click();
      // a pin
      await page.getByTestId('pin-Kuala Lumpur').click();
      await expect(page.getByText('Kuala Lumpur · All homes', { exact: true })).toBeVisible();
      await expect(page.getByTestId('hp-now')).toHaveText('RM 710k');
      await expect(page.getByTestId('pin-Kuala Lumpur')).toHaveText('RM 710k');
      await expect.poll(async () => (await page.getByTestId('area-Kuala Lumpur').boundingBox())?.width ?? 0).toBeGreaterThan(150);
    });

    await ac('AC11.7.4', 'Back to list', async () => {
      await page.getByRole('button', { name: 'Back to list', exact: true }).click();
      await expect(page.getByText('10 areas · cheapest first', { exact: true })).toBeVisible();
      await expect(rows(page)).toHaveCount(10);
      await expect.poll(() => areaWidth(page, 'Klang')).toBeLessThan(wholeState * 1.2);
      await expect.poll(() => areaWidth(page, 'Klang')).toBeGreaterThan(wholeState * 0.8);
      await expect(page.getByTestId('hp-back')).toHaveCount(0);
    });
  });

  test('US11.2 / US11.3 — Choose a type of home and a state', { tag: ['@us11.2', '@us11.3'] }, async ({ page }) => {
    test.setTimeout(240_000);
    await stubMarket(page, { allHomes: false });   // the real SQLite backend for every type
    await openGuestApp(page);
    await openHouseCosts(page);

    await ac('AC11.2.1', 'Type selector in plain language', async () => {
      for (const [k, label] of KINDS) {
        const button = page.getByTestId(`hp-kind-${k}`);
        await expect(button).toHaveText(label);
        await expect(button.locator('svg').first()).toBeVisible();
      }
      // the names on the row, never NAPIC's labels or the API's keys
      const labels = await page.locator('[data-testid^="hp-kind-"]').allInnerTexts();
      expect(labels.map(l => l.trim())).toEqual(KINDS.map(([, l]) => l));
      for (const l of labels) expect(l).not.toMatch(/_|Detached|Terraced|Condominium\/Apartment|Storey/);
    });

    await ac('AC11.2.2', 'All homes comes from real sales', async () => {
      // the model prices every single type here, but All homes is never built from them:
      // without the NAPIC sales table (Neon only) it has no districts and no quarters at all
      const terrace = await apiAreas(page, 'SGR', 'terrace');
      expect(terrace.areas.filter(a => a.typical).length).toBeGreaterThan(5);
      const all = await apiAreas(page, 'SGR', 'all');
      expect(all.areas).toEqual([]);
      expect(all.window).toBeNull();
      await expect(page.getByText('No sales for this home type here. Try another type.', { exact: true })).toBeVisible();
      await expect(rows(page)).toHaveCount(0);
    });

    await ac('AC11.2.3', 'A single type is priced for that type only', async () => {
      await pickKind(page, 'terrace', new RegExp(`^${esc(CAP_TYPE)}$`));
      const terrace = (await apiAreas(page, 'SGR', 'terrace')).areas.find(a => a.district === 'Petaling')!;
      const condo = (await apiAreas(page, 'SGR', 'condo')).areas.find(a => a.district === 'Petaling')!;
      const model = await apiHome(page, 'Petaling', 'terrace');
      expect(terrace.typical).toBe(model.today.p50);          // the model's typical terrace, freehold, typical size
      expect(condo.typical).not.toBe(terrace.typical);        // not blended across types
      await expect(page.getByTestId('hp-row-Petaling')).toContainText(rmK(terrace.typical!));
      await expect(page.getByText(CAP_TYPE, { exact: true })).toBeVisible();
    });

    await ac('AC11.2.5', 'Change type from a district', async () => {
      await page.getByTestId('hp-row-Petaling').click();
      await expect(page.getByText('Selangor · Terrace', { exact: true })).toBeVisible();
      await expect(page.getByTestId('hp-now')).toHaveText('RM 634k');
      await page.getByRole('button', { name: 'Filter by home type', exact: true }).click();
      await expect(page.getByText('Home type', { exact: true })).toBeVisible();
      await page.getByText('Condo', { exact: true }).last().click();
      await expect(page.getByText('Selangor · Condo', { exact: true })).toBeVisible();
      const condo = await apiHome(page, 'Petaling', 'condo');
      await expect(page.getByTestId('hp-now')).toHaveText(rmK(condo.today.p50));
      await expect(page.getByTestId('hp-back')).toBeVisible();      // still in Petaling
      await page.getByTestId('hp-back').click();
      await pickKind(page, 'terrace', new RegExp(`^${esc(CAP_TYPE)}$`));
    });

    await ac('AC11.3.1', 'The state drives both sides', async () => {
      await openInfo(page);
      await expect(page.getByText('A typical family in Selangor earns RM 10,726 a month.', { exact: true })).toBeVisible();
      await closeSheet(page);
      await pickState(page, 'Johor');
      await expect(page.getByTestId('hp-row-Johor Bahru')).toBeVisible();
      await expect(page.getByTestId('hp-row-Petaling')).toHaveCount(0);
      for (const r of await rowList(page)) expect(r.text).toContain('Johor');
      await openInfo(page);
      await expect(page.getByText('A typical family in Johor earns RM 7,712 a month.', { exact: true })).toBeVisible();
      await closeSheet(page);
      // years of family income in Johor use Johor's income
      const jb = await apiHome(page, 'Johor Bahru', 'terrace');
      await page.getByTestId('hp-row-Johor Bahru').click();
      await page.getByTestId('hp-more').click();
      await expect(page.getByText(`${(jb.today.p50 / (TEST_INCOME.JHR * 12)).toFixed(1)} years`, { exact: true })).toBeVisible();
      await page.getByText('Years of family income', { exact: true }).scrollIntoViewIfNeeded();
    });

    await ac('AC11.3.2', 'Every state available', async () => {
      await page.getByTestId('hp-back').click();
      await pickState(page, 'Selangor & KL');
      for (const d of ['Kuala Lumpur', 'Putrajaya']) {
        await expect(page.getByTestId(`area-${d}`)).toHaveCount(1);
        await expect(page.getByTestId(`hp-row-${d}`)).toBeVisible();
      }
      await page.getByTestId('hp-state').click();
      await expect(page.getByText('Choose a state', { exact: true })).toBeVisible();
      const states = ['Johor', 'Kedah', 'Kelantan', 'Labuan', 'Melaka', 'Negeri Sembilan', 'Pahang', 'Perak', 'Perlis',
        'Pulau Pinang', 'Sabah', 'Sarawak', 'Selangor & KL', 'Terengganu'];
      for (const s of states) await expect(page.getByText(s, { exact: true }).last()).toBeVisible();
    });

    await ac('AC11.3.3', 'Single-place states render normally', async () => {
      await page.getByText('Perlis', { exact: true }).last().click();
      await expect(page.getByTestId('hp-state')).toHaveText('Perlis');
      const perlis = await apiAreas(page, 'PLS', 'terrace');
      expect(perlis.areas.filter(a => a.typical)).toHaveLength(1);
      await expect(rows(page)).toHaveCount(1);
      await expect(page.getByTestId('hp-row-Perlis')).toContainText(rmK(perlis.areas[0].typical!));
      await expect(page.getByTestId('pin-Perlis')).toHaveText(rmK(perlis.areas[0].typical!));
      await expect(page.getByText(/No sales for this home type|Not enough sales to show|Could not load|Prices are not available/)).toHaveCount(0);
    });

    await ac('AC11.2.4', 'Nothing of this kind sold is said plainly', async () => {
      expect((await apiAreas(page, 'PLS', 'condo')).areas).toEqual([]);
      await page.getByTestId('hp-kind-condo').click();
      await expect(page.getByText('No sales for this home type here. Try another type.', { exact: true })).toBeVisible();
      await expect(rows(page)).toHaveCount(0);
      await expect(page.getByText(/Could not load|Prices are not available/)).toHaveCount(0);
    });

    await ac('AC11.3.4', 'Search a district or state', async () => {
      // a state
      await page.getByTestId('fh-search').fill('kedah');
      await expect(page.getByText('State', { exact: true })).toBeVisible();
      await page.getByText('Kedah', { exact: true }).first().click();
      await expect(page.getByTestId('hp-state')).toHaveText('Kedah');
      // a district on another state's map opens and switches the map to its state
      await page.getByTestId('fh-search').fill('petal');
      await expect(page.getByTestId('hp-hit-Petaling')).toBeVisible();
      await page.getByTestId('hp-hit-Petaling').click();
      await expect(page.getByText('Selangor · Condo', { exact: true })).toBeVisible();
      await expect(page.getByTestId('hp-now')).toBeVisible();
      await expect(page.getByTestId('area-Petaling')).toHaveCount(1);
      await expect(page.getByTestId('area-Kota Setar')).toHaveCount(0);
    });
  });

  test('US11.4 / US11.5 / US11.8 — District prices, how far to trust them and how they move', { tag: ['@us11.4', '@us11.5', '@us11.8', '@us11.1'] }, async ({ page }) => {
    test.setTimeout(240_000);
    await stubMarket(page);
    await openGuestApp(page);
    await openHouseCosts(page);

    await ac('AC11.4.2', 'A plain framing line', async () => {
      await expect(page.getByText(CAP_ALL, { exact: true })).toBeVisible();
      expect(await page.locator('body').innerText()).not.toMatch(/\bnormal\b/i);
      await page.getByText(CAP_ALL, { exact: true }).scrollIntoViewIfNeeded();
    });

    await ac('AC11.5.2', 'Thin places are named, not priced', async () => {
      // Sabak Bernam: 7 sales, under the 8 All homes needs
      await expect(page.getByText('Not enough sales to show: Sabak Bernam.', { exact: true })).toBeVisible();
      await expect(page.getByTestId('hp-row-Sabak Bernam')).toHaveCount(0);
      await page.getByText('Not enough sales to show: Sabak Bernam.', { exact: true }).scrollIntoViewIfNeeded();
    });

    await ac('AC11.5.3', 'Unpriced districts carry no price marker', async () => {
      const thin = page.getByTestId('area-Sabak Bernam');
      await expect(thin).toHaveCount(1);
      expect(await fillOf(thin)).toBe('#c9d3d2');
      expect(await thin.evaluate(el => el.getAttribute('fill-opacity') ?? el.getAttribute('fillOpacity'))).toBe('0.2');
      expect(await fillOf(page.getByTestId('area-Klang'))).not.toBe('#c9d3d2');
      await expect(page.getByTestId('pin-Sabak Bernam')).toHaveCount(0);
      await expect(page.getByTestId('dot-Sabak Bernam')).toHaveCount(0);
      await expect(page.getByTestId('hp-row-Sabak Bernam')).toHaveCount(0);
    });

    await pickKind(page, 'terrace', new RegExp(`^${esc(CAP_TYPE)}$`));
    let list: { d: string; price: number; text: string }[] = [];

    await ac('AC11.4.5', 'Cheapest first', async () => {
      list = await rowList(page);
      expect(list.length).toBeGreaterThan(5);
      for (let i = 1; i < list.length; i += 1) expect(list[i].price).toBeGreaterThanOrEqual(list[i - 1].price);
      await expect(page.getByText(`${list.length} areas · cheapest first`, { exact: true })).toBeVisible();
    });

    await ac('AC11.4.3', 'The price leads each row', async () => {
      const terrace = await apiAreas(page, 'SGR', 'terrace');
      for (const [i, r] of list.entries()) {
        const row = page.getByTestId(`hp-row-${r.d}`);
        await expect(row.getByText(String(i + 1), { exact: true })).toBeVisible();
        const typical = (terrace.areas.find(a => a.district === r.d) ?? (await apiAreas(page, r.d === 'Kuala Lumpur' ? 'KUL' : 'PJY', 'terrace')).areas[0]).typical!;
        await expect(row).toContainText(rmK(typical));
      }
      await expect(page.getByTestId('hp-row-Klang').getByText('Selangor', { exact: true })).toBeVisible();
      await expect(page.getByTestId('hp-row-Putrajaya').getByText('Putrajaya', { exact: true })).toHaveCount(2);
    });

    await ac('AC11.4.4', 'Map shading follows the prices shown', async () => {
      const fills: string[] = [];
      for (const r of list) fills.push(await fillOf(page.getByTestId(`area-${r.d}`)));
      expect(fills[0]).toBe(SHADE[0]);                        // the cheapest district
      expect(fills[fills.length - 1]).toBe(SHADE[3]);         // the dearest district
      expect(new Set(fills).size).toBe(4);
      const idx = fills.map(f => SHADE.indexOf(f));
      expect(idx.every(i => i >= 0)).toBe(true);
      for (let i = 1; i < idx.length; i += 1) expect(idx[i]).toBeGreaterThanOrEqual(idx[i - 1]);   // darker only as prices rise
      // the Demographia scale and its colours sit in Where these numbers come from, about places only
      await openInfo(page);
      for (const [range, band] of [['3.0 and below', 'Affordable'], ['3.1 to 4.0', 'Moderately unaffordable'], ['4.1 to 5.0', 'Seriously unaffordable'], ['5.1 and above', 'Severely unaffordable']]) {
        await expect(page.getByText(range, { exact: true })).toBeVisible();
        await expect(page.getByText(band, { exact: true })).toBeVisible();
      }
      await expect(page.getByText(/^Bands: Demographia international housing affordability scale/)).toBeVisible();
      await page.getByText('A published scale reads:', { exact: true }).scrollIntoViewIfNeeded();
    });
    await closeSheet(page);

    const model = await apiHome(page, 'Petaling', 'terrace');
    await page.getByTestId('hp-row-Petaling').click();
    await expect(page.getByText('Selangor · Terrace', { exact: true })).toBeVisible();
    await dragSheetTo(page, 60);          // the details at full height

    await ac('AC11.8.1', 'Last year, now and in 3 years', async () => {
      const f3 = model.future[2].p50;
      await expect(page.getByText('Last year', { exact: true })).toBeVisible();
      await expect(page.getByText(rmK(model.last_year!), { exact: true }).first()).toBeVisible();
      await expect(page.getByText('Now', { exact: true }).first()).toBeVisible();
      await expect(page.getByTestId('hp-now')).toHaveText(rmK(model.today.p50));
      await expect(page.getByText(`${pctChange(model.today.p50, model.last_year!)} in a year`, { exact: true })).toBeVisible();
      await expect(page.getByText('In 3 years', { exact: true })).toBeVisible();
      await expect(page.getByText(rmK(f3), { exact: true }).first()).toBeVisible();
      await expect(page.getByText(pctChange(f3, model.today.p50), { exact: true })).toBeVisible();
    });

    await ac('AC11.4.8', 'The price range is shown', async () => {
      await expect(page.getByText(`Most homes here sell for ${rmK(model.today.p10)} – ${rmK(model.today.p90).replace('RM ', '')}`, { exact: true })).toBeVisible();
    });

    await ac('AC11.8.2', 'A price trend chart', async () => {
      expect(model.history[0].quarter.startsWith('2021')).toBe(true);
      await expect(page.getByText('Price trend', { exact: true })).toBeVisible();
      await expect(page.getByText(`2021 – ${Number(model.history[model.history.length - 1].quarter.slice(0, 4)) + 3}`, { exact: true })).toBeVisible();
      for (const l of ['Past', 'If the trend continues', 'Likely range']) await expect(page.getByText(l, { exact: true }).first()).toBeVisible();
      const chart = page.getByTestId('hp-chart');
      await chart.scrollIntoViewIfNeeded();
      const box = (await chart.boundingBox())!;
      await page.mouse.move(box.x + 2, box.y + box.height / 2);
      await expect(page.getByTestId('hp-tip')).toContainText(model.history[0].quarter.replace('Q', ' Q'));
      await page.mouse.move(box.x + box.width * 0.9, box.y + box.height / 2);
      await expect(page.getByTestId('hp-tip')).toContainText('in 3 years');
      await expect(page.getByTestId('hp-tip')).toContainText(rmK(model.future[2].p50));
      await expect(page.getByTestId('hp-tip')).toContainText('Likely range');
    });
    await page.mouse.move(5, 5);

    await page.getByTestId('hp-more').click();
    await expect(page.getByText('Fewer details', { exact: true })).toBeVisible();

    await ac('AC11.1.4', 'Loan assumptions are stated', async () => {
      await expect(page.getByText('Monthly loan payment*', { exact: true })).toBeVisible();
      await expect(page.getByText(/^\*90% loan at [\d.]+% over \d+ years\./)).toBeVisible();
      await page.getByText('Monthly loan payment*', { exact: true }).scrollIntoViewIfNeeded();
    });

    await ac('AC11.4.1', 'Years, not multiples', async () => {
      const years = `${(model.today.p50 / (TEST_INCOME.SGR * 12)).toFixed(1)} years`;
      await expect(page.getByText('Years of family income', { exact: true })).toBeVisible();
      await expect(page.getByText(years, { exact: true })).toBeVisible();
      expect(years).toMatch(/^\d+\.\d years$/);
    });

    await ac('AC11.5.1', 'The sale count is visible', async () => {
      await expect(page.getByText('Homes sold', { exact: true })).toBeVisible();
      await expect(page.getByText(model.n_sales_2y.toLocaleString('en-MY'), { exact: true })).toBeVisible();
    });

    await ac('AC11.5.4', 'Model accuracy is stated', async () => {
      expect(model.accuracy).not.toBeNull();
      const within = Math.round(model.accuracy!.median_APE * 100);
      await expect(page.getByText(new RegExp(`On sales it had not seen, half of the model's typical prices were within ${within}% of the real price\\.$`))).toBeVisible();
      await page.getByText(/On sales it had not seen/).scrollIntoViewIfNeeded();
    });

    await ac('AC11.8.3', 'The future is a what-if', async () => {
      await expect(page.getByText(/Past and future trend is measured for the whole state and applied to this area's price\. The future line is a what-if, not a promise\./)).toBeVisible();
    });

    await ac('AC11.8.5', 'What pushes prices up', async () => {
      await expect(page.getByText('What pushes prices up', { exact: true })).toBeVisible();
      const up = model.drivers.filter(x => x.effect_pct >= 3.5).sort((a, b) => b.effect_pct - a.effect_pct);
      expect(up.length).toBeGreaterThan(4);
      for (const x of up.slice(0, 4)) {
        const line = page.getByText(`${x.description}: ${x.band}`, { exact: true });
        await expect(line).toBeVisible();
        await expect(line.locator('xpath=..')).toContainText(`+${x.effect_pct.toFixed(0)}%`);
      }
      for (const x of up.slice(4)) await expect(page.getByText(`${x.description}: ${x.band}`, { exact: true })).toHaveCount(0);
      await page.getByText('What pushes prices up', { exact: true }).scrollIntoViewIfNeeded();
    });

    await ac('AC11.8.4', 'Choose a home size', async () => {
      await page.getByText('Years of family income', { exact: true }).scrollIntoViewIfNeeded();
      for (const s of ['small', 'typical', 'large'] as const) {
        await expect(page.getByRole('tab', { name: new RegExp(`^${s[0].toUpperCase()}${s.slice(1)}\\s*${model.sizes[s]} m²$`) })).toBeVisible();
      }
      const large = await apiHome(page, 'Petaling', 'terrace', 'large');
      await page.getByRole('tab', { name: /^Large/ }).click();
      await expect(page.getByTestId('hp-now')).toHaveText(rmK(large.today.p50));
      await expect(page.getByText(`${large.size_m2} m² · ${large.storeys}-storey`, { exact: true })).toBeVisible();
      await expect(page.getByText('Selangor · Terrace', { exact: true })).toBeVisible();
    });
  });

  test('US11.6 — Where these numbers come from', { tag: ['@us11.6'] }, async ({ page }) => {
    test.setTimeout(180_000);
    await stubMarket(page);
    await openGuestApp(page);
    await openHouseCosts(page);

    await ac('AC11.6.1', 'The sources are named', async () => {
      await expect(page.getByText(CAP_ALL, { exact: true })).toBeVisible();
      await pickKind(page, 'terrace', new RegExp(`^${esc(CAP_TYPE)}$`));
      await pickKind(page, 'all', new RegExp(`^${esc(CAP_ALL)}$`));
      await openInfo(page);
      await expect(page.getByText(/National Property Information Centre \(NAPIC\)/)).toBeVisible();
      await expect(page.getByText(/^Income: Department of Statistics Malaysia/)).toBeVisible();
      await expect(page.getByText(/Khazanah Research Institute/).first()).toBeVisible();
      await page.getByText('Sources', { exact: true }).scrollIntoViewIfNeeded();
    });

    await ac('AC11.6.2', 'Both data vintages visible', async () => {
      await expect(page.getByText('Prices: National Property Information Centre (NAPIC), Open Transaction Data, July 2025 to June 2026.', { exact: true })).toBeVisible();
      await expect(page.getByText('Income: Department of Statistics Malaysia, household income by state, 2024.', { exact: true })).toBeVisible();
    });

    await ac('AC11.6.6', 'The date the sources were opened is stated', async () => {
      await expect(page.getByText('All opened 12 September 2026.', { exact: true })).toBeVisible();
      await page.getByText('All opened 12 September 2026.', { exact: true }).scrollIntoViewIfNeeded();
    });

    await ac('AC11.6.4', 'Income granularity disclosed', async () => {
      const line = page.getByText('Household income is published by state, not by district, so every place within a state is measured against the same income.', { exact: true });
      await expect(line).toBeVisible();
      await line.scrollIntoViewIfNeeded();
    });

    await ac('AC11.6.3', 'Not a valuation', async () => {
      const line = page.getByText('These are prices homes actually sold for in the district. They are not a valuation, and not an asking price for any one property.', { exact: true });
      await expect(line).toBeVisible();
      await line.scrollIntoViewIfNeeded();
      await closeSheet(page);
      await expect(page.getByText(/^Typical prices from real sales/)).toBeVisible();
      // the future figure in a district is a what-if, not a promise
      await page.getByTestId('hp-row-Klang').click();
      await expect(page.getByText('If the trend continues', { exact: true })).toBeVisible();
      await page.getByTestId('hp-more').click();
      await expect(page.getByText(/The future line is a what-if, not a promise\./)).toBeVisible();
      await page.getByText(/The future line is a what-if/).scrollIntoViewIfNeeded();
    });
  });

  test('US11.9 — Check prices against my budget', { tag: ['@us11.9'] }, async ({ page }) => {
    test.setTimeout(180_000);
    await stubMarket(page);
    await openGuestApp(page);
    await openHouseCosts(page);
    const FITS = /Within your budget|A stretch|Above your budget/;

    await ac('AC11.9.1', 'Off until I add it', async () => {
      await expect(page.getByTestId('hp-budget')).toHaveText('+ Budget');
      await expect(rows(page).getByText(FITS)).toHaveCount(0);
      const pins = page.locator('[data-testid^="pin-"]');
      expect(await pins.count()).toBeGreaterThan(0);
      for (const pin of await pins.all()) expect(await pinFit(pin)).toBeNull();
    });

    await ac('AC11.9.3', 'Rows and pins show the fit', async () => {
      await page.getByTestId('hp-budget').click();
      await expect(page.getByText('My budget', { exact: true })).toBeVisible();
      await page.getByTestId('hp-bud-in').fill('400000');
      await page.getByTestId('hp-bud-go').click();
      await expect(page.getByTestId('hp-budget')).toHaveText('RM 400k');
      // RM 400k against the typical price and the lower end of each district's range
      await expect(page.getByTestId('hp-row-Kuala Langat')).toContainText('Within your budget');
      await expect(page.getByTestId('hp-row-Klang')).toContainText('A stretch');
      await expect(page.getByTestId('hp-row-Petaling')).toContainText('Above your budget');
      for (const r of await rowList(page)) expect(r.text).toMatch(FITS);
      const pins = await page.locator('[data-testid^="pin-"]').all();
      expect(pins.length).toBeGreaterThan(0);
      for (const pin of pins) {
        const d = (await pin.getAttribute('data-testid'))!.slice(4);
        const tag = (await page.getByTestId(`hp-row-${d}`).innerText()).match(FITS)![0];
        expect(await pinFit(pin), `pin dot for ${d}`).toBe(tag);
      }
    });

    await ac('AC11.9.4', 'Share of sales the budget covers', async () => {
      await page.getByTestId('hp-row-Klang').click();
      await expect(page.getByText('A stretch. Your RM 400k covers about 40% of homes sold here.', { exact: true })).toBeVisible();
    });

    await ac('AC11.9.5', 'Remove the budget', async () => {
      await page.getByTestId('hp-back').click();
      await page.getByTestId('hp-budget').click();
      await page.getByText('Remove budget', { exact: true }).click();
      await expect(page.getByTestId('hp-budget')).toHaveText('+ Budget');
      await expect(rows(page).getByText(FITS)).toHaveCount(0);
      await expect(page.getByTestId('hp-row-Klang')).toContainText('Selangor');
      for (const pin of await page.locator('[data-testid^="pin-"]').all()) expect(await pinFit(pin)).toBeNull();
      await page.getByTestId('hp-row-Klang').click();
      await expect(page.getByTestId('hp-now')).toHaveText('RM 480k');
      await expect(page.getByText(/covers about/)).toHaveCount(0);
      await page.getByTestId('hp-back').click();
    });
  });

  test('US11.1 / US11.6 / US11.9 / US11.10 — With my own record and a stress test', { tag: ['@us11.1', '@us11.6', '@us11.9', '@us11.10'] }, async ({ page }) => {
    test.setTimeout(300_000);
    await stubMarket(page);
    await pinGuestClientId(page);
    const loaded = await e2ePost(page, `${API}/dev/scenarios/my-gig-driver-12m/load/`, { data: { confirm_reset: true } });
    expect(loaded.status()).toBe(201);
    await openGuestApp(page);

    // a house test on the twelve recorded months
    await page.getByRole('tab', { name: 'House', exact: true }).click();
    await page.getByText('Test a house', { exact: true }).click();
    await expect(page.getByText('Property price', { exact: true })).toBeVisible();
    await page.locator('input:visible').nth(0).fill('80000');
    await page.getByText('The house', { exact: true }).click();
    await page.getByText('Run the test', { exact: true }).last().click();
    await expect(page.getByText(/All 12 months would carry it/)).toBeVisible();

    await page.getByRole('tab', { name: 'House', exact: true }).click();
    if (!(await page.getByText('House costs', { exact: true }).first().isVisible().catch(() => false))) {
      await page.getByRole('tab', { name: 'Home', exact: true }).click();
      await page.getByRole('tab', { name: 'House', exact: true }).click();
    }
    await page.getByText('House costs', { exact: true }).first().click();
    await expect(page.getByTestId('hp-state')).toBeVisible();

    /* the figures of my own record and test (scenario_service.py SCENARIO_MONTHS, the RM 80,000 test) */
    const MINE = ['4,780', '5,260', '4,930', '5,480', '6,620', '4,380', '3,910', '5,840', '4,690', '5,560', '5,010', '5,790', '80,000', 'RM 80k'];
    const noneOfMine = async () => {
      const text = await page.locator('body').innerText();
      for (const m of MINE) expect(text, `my own figure ${m}`).not.toContain(m);
    };

    await ac('AC11.1.3', 'No personal figures unless I add them', async () => {
      await expect(rows(page)).toHaveCount(10);
      await noneOfMine();
      await page.getByTestId('hp-row-Klang').click();
      await expect(page.getByTestId('hp-now')).toHaveText('RM 480k');
      await page.getByTestId('hp-more').click();
      await expect(page.getByText('Homes sold', { exact: true })).toBeVisible();
      await noneOfMine();
      await page.getByTestId('hp-back').click();
    });

    await ac('AC11.6.5', 'About a market unless I add a budget', async () => {
      await expect(page.getByTestId('hp-budget')).toHaveText('+ Budget');
      await expect(rows(page).getByText(/Within your budget|A stretch|Above your budget/)).toHaveCount(0);
      await expect(page.getByText(/covers about|your price|your safe price/i)).toHaveCount(0);
      await openInfo(page);
      await expect(page.getByText('This is about places, not about you.', { exact: true })).toBeVisible();
    });
    await closeSheet(page);

    let safe = 0;
    await ac('AC11.9.2', 'Type it, slide it or take it from my stress test', async () => {
      await page.getByTestId('hp-budget').click();
      await expect(page.getByText('My budget', { exact: true })).toBeVisible();
      const input = page.getByTestId('hp-bud-in');
      // typed
      await input.fill('520000');
      await input.blur();
      await expect(input).toHaveValue('520,000');
      // slid between RM 100k and RM 1.5m
      await expect(page.getByText('RM 100k', { exact: true })).toBeVisible();
      await expect(page.getByText('RM 1.5m', { exact: true })).toBeVisible();
      const track = (await page.getByRole('slider', { name: 'My budget' }).boundingBox())!;
      await page.mouse.click(track.x + 1, track.y + track.height / 2);
      await expect(input).toHaveValue('100,000');
      await page.mouse.click(track.x + track.width - 1, track.y + track.height / 2);
      await expect(input).toHaveValue('1,500,000');
      // my safe price from the stress test
      const use = page.getByText(/^Use my safe price from the stress test \(RM [\d.]+(k|m)\)$/);
      await expect(use).toBeVisible();
      safe = fromRmK(await use.innerText());
      await use.click();
      await expect(input).toHaveValue(safe.toLocaleString('en-MY'));
    });
    await page.getByLabel('Close', { exact: true }).click();
    await expect(page.getByTestId('hp-budget')).toHaveText('+ Budget');

    await ac('AC11.10.3', 'My starting price', async () => {
      await page.getByTestId('fh-px').click();
      await expect(page.getByTestId('px-step-1').getByRole('heading')).toHaveText('Your safe price');
      await expect(page.getByText('From your stress test.', { exact: true })).toBeVisible();
      await expect(page.getByTestId('px-budget')).toHaveValue(safe.toLocaleString('en-MY'));
      // still free to type another price to explore
      await page.getByTestId('px-budget').fill('520000');
      await page.getByTestId('px-budget').press('Enter');
      await expect(page.getByTestId('px-budget')).toHaveValue('520,000');
    });
  });

  test('US11.10 — Where my price fits', { tag: ['@us11.10'] }, async ({ page }) => {
    test.setTimeout(240_000);
    /* the share of last year's sales at or under the price needs NAPIC raw sales (Neon only) */
    const SHARE = { SGR: { Klang: 0.72, 'Hulu Langat': 0.45, Petaling: 0.2, Gombak: 0.05 } };
    await stubMarket(page, { share: SHARE });
    await openGuestApp(page);
    await openHouseCosts(page);

    await ac('AC11.10.1', 'Opened from House costs', async () => {
      await page.getByText('See where my price fits ›', { exact: true }).click();
      await expect(page.getByText('Where my price fits', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('Find areas with homes at your price, then test one.', { exact: true })).toBeVisible();
    });

    await ac('AC11.10.2', 'Steps unlock in order', async () => {
      const titles = ['A price to explore', 'What kind of home?', 'Where does it fit?', 'A home like this', 'What could it cost later?'];
      for (const [i, title] of titles.entries()) {
        await expect(page.getByTestId(`px-step-${i + 1}`).getByRole('heading')).toHaveText(title);
      }
      const order = await Promise.all(titles.map((_, i) => page.getByTestId(`px-step-${i + 1}`).boundingBox().then(b => b!.y)));
      for (let i = 1; i < order.length; i += 1) expect(order[i]).toBeGreaterThan(order[i - 1]);
      await expect(page.getByTestId('px-step-4').getByText('Pick an area first.', { exact: true })).toBeVisible();
      await expect(page.getByTestId('px-step-5').getByText('Pick an area first.', { exact: true })).toBeVisible();
      await expect(page.getByTestId('px-cta')).toHaveText('Pick an area below ↓');
      await page.getByTestId('px-step-4').scrollIntoViewIfNeeded();
    });

    await page.getByTestId('px-budget').fill('520000');
    await page.getByTestId('px-budget').press('Enter');
    await expect(page.getByTestId('px-budget')).toHaveValue('520,000');

    await ac('AC11.10.4', 'Where my price fits on the map', async () => {
      const legend = "% of last year's sales at or under RM 520k";
      await expect(page.getByText(legend, { exact: true })).toBeVisible();
      await expect(page.getByText('72%', { exact: true })).toBeVisible();
      await expect(page.getByText('20%', { exact: true })).toBeVisible();
      await expect(page.getByText('few sales', { exact: true }).first()).toBeVisible();
      await page.getByRole('tab', { name: 'Map', exact: true }).click();
      await expect(page.getByText(legend, { exact: true })).toBeVisible();
      for (const l of ['under 10%', '10–33%', '33–66%', '66%+', 'too few sales']) await expect(page.getByText(l, { exact: true })).toBeVisible();
      expect(await fillOf(page.getByTestId('map-Gombak'))).toBe('#e0f3db');        // under 10%
      expect(await fillOf(page.getByTestId('map-Petaling'))).toBe('#a8ddb5');      // 10-33%
      expect(await fillOf(page.getByTestId('map-Hulu Langat'))).toBe('#2b8cbe');   // 33-66%
      expect(await fillOf(page.getByTestId('map-Klang'))).toBe('#08589e');         // 66%+
      expect(await fillOf(page.getByTestId('map-Sepang'))).toBe('url(#pxhatch)');  // too few sales
      await page.getByText('too few sales', { exact: true }).scrollIntoViewIfNeeded();
    });

    const model = await apiHome(page, 'Petaling', 'terrace');
    await page.getByTestId('map-Petaling').dispatchEvent('click');
    await expect(page.getByRole('heading', { name: 'A terrace in Petaling' })).toBeVisible();

    await ac('AC11.10.5', 'A home like this', async () => {
      await expect(page.getByTestId('px-range')).toHaveText(`${rmK(model.today.p10)} – ${rmK(model.today.p90).replace('RM ', '')}`);
      await expect(page.getByText('Most sell for', { exact: true })).toBeVisible();
      await expect(page.getByText('your price RM 520k', { exact: true })).toBeVisible();
      await expect(page.getByText(`Typical RM ${model.today.p50.toLocaleString('en-MY')}`, { exact: false }).first()).toBeVisible();
      await expect(page.getByText(/^a month \(90% loan, [\d.]+%, \d+ yrs\)$/)).toBeVisible();
      await expect(page.getByText('sales in 2 years', { exact: true })).toBeVisible();
      await expect(page.getByText(model.n_sales_2y.toLocaleString('en-MY'), { exact: true })).toBeVisible();
      await page.getByTestId('px-adjust').click();
      for (const l of ['Size', 'Tenure']) await expect(page.getByText(l, { exact: true })).toBeVisible();
      for (const l of [/^Small/, /^Typical/, /^Large/, /^Freehold/, /^Leasehold/]) await expect(page.getByRole('tab', { name: l })).toBeVisible();
      await page.getByText('What affects the price here?', { exact: true }).click();
      await expect(page.getByText('Links in past sales, not causes.', { exact: true })).toBeVisible();
      await expect(page.getByText(/^Distance to KL centre: /).first()).toBeVisible();
      await page.getByText('Links in past sales, not causes.', { exact: true }).scrollIntoViewIfNeeded();
    });

    await ac('AC11.10.6', 'What it could cost later', async () => {
      const step5 = page.getByTestId('px-step-5');
      await expect(step5.getByRole('heading')).toHaveText('What could it cost later?');
      await expect(step5.getByText('If recent trends continue. Not a prediction.', { exact: true })).toBeVisible();
      await page.getByTestId('px-more').click();
      for (const l of ['1 yr', '2 yrs', '3 yrs']) await expect(page.getByRole('tab', { name: l, exact: true })).toBeVisible();
      await page.getByRole('tab', { name: '3 yrs', exact: true }).click();
      const y3 = model.future[2];
      const year = Number(model.meta.price_level_quarter.slice(0, 4)) + 3;
      await expect(page.getByText(`In ${year}, it could cost`, { exact: true })).toBeVisible();
      await expect(page.getByText(`${rmK(y3.p10)} – ${rmK(y3.p90).replace('RM ', '')}`, { exact: true })).toBeVisible();
      await expect(page.getByText('Chance it costs less than today', { exact: true })).toBeVisible();
      await expect(page.getByText(/chance of costing less\.$/).first()).toBeVisible();
      await expect(page.getByText('If your price rises each year by', { exact: true })).toBeVisible();
      await expect(page.getByText(/^(Your price already covers the typical home\.|It catches up with the typical home in year \d\.|It covers the cheaper homes now, but not the typical one within 3 years\.|It reaches the cheaper homes in year \d, but not the typical one within 3 years\.|It stays below even the cheaper homes for the next 3 years\.)$/)).toBeVisible();
      await page.getByText('If your price rises each year by', { exact: true }).scrollIntoViewIfNeeded();
    });

    await ac('AC11.10.7', 'Accuracy, sources and a link to the stress test', async () => {
      await page.getByTestId('px-sure').click();
      await expect(page.getByText(`Tested on ${model.meta.test_sales!.toLocaleString('en-MY')} sales it had not seen.`, { exact: true })).toBeVisible();
      await expect(page.getByText('within 20% of the real price', { exact: true })).toBeVisible();
      await expect(page.getByText(`${Math.round(model.accuracy!.within_20pct * 10)} in 10`, { exact: true }).first()).toBeVisible();
      await expect(page.getByText(/^NAPIC Open Transaction Data \(2021–2026\), DOSM boundaries/)).toBeVisible();
      await expect(page.getByTestId('px-cta')).toHaveText(`Test ${rmK(model.today.p50)} in my stress test`);
      await page.getByText(/^NAPIC Open Transaction Data/).scrollIntoViewIfNeeded();
    });
    await page.getByTestId('px-cta').click();
    await expect(page.getByPlaceholder('e.g. 250,000')).toHaveValue(String(model.today.p50));
  });
});
