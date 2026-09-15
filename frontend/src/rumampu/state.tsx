import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AppData, MOCK } from './mock';
import { Lang, STRINGS } from './strings';
import {
  ApiCoverageAnswer,
  ApiIncomeCoverage,
  ApiIncomePattern,
  ApiWorkCostMonthSummary,
  ApiWorkCostEntry,
  createExpense as createExpenseRequest,
  createExpenseCategory as createExpenseCategoryRequest,
  createWorkCostCategory as createWorkCostCategoryRequest,
  createWorkCostEntry as createWorkCostEntryRequest,
  createIncomeEntry as createIncomeEntryRequest,
  createIncomeSource as createIncomeSourceRequest,
  deleteIncomeEntry as deleteIncomeEntryRequest,
  deleteRecord as deleteRecordRequest,
  fetchCommitments,
  fetchExpenseCategories,
  fetchExpenses,
  fetchIncomeCoverage,
  fetchIncomePattern,
  fetchIncomeRecord,
  fetchWorkCostCategories,
  fetchWorkCostEntries,
  fetchWorkCostMonthSummary,
  fetchCurrentUser,
  hasStoredLogin,
  initializeAuthStorage,
  logout as logoutRequest,
  rotateGuestClientId,
  ApiError,
  INCOME_API_ENABLED,
  isOutlierConfirmation,
  updateIncomeCoverage as updateIncomeCoverageRequest,
  updateIncomeEntry as updateIncomeEntryRequest,
  updateCommitment as updateCommitmentRequest,
  updateWorkCostEntry as updateWorkCostEntryRequest,
} from './api';
import { fetchHouseCosts as fetchHouseCostsRequest, fetchSavedHousingTests as fetchSavedHousingTestsRequest } from '../../services/housingService';
import { HouseCostType, HouseCostsResponse, SavedHousingTestRecord } from '../../types/housing';
import { logIt } from './log';
import { rm, rmx } from './calc';

/* Central app state — mirrors the prototype's `S` object and navigation model. */

export type Route =
  | 'home' | 'plan' | 'money' | 'income' | 'incomeimport' | 'workcosts' | 'commit' | 'pattern' | 'coverage' | 'record'
  | 'expenses' | 'expadd' | 'expscan' | 'expmonths' | 'exlimits'
  | 'house' | 'homecost' | 'precheck' | 'result' | 'range' | 'compare' | 'shock'
  | 'househome' | 'savedtests' | 'profile' | 'homecosts' | 'acctdetails'
  // EN: Epic 7 preview routes are registered for future Iteration 3 work; this
  // does not make them an Iteration 1 implementation.
  // 中文：Epic 7 预览路由为未来 Iteration 3 工作保留；这不代表它们是 Iteration 1 实现。
  | 'prepare' | 'prepare_soon' | 'upfront' | 'buffer' | 'docs' | 'pv_switch' | 'pv_month' | 'pv_compare';

/* v22 tab model: home / money / test (house) / profile, FAB in the middle. */
export type Tab = 'home' | 'money' | 'test' | 'profile';

export const TAB_OF: Record<Route, Tab> = {
  home: 'home', househome: 'test', savedtests: 'test',
  money: 'money', income: 'money', incomeimport: 'money', workcosts: 'money', commit: 'money', pattern: 'money',
  coverage: 'money', record: 'money', expenses: 'money', expadd: 'money', expscan: 'money',
  expmonths: 'money', exlimits: 'money',
  house: 'test', homecost: 'test', precheck: 'test', result: 'test', range: 'test',
  homecosts: 'test', acctdetails: 'profile',
  compare: 'test', shock: 'test',
  plan: 'money', profile: 'profile', prepare: 'test', prepare_soon: 'test', upfront: 'test', buffer: 'money', docs: 'test',
  pv_switch: 'test', pv_month: 'test', pv_compare: 'test',
};

// EN: US8.2 stores the compact kept-test summary used by Your Record during the
// current frontend session: payment, short months, tested months, and largest gap.
// 中文：US8.2 在当前前端会话中保存“记录档案”需要的留存测试摘要：月供、短缺月份、测试月份和最大缺口。
export interface KeptTest {
  id?: number;
  name?: string;
  pay: number;
  s: number;
  n: number;
  g: number;
  scenarioId?: number | null;
  propertyPrice?: number | null;
  scenario?: SavedHousingTestRecord['scenario'];
  result?: SavedHousingTestRecord['result'];
  createdAt?: string;
  incomeShockPercent?: number;
}

/* v22 saving plan: the month's target split into uneven daily amounts.
   LeanKit 10.9: skipped days redistribute and are never "missed"; a paused
   month counts nothing as missed and resumes where it stopped. */
export interface PlanState {
  key: string; target: number; n: number; amounts: number[]; done: boolean[]; seed: number;
  skipped?: boolean[]; paused?: boolean;
}

/* v22 saving village: a 4x4 merge board (2048-style) that grows with the plan. */
export interface VillageState {
  cells: number[]; pop: number[]; score: number; best: number; moves: number; gain: number; built: number;
  /* Epic 10: istanas graduate off the grid into a permanent collection, and a
     full board queues new houses instead of silently dropping a saved day.
     savedRm is the truthful ringgit total behind the game — the only honest
     signal on screen; istanas themselves are decorative. */
  collection: number; queued: number; savedRm: number;
  msg?: string;
}

/* Epic 10 buffer shield: savings toward the house test's starting-liquidity
   trough. Fills before the village game opens; spending it is the shield
   working, so the tone of every transition is recorded here, not in a view. */
export interface BufferState {
  saved: number;
  /* Savings beyond the target — still the user's money, spills into Phase 2. */
  overflow: number;
  /* null until a house test exists; 0 is a valid target (bf_zero). */
  target: number | null;
  /* tested_home_cost the target came from, to notice when the house changed. */
  houseCost: number | null;
  /* Set when a house change moved the target, so the user can be told. */
  prevTarget: number | null;
  msg: 'used' | 'moved' | null;
}

export type EntryPer = 'day' | 'week' | 'month';
export type EntryMode = 'type' | 'scan' | 'csv';
export type AuthMode = 'login' | 'signup' | 'forgot' | 'checkmail';

export interface IncScanRow { a: number; d: string; s: string; low?: boolean; on: boolean }
export interface IncScanState { stage: 'pick' | 'reading' | 'confirm'; rows: IncScanRow[] }
export interface CsvMapState {
  stage: 'pick' | 'map' | 'done';
  err?: string;
  headers?: string[];
  rows?: string[][];
  map?: { d: number; a: number; desc: number };
  /* income: source id or 'desc'; expenses: category id or 'desc' */
  cat?: string;
  src?: string;
  added?: number; skipped?: number; from?: string; to?: string;
}
export interface EntryEdit { i: number; a: number | string; d: string; s?: string; c?: string; per: EntryPer }
export interface ScanState {
  stage: 'pick' | 'read' | 'confirm';
  thumb?: string | null;
  vals?: { m: string; d: string; a: number | string; c: string };
  /* Which fields actually came from the receipt (AC6.1.10 — unread fields must
     not be presented as extracted values). Absent means all fields did. */
  src?: { m: boolean; d: boolean; a: boolean };
  /* The category id the AI suggested (AC6.1.4 — labelled as an AI suggestion
     while it remains the selected category). */
  aiC?: string;
}

