import type { AppState, BufferState, KeptTest, PlanState, VillageState } from './state';
import { STATEMENT_SCAN_DISCLOSURE_VERSION } from './ai-disclosure';
import { getHousingScenario, getHousingTestResult, hydrateHousingSession } from '../../services/housingSession';
import { isValidIsoDate } from './validation';

const VERSION = 1;
/* AC5.8.10: the longest name a user can give their safety money. */
export const BUFFER_NAME_MAX = 30;
const PERSISTED = ['plan', 'buffer', 'village', 'planHorizon',
  'potMovedMonths', 'potMoved', 'docsChecked', 'keptTests', 'tipsOff', 'seenG', 'lnProg',
  'bought', 'purchaseMonth', 'notificationPreferences', 'aiDisclosureAccepted', 'statementDisclosureVersion',
  'voiceDisclosureAccepted'] as const;

type JsonRecord = Record<string, unknown>;

function record(value: unknown): value is JsonRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function validExpenseLimits(value: unknown): value is Record<string, number> {
  return record(value) && Object.entries(value).every(([key, amount]) =>
    key.length > 0 && finite(amount) && amount >= 0);
}

function daysInMonth(key: string): number | null {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || month < 1 || month > 12) return null;
  return new Date(year, month, 0).getDate();
}

function validPlan(value: unknown): value is PlanState {
  if (!record(value)) return false;
  const nValue = value.n;
  if (typeof value.key !== 'string' || !finite(value.target)
    || value.target < 0 || typeof nValue !== 'number' || !Number.isInteger(nValue) || nValue < 1) return false;
  const n = nValue;
  if (daysInMonth(value.key) !== n || !Array.isArray(value.amounts)
    || value.amounts.length !== n || !value.amounts.every(item => finite(item) && item >= 0)
    || !Array.isArray(value.done) || value.done.length !== n
    || !value.done.every(item => typeof item === 'boolean') || !finite(value.seed)) return false;
  if (value.skipped !== undefined
    && (!Array.isArray(value.skipped) || value.skipped.length !== n
      || !value.skipped.every(item => typeof item === 'boolean'))) return false;
  if (value.buffered !== undefined
    && (!Array.isArray(value.buffered) || value.buffered.length !== n
      || !value.buffered.every(item => item === null || typeof item === 'boolean'))) return false;
  return value.paused === undefined || typeof value.paused === 'boolean';
}

function validBuffer(value: unknown): value is BufferState {
  /* saved and overflow are the retired shield balance: still accepted from older
     snapshots so the rest of the buffer is kept, but dropped on hydrate. */
  const optionalAmount = (v: unknown) => v === undefined || (finite(v) && v >= 0);
  if (!record(value) || !optionalAmount(value.saved) || !optionalAmount(value.overflow)
    || !optionalAmount(value.used)
    || !(value.name === undefined || (typeof value.name === 'string' && value.name.length <= BUFFER_NAME_MAX))
    || !(value.target === null || (finite(value.target) && value.target >= 0))
    || !(value.houseCost === null || (finite(value.houseCost) && value.houseCost >= 0))
    || !(value.prevTarget === null || (finite(value.prevTarget) && value.prevTarget >= 0))
    || !(value.msg === null || value.msg === 'used' || value.msg === 'moved')) return false;
  return true;
}

function validVillage(value: unknown): value is VillageState {
  if (!record(value) || !Array.isArray(value.cells) || value.cells.length !== 16
    || !value.cells.every(item => Number.isInteger(item) && (item as number) >= 0 && (item as number) <= 4)
    || !Array.isArray(value.pop) || !value.pop.every(item => Number.isInteger(item) && (item as number) >= 0 && (item as number) < 16)) return false;
  for (const key of ['score', 'best', 'moves', 'gain', 'built', 'collection', 'queued', 'savedRm']) {
    if (!finite(value[key]) || (value[key] as number) < 0) return false;
  }
  return value.msg === undefined || typeof value.msg === 'string';
}

function validStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

function validKeptTests(value: unknown): value is KeptTest[] {
  return Array.isArray(value) && value.every(item => {
    if (!record(item)) return false;
    return finite(item.pay) && finite(item.s) && finite(item.n) && finite(item.g);
  });
}

