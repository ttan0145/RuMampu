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
  fetchCommitments,
  fetchExpenseCategories,
  fetchExpenses,
  fetchIncomeCoverage,
  fetchIncomePattern,
  fetchIncomeRecord,
  fetchWorkCostCategories,
  fetchWorkCostEntries,
  fetchWorkCostMonthSummary,
  INCOME_API_ENABLED,
  isOutlierConfirmation,
  updateIncomeCoverage as updateIncomeCoverageRequest,
  updateIncomeEntry as updateIncomeEntryRequest,
  updateCommitment as updateCommitmentRequest,
  updateWorkCostEntry as updateWorkCostEntryRequest,
} from './api';

/* Central app state — mirrors the prototype's `S` object and navigation model. */

export type Route =
  | 'home' | 'money' | 'income' | 'incomeimport' | 'workcosts' | 'commit' | 'pattern' | 'coverage' | 'record'
  | 'expenses' | 'expadd' | 'expscan' | 'expmonths' | 'exlimits'
  | 'house' | 'homecost' | 'precheck' | 'result' | 'range' | 'compare' | 'shock'
  // EN: Epic 7 preview routes are registered for future Iteration 3 work; this
  // does not make them an Iteration 1 implementation.
  // 中文：Epic 7 预览路由为未来 Iteration 3 工作保留；这不代表它们是 Iteration 1 实现。
  | 'prepare' | 'upfront' | 'buffer' | 'docs' | 'pv_switch' | 'pv_month' | 'pv_compare';

export type Tab = 'home' | 'money' | 'test' | 'prepare';

export const TAB_OF: Record<Route, Tab> = {
  home: 'home',
  money: 'money', income: 'money', incomeimport: 'money', workcosts: 'money', commit: 'money', pattern: 'money',
  coverage: 'money', record: 'money', expenses: 'money', expadd: 'money', expscan: 'money',
  expmonths: 'money', exlimits: 'money',
  house: 'test', homecost: 'test', precheck: 'test', result: 'test', range: 'test',
  compare: 'test', shock: 'test',
  prepare: 'prepare', upfront: 'prepare', buffer: 'prepare', docs: 'prepare',
  pv_switch: 'prepare', pv_month: 'prepare', pv_compare: 'prepare',
};

// EN: US8.2 stores the compact kept-test summary used by Your Record during the
// current frontend session: payment, short months, tested months, and largest gap.
// 中文：US8.2 在当前前端会话中保存“记录档案”需要的留存测试摘要：月供、短缺月份、测试月份和最大缺口。
export interface KeptTest { pay: number; s: number; n: number; g: number }
export interface ScanState {
  stage: 'pick' | 'read' | 'confirm';
  thumb?: string | null;
  vals?: { m: string; d: string; a: number | string; c: string };
}

export interface AppState {
  lang: Lang;
  route: Route;
  stack: Route[];
  onboard: number;
  onboarded: boolean;
  splash: boolean;
  data: AppData;
  testRan: boolean;
  howOpen: boolean;
  rgHowOpen: boolean;
  tcOpen: boolean;
  dcOpen: boolean;
  docsChecked: string[];
  keptTests: KeptTest[];
  expDraft: { a: string; c: string; d: string };
  scan: ScanState;
  exCatOpen: boolean;
  exMonthOpen: number | null;
  shock: number;
  bought: boolean;
  incomeDraft: { a: string; d: string; s: string; flag: 'invalid' | 'neg' | 'outlier' | null };
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
  }
  return {
    lang: 'en',
    route: 'home',
    stack: [],
    onboard: 0, onboarded: false, splash: true,
    data,
    testRan: false,
    howOpen: false, rgHowOpen: false, tcOpen: false, dcOpen: false,
    // EN: keptTests starts empty for each AppProvider lifetime, matching the
    // Iteration 1 current-session scope instead of account-level saved history.
    // 中文：每次 AppProvider 生命周期开始时 keptTests 为空，符合 Iteration 1 当前会话范围，而不是账号级历史保存。
    docsChecked: [], keptTests: [],
    expDraft: { a: '', c: 'meals', d: '2026-08-23' },
    scan: { stage: 'pick' },
    exCatOpen: false, exMonthOpen: null,
    shock: 0,
    bought: false,
    incomeDraft: { a: '', d: '2026-08-21', s: 'ehail', flag: null },
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
  };
}