export interface AppState {
  lang: Lang;
  route: Route;
  stack: Route[];
  onboard: number;
  onboarded: boolean;
  splash: boolean;
  /* v22 entry flow: language → meet Ruma → auth, then the get-to-know pages. */
  wstep: number;
  authMode: AuthMode;
  acctMade: boolean;
  fgMail: string;
  guest: boolean;
  /* When a guest chooses Sign up from Profile, this records their explicit
     choice to move the current guest record into the new account. */
  mergeGuestOnSignup: boolean;
  knew: boolean;
  kstep: number;
  jobs: string[];
  ownJobs: { id: string; name: string }[];
  lastMonth: string;
  /* v22 saving plan + village game. */
  plan: PlanState | null;
  village: VillageState | null;
  buffer: BufferState | null;
  vHelp: boolean;
  /* Months the user chose to spread the upfront need over (village phase).
     null = go by the record's median leftover, or 12 when there is no record. */
  planHorizon: number | null;
  /* v22 misc UI state. */
  moView: 'tiles' | 'list';
  /* US11 what homes cost here: published NAPIC figures, cached per session. */
  houseCosts: HouseCostsResponse | null;
  houseCostsSync: 'idle' | 'loading' | 'ready' | 'error';
  hcState: string;
  hcType: HouseCostType;
  /* v24 upfront: the first-home stamp exemption flag, which saved test the
     figures work from, and the renovation switch. */
  firstHome: boolean;
  ufTest: number | null;
  ufReno: boolean;
  /* v24: name shown while the Result screen displays a saved test. */
  viewTestName: string | null;
  /* Quick-menu shortcut: open the camera as soon as the scan screen mounts. */
  scanAuto: boolean;
  /* v24: the past-month sheet serves income or expenses depending on who opened it. */
  pastT: 'inc' | 'ex';
  /* v24 cardI: the (i) info sheet's content — title key, body keys, the
     provenance kind explained, and optional pre-formatted extra lines. */
  cardInfo: { t: string; b: string[]; p?: string; x?: string[] } | null;
  /* LeanKit 10.10.3: leftovers from finished months, moved into the pot only
     by the user's own control. Keys are YYYY-MM of months already added. */
  potMoved: number;
  potMovedMonths: string[];
  /* v24 activity log — what changed and when (session-only). */
  log: { ts: number; k: string; v: Record<string, string | number>; field: string | null }[];
  houseTab: 'test' | 'prep';
  tryPay: number | null;
  tryCust: boolean;
  depMode: 'other' | null;
  incPick: boolean;
  incMode: EntryMode;
  incScan: IncScanState;
  incCsv: CsvMapState;
  incEdit: EntryEdit | null;
  exMode: EntryMode;
  exCsv: CsvMapState;
  exEdit: EntryEdit | null;
  svIdx: number;
  svDraft: string;
  svDelArm: boolean;
  data: AppData;
  testRan: boolean;
  howOpen: boolean;
  rgHowOpen: boolean;
  tcOpen: boolean;
  dcOpen: boolean;
  docsChecked: string[];
  keptTests: KeptTest[];
  expDraft: { a: string; c: string; d: string; per: EntryPer };
  scan: ScanState;
  exCatOpen: boolean;
  exMonthOpen: number | null;
  /* v24 month filter for the recent lists: null = latest recorded month. */
  incMonth: number | null;
  exMonth: number | null;
  shock: number;
  bought: boolean;
  incomeDraft: { a: string; d: string; s: string; flag: 'invalid' | 'neg' | 'outlier' | null; per: EntryPer };
  incomeSync: 'disabled' | 'loading' | 'ready' | 'error';
  workCostSync: 'disabled' | 'loading' | 'ready' | 'error';
  workCostSelectedMonth: string;
  workCostSummary: ApiWorkCostMonthSummary | null;
  commitmentSync: 'disabled' | 'loading' | 'ready' | 'error';
  expenseSync: 'disabled' | 'loading' | 'ready' | 'error';
  incomePattern: ApiIncomePattern | null;
  incomeCoverage: ApiIncomeCoverage | null;
  incomePatternSync: 'disabled' | 'idle' | 'loading' | 'ready' | 'error';
  coverageSync: 'disabled' | 'idle' | 'loading' | 'ready' | 'saving' | 'error';
  sheet: string | null;
  /* US6.2 assistant: sheet visibility + per-session conversation history. */
  assistantOpen: boolean;
  assistantMsgs: { role: 'user' | 'assistant'; content: string }[];
}

function initialState(): AppState {
  const data: AppData = JSON.parse(JSON.stringify(MOCK));
  const currentMonth = currentMonthText();
  if (INCOME_API_ENABLED) {
    data.sources = [];
    data.income = [];
    data.workCostCategories = [];
    data.workCostEntries = [];
    data.commitments = { living: [], debts: [], savings: [] };
    data.expenseCats = [];
    data.expenses = [];
    // Never inherit demo/mock cash in the real API-backed app. The balance
    // starts at zero and changes only through real user actions/data.
    data.cashOnHand = 0;
  }
  const today = todayIso();
  return {
    lang: 'en',
    route: 'home',
    stack: [],
    onboard: 0, onboarded: false, splash: true,
    wstep: 0, authMode: 'login', acctMade: false, fgMail: '', guest: false, mergeGuestOnSignup: false,
    knew: false, kstep: 0, jobs: ['taxi'], ownJobs: [], lastMonth: '',
    plan: null, village: null, buffer: null, vHelp: false, planHorizon: null,
    moView: 'tiles', houseTab: 'test',
    houseCosts: null, houseCostsSync: 'idle', hcState: 'sgr', hcType: 'all', firstHome: false,
    potMoved: 0, potMovedMonths: [], ufTest: null, ufReno: false, viewTestName: null, scanAuto: false, pastT: 'inc', cardInfo: null, log: [],
    tryPay: null, tryCust: false, depMode: null,
    incPick: false, incMode: 'type', incScan: { stage: 'pick', rows: [] }, incCsv: { stage: 'pick' }, incEdit: null,
    exMode: 'type', exCsv: { stage: 'pick' }, exEdit: null,
    svIdx: 0, svDraft: '', svDelArm: false,
    data,
    testRan: false,
    howOpen: false, rgHowOpen: false, tcOpen: false, dcOpen: false,
    // EN: keptTests starts empty for each AppProvider lifetime, matching the
    // Iteration 1 current-session scope instead of account-level saved history.
    // 中文：每次 AppProvider 生命周期开始时 keptTests 为空，符合 Iteration 1 当前会话范围，而不是账号级历史保存。
    docsChecked: [], keptTests: [],
    expDraft: { a: '', c: 'meals', d: today, per: 'day' },
    scan: { stage: 'pick' },
    exCatOpen: false, exMonthOpen: null, incMonth: null, exMonth: null,
    shock: 0,
    bought: false,
    incomeDraft: { a: '', d: today, s: 'ehail', flag: null, per: 'day' },
    incomeSync: INCOME_API_ENABLED ? 'loading' : 'disabled',
    workCostSync: INCOME_API_ENABLED ? 'loading' : 'disabled',
    workCostSelectedMonth: currentMonth,
    workCostSummary: INCOME_API_ENABLED ? null : localWorkCostSummary(data, currentMonth),
    commitmentSync: INCOME_API_ENABLED ? 'loading' : 'disabled',
    expenseSync: INCOME_API_ENABLED ? 'loading' : 'disabled',
    incomePattern: null,
    incomeCoverage: null,
    incomePatternSync: INCOME_API_ENABLED ? 'idle' : 'disabled',
    coverageSync: INCOME_API_ENABLED ? 'idle' : 'disabled',
    sheet: null,
    assistantOpen: false,
    assistantMsgs: [],
  };
}

