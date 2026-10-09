import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  monthsBetween, postPurchaseMonths, testedMonthsAfterPurchase, unrecordedCompletedMonths,
} from '../src/rumampu/homeownership-months.ts';

// 9 October 2026: October is still in progress.
const NOW = new Date(2026, 9, 9, 12, 0, 0);

describe('homeownership months', () => {
  it('lists every month between two months, across a year end', () => {
    assert.deepEqual(monthsBetween('2025-11', '2026-02'), ['2025-11', '2025-12', '2026-01', '2026-02']);
    assert.deepEqual(monthsBetween('2026-05', '2026-04'), []);
  });

  it('offers every month since buying, including ones with no income, newest first', () => {
    assert.deepEqual(postPurchaseMonths('2026-07', NOW), ['2026-10', '2026-09', '2026-08', '2026-07']);
  });

  it('finds completed months since buying that have no home costs yet, leaving out this month', () => {
    // Bought in January; only July to September were recorded.
    assert.deepEqual(
      unrecordedCompletedMonths('2026-01', ['2026-07', '2026-08', '2026-09'], NOW),
      ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'],
    );
    assert.deepEqual(unrecordedCompletedMonths('2026-10', [], NOW), []);
  });

  it('counts the earlier test months that fall on or after the purchase month', () => {
    const tested = ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
    assert.equal(testedMonthsAfterPurchase(tested, '2026-07'), 3);
    assert.equal(testedMonthsAfterPurchase(tested, '2026-10'), 0);
  });
});

describe('completed months since buying', () => {
  it('counts ended months from the purchase month, leaving out this month', async () => {
    const { completedMonthsSincePurchase } = await import('../src/rumampu/homeownership-months.ts');
    assert.equal(completedMonthsSincePurchase('2026-04', NOW), 6);
    assert.equal(completedMonthsSincePurchase('2026-07', NOW), 3);
    assert.equal(completedMonthsSincePurchase('2026-10', NOW), 0);
  });
});
