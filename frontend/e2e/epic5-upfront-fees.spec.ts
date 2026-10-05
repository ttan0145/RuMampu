import { expect, test } from '@playwright/test';
import { MOCK } from '../src/rumampu/mock';
import {
  legalFee, stampDutyLoan, stampDutyTransfer, ufExempt, upfrontNeed, valuationFee,
} from '../src/rumampu/fees';
import { potForUpfront, potHeld, potParts, potSum } from '../src/rumampu/pot';
import type { AppState } from '../src/rumampu/state';
import { planEnsure, planPhase, planToggle, syncBufferTarget } from '../src/rumampu/plan';
import { setHousingTestResult } from '../services/housingSession';
import type { HousingTestResult } from '../types/housing';
import { accountSnapshot, hydrateAccountState } from '../src/rumampu/persist';

/* US5.2 engineering regression — the published fee scales behind "You need".

   These are pure functions, so they are pinned here at their band edges rather
   than through the browser. Each expected figure is worked out by hand from the
   published scale named in fees.ts (Stamp Act 1949 First Schedule items 32(a)
   and 27(a); Solicitors' Remuneration Order 2023; Board of Valuers Rule 48). The
   scales are not acceptance criteria themselves, so these titles use TECH-. */

interface HouseInput {
  price: number | null;
  deposit: number;
  firstHome?: boolean;
  ufReno?: boolean;
  /** Amounts the user typed into the upfront list, by item id. */
  entered?: Record<string, number>;
  /** A saved test chosen as the price source, instead of the house screen. */
  keptTest?: { propertyPrice: number; deposit: number };
}

/* Only the fields fees.ts reads are supplied. */
function stateFor(input: HouseInput): AppState {
  return {
    firstHome: !!input.firstHome,
    ufReno: !!input.ufReno,
    ufTest: input.keptTest ? 0 : null,
    keptTests: input.keptTest
      ? [{ pay: 0, s: 0, n: 0, g: 0, propertyPrice: input.keptTest.propertyPrice, scenario: { deposit: String(input.keptTest.deposit) } }]
      : [],
    data: {
      house: { price: input.price, deposit: input.deposit, rate: 4.3, years: 35, knownPayment: null },
      upfront: MOCK.upfront.map(item => ({ ...item, a: input.entered?.[item.id] ?? 0 })),
    },
  } as unknown as AppState;
}