function validNotificationPreferences(value: unknown): value is AppState['notificationPreferences'] {
  if (!record(value) || !record(value.reminders)) return false;
  for (const key of ['bill_reminders', 'record_warnings', 'permission_asked', 'permission_granted']) {
    if (typeof value[key] !== 'boolean') return false;
  }
  return Object.values(value.reminders).every(reminder => {
    if (!record(reminder) || typeof reminder.enabled !== 'boolean') return false;
    if (!Number.isInteger(reminder.day) || (reminder.day as number) < 1 || (reminder.day as number) > 28) return false;
    if (reminder.time !== undefined && (typeof reminder.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(reminder.time))) return false;
    return reminder.notification_id === null || typeof reminder.notification_id === 'string';
  });
}

/** Serialize only declared, local progress; transient UI state is excluded. */
export function snapshot(s: AppState): string {
  const payload: JsonRecord = { version: VERSION };
  for (const key of PERSISTED) payload[key] = s[key];
  payload.data = {
    cashOnHand: s.data.cashOnHand,
    cashOnHandDate: s.data.cashOnHandDate,
    expenseLimits: s.data.expenseLimits,
  };
  payload.housingTestResult = getHousingTestResult();
  payload.housingScenario = getHousingScenario();
  return JSON.stringify(payload);
}

/** Restore a validated payload into an existing initial AppState draft. */
export function hydrate(s: AppState, raw: string | null): void {
  if (!raw) return;
  try {
    const payload: unknown = JSON.parse(raw);
    if (!record(payload) || payload.version !== VERSION) return;

    hydrateHousingSession(payload.housingTestResult, payload.housingScenario);

    s.plan = validPlan(payload.plan) ? payload.plan : null;
    if (validBuffer(payload.buffer)) {
      const { saved: _saved, overflow: _overflow, ...buffer } = payload.buffer as BufferState & { saved?: number; overflow?: number };
      s.buffer = buffer;
    } else {
      s.buffer = null;
    }
    s.village = validVillage(payload.village) ? payload.village : null;
    if (payload.planHorizon === null || (finite(payload.planHorizon) && payload.planHorizon > 0)) {
      s.planHorizon = payload.planHorizon as number | null;
    }
    if (validStringArray(payload.potMovedMonths)) s.potMovedMonths = payload.potMovedMonths;
    if (finite(payload.potMoved) && payload.potMoved >= 0) s.potMoved = payload.potMoved;
    /* A month is only ever moved in with money left over, so months marked as moved
       with nothing in potMoved come from snapshots saved before the amount was kept
       (AC10.13.1). Offer those months again instead of hiding money that is no
       longer counted anywhere. */
    if (s.potMovedMonths.length && !(s.potMoved > 0)) s.potMovedMonths = [];
    if (validStringArray(payload.docsChecked)) s.docsChecked = payload.docsChecked;
    if (validKeptTests(payload.keptTests)) s.keptTests = payload.keptTests;
    /* v27b screen tips stay on this device. Under Playwright they stay off. */
    if (typeof payload.tipsOff === 'boolean' && process.env.EXPO_PUBLIC_E2E !== '1') s.tipsOff = payload.tipsOff;
    if (validStringArray(payload.seenG)) s.seenG = payload.seenG as AppState['seenG'];
    /* v26 learning progress stays on this device: pages read per lesson. */
    if (record(payload.lnProg) && Object.keys(payload.lnProg).length <= 100
      && Object.entries(payload.lnProg).every(([k, v]) => /^[a-z][a-z0-9_-]{0,63}$/.test(k)
        && finite(v) && Number.isInteger(v) && v >= 0 && v <= 100)) {
      s.lnProg = payload.lnProg as Record<string, number>;
    }
    if (typeof payload.bought === 'boolean') s.bought = payload.bought;
    if (payload.purchaseMonth === null || (typeof payload.purchaseMonth === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(payload.purchaseMonth))) {
      s.purchaseMonth = payload.purchaseMonth as string | null;
    }
    if (validNotificationPreferences(payload.notificationPreferences)) {
      s.notificationPreferences = payload.notificationPreferences;
    }
    if (typeof payload.aiDisclosureAccepted === 'boolean') {
      s.aiDisclosureAccepted = payload.aiDisclosureAccepted;
    }
    if (payload.statementDisclosureVersion === STATEMENT_SCAN_DISCLOSURE_VERSION) {
      s.statementDisclosureVersion = STATEMENT_SCAN_DISCLOSURE_VERSION;
    }
    if (typeof payload.voiceDisclosureAccepted === 'boolean') {
      s.voiceDisclosureAccepted = payload.voiceDisclosureAccepted;
    }
    if (record(payload.data)) {
      if (finite(payload.data.cashOnHand) && payload.data.cashOnHand >= 0) {
        s.data.cashOnHand = payload.data.cashOnHand;
      }
      /* The day the cash was reported (AC5.2.10). Absent in older snapshots, so only an
         explicit null or a real YYYY-MM-DD day changes it. */
      if (payload.data.cashOnHandDate === null) {
        s.data.cashOnHandDate = null;
      } else if (typeof payload.data.cashOnHandDate === 'string' && isValidIsoDate(payload.data.cashOnHandDate)) {
        s.data.cashOnHandDate = payload.data.cashOnHandDate;
      }
      if (validExpenseLimits(payload.data.expenseLimits)) {
        s.data.expenseLimits = payload.data.expenseLimits;
      }
    }
  } catch {
    // Corrupt or incompatible local data is discarded; start with clean state.
  }
}

