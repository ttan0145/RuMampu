import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AppState } from '../src/rumampu/state.tsx';
import {
  legalFee, stampDutyLoan, stampDutyTransfer, ufExempt, ufSource, upfrontFees, upfrontNeed, valuationFee,
} from '../src/rumampu/fees.ts';

/* Minimal AppState: only the fields fees.ts reads. */
interface Stub {
  firstHome?: boolean;
  ufReno?: boolean;
  ufTest?: number | null;
  keptTests?: unknown[];
  house?: { price?: number | null; deposit?: number; knownPayment?: number | null };
  upfront?: { id: string; a: number; stage: number; sw?: boolean }[];
  prep?: { price?: number; name?: string | null };
}

function state(o: Stub = {}): AppState {
  return {
    firstHome: o.firstHome ?? false,
    ufReno: o.ufReno ?? false,
    ufTest: o.ufTest ?? null,
    keptTests: o.keptTests ?? [],
    prep: o.prep ?? { price: 0, name: null },
    data: {
      house: { price: 0, deposit: 0, knownPayment: null, ...o.house },
      upfront: o.upfront ?? [],
    },
  } as unknown as AppState;
}

describe('stampDutyTransfer (Stamp Act 1949, First Schedule 32(a))', () => {
  const cases: [number, number][] = [
    [0, 0],
    [100_000, 1_000],
    [100_001, 1_002],
    [300_000, 5_000],
    [500_000, 9_000],
    [500_001, 9_003],
    [1_000_000, 24_000],
    [1_000_001, 24_004],
    [250_050, 4_002], // 1,000 + ceil(150,050 / 100) * 2
    [-5, 0],
  ];
  for (const [price, duty] of cases) {
    it(`RM ${price} -> RM ${duty}`, () => assert.equal(stampDutyTransfer(price), duty));
  }
});

describe('stampDutyLoan (item 27(a))', () => {
  const cases: [number, number][] = [[0, 0], [999, 5], [1_000, 5], [270_000, 1_350], [270_001, 1_355]];
  for (const [loan, duty] of cases) {
    it(`RM ${loan} -> RM ${duty}`, () => assert.equal(stampDutyLoan(loan), duty));
  }
});

describe('legalFee (SRO 2023, P.U.(A) 207/2023)', () => {
  const cases: [number, number][] = [
    [0, 0],
    [10_000, 500], // 1.25% = 125, raised to the RM500 minimum
    [270_000, 3_375],
    [300_000, 3_750],
    [500_000, 6_250],
    [1_000_000, 11_250], // 6,250 + 1% of the next 500,000
    [400_100, 5_001], // 5,001.25 rounds down
    [400_140, 5_002], // 5,001.75 rounds up
  ];
  for (const [value, fee] of cases) {
    it(`RM ${value} -> RM ${fee}`, () => assert.equal(legalFee(value), fee));
  }
});

describe('valuationFee (Board of Valuers, Rule 48 item 3)', () => {
  const cases: [number, number][] = [
    [0, 0],
    [100_000, 400], // 0.25% = 250, raised to the RM400 minimum
    [200_000, 450],
    [1_000_000, 2_050],
    [2_000_000, 4_050],
    [2_600_000, 5_050], // 4,050 + 600,000 / 600
    [7_000_000, 12_383], // 4,050 + 5,000,000 / 600 = 12,383.33
  ];
  for (const [value, fee] of cases) {
    it(`RM ${value} -> RM ${fee}`, () => assert.equal(valuationFee(value), fee));
  }
});

describe('ufExempt (P.U.(A) 53/2021 and 54/2021)', () => {
  it('applies to a first home at RM 500,000', () => assert.equal(ufExempt(state({ firstHome: true }), 500_000), true));
  it('does not apply at RM 500,001', () => assert.equal(ufExempt(state({ firstHome: true }), 500_001), false));
  it('does not apply to a price of 0', () => assert.equal(ufExempt(state({ firstHome: true }), 0), false));
  it('does not apply when the switch is off', () => assert.equal(ufExempt(state({ firstHome: false }), 300_000), false));
});

