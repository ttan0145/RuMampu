import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AppState } from '../src/rumampu/state.tsx';
import { potForUpfront, potHeld, potParts, potSum } from '../src/rumampu/pot.ts';

interface Stub { cash?: number; planSaved?: number; moved?: number; used?: number }

function state(o: Stub = {}): AppState {
  return {
    data: { cashOnHand: o.cash ?? 0 },
    village: { savedRm: o.planSaved ?? 0 },
    potMoved: o.moved ?? 0,
    buffer: { used: o.used ?? 0 },
  } as unknown as AppState;
}

describe('pot (US5.8)', () => {
  it('AC5.8.9: a RM 10,000 pot with a RM 3,000 buffer holds 3,000 and offers 7,000', () => {
    const s = state({ cash: 10_000 });
    assert.equal(potSum(s), 10_000);
    assert.equal(potHeld(s, 3_000), 3_000);
    assert.equal(potForUpfront(s, 3_000), 7_000);
  });

  it('AC5.8.9: after RM 1,000 is used the pot is 9,000, 3,000 held, 6,000 available', () => {
    const s = state({ cash: 10_000, used: 1_000 });
    assert.equal(potSum(s), 9_000);
    assert.equal(potHeld(s, 3_000), 3_000);
    assert.equal(potForUpfront(s, 3_000), 6_000);
  });

  it('AC5.8.5: a buffer of RM 0 holds nothing and the whole pot is available', () => {
    const s = state({ cash: 10_000 });
    assert.equal(potHeld(s, 0), 0);
    assert.equal(potForUpfront(s, 0), 10_000);
  });

  it('holds only what the pot has when the buffer is bigger, never going negative', () => {
    const s = state({ cash: 2_000 });
    assert.equal(potHeld(s, 5_000), 2_000);
    assert.equal(potForUpfront(s, 5_000), 0);
  });

  it('treats a missing or invalid buffer target as 0', () => {
    const s = state({ cash: 4_000 });
    assert.equal(potHeld(s, Number.NaN), 0);
    assert.equal(potHeld(s, -100), 0);
    assert.equal(potForUpfront(s, Number.NaN), 4_000);
  });

  it('potParts: cash, plan and moved add up and used leaves the pot; total is the sum', () => {
    const p = potParts(state({ cash: 5_000, planSaved: 1_500, moved: 2_500, used: 1_000 }));
    assert.deepEqual(p, { had: 5_000, plan: 1_500, moved: 2_500, used: 1_000, total: 8_000 });
    assert.equal(p.had + p.plan + p.moved - p.used, p.total);
  });

  it('potParts: total never goes below 0', () => {
    assert.equal(potParts(state({ cash: 500, used: 2_000 })).total, 0);
  });

  it('potParts: negative or missing inputs count as 0', () => {
    const s = { data: { cashOnHand: -50 }, potMoved: undefined, buffer: undefined, village: undefined } as unknown as AppState;
    assert.deepEqual(potParts(s), { had: 0, plan: 0, moved: 0, used: 0, total: 0 });
  });
});
