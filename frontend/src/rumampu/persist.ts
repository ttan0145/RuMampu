import type { AppState, BufferState, KeptTest, PlanState, VillageState } from './state';
import { getHousingScenario, getHousingTestResult, hydrateHousingSession } from '../../services/housingSession';

const VERSION = 1;
const PERSISTED = ['plan', 'buffer', 'village', 'planHorizon',
  'potMovedMonths', 'docsChecked', 'keptTests'] as const;

type JsonRecord = Record<string, unknown>;

function record(value: unknown): value is JsonRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
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
  return value.paused === undefined || typeof value.paused === 'boolean';
}

function validBuffer(value: unknown): value is BufferState {
  if (!record(value) || !finite(value.saved) || value.saved < 0
    || !finite(value.overflow) || value.overflow < 0
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

/** Serialize only declared, local progress; transient UI state is excluded. */
export function snapshot(s: AppState): string {
  const payload: JsonRecord = { version: VERSION };
  for (const key of PERSISTED) payload[key] = s[key];
  payload.data = { cashOnHand: s.data.cashOnHand };
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
    s.buffer = validBuffer(payload.buffer) ? payload.buffer : null;
    s.village = validVillage(payload.village) ? payload.village : null;
    if (payload.planHorizon === null || (finite(payload.planHorizon) && payload.planHorizon > 0)) {
      s.planHorizon = payload.planHorizon as number | null;
    }
    if (validStringArray(payload.potMovedMonths)) s.potMovedMonths = payload.potMovedMonths;
    if (validStringArray(payload.docsChecked)) s.docsChecked = payload.docsChecked;
    if (validKeptTests(payload.keptTests)) s.keptTests = payload.keptTests;
    if (record(payload.data) && finite(payload.data.cashOnHand) && payload.data.cashOnHand >= 0) {
      s.data.cashOnHand = payload.data.cashOnHand;
    }
  } catch {
    // Corrupt or incompatible local data is discarded; start with clean state.
  }
}

/** Shape the same allow-listed state for the account PATCH endpoint. */
export function accountSnapshot(s: AppState): {
  cash_on_hand: number;
  saving_plan: Record<string, unknown>;
  buffer_state: Record<string, unknown>;
  village_state: Record<string, unknown>;
  plan_horizon: number | null;
  pot_moved_months: string[];
  docs_checked: string[];
  kept_tests: unknown[];
} {
  const local = JSON.parse(snapshot(s)) as JsonRecord;
  return {
    cash_on_hand: s.data.cashOnHand,
    saving_plan: (local.plan as Record<string, unknown> | null) ?? {},
    buffer_state: (local.buffer as Record<string, unknown> | null) ?? {},
    village_state: (local.village as Record<string, unknown> | null) ?? {},
    plan_horizon: (local.planHorizon as number | null) ?? null,
    pot_moved_months: (local.potMovedMonths as string[]) ?? [],
    docs_checked: (local.docsChecked as string[]) ?? [],
    kept_tests: (local.keptTests as unknown[]) ?? [],
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
    docsChecked: remote.docs_checked,
    keptTests: remote.kept_tests,
    data: { cashOnHand: cash },
  };
  hydrate(s, JSON.stringify(payload));
}
