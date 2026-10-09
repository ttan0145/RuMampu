import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BUY_FACTS, BUY_SRC, SCHED } from '../src/rumampu/buying-facts.ts';

/* AC5.11.4: every timing or share on How buying works either names a source
   with a checked date or is marked unverified; the Schedule H stages add up. */

describe('Schedule H stages', () => {
  it('bill the whole price across the twelve stages', () => {
    assert.equal(SCHED.length, 12);
    assert.equal(SCHED.reduce((sum, [, , pct]) => sum + pct, 0), 100);
  });

  it('pay 65% of the price while the home is built (stages 2(a) to 2(h))', () => {
    const build = SCHED.slice(1, 9);
    assert.deepEqual(build.map(([code]) => code), ['2(a)', '2(b)', '2(c)', '2(d)', '2(e)', '2(f)', '2(g)', '2(h)']);
    assert.equal(build.reduce((sum, [, , pct]) => sum + pct, 0), 65);
  });

  it('bill 17.5% at the keys stage', () => {
    const keys = SCHED.find(([code]) => code === '3');
    assert.ok(keys);
    assert.equal(keys[2], 17.5);
  });
});

describe('Sources for the timings and shares', () => {
  it('each source has a secure link and a checked date', () => {
    for (const [key, src] of Object.entries(BUY_SRC)) {
      assert.ok(src.n.length > 0, `${key} has a name`);
      assert.match(src.h, /^https:\/\//, `${key} links over https`);
      assert.match(src.d, /^\d{1,2} [A-Z][a-z]+ 20\d\d$/, `${key} carries a checked date`);
    }
  });

  it('each fact names a source with a date, or is marked unverified', () => {
    for (const [key, fact] of Object.entries(BUY_FACTS)) {
      if (fact.status === 'practice') {
        assert.ok(fact.src && BUY_SRC[fact.src], `${key} names a registered source`);
      } else {
        assert.equal(fact.status, 'unverified', `${key} is either sourced or unverified`);
      }
      if (fact.src) assert.ok(BUY_SRC[fact.src], `${key} points at a registered source`);
    }
  });

  it('covers the subsale timings, the project shares and the age rule', () => {
    assert.deepEqual(Object.keys(BUY_FACTS).sort(), ['age', 'book', 'comp', 'keys', 'sched', 'spa']);
    assert.equal(BUY_FACTS.keys.status, 'unverified');
    assert.equal(BUY_FACTS.sched.status, 'unverified');
    assert.equal(BUY_FACTS.sched.src, 'hda');
  });
});
