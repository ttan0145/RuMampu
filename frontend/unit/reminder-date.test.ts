import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isValidReminderRule, nextReminderDate } from '../src/rumampu/reminder-date.ts';

// Thursday 8 October 2026, 10:00 local time.
const NOW = new Date(2026, 9, 8, 10, 0, 0, 0);
const at = (y: number, m: number, d: number, h: number, min: number) => new Date(y, m, d, h, min, 0, 0).getTime();

describe('nextReminderDate', () => {
  it('daily: later today, or tomorrow once today’s time has passed', () => {
    assert.equal(nextReminderDate({ repeat: 'daily', day: 1, time: '20:00' }, NOW)?.getTime(), at(2026, 9, 8, 20, 0));
    assert.equal(nextReminderDate({ repeat: 'daily', day: 1, time: '09:00' }, NOW)?.getTime(), at(2026, 9, 9, 9, 0));
  });

  it('weekly: the next matching weekday, a week on when it is today and has passed', () => {
    // Monday (1) after Thursday 8 Oct is 12 Oct.
    assert.equal(nextReminderDate({ repeat: 'weekly', weekday: 1, day: 1, time: '08:30' }, NOW)?.getTime(), at(2026, 9, 12, 8, 30));
    // Thursday (4) at 11:00 is still today; at 09:00 it is next Thursday.
    assert.equal(nextReminderDate({ repeat: 'weekly', weekday: 4, day: 1, time: '11:00' }, NOW)?.getTime(), at(2026, 9, 8, 11, 0));
    assert.equal(nextReminderDate({ repeat: 'weekly', weekday: 4, day: 1, time: '09:00' }, NOW)?.getTime(), at(2026, 9, 15, 9, 0));
  });

  it('monthly: unchanged rule, and the default when repeat is missing', () => {
    assert.equal(nextReminderDate({ day: 31, time: '09:00' }, NOW)?.getTime(), at(2026, 9, 31, 9, 0));
    // November has 30 days, so day 31 falls on the 30th.
    assert.equal(nextReminderDate({ repeat: 'monthly', day: 31, time: '09:00' }, new Date(2026, 10, 1))?.getTime(), at(2026, 10, 30, 9, 0));
  });

  it('once: the chosen moment, or nothing once it has passed', () => {
    assert.equal(nextReminderDate({ repeat: 'once', date: '2026-12-24', day: 1, time: '10:00' }, NOW)?.getTime(), at(2026, 11, 24, 10, 0));
    assert.equal(nextReminderDate({ repeat: 'once', date: '2026-10-08', day: 1, time: '09:00' }, NOW), null);
  });
});

describe('isValidReminderRule', () => {
  it('keeps reminders saved before repeats existed', () => {
    assert.equal(isValidReminderRule({ day: 15, time: '18:30' }), true);
  });

  it('needs a weekday for weekly and a real date for once', () => {
    assert.equal(isValidReminderRule({ repeat: 'weekly', day: 1, time: '09:00' }), false);
    assert.equal(isValidReminderRule({ repeat: 'weekly', weekday: 7, day: 1, time: '09:00' }), false);
    assert.equal(isValidReminderRule({ repeat: 'once', day: 1, time: '09:00' }), false);
    assert.equal(isValidReminderRule({ repeat: 'once', date: '2026-02-30', day: 1, time: '09:00' }), false);
    assert.equal(isValidReminderRule({ repeat: 'hourly', day: 1, time: '09:00' }), false);
  });
});