describe('ufSource', () => {
  it('uses the chosen kept test', () => {
    const s = state({
      ufTest: 0,
      keptTests: [{ name: 'Test A', propertyPrice: 400_000, scenario: { deposit: 40_000 } }],
      house: { price: 300_000, deposit: 30_000 },
    });
    assert.deepEqual(ufSource(s), { name: 'Test A', price: 400_000, dep: 40_000, saved: true });
  });

  it('falls back to the price on the house screen', () => {
    const s = state({ house: { price: 300_000, deposit: 30_000, knownPayment: null } });
    assert.deepEqual(ufSource(s), { name: null, price: 300_000, dep: 30_000, saved: false });
  });

  it('uses a home typed on Prepare with a 10% deposit', () => {
    const s = state({ prep: { price: 350_000, name: 'My flat' } });
    assert.deepEqual(ufSource(s), { name: 'My flat', price: 350_000, dep: 35_000, saved: false, typed: true });
  });

  it('is empty when nothing is set', () => {
    assert.deepEqual(ufSource(state()), { name: null, price: 0, dep: 0, saved: false });
  });
});

describe('upfrontFees', () => {
  const house = { price: 300_000, deposit: 30_000, knownPayment: null };

  it('zeroes duty for an exempt first home but keeps the un-exempted amounts', () => {
    const f = upfrontFees(state({ firstHome: true, house }));
    assert.equal(f.exempt, true);
    assert.equal(f.t, 0);
    assert.equal(f.l, 0);
    assert.equal(f.t0, 5_000);
    assert.equal(f.l0, 1_350);
    assert.equal(f.spa, 3_750);
    assert.equal(f.loanLegal, 3_375);
    assert.equal(f.val, 650);
  });

  it('charges duty when the first-home switch is off', () => {
    const f = upfrontFees(state({ firstHome: false, house }));
    assert.equal(f.exempt, false);
    assert.equal(f.t, 5_000);
    assert.equal(f.l, 1_350);
  });
});

describe('upfrontNeed', () => {
  const house = { price: 300_000, deposit: 30_000, knownPayment: null };

  it('adds deposit, duties, legal and valuation fees', () => {
    assert.equal(upfrontNeed(state({ firstHome: false, house })), 30_000 + 5_000 + 1_350 + 3_750 + 3_375 + 650);
  });

  it('leaves the duties out for an exempt first home', () => {
    assert.equal(upfrontNeed(state({ firstHome: true, house })), 30_000 + 3_750 + 3_375 + 650);
  });

  it('never adds the earnest deposit on top of the deposit (AC5.2.12)', () => {
    const base = upfrontNeed(state({ firstHome: true, house }));
    const withEarnest = upfrontNeed(state({
      firstHome: true, house, upfront: [{ id: 'earnest', a: 3_000, stage: 1 }],
    }));
    assert.equal(withEarnest, base);
  });

  it('counts the MRTA item', () => {
    const base = upfrontNeed(state({ firstHome: true, house }));
    const s = state({ firstHome: true, house, upfront: [{ id: 'mrta', a: 1_200, stage: 2 }] });
    assert.equal(upfrontNeed(s), base + 1_200);
  });

  it('counts a stage 3 switch item only while renovation is on', () => {
    const base = upfrontNeed(state({ firstHome: true, house }));
    const items = [{ id: 'reno', a: 2_000, stage: 3, sw: true }, { id: 'keys', a: 500, stage: 3 }];
    assert.equal(upfrontNeed(state({ firstHome: true, house, upfront: items, ufReno: false })), base + 500);
    assert.equal(upfrontNeed(state({ firstHome: true, house, upfront: items, ufReno: true })), base + 2_500);
  });

  it('works from a kept test price and deposit', () => {
    const s = state({
      firstHome: true,
      ufTest: 0,
      keptTests: [{ name: 'A', propertyPrice: 400_000, scenario: { deposit: 40_000 } }],
    });
    // loan 360,000: loan legal 1.25% = 4,500; SPA 5,000; valuation 250 + 600 = 850
    assert.equal(upfrontNeed(s), 40_000 + 5_000 + 4_500 + 850);
  });
});