/** Shape the same allow-listed state for the account PATCH endpoint. */
export function accountSnapshot(s: AppState): {
  cash_on_hand: number;
  cash_on_hand_date: string | null;
  expense_limits: Record<string, number>;
  saving_plan: Record<string, unknown>;
  buffer_state: Record<string, unknown>;
  village_state: Record<string, unknown>;
  plan_horizon: number | null;
  pot_moved_months: string[];
  pot_moved: number;
  docs_checked: string[];
  learning_progress: Record<string, number>;
  kept_tests: unknown[];
  bought_home: boolean;
  homeownership_purchase_month: string | null;
} {
  const local = JSON.parse(snapshot(s)) as JsonRecord;
  return {
    cash_on_hand: s.data.cashOnHand,
    cash_on_hand_date: s.data.cashOnHandDate,
    expense_limits: s.data.expenseLimits,
    saving_plan: (local.plan as Record<string, unknown> | null) ?? {},
    buffer_state: (local.buffer as Record<string, unknown> | null) ?? {},
    village_state: (local.village as Record<string, unknown> | null) ?? {},
    plan_horizon: (local.planHorizon as number | null) ?? null,
    pot_moved_months: (local.potMovedMonths as string[]) ?? [],
    pot_moved: (local.potMoved as number) ?? 0,
    docs_checked: (local.docsChecked as string[]) ?? [],
    learning_progress: (local.lnProg as Record<string, number>) ?? {},
    kept_tests: (local.keptTests as unknown[]) ?? [],
    bought_home: s.bought,
    homeownership_purchase_month: s.purchaseMonth,
  };
}

/** Apply account-owned declarations. The account is authoritative on conflict. */
export function hydrateAccountState(s: AppState, remote: Record<string, unknown>): void {
  const cash = typeof remote.cash_on_hand === 'number'
    ? remote.cash_on_hand
    : Number(remote.cash_on_hand);
  const payload = {
    version: VERSION,
    plan: remote.saving_plan,
    buffer: remote.buffer_state,
    village: remote.village_state,
    planHorizon: remote.plan_horizon,
    potMovedMonths: remote.pot_moved_months,
    potMoved: typeof remote.pot_moved === 'number' ? remote.pot_moved : Number(remote.pot_moved),
    docsChecked: remote.docs_checked,
    // An empty account must clear another account's local reading history.
    lnProg: remote.learning_progress ?? {},
    keptTests: remote.kept_tests,
    bought: remote.bought_home,
    purchaseMonth: remote.homeownership_purchase_month ?? null,
    data: { cashOnHand: cash, cashOnHandDate: remote.cash_on_hand_date ?? null },
  };
  hydrate(s, JSON.stringify(payload));
  if (validExpenseLimits(remote.expense_limits)) {
    s.data.expenseLimits = remote.expense_limits;
  }
  const preferredSourceId = remote.preferred_income_source_id;
  s.preferredIncomeSourceId = preferredSourceId == null ? null : String(preferredSourceId);
}