test.describe('Epic 5 — Upfront cash fee scales', { tag: ['@epic5', '@hardening'] }, () => {
  test('TECH-5.2 — Transfer stamp duty follows the 1%, 2%, 3% and 4% bands per RM100 or part', async () => {
    const expected: [number, number][] = [
      [0, 0],
      [1, 1],
      [100, 1],
      [101, 2],
      [250, 3],
      [80_000, 800],
      [100_000, 1_000],
      [100_001, 1_002],
      [250_000, 4_000],
      [300_000, 5_000],
      [500_000, 9_000],
      [500_001, 9_003],
      [1_000_000, 24_000],
      [1_000_001, 24_004],
    ];
    for (const [price, duty] of expected) expect(stampDutyTransfer(price), `price ${price}`).toBe(duty);
    expect(stampDutyTransfer(-5)).toBe(0);
    expect(stampDutyTransfer(Number.NaN)).toBe(0);
  });

  test('TECH-5.2 — Loan stamp duty is RM5 for each RM1,000 financed or part', async () => {
    const expected: [number, number][] = [
      [0, 0],
      [1, 5],
      [1_000, 5],
      [1_001, 10],
      [80_000, 400],
      [250_000, 1_250],
      [270_000, 1_350],
    ];
    for (const [loan, duty] of expected) expect(stampDutyLoan(loan), `loan ${loan}`).toBe(duty);
    expect(stampDutyLoan(-1)).toBe(0);
  });

  test('TECH-5.2 — Legal fees are 1.25% of the first RM500,000 and 1% after, with a RM500 minimum', async () => {
    const expected: [number, number][] = [
      [0, 0],
      [10_000, 500],
      [40_000, 500],
      [80_000, 1_000],
      [100_000, 1_250],
      [270_000, 3_375],
      [300_000, 3_750],
      [500_000, 6_250],
      [600_000, 7_250],
      [1_000_000, 11_250],
    ];
    for (const [value, fee] of expected) expect(legalFee(value), `value ${value}`).toBe(fee);
  });

  test('TECH-5.2 — Valuation fees follow the 1/4%, 1/5% and 1/6% bands with a RM400 minimum', async () => {
    const expected: [number, number][] = [
      [0, 0],
      [80_000, 400],
      [100_000, 400],
      [160_000, 400],
      [200_000, 450],
      [300_000, 650],
      [2_000_000, 4_050],
      [7_000_000, 12_383],
    ];
    for (const [value, fee] of expected) expect(valuationFee(value), `value ${value}`).toBe(fee);
  });

  test('TECH-5.2 — The first-home exemption applies only to a RM500,000 or cheaper home', async () => {
    expect(ufExempt(stateFor({ price: 500_000, deposit: 0, firstHome: true }), 500_000)).toBe(true);
    expect(ufExempt(stateFor({ price: 500_001, deposit: 0, firstHome: true }), 500_001)).toBe(false);
    expect(ufExempt(stateFor({ price: 0, deposit: 0, firstHome: true }), 0)).toBe(false);
    expect(ufExempt(stateFor({ price: 300_000, deposit: 0, firstHome: false }), 300_000)).toBe(false);
  });

  test('TECH-5.2 — What you need is the deposit plus fees, and only what is on the list', async () => {
    // RM 300,000 with RM 30,000 down: 30,000 + 5,000 + 1,350 + 3,750 + 3,375 + 650.
    expect(upfrontNeed(stateFor({ price: 300_000, deposit: 30_000 }))).toBe(44_125);

    // The first-home exemption removes both stamp duties (5,000 and 1,350).
    expect(upfrontNeed(stateFor({ price: 300_000, deposit: 30_000, firstHome: true }))).toBe(37_775);

    // Above RM500,000 the exemption no longer applies: 9,003 + 2,505 + 6,250 + 6,250 + 1,050, no deposit.
    expect(upfrontNeed(stateFor({ price: 500_001, deposit: 0, firstHome: true }))).toBe(25_058);

    // The earnest deposit is part of the deposit, never added on top.
    expect(upfrontNeed(stateFor({ price: 300_000, deposit: 30_000, entered: { earnest: 5_000 } }))).toBe(44_125);

    // Mortgage insurance is added when the user enters a quote.
    expect(upfrontNeed(stateFor({ price: 300_000, deposit: 30_000, entered: { mrta: 12_000 } }))).toBe(56_125);

    // Move-in costs count; renovation counts only while its switch is on.
    const moveIn = { util: 900, strata: 1_200, furn: 6_000, reno: 15_000 };
    expect(upfrontNeed(stateFor({ price: 300_000, deposit: 30_000, entered: moveIn }))).toBe(44_125 + 8_100);
    expect(upfrontNeed(stateFor({ price: 300_000, deposit: 30_000, entered: moveIn, ufReno: true }))).toBe(44_125 + 8_100 + 15_000);

    // With no price there are no fees to work out, only what the user has entered.
    expect(upfrontNeed(stateFor({ price: null, deposit: 0 }))).toBe(0);
    expect(upfrontNeed(stateFor({ price: null, deposit: 0, entered: { util: 900 } }))).toBe(900);
  });

  test('TECH-5.2 — The pot counts the cash I had, the plan and moved-in months once each', async () => {
    const state = (cash: number, planSaved: number | null, moved: number) => ({
      potMoved: moved,
      village: planSaved === null ? null : { savedRm: planSaved },
      data: { cashOnHand: cash },
    }) as unknown as AppState;

    expect(potParts(state(1000, 83, 200))).toEqual({ had: 1000, plan: 83, moved: 200, total: 1283 });
    expect(potSum(state(1000, 83, 200))).toBe(1283);
    // No plan started yet, nothing moved in: the pot is just the cash entered.
    expect(potParts(state(8000, null, 0))).toEqual({ had: 8000, plan: 0, moved: 0, total: 8000 });
    // Nothing anywhere is an empty pot, and a bad value never makes it negative.
    expect(potSum(state(0, null, 0))).toBe(0);
    expect(potSum(state(-50, 10, 0))).toBe(10);
  });

  test('TECH-5.8 — The buffer is held from the whole pot first and only the rest counts towards upfront cash', async () => {
    const state = (cash: number, planSaved: number, moved: number) => ({
      potMoved: moved,
      village: { savedRm: planSaved },
      data: { cashOnHand: cash },
    }) as unknown as AppState;

    // RM 1,000 cash + RM 300 saved + RM 200 moved in = RM 1,500; a RM 905 buffer is held first.
    expect(potHeld(state(1000, 300, 200), 905)).toBe(905);
    expect(potForUpfront(state(1000, 300, 200), 905)).toBe(595);
    // Cash I already had counts towards the buffer too (it is part of the pot).
    expect(potHeld(state(800, 0, 0), 905)).toBe(800);
    expect(potForUpfront(state(800, 0, 0), 905)).toBe(0);
    // No buffer (no test, or RM 0): nothing is held and the whole pot counts.
    expect(potHeld(state(8000, 0, 0), 0)).toBe(0);
    expect(potForUpfront(state(8000, 0, 0), 0)).toBe(8000);
    // Held plus what counts towards upfront cash is always the pot.
    for (const target of [0, 500, 1500, 99999]) {
      const s = state(1000, 300, 200);
      expect(potHeld(s, target) + potForUpfront(s, target)).toBe(potSum(s));
    }
  });

  test('TECH-5.2 — A chosen saved test supplies the price and deposit instead of the house screen', async () => {
    // RM 200,000 with RM 20,000 down: 20,000 + 3,000 + 900 + 2,500 + 2,250 + 450.
    const state = stateFor({ price: 300_000, deposit: 30_000, keptTest: { propertyPrice: 200_000, deposit: 20_000 } });
    expect(upfrontNeed(state)).toBe(29_100);
  });
});