function currentMonthText(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
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
  /** Mutate a draft copy of the state; the result becomes the next state. */
  up: (fn: (s: AppState) => void) => void;
  t: (k: string, vars?: Record<string, string | number>) => string;
  monthName: (m: number) => string;
  go: (r: Route) => void;
  goTab: (tab: Tab) => void;
  backNav: () => void;
  saveIncomeEntry: (input: SaveIncomeInput) => Promise<'saved' | 'outlier'>;
  updateIncomeEntry: (id: string, input: { amount: number; date: string; sourceId?: string }) => Promise<void>;
  saveIncomeSource: (name: string) => Promise<string>;
  refreshIncomeRecord: () => Promise<void>;
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
  toast: (msg: string, tone?: 'success' | 'error') => void;
  toastMsg: { msg: string; key: number; tone: 'success' | 'error' } | null;
}

const AppCtx = createContext<Ctx | null>(null);

function applyConfirmedCoverage(state: AppState, coverage: ApiIncomeCoverage): void {
  state.incomeCoverage = coverage;
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

  // EN: Bootstrap Epic 1 domains from one guest-owned backend record before Epic 2 analysis runs.
  // 中文：在 Epic 2 分析启动前，从同一访客所有的后端记录加载 Epic 1 各数据域。
  React.useEffect(() => {
    if (!INCOME_API_ENABLED) return;
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
  }, [ensureGuest, up]);

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
      if (tab === 'test') s.route = s.testRan ? 'result' : 'house';
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
      const root: Route = (tab === 'test') ? (s.testRan ? 'result' : 'house') : tab;
      const target: Tab = s.route === root ? 'home' : tab;
      s.stack = [];
      if (target === 'test') s.route = s.testRan ? 'result' : 'house';
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
    void refreshWorkCosts().catch(() => undefined);
    return () => { workCostRequestVersion.current += 1; };
  }, [refreshWorkCosts]);

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
    if (!INCOME_API_ENABLED || S.incomeSync !== 'ready' || S.coverageSync !== 'idle') return;
    void refreshIncomeCoverage().catch(() => undefined);
  }, [S.coverageSync, S.incomeSync, refreshIncomeCoverage]);

  /**
   * EN: Persist US1.1/US1.2 income; return the stable 409 warning for AC1.1.10 confirmation.
   * 中文：持久化 US1.1/US1.2 收入；把稳定的 409 警告交给 AC1.1.10 二次确认。
   */
  const saveIncomeEntry = useCallback(async (input: SaveIncomeInput): Promise<'saved' | 'outlier'> => {
    if (!INCOME_API_ENABLED) {
      up(s => {
        s.data.income.push({
          id: `local-${Date.now()}`,
          a: input.amount,
          d: input.date,
          s: input.sourceId || '',
          method: input.entryMethod || 'manual',
        });
        s.data.income.sort((x, y) => (x.d < y.d ? -1 : 1));
        s.workCostSummary = localWorkCostSummary(s.data, s.workCostSelectedMonth);
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
        });
        s.data.income.sort((x, y) => (x.d < y.d ? -1 : 1));
        s.incomeSync = 'ready';
      });
      refreshAfterMoneyWrite();
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
      });
      return;
    }
    const entry = await createWorkCostEntryRequest(input);
    up(s => { applyConfirmedWorkCost(s, entry); });
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
      });
    } catch (error) {
      up(s => { s.expenseSync = 'error'; });
      throw error;
    }
  }, [up]);

  const toast = useCallback((msg: string, tone: 'success' | 'error' = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg({ msg, key: Date.now(), tone });
    toastTimer.current = setTimeout(() => setToastMsg(null), 1800);
  }, []);

  const value = useMemo<Ctx>(() => ({
    S, up, t, monthName, go, goTab, backNav,
    saveIncomeEntry, updateIncomeEntry, saveIncomeSource, refreshIncomeRecord, refreshIncomePattern,
    refreshIncomeCoverage, saveIncomeCoverage, refreshWorkCosts, saveWorkCostCategory, saveWorkCostEntry, updateWorkCostEntry,
    saveCommitmentAmount, toast, toastMsg,
    saveExpenseCategory, saveExpenseEntry,
  }), [
    S, up, t, monthName, go, goTab, backNav,
    saveIncomeEntry, updateIncomeEntry, saveIncomeSource, refreshIncomeRecord, refreshIncomePattern,
    refreshIncomeCoverage, saveIncomeCoverage, refreshWorkCosts, saveWorkCostCategory, saveWorkCostEntry, updateWorkCostEntry,
    saveCommitmentAmount, toast, toastMsg,
    saveExpenseCategory, saveExpenseEntry,
  ]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