function currentMonthText(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function lastMonthIso(): string {
  const d = new Date();
  const lm = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return `${lm.getFullYear()}-${String(lm.getMonth() + 1).padStart(2, '0')}-01`;
}

function localWorkCostSummary(data: AppData, month: string): ApiWorkCostMonthSummary {
  const income = data.income
    .filter(entry => entry.d.slice(0, 7) === month)
    .reduce((total, entry) => total + entry.a, 0);
  const incomeRecorded = data.income.some(entry => entry.d.slice(0, 7) === month);
  const workCosts = data.workCostEntries
    .filter(entry => entry.d.slice(0, 7) === month)
    .reduce((total, entry) => total + entry.a, 0);
  const availableMonths = new Set<string>([currentMonthText()]);
  data.income.forEach(entry => availableMonths.add(entry.d.slice(0, 7)));
  data.workCostEntries.forEach(entry => availableMonths.add(entry.d.slice(0, 7)));
  return {
    month,
    income_recorded: incomeRecorded,
    gross_income: income.toFixed(2),
    work_cost_total: workCosts.toFixed(2),
    income_after_work_costs: incomeRecorded ? (income - workCosts).toFixed(2) : null,
    available_months: [...availableMonths].sort().reverse(),
  };
}

export interface SaveIncomeInput {
  amount: number;
  date: string;
  sourceId?: string;
  entryMethod?: 'manual' | 'historical_total';
  confirmOutlier?: boolean;
}

export interface Ctx {
  S: AppState;
  authReady: boolean;
  /** Mutate a draft copy of the state; the result becomes the next state. */
  up: (fn: (s: AppState) => void) => void;
  t: (k: string, vars?: Record<string, string | number>) => string;
  monthName: (m: number) => string;
  go: (r: Route) => void;
  goTab: (tab: Tab) => void;
  backNav: () => void;
  saveIncomeEntry: (input: SaveIncomeInput, options?: { deferRefresh?: boolean }) => Promise<'saved' | 'outlier'>;
  /* Batch loops save many rows with deferRefresh, then run one refresh at the end. */
  refreshAfterMoneyWrite: () => void;
  updateIncomeEntry: (id: string, input: { amount: number; date: string; sourceId?: string }) => Promise<void>;
  deleteIncomeEntry: (id: string) => Promise<void>;
  saveIncomeSource: (name: string) => Promise<string>;
  refreshIncomeRecord: () => Promise<void>;
  refreshAccountData: (
    onProgress?: (progress: number, stage: string) => void,
    options?: { includeSavedTests?: boolean },
  ) => Promise<void>;
  refreshSavedHousingTests: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteCurrentRecord: () => Promise<void>;
  enterGuestMode: () => Promise<void>;
  refreshIncomePattern: () => Promise<void>;
  refreshIncomeCoverage: () => Promise<void>;
  saveIncomeCoverage: (input: {
    answer: ApiCoverageAnswer;
    slowerMonths: number[];
  }) => Promise<void>;
  refreshWorkCosts: (month?: string) => Promise<void>;
  saveWorkCostCategory: (name: string) => Promise<string>;
  saveWorkCostEntry: (input: { categoryId: string; amount: number; date: string }) => Promise<void>;
  updateWorkCostEntry: (id: string, input: { categoryId?: string; amount?: number; date?: string }) => Promise<void>;
  saveCommitmentAmount: (id: string, amount: number) => Promise<void>;
  saveExpenseCategory: (name: string) => Promise<string>;
  saveExpenseEntry: (input: {
    amount: number;
    date: string;
    categoryId: string;
    entryMethod?: 'manual' | 'receipt';
    merchant?: string;
    confirmReceipt?: boolean;
  }) => Promise<void>;
  loadHouseCosts: () => Promise<void>;
  toast: (msg: string, tone?: 'success' | 'error') => void;
  toastMsg: { msg: string; key: number; tone: 'success' | 'error' } | null;
}

const AppCtx = createContext<Ctx | null>(null);

function applyConfirmedCoverage(state: AppState, coverage: ApiIncomeCoverage): void {
  state.incomeCoverage = coverage;
}

function keptTestFromRecord(record: SavedHousingTestRecord): KeptTest {
  return {
    id: record.id,
    name: record.name,
    pay: Math.round(Number(record.monthly_payment || record.tested_monthly_home_cost || 0)),
    s: Number(record.short_month_count) || 0,
    n: Number(record.tested_months) || 0,
    g: Math.round(Number(record.largest_gap) || 0),
    scenarioId: record.scenario_id,
    propertyPrice: record.property_price == null ? null : Number(record.property_price),
    scenario: record.scenario,
    result: record.result,
    createdAt: record.created_at,
    incomeShockPercent: Number(record.income_shock_percent) || 0,
  };
}

function applyConfirmedWorkCost(state: AppState, entry: ApiWorkCostEntry): void {
  state.data.workCostEntries = state.data.workCostEntries.filter(item => item.id !== String(entry.id));
  state.data.workCostEntries.push({
    id: String(entry.id), categoryId: String(entry.category_id), categoryName: entry.category_name,
    a: Number(entry.amount), d: entry.date,
  });
  state.data.workCostEntries.sort((a, b) => b.d.localeCompare(a.d) || Number(b.id) - Number(a.id));
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [S, setS] = useState<AppState>(initialState);
  const [authReady, setAuthReady] = useState(!INCOME_API_ENABLED);
  const [toastMsg, setToastMsg] = useState<{
    msg: string;
    key: number;
    tone: 'success' | 'error';
  } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const patternRequestVersion = useRef(0);
  const patternRefreshInFlight = useRef<Promise<void> | null>(null);
  const coverageRequestVersion = useRef(0);
  const coverageRefreshInFlight = useRef<Promise<void> | null>(null);
  const workCostRequestVersion = useRef(0);
  const workCostMonth = useRef(S.workCostSelectedMonth);
  const guestBootstrap = useRef<ReturnType<typeof fetchIncomeRecord> | null>(null);

  const ensureGuest = useCallback(() => {
    if (!guestBootstrap.current) {
      const request = fetchIncomeRecord();
      guestBootstrap.current = request;
      void request.catch(() => {
        if (guestBootstrap.current === request) guestBootstrap.current = null;
      });
    }
    return guestBootstrap.current;
  }, []);

  const up = useCallback((fn: (s: AppState) => void) => {
    setS(prev => {
      const next: AppState = JSON.parse(JSON.stringify(prev));
      fn(next);
      return next;
    });
  }, []);

  // Restore a real account session before any anonymous profile request runs.
  // Web reads localStorage; native reads the token from Expo SecureStore.
  React.useEffect(() => {
    if (!INCOME_API_ENABLED) return;
    let active = true;
    void (async () => {
      await initializeAuthStorage();
      const hasLogin = await hasStoredLogin();
      if (!hasLogin) {
        if (active) setAuthReady(true);
        return;
      }

      try {
        const auth = await fetchCurrentUser();
        if (!active) return;
        setS(prev => {
          const next: AppState = JSON.parse(JSON.stringify(prev));
          next.guest = false;
          next.knew = auth.onboarding_completed;
          if (auth.preferred_language) next.lang = auth.preferred_language;

          if (auth.onboarding_completed) {
            // Returning accounts go directly to Home in their stored language.
            next.onboarded = true;
            next.wstep = 0;
          } else {
            // An unfinished account resumes onboarding after authentication.
            next.onboarded = false;
            next.wstep = auth.preferred_language ? 2 : 1;
          }
          return next;
        });
      } catch (error) {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          // The token is no longer valid (for example after a password reset).
          // Clear it and rotate the anonymous boundary so account data cannot
          // accidentally appear in guest mode.
          try { await logoutRequest(); } catch { /* logout() still clears local token */ }
          await rotateGuestClientId();
        } else if (active) {
          // A temporary network failure should not silently sign a returning user out.
          setS(prev => {
            const next: AppState = JSON.parse(JSON.stringify(prev));
            next.guest = false;
            next.onboarded = true;
            // Keep the current UI state during a temporary network failure;
            // do not guess that onboarding has been completed.
            return next;
          });
        }
      } finally {
        if (active) setAuthReady(true);
      }
    })();
    return () => { active = false; };
  }, []);

  // EN: Bootstrap Epic 1 domains from one guest-owned backend record before Epic 2 analysis runs.
  // 中文：在 Epic 2 分析启动前，从同一访客所有的后端记录加载 Epic 1 各数据域。
  React.useEffect(() => {
    if (!INCOME_API_ENABLED || !authReady) return;
    let active = true;
    void (async () => {
      try {
        const record = await ensureGuest();
        if (!active) return;
        setS(prev => {
          const next: AppState = JSON.parse(JSON.stringify(prev));
          next.data.sources = record.sources.map(source => ({
            id: String(source.id),
            k: source.slug ? `src_${source.slug}` : undefined,
            custom: source.is_custom,
            name: source.name,
          }));
          next.data.income = record.entries.map(entry => ({
            id: String(entry.id),
            a: Number(entry.amount),
            d: entry.date,
            s: entry.source_id == null ? '' : String(entry.source_id),
            method: entry.entry_method,
            createdAt: entry.created_at,
          }));
          const selectedSlug = prev.incomeDraft.s;
          const selected = record.sources.find(source => source.slug === selectedSlug)
            || record.sources.find(source => String(source.id) === selectedSlug)
            || record.sources[0];
          if (selected) next.incomeDraft.s = String(selected.id);
          next.incomeSync = 'ready';
          return next;
        });
      } catch (error) {
        console.error('Failed to load income record from backend:', error);
        if (active) {
          up(s => {
            s.incomeSync = 'error';
            s.commitmentSync = 'error';
            s.expenseSync = 'error';
          });
        }
        return;
      }

      try {
        const [commitmentItems, expenseCategories, expenses] = await Promise.all([
          fetchCommitments(),
          fetchExpenseCategories(),
          fetchExpenses(),
        ]);
        if (!active) return;
        up(s => {
          const commitments: AppData['commitments'] = { living: [], debts: [], savings: [] };
          for (const item of commitmentItems) {
            const target = item.commitment_type === 'debt' ? commitments.debts
              : item.commitment_type === 'savings' ? commitments.savings
                : commitments.living;
            target.push({
              id: String(item.id),
              k: `cm_${item.slug}`,
              a: Number(item.monthly_amount),
              dv: item.is_daily_variable,
            });
          }
          s.data.commitments = commitments;
          s.data.expenseCats = expenseCategories.map(category => ({
            id: String(category.id),
            k: category.slug ? `xc_${category.slug}` : undefined,
            custom: category.is_custom,
            name: category.name,
          }));
          s.data.expenses = expenses.map(entry => ({
            a: Number(entry.amount),
            d: entry.date,
            c: String(entry.category_id),
            method: entry.entry_method,
            merchant: entry.merchant,
          }));
          const selectedCategory = expenseCategories.find(category => category.slug === s.expDraft.c)
            || expenseCategories.find(category => String(category.id) === s.expDraft.c)
            || expenseCategories[0];
          if (selectedCategory) s.expDraft.c = String(selectedCategory.id);
          s.commitmentSync = 'ready';
          s.expenseSync = 'ready';
        });
      } catch {
        if (active) {
          up(s => {
            s.commitmentSync = 'error';
            s.expenseSync = 'error';
          });
        }
      }
    })();
    return () => { active = false; };
  }, [authReady, ensureGuest, up]);

  const t = useCallback((k: string, vars?: Record<string, string | number>) => {
    const table = STRINGS[S.lang];
    let s = (table[k] !== undefined ? table[k] : STRINGS.en[k]) as string | undefined;
    if (s === undefined) s = '[' + k + ']';
    if (vars) for (const v in vars) s = s.split('{' + v + '}').join(String(vars[v]));
    return s;
  }, [S.lang]);

  const monthName = useCallback((m: number) => STRINGS[S.lang].months[m], [S.lang]);

  const go = useCallback((r: Route) => {
    up(s => { s.stack.push(s.route); s.route = r; s.howOpen = false; s.rgHowOpen = false; });
  }, [up]);

  // EN: Epic 8 uses goTab() for AC8.4 bottom-tab navigation, but the navigation
  // model is shared by every epic.
  // 中文：Epic 8 使用 goTab() 满足 AC8.4 底部导航，但这个导航模型由所有 epic 共用。
  const goTab = useCallback((tab: Tab) => {
    up(s => {
      s.stack = [];
      if (tab === 'test') s.route = 'househome';
      else s.route = tab;
    });
  }, [up]);

  // EN: Epic 8 uses backNav() for AC8.4.6 Back behaviour; it remains shared app
  // infrastructure rather than Epic 8-only code.
  // 中文：Epic 8 使用 backNav() 支持 AC8.4.6 返回行为；它仍是共享应用基础设施，不是 Epic 8 专属代码。
  const backNav = useCallback(() => {
    up(s => {
      const prev = s.stack.pop();
      if (prev) { s.route = prev; return; }
      const tab = TAB_OF[s.route] || 'home';
      const root: Route = (tab === 'test') ? 'househome' : tab;
      const target: Tab = s.route === root ? 'home' : tab;
      s.stack = [];
      if (target === 'test') s.route = 'househome';
      else s.route = target;
    });
  }, [up]);

  const refreshIncomeRecord = useCallback(async (): Promise<void> => {
    if (!INCOME_API_ENABLED) return;
    up(s => { s.incomeSync = 'loading'; });
    try {
      const record = await fetchIncomeRecord();
      setS(prev => {
        const next: AppState = JSON.parse(JSON.stringify(prev));
        next.data.sources = record.sources.map(source => ({
          id: String(source.id),
          k: source.slug ? `src_${source.slug}` : undefined,
          custom: source.is_custom,
          name: source.name,
        }));
        next.data.income = record.entries.map(entry => ({
          id: String(entry.id),
          a: Number(entry.amount),
          d: entry.date,
          s: entry.source_id == null ? '' : String(entry.source_id),
          method: entry.entry_method,
          createdAt: entry.created_at,
        }));
        const selectedValue = prev.incomeDraft.s;
        const selected = record.sources.find(source => String(source.id) === selectedValue)
          || record.sources.find(source => source.slug === selectedValue)
          || record.sources[0];
        if (selected) next.incomeDraft.s = String(selected.id);
        next.incomeSync = 'ready';
        return next;
      });
    } catch (error) {
      up(s => { s.incomeSync = 'error'; });
      throw error;
    }
  }, [up]);

  const refreshSavedHousingTests = useCallback(async (): Promise<void> => {
    if (!INCOME_API_ENABLED) return;
    try {
      const records = await fetchSavedHousingTestsRequest();
      up(s => {
        // The API lists newest first; the local list appends as tests are kept.
        // Keep one order (oldest first) so the list does not jump when a
        // refresh lands a few seconds after a save.
        if (!s.guest) s.keptTests = records.slice().reverse().map(keptTestFromRecord);
      });
    } catch (error) {
      // housingService throws services/api.ApiError, which is a different class
      // from src/rumampu/api.ApiError. Check the HTTP status structurally so
      // guest-only 401/403 responses never crash the app.
      const status = typeof error === 'object' && error !== null && 'status' in error
        ? Number((error as { status?: unknown }).status)
        : undefined;
      if (status === 401 || status === 403) return;
      throw error;
    }
  }, [up]);

  // EN: Successful category/entry reads remain visible when another read fails.
  // Only publish the calculated result after the whole refresh is confirmed.
  // 中文：其他读取失败时仍展示成功加载的类别/记录；整次刷新成功后才展示计算结果。
  const refreshWorkCosts = useCallback(async (month?: string): Promise<void> => {
    const selectedMonth = month || workCostMonth.current;
    workCostMonth.current = selectedMonth;
    const version = ++workCostRequestVersion.current;
    if (!INCOME_API_ENABLED) {
      up(s => {
        s.workCostSelectedMonth = selectedMonth;
        s.workCostSummary = localWorkCostSummary(s.data, selectedMonth);
      });
      return;
    }
    up(s => { s.workCostSelectedMonth = selectedMonth; s.workCostSync = 'loading'; });
    try {
      // Native clients use cookies: establish one guest before parallel reads.
      await ensureGuest();
      if (version !== workCostRequestVersion.current) return;
      const categoriesRequest = fetchWorkCostCategories().then(categories => {
        up(s => {
          if (version !== workCostRequestVersion.current) return;
          s.data.workCostCategories = categories.map(item => ({
            id: String(item.id),
            k: item.slug ? `wc_${item.slug}` : undefined,
            custom: item.is_custom,
            name: item.name,
            legacyMonthlyAmount: Number(item.legacy_monthly_amount),
          }));
        });
      });
      const entriesRequest = fetchWorkCostEntries().then(entries => {
        up(s => {
          if (version !== workCostRequestVersion.current) return;
          s.data.workCostEntries = entries.map(entry => ({
            id: String(entry.id),
            categoryId: String(entry.category_id),
            categoryName: entry.category_name,
            a: Number(entry.amount),
            d: entry.date,
          }));
        });
      });
      const [, , summary] = await Promise.all([
        categoriesRequest,
        entriesRequest,
        fetchWorkCostMonthSummary(selectedMonth),
      ]);
      up(s => {
        if (version !== workCostRequestVersion.current) return;
        s.workCostSummary = summary;
        s.workCostSelectedMonth = summary.month;
        s.workCostSync = 'ready';
      });
    } catch (error) {
      if (version !== workCostRequestVersion.current) return;
      up(s => { if (version === workCostRequestVersion.current) s.workCostSync = 'error'; });
      throw error;
    }
  }, [ensureGuest, up]);

  // Work costs load independently: an expense/commitment failure must not hide them.
  React.useEffect(() => {
    if (!authReady) return;
    void refreshWorkCosts().catch(() => undefined);
    return () => { workCostRequestVersion.current += 1; };
  }, [authReady, refreshWorkCosts]);

  React.useEffect(() => {
    if (!INCOME_API_ENABLED || !authReady || S.guest || !S.onboarded || !S.knew) return;
    void refreshSavedHousingTests().catch(() => undefined);
  }, [authReady, S.guest, S.knew, S.onboarded, refreshSavedHousingTests]);

  const refreshAfterMoneyWrite = useCallback(() => {
    // Ignore any pre-write analyses; a successful write must not become a failed
    // save just because its follow-up GET fails. The page offers a read-only retry.
    patternRequestVersion.current += 1;
    patternRefreshInFlight.current = null;
    coverageRequestVersion.current += 1;
    coverageRefreshInFlight.current = null;
    up(s => { s.incomePatternSync = 'idle'; s.coverageSync = 'idle'; });
    void refreshWorkCosts().catch(() => undefined);
  }, [refreshWorkCosts, up]);

  // EN: Epic 2 keeps one in-flight authoritative pattern request and ignores stale responses.
  // 中文：Epic 2 只保留一个进行中的权威形态请求，并忽略过期响应。
  const refreshIncomePattern = useCallback((): Promise<void> => {
    if (!INCOME_API_ENABLED) return Promise.resolve();
    if (patternRefreshInFlight.current) return patternRefreshInFlight.current;

    const version = ++patternRequestVersion.current;
    up(s => { s.incomePatternSync = 'loading'; });
    const request = (async () => {
      try {
        const pattern = await fetchIncomePattern();
        if (version !== patternRequestVersion.current) return;
        up(s => {
          s.incomePattern = pattern;
          s.incomePatternSync = 'ready';
        });
      } catch (error) {
        if (version !== patternRequestVersion.current) return;
        up(s => { s.incomePatternSync = 'error'; });
        throw error;
      }
    })();
    patternRefreshInFlight.current = request;
    const clear = () => {
      if (patternRefreshInFlight.current === request) patternRefreshInFlight.current = null;
    };
    void request.then(clear, clear);
    return request;
  }, [up]);

  // EN: US2.4 reads the last server-confirmed answer without duplicating coverage rules in React.
  // 中文：US2.4 读取服务端最后确认的答案，不在 React 中复制覆盖计算规则。
  const refreshIncomeCoverage = useCallback((): Promise<void> => {
    if (!INCOME_API_ENABLED) return Promise.resolve();
    if (coverageRefreshInFlight.current) return coverageRefreshInFlight.current;

    const version = ++coverageRequestVersion.current;
    up(s => { s.coverageSync = 'loading'; });
    const request = (async () => {
      try {
        const coverage = await fetchIncomeCoverage();
        if (version !== coverageRequestVersion.current) return;
        up(s => {
          applyConfirmedCoverage(s, coverage);
          s.coverageSync = 'ready';
        });
      } catch (error) {
        if (version !== coverageRequestVersion.current) return;
        up(s => { s.coverageSync = 'error'; });
        throw error;
      }
    })();
    coverageRefreshInFlight.current = request;
    const clear = () => {
      if (coverageRefreshInFlight.current === request) coverageRefreshInFlight.current = null;
    };
    void request.then(clear, clear);
    return request;
  }, [up]);

  // EN: US2.4 keeps a retryable draft on failure while confirmed results remain unchanged.
  // 中文：US2.4 保存失败时保留可重试草稿，同时不覆盖已确认结果。
  const saveIncomeCoverage = useCallback(async (input: {
    answer: ApiCoverageAnswer;
    slowerMonths: number[];
  }): Promise<void> => {
    if (input.answer === 'yes' && input.slowerMonths.length === 0) {
      throw new Error('At least one slower month is required.');
    }
    if (!INCOME_API_ENABLED) {
      throw new Error('Income coverage requires the connected API mode.');
    }
    const version = ++coverageRequestVersion.current;
    coverageRefreshInFlight.current = null;
    up(s => { s.coverageSync = 'saving'; });
    try {
      const coverage = await updateIncomeCoverageRequest(input);
      if (version !== coverageRequestVersion.current) return;
      up(s => {
        applyConfirmedCoverage(s, coverage);
        s.coverageSync = 'ready';
      });
    } catch (error) {
      if (version !== coverageRequestVersion.current) return;
      // Keep the last server-confirmed coverage visible and available for retry.
      up(s => { s.coverageSync = 'error'; });
      throw error;
    }
  }, [up]);

  React.useEffect(() => {
    // Let the income bootstrap establish the guest session before coverage starts.
    // Parallel first requests can otherwise create different anonymous sessions.
    if (!INCOME_API_ENABLED || !authReady || S.incomeSync !== 'ready' || S.coverageSync !== 'idle') return;
    void refreshIncomeCoverage().catch(() => undefined);
  }, [authReady, S.coverageSync, S.incomeSync, refreshIncomeCoverage]);

  /**
   * EN: Persist US1.1/US1.2 income; return the stable 409 warning for AC1.1.10 confirmation.
   * 中文：持久化 US1.1/US1.2 收入；把稳定的 409 警告交给 AC1.1.10 二次确认。
   */
  const saveIncomeEntry = useCallback(async (
    input: SaveIncomeInput,
    options?: { deferRefresh?: boolean },
  ): Promise<'saved' | 'outlier'> => {
    if (!INCOME_API_ENABLED) {
      up(s => {
        s.data.income.push({
          id: `local-${Date.now()}`,
          a: input.amount,
          d: input.date,
          s: input.sourceId || '',
          method: input.entryMethod || 'manual',
          createdAt: new Date().toISOString(),
        });
        s.data.income.sort((x, y) => (x.d < y.d ? -1 : 1));
        s.workCostSummary = localWorkCostSummary(s.data, s.workCostSelectedMonth);
        logIt(s, 'lg_inc_add', { a: rm(input.amount) });
      });
      return 'saved';
    }
    try {
      const entry = await createIncomeEntryRequest(input);
      up(s => {
        s.data.income.push({
          id: String(entry.id),
          a: Number(entry.amount),
          d: entry.date,
          s: entry.source_id == null ? '' : String(entry.source_id),
          method: entry.entry_method,
          createdAt: entry.created_at,
        });
        s.data.income.sort((x, y) => (x.d < y.d ? -1 : 1));
        s.incomeSync = 'ready';
        logIt(s, 'lg_inc_add', { a: rm(Number(entry.amount)) });
      });
      if (!options?.deferRefresh) refreshAfterMoneyWrite();
      return 'saved';
    } catch (error) {
      if (isOutlierConfirmation(error)) return 'outlier';
      up(s => { s.incomeSync = 'error'; });
      throw error;
    }
  }, [refreshAfterMoneyWrite, up]);

  const updateIncomeEntry = useCallback(async (
    id: string,
    input: { amount: number; date: string; sourceId?: string },
  ): Promise<void> => {
    if (!INCOME_API_ENABLED) {
      up(s => {
        const existing = s.data.income.find(entry => entry.id === id);
        if (!existing) throw new Error('Income entry was not found.');
        existing.a = input.amount;
        existing.d = input.date;
        if (existing.method === 'manual' && input.sourceId) existing.s = input.sourceId;
        s.data.income.sort((x, y) => (x.d < y.d ? -1 : 1));
        s.workCostSummary = localWorkCostSummary(s.data, s.workCostSelectedMonth);
      });
      return;
    }
    try {
      const entry = await updateIncomeEntryRequest(id, input);
      up(s => {
        const existing = s.data.income.find(item => item.id === id);
        if (!existing) return;
        existing.a = Number(entry.amount);
        existing.d = entry.date;
        existing.s = entry.source_id == null ? '' : String(entry.source_id);
        existing.method = entry.entry_method;
        s.data.income.sort((x, y) => (x.d < y.d ? -1 : 1));
        s.incomeSync = 'ready';
        s.incomePatternSync = 'idle';
        s.coverageSync = 'idle';
        logIt(s, 'lg_inc_edit', { a: rm(Number(entry.amount)) });
      });
      refreshAfterMoneyWrite();
    } catch (error) {
      up(s => { s.incomeSync = 'error'; });
      throw error;
    }
  }, [refreshAfterMoneyWrite, up]);

  const deleteIncomeEntry = useCallback(async (id: string): Promise<void> => {
    if (!INCOME_API_ENABLED) {
      up(s => {
        s.data.income = s.data.income.filter(entry => entry.id !== id);
        s.workCostSummary = localWorkCostSummary(s.data, s.workCostSelectedMonth);
        s.incomePatternSync = 'idle';
        s.coverageSync = 'idle';
      });
      return;
    }
    try {
      await deleteIncomeEntryRequest(id);
      up(s => {
        const gone = s.data.income.find(entry => entry.id === id);
        s.data.income = s.data.income.filter(entry => entry.id !== id);
        s.incomeSync = 'ready';
        s.incomePatternSync = 'idle';
        s.coverageSync = 'idle';
        logIt(s, 'lg_inc_del', gone ? { a: rm(gone.a) } : {});
      });
      refreshAfterMoneyWrite();
    } catch (error) {
      up(s => { s.incomeSync = 'error'; });
      throw error;
    }
  }, [refreshAfterMoneyWrite, up]);

  const saveIncomeSource = useCallback(async (name: string): Promise<string> => {
    if (!INCOME_API_ENABLED) {
      const id = `own${Date.now()}`;
      up(s => {
        s.data.sources.push({ id, custom: true, name });
        s.incomeDraft.s = id;
      });
      return id;
    }
    try {
      const source = await createIncomeSourceRequest(name);
      const id = String(source.id);
      up(s => {
        s.data.sources.push({ id, custom: true, name: source.name });
        s.incomeDraft.s = id;
        s.incomeSync = 'ready';
      });
      return id;
    } catch (error) {
      up(s => { s.incomeSync = 'error'; });
      throw error;
    }
  }, [up]);

  const saveWorkCostCategory = useCallback(async (name: string): Promise<string> => {
    if (!INCOME_API_ENABLED) {
      const id = `own${Date.now()}`;
      up(s => { s.data.workCostCategories.push({ id, custom: true, name }); });
      return id;
    }
    const item = await createWorkCostCategoryRequest(name);
    const id = String(item.id);
    up(s => { s.data.workCostCategories.push({ id, custom: true, name: item.name }); });
    void refreshWorkCosts().catch(() => undefined);
    return id;
  }, [refreshWorkCosts, up]);

  const saveWorkCostEntry = useCallback(async (input: {
    categoryId: string;
    amount: number;
    date: string;
  }): Promise<void> => {
    if (!INCOME_API_ENABLED) {
      up(s => {
        const category = s.data.workCostCategories.find(item => item.id === input.categoryId);
        s.data.workCostEntries.unshift({
          id: `local-${Date.now()}`,
          categoryId: input.categoryId,
          categoryName: category?.custom ? category.name : undefined,
          a: input.amount,
          d: input.date,
        });
        s.workCostSummary = localWorkCostSummary(s.data, s.workCostSelectedMonth);
        logIt(s, 'lg_wc_log', { a: rm(input.amount) });
      });
      return;
    }
    const entry = await createWorkCostEntryRequest(input);
    up(s => {
      applyConfirmedWorkCost(s, entry);
      logIt(s, 'lg_wc_log', { a: rm(Number(entry.amount)), c: entry.category_name ?? '' });
    });
    refreshAfterMoneyWrite();
  }, [refreshAfterMoneyWrite, up]);

  const updateWorkCostEntry = useCallback(async (
    id: string,
    input: { categoryId?: string; amount?: number; date?: string },
  ): Promise<void> => {
    if (!INCOME_API_ENABLED) {
      up(s => {
        const entry = s.data.workCostEntries.find(item => item.id === id);
        if (!entry) throw new Error('Work-cost entry was not found.');
        if (input.categoryId) entry.categoryId = input.categoryId;
        if (input.amount != null) entry.a = input.amount;
        if (input.date) entry.d = input.date;
        s.workCostSummary = localWorkCostSummary(s.data, s.workCostSelectedMonth);
      });
      return;
    }
    const entry = await updateWorkCostEntryRequest(id, input);
    up(s => { applyConfirmedWorkCost(s, entry); });
    refreshAfterMoneyWrite();
  }, [refreshAfterMoneyWrite, up]);

  // EN: US1.4 updates only the matching commitment after Django confirms the write.
  // 中文：US1.4 只在 Django 确认写入后更新对应承诺项。
  const saveCommitmentAmount = useCallback(async (id: string, amount: number): Promise<void> => {
    if (!INCOME_API_ENABLED) return;
    try {
      const item = await updateCommitmentRequest(id, amount);
      up(s => {
        const all = [
          ...s.data.commitments.living,
          ...s.data.commitments.debts,
          ...s.data.commitments.savings,
        ];
        const existing = all.find(commitment => commitment.id === id);
        if (existing) existing.a = Number(item.monthly_amount);
        s.commitmentSync = 'ready';
        logIt(s, 'lg_cm_set', { a: rm(Number(item.monthly_amount)) }, `cm:${id}`);
      });
    } catch (error) {
      up(s => { s.commitmentSync = 'error'; });
      throw error;
    }
  }, [up]);

  const saveExpenseCategory = useCallback(async (name: string): Promise<string> => {
    if (!INCOME_API_ENABLED) {
      const id = `own${Date.now()}`;
      up(s => {
        s.data.expenseCats.push({ id, custom: true, name });
        s.expDraft.c = id;
      });
      return id;
    }
    try {
      const category = await createExpenseCategoryRequest(name);
      const id = String(category.id);
      up(s => {
        s.data.expenseCats.push({ id, custom: true, name: category.name });
        s.expDraft.c = id;
        s.expenseSync = 'ready';
      });
      return id;
    } catch (error) {
      up(s => { s.expenseSync = 'error'; });
      throw error;
    }
  }, [up]);

  // EN: US1.5/US1.7 add only confirmed manual or receipt entries to displayed expenses.
  // 中文：US1.5/US1.7 只把已确认的手工或收据记录加入展示支出。
  const saveExpenseEntry = useCallback(async (input: {
    amount: number;
    date: string;
    categoryId: string;
    entryMethod?: 'manual' | 'receipt';
    merchant?: string;
    confirmReceipt?: boolean;
  }): Promise<void> => {
    if (!INCOME_API_ENABLED) {
      up(s => {
        s.data.expenses.push({
          a: input.amount,
          d: input.date,
          c: input.categoryId,
          method: input.entryMethod || 'manual',
          merchant: input.merchant,
        });
        logIt(s, input.entryMethod === 'receipt' ? 'lg_exp_scan' : 'lg_exp_add', { a: rmx(input.amount) });
      });
      return;
    }
    try {
      const entry = await createExpenseRequest(input);
      up(s => {
        s.data.expenses.push({
          a: Number(entry.amount),
          d: entry.date,
          c: String(entry.category_id),
          method: entry.entry_method,
          merchant: entry.merchant,
        });
        s.expenseSync = 'ready';
        logIt(s, entry.entry_method === 'receipt' ? 'lg_exp_scan' : 'lg_exp_add', { a: rmx(Number(entry.amount)) });
      });
    } catch (error) {
      up(s => { s.expenseSync = 'error'; });
      throw error;
    }
  }, [up]);

  const refreshAccountData = useCallback(async (
    onProgress?: (progress: number, stage: string) => void,
    options?: { includeSavedTests?: boolean },
  ): Promise<void> => {
    if (!INCOME_API_ENABLED) {
      onProgress?.(100, 'Ready');
      return;
    }
    const includeSavedTests = options?.includeSavedTests ?? true;

    // Authentication can change which profile is authoritative. Discard the
    // anonymous bootstrap promise so later reads cannot reuse stale guest data.
    guestBootstrap.current = null;
    onProgress?.(15, 'Preparing your account...');

    await refreshIncomeRecord();
    onProgress?.(35, 'Income records loaded');

    // These three domains do not depend on one another, so load them in parallel.
    // Progress is based on completed account-loading tasks rather than a fake timer.
    let completedDomains = 0;
    const tracked = async <T,>(promise: Promise<T>, label: string): Promise<T> => {
      const result = await promise;
      completedDomains += 1;
      const progress = 35 + (completedDomains * 15);
      onProgress?.(progress, label);
      return result;
    };

    const [commitmentItems, expenseCategories, expenses] = await Promise.all([
      tracked(fetchCommitments(), 'Commitments loaded'),
      tracked(fetchExpenseCategories(), 'Expense categories loaded'),
      tracked(fetchExpenses(), 'Expenses loaded'),
    ]);
    up(s => {
      const commitments: AppData['commitments'] = { living: [], debts: [], savings: [] };
      for (const item of commitmentItems) {
        const target = item.commitment_type === 'debt' ? commitments.debts
          : item.commitment_type === 'savings' ? commitments.savings
            : commitments.living;
        target.push({
          id: String(item.id),
          k: `cm_${item.slug}`,
          a: Number(item.monthly_amount),
          dv: item.is_daily_variable,
        });
      }
      s.data.commitments = commitments;
      s.data.expenseCats = expenseCategories.map(category => ({
        id: String(category.id),
        k: category.slug ? `xc_${category.slug}` : undefined,
        custom: category.is_custom,
        name: category.name,
      }));
      s.data.expenses = expenses.map(entry => ({
        a: Number(entry.amount),
        d: entry.date,
        c: String(entry.category_id),
        method: entry.entry_method,
        merchant: entry.merchant,
      }));
      const selectedCategory = expenseCategories.find(category => String(category.id) === s.expDraft.c)
        || expenseCategories.find(category => category.slug === s.expDraft.c)
        || expenseCategories[0];
      if (selectedCategory) s.expDraft.c = String(selectedCategory.id);
      s.commitmentSync = 'ready';
      s.expenseSync = 'ready';
      s.incomePattern = null;
      s.incomeCoverage = null;
      s.incomePatternSync = 'idle';
      s.coverageSync = 'idle';
    });

    let finalDomains = 0;
    const trackedFinal = async <T,>(promise: Promise<T>, label: string): Promise<T> => {
      const result = await promise;
      finalDomains += 1;
      onProgress?.(80 + (finalDomains * 7), label);
      return result;
    };

    const finalTasks = [
      trackedFinal(refreshWorkCosts(), 'Work costs loaded'),
    ];
    if (includeSavedTests) {
      finalTasks.push(trackedFinal(refreshSavedHousingTests(), 'Saved tests loaded'));
    } else {
      up(s => { s.keptTests = []; });
    }
    await Promise.all(finalTasks);
    onProgress?.(95, 'Preparing your dashboard...');

    // Yield once so the final state updates above can be committed before Home renders.
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    onProgress?.(100, 'Your account is ready');
  }, [refreshIncomeRecord, refreshSavedHousingTests, refreshWorkCosts, up]);

  const signOut = useCallback(async (): Promise<void> => {
    try {
      await logoutRequest();
    } catch {
      // logoutRequest clears the locally stored token in its finally block.
    }
    await rotateGuestClientId();
    guestBootstrap.current = null;
    setS(prev => {
      const next = initialState();
      next.lang = prev.lang;
      next.splash = false;
      // Logging out must always return to the authentication screen.
      // Language/onboarding steps are only resumed after a successful login.
      next.wstep = 0;
      next.authMode = 'login';
      return next;
    });
  }, []);

  const deleteCurrentRecord = useCallback(async (): Promise<void> => {
    await deleteRecordRequest();
    await rotateGuestClientId();
    guestBootstrap.current = null;
    setS(prev => {
      const next = initialState();
      next.lang = prev.lang;
      next.splash = false;
      next.guest = true;
      next.onboarded = true;
      next.knew = true;
      return next;
    });
    await refreshAccountData(undefined, { includeSavedTests: false });
  }, [refreshAccountData]);

  const enterGuestMode = useCallback(async (): Promise<void> => {
    try {
      await logoutRequest();
    } catch {
      // This is expected when there is no authenticated token yet.
    }
    await rotateGuestClientId();
    guestBootstrap.current = null;

    setS(prev => {
      const next = initialState();
      next.lang = prev.lang;
      next.splash = false;
      next.guest = true;
      next.onboarded = true;
      return next;
    });

    // Load a clean anonymous profile using the newly rotated client id.
    await refreshAccountData(undefined, { includeSavedTests: false });
  }, [refreshAccountData]);

  /* US11: published house-cost figures — fetched once per session, cached.
     The in-flight guard lives in a ref because setState updaters are not
     applied synchronously. */
  const houseCostsInflight = useRef(false);
  /* Loads once per session. The guard is deliberately not reset on success: the
     payload is small and the underlying data changes quarterly at most, so a
     second fetch would be wasted. It IS reset on error so a retry works.
     Consequence: the `quarters` parameter cannot be varied after a successful
     load without a state reset. */
  const loadHouseCosts = useCallback(async (): Promise<void> => {
    if (houseCostsInflight.current) return;
    houseCostsInflight.current = true;
    setS(prev => (prev.houseCostsSync === 'ready' ? prev : { ...prev, houseCostsSync: 'loading' }));
    try {
      const data = await fetchHouseCostsRequest();
      setS(prev => ({
        ...prev,
        houseCosts: data,
        houseCostsSync: 'ready',
        hcState: data.states[prev.hcState] ? prev.hcState : (Object.keys(data.states)[0] ?? prev.hcState),
      }));
    } catch {
      houseCostsInflight.current = false;
      setS(prev => ({ ...prev, houseCostsSync: 'error' }));
    }
  }, []);

  const toast = useCallback((msg: string, tone: 'success' | 'error' = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg({ msg, key: Date.now(), tone });
    toastTimer.current = setTimeout(() => setToastMsg(null), 1800);
  }, []);

  const value = useMemo<Ctx>(() => ({
    S, authReady, up, t, monthName, go, goTab, backNav,
    saveIncomeEntry, refreshAfterMoneyWrite, updateIncomeEntry, deleteIncomeEntry, saveIncomeSource, refreshIncomeRecord, refreshAccountData, refreshSavedHousingTests, signOut, deleteCurrentRecord, enterGuestMode, refreshIncomePattern,
    refreshIncomeCoverage, saveIncomeCoverage, refreshWorkCosts, saveWorkCostCategory, saveWorkCostEntry, updateWorkCostEntry,
    saveCommitmentAmount, loadHouseCosts, toast, toastMsg,
    saveExpenseCategory, saveExpenseEntry,
  }), [
    S, authReady, up, t, monthName, go, goTab, backNav,
    saveIncomeEntry, refreshAfterMoneyWrite, updateIncomeEntry, deleteIncomeEntry, saveIncomeSource, refreshIncomeRecord, refreshAccountData, refreshSavedHousingTests, signOut, deleteCurrentRecord, enterGuestMode, refreshIncomePattern,
    refreshIncomeCoverage, saveIncomeCoverage, refreshWorkCosts, saveWorkCostCategory, saveWorkCostEntry, updateWorkCostEntry,
    saveCommitmentAmount, loadHouseCosts, toast, toastMsg,
    saveExpenseCategory, saveExpenseEntry,
  ]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
