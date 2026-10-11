import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AccountStatePatch } from '../src/rumampu/api.ts';
import { changedAccountFields } from '../src/rumampu/account-sync.ts';

function accountState(): AccountStatePatch {
  return {
    cash_on_hand: 0,
    cash_on_hand_date: null,
    expense_limits: {},
    saving_plan: {},
    buffer_state: {},
    village_state: {},
    plan_horizon: null,
    pot_moved_months: [],
    pot_moved: 0,
    upfront_costs: [],
    docs_checked: [],
    learning_progress: { sjkp: 1 },
    kept_tests: [],
    bought_home: false,
    homeownership_purchase_month: null,
    notification_preferences: { bill_reminders: true, reminders: {} },
    experience_preferences: {
      ai_disclosure_accepted: false,
      tips_off: false,
      seen_guides: [],
    },
  };
}

describe('account field synchronization', () => {
  it('does not send stale reminder settings with a reading-progress edit', () => {
    const original = accountState();
    const edited = structuredClone(original);
    edited.learning_progress.sjkp = 2;

    assert.deepEqual(changedAccountFields(original, edited), {
      learning_progress: { sjkp: 2 },
    });
  });

  it('does not send stale reading progress with a reminder edit', () => {
    const original = accountState();
    const edited = structuredClone(original);
    edited.notification_preferences.reminders.income = {
      enabled: true,
      day: 1,
      time: '20:00',
      repeat: 'daily',
    };

    assert.deepEqual(changedAccountFields(original, edited), {
      notification_preferences: edited.notification_preferences,
    });
  });

  it('preserves both devices changes regardless of patch completion order', () => {
    const original = accountState();
    const progressDevice = structuredClone(original);
    progressDevice.learning_progress.sjkp = 2;
    const reminderDevice = structuredClone(original);
    reminderDevice.notification_preferences.reminders.income = {
      enabled: true,
      day: 1,
      time: '20:00',
      repeat: 'daily',
    };
    const progressPatch = changedAccountFields(original, progressDevice);
    const reminderPatch = changedAccountFields(original, reminderDevice);

    assert.deepEqual({ ...original, ...progressPatch, ...reminderPatch }, {
      ...original,
      learning_progress: progressDevice.learning_progress,
      notification_preferences: reminderDevice.notification_preferences,
    });
    assert.deepEqual({ ...original, ...reminderPatch, ...progressPatch }, {
      ...original,
      learning_progress: progressDevice.learning_progress,
      notification_preferences: reminderDevice.notification_preferences,
    });
  });
});
