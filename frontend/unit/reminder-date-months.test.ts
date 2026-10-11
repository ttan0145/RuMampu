import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { nextReminderDate } from '../src/rumampu/reminder-date.ts';

/* Monthly reminders around short months and year ends. Times are local to the
   device, which is Malaysia time for RuMampu users. */
const at = (y: number, m: number, d: number, h: number, min: number) => new Date(y, m, d, h, min, 0, 0).getTime();
const monthly = (day: number) => ({ repeat: 'monthly' as const, day, time: '09:00' });

describe('nextReminderDate, month ends', () => {
  it('a day 31 reminder falls on 28 February in an ordinary year', () => {
    assert.equal(nextReminderDate(monthly(31), new Date(2027, 1, 1))?.getTime(), at(2027, 1, 28, 9, 0));
  });

  it('a day 31 reminder falls on 29 February in a leap year', () => {
    assert.equal(nextReminderDate(monthly(31), new Date(2028, 1, 1))?.getTime(), at(2028, 1, 29, 9, 0));
  });

  it('a day 29 reminder also falls on 28 February when February is short', () => {
    assert.equal(nextReminderDate(monthly(29), new Date(2027, 1, 15))?.getTime(), at(2027, 1, 28, 9, 0));
  });

  it('once the February reminder has passed, the next one is 31 March', () => {
    assert.equal(nextReminderDate(monthly(31), new Date(2027, 1, 28, 10, 0))?.getTime(), at(2027, 2, 31, 9, 0));
  });

  it('after 31 January has passed, the next one is 28 February', () => {
    assert.equal(nextReminderDate(monthly(31), new Date(2027, 0, 31, 10, 0))?.getTime(), at(2027, 1, 28, 9, 0));
  });

  it('after 31 December has passed, the next one is 31 January of the new year', () => {
    assert.equal(nextReminderDate(monthly(31), new Date(2026, 11, 31, 10, 0))?.getTime(), at(2027, 0, 31, 9, 0));
  });
});