test.describe('Safety buffer saving reversals', { tag: ['@epic5', '@epic10', '@hardening'] }, () => {
  const result = {
    tested_home_cost: 100,
    months: [{ post_housing_residual: 100 }],
    starting_liquidity: { required_amount: 100, months: [] },
  } as unknown as HousingTestResult;

  function savingState(amounts: number[]): AppState {
    const state = stateFor({ price: 300000, deposit: 30000 });
    state.data.cashOnHand = 0;
    state.potMoved = 0;
    state.plan = null;
    state.village = null;
    state.buffer = null;
    setHousingTestResult(result);
    syncBufferTarget(state, result);
    const plan = planEnsure(state);
    plan.amounts = plan.amounts.map((_, i) => amounts[i] ?? 0);
    plan.target = amounts.reduce((sum, amount) => sum + amount, 0);
    return state;
  }

  test.afterEach(() => setHousingTestResult(null));

  test('TECH-BUFFER-01 — Undoing the day that filled the shield reopens the buffer phase', () => {
    const state = savingState([100]);
    planToggle(state, 0);
    expect(state.buffer?.saved).toBe(100);
    expect(planPhase(state, result)).toBe('village');
    planToggle(state, 0);
    expect(state.buffer?.saved).toBe(0);
    expect(potSum(state)).toBe(0);
    expect(planPhase(state, result)).toBe('buffer');
  });

  test('TECH-BUFFER-02 — Undo uses each day\'s allocation even after the phase changes', () => {
    const state = savingState([100, 40]);
    planToggle(state, 0);
    planToggle(state, 1);
    expect(state.village?.built).toBe(1);
    const remote = JSON.parse(JSON.stringify(accountSnapshot(state)));
    state.plan = null;
    hydrateAccountState(state, remote);
    expect(planEnsure(state).buffered?.slice(0, 2)).toEqual([true, false]);
    planToggle(state, 0);
    expect(state.buffer?.saved).toBe(0);
    // US5.8: the RM 40 still saved is held for the RM 100 buffer first.
    expect(potHeld(state, 100)).toBe(40);
    expect(potForUpfront(state, 100)).toBe(0);
    expect(planPhase(state, result)).toBe('buffer');
    planToggle(state, 1);
    expect(potSum(state)).toBe(0);
    expect(state.village?.built).toBe(0);
    expect(state.village?.cells.every(cell => cell === 0)).toBe(true);
  });

  test('TECH-BUFFER-03 — Undoing a buffered day reverses overflow before the shield', () => {
    const state = savingState([60, 80]);
    planToggle(state, 0);
    planToggle(state, 1);
    expect(state.buffer).toMatchObject({ saved: 100, overflow: 40 });
    planToggle(state, 0);
    expect(state.buffer).toMatchObject({ saved: 80, overflow: 0 });
    expect(potSum(state)).toBe(80);
    expect(potForUpfront(state, 100)).toBe(0);
  });

  test('TECH-BUFFER-04 — Legacy plans cannot retain more reserved money than remains saved', () => {
    const state = savingState([100]);
    planToggle(state, 0);
    if (state.plan) delete state.plan.buffered;
    planToggle(state, 0);
    expect(state.buffer).toMatchObject({ saved: 0, overflow: 0 });
    expect(planPhase(state, result)).toBe('buffer');
  });

  test('TECH-BUFFER-05 — Cash I already had fills the buffer first, so the plan goes straight to upfront cash', () => {
    const state = savingState([10]);
    expect(planPhase(state, result)).toBe('buffer');
    state.data.cashOnHand = 100;
    expect(planPhase(state, result)).toBe('village');
    expect(potHeld(state, 100)).toBe(100);
    expect(potForUpfront(state, 100)).toBe(0);
    state.data.cashOnHand = 60;
    expect(planPhase(state, result)).toBe('buffer');
  });
});
