import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AppData, MOCK } from './mock';
import { Lang, STRINGS } from './strings';
import {
  ApiCoverageAnswer,
  ApiIncomeCoverage,
  ApiIncomePattern,
  createExpense as createExpenseRequest,
  createExpenseCategory as createExpenseCategoryRequest,
  createWorkCost as createWorkCostRequest,
  createIncomeEntry as createIncomeEntryRequest,
  createIncomeSource as createIncomeSourceRequest,
  fetchCommitments,
  fetchExpenseCategories,
  fetchExpenses,
  fetchIncomeCoverage,
  fetchIncomePattern,
  fetchIncomeRecord,
  fetchWorkCosts,
  INCOME_API_ENABLED,
  isOutlierConfirmation,
  updateIncomeCoverage as updateIncomeCoverageRequest,
  updateCommitment as updateCommitmentRequest,
  updateWorkCost as updateWorkCostRequest,
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
  incomeDraft: { a: string; d: string; s: string; flag: 'neg' | 'outlier' | null };
  incomeSync: 'disabled' | 'loading' | 'ready' | 'error';
  workCostSync: 'disabled' | 'loading' | 'ready' | 'error';
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
  if (INCOME_API_ENABLED) {
    data.sources = [];
    data.income = [];
    data.workCosts = [];
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
    commitmentSync: INCOME_API_ENABLED ? 'loading' : 'disabled',
    expenseSync: INCOME_API_ENABLED ? 'loading' : 'disabled',
    incomePattern: null,
    incomeCoverage: null,
    incomePatternSync: INCOME_API_ENABLED ? 'idle' : 'disabled',
    coverageSync: INCOME_API_ENABLED ? 'idle' : 'disabled',
    sheet: null,
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
  saveIncomeSource: (name: string) => Promise<string>;
  refreshIncomeRecord: () => Promise<void>;
  refreshIncomePattern: () => Promise<void>;
  refreshIncomeCoverage: () => Promise<void>;
  saveIncomeCoverage: (input: {
    answer: ApiCoverageAnswer;
    slowerMonths: number[];
  }) => Promise<void>;
  saveWorkCostAmount: (id: string, amount: number) => Promise<void>;
  saveCustomWorkCost: (name: string, amount: number) => Promise<string>;
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

  const up = useCallback((fn: (s: AppState) => void) => {
    setS(prev => {
      const next: AppState = JSON.parse(JSON.stringify(prev));
      fn(next);
      return next;
    });
  }, []);

  React.useEffect(() => {
    if (!INCOME_API_ENABLED) return;
    let active = true;
    void (async () => {
      try {
        const record = await fetchIncomeRecord();
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
            s.workCostSync = 'error';
            s.commitmentSync = 'error';
            s.expenseSync = 'error';
          });
        }
        return;
      }

      try {
        const [workCosts, commitmentItems, expenseCategories, expenses] = await Promise.all([
          fetchWorkCosts(),
          fetchCommitments(),
          fetchExpenseCategories(),
          fetchExpenses(),
        ]);
        if (!active) return;
        up(s => {
          s.data.workCosts = workCosts.map(item => ({
            id: String(item.id),
            k: item.slug ? `wc_${item.slug}` : undefined,
            custom: item.is_custom,
            name: item.name,
            a: Number(item.monthly_amount),
          }));
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
          s.workCostSync = 'ready';
          s.commitmentSync = 'ready';
          s.expenseSync = 'ready';
        });
      } catch {
        if (active) {
          up(s => {
            s.workCostSync = 'error';
            s.commitmentSync = 'error';
            s.expenseSync = 'error';
          });
        }
      }
    })();
    return () => { active = false; };
  }, [up]);

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

  const saveIncomeEntry = useCallback(async (input: SaveIncomeInput): Promise<'saved' | 'outlier'> => {
    if (!INCOME_API_ENABLED) {
      up(s => {
        s.data.income.push({
          a: input.amount,
          d: input.date,
          s: input.sourceId || '',
          method: input.entryMethod || 'manual',
        });
        s.data.income.sort((x, y) => (x.d < y.d ? -1 : 1));
      });
      return 'saved';
    }
    try {
      const entry = await createIncomeEntryRequest(input);
      up(s => {
        s.data.income.push({
          a: Number(entry.amount),
          d: entry.date,
          s: entry.source_id == null ? '' : String(entry.source_id),
          method: entry.entry_method,
        });
        s.data.income.sort((x, y) => (x.d < y.d ? -1 : 1));
        s.incomeSync = 'ready';
      });
      return 'saved';
    } catch (error) {
      if (isOutlierConfirmation(error)) return 'outlier';
      up(s => { s.incomeSync = 'error'; });
      throw error;
    }
  }, [up]);

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

  const saveWorkCostAmount = useCallback(async (id: string, amount: number): Promise<void> => {
    if (!INCOME_API_ENABLED) return;
    try {
      const item = await updateWorkCostRequest(id, amount);
      up(s => {
        const existing = s.data.workCosts.find(cost => cost.id === id);
        if (existing) existing.a = Number(item.monthly_amount);
        s.workCostSync = 'ready';
      });
    } catch (error) {
      up(s => { s.workCostSync = 'error'; });
      throw error;
    }
  }, [up]);

  const saveCustomWorkCost = useCallback(async (name: string, amount: number): Promise<string> => {
    if (!INCOME_API_ENABLED) {
      const id = `own${Date.now()}`;
      up(s => { s.data.workCosts.push({ id, custom: true, name, a: amount }); });
      return id;
    }
    try {
      const item = await createWorkCostRequest({ name, monthlyAmount: amount });
      const id = String(item.id);
      up(s => {
        s.data.workCosts.push({ id, custom: true, name: item.name, a: Number(item.monthly_amount) });
        s.workCostSync = 'ready';
      });
      return id;
    } catch (error) {
      up(s => { s.workCostSync = 'error'; });
      throw error;
    }
  }, [up]);

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
    saveIncomeEntry, saveIncomeSource, refreshIncomeRecord, refreshIncomePattern,
    refreshIncomeCoverage, saveIncomeCoverage, saveWorkCostAmount, saveCustomWorkCost,
    saveCommitmentAmount, toast, toastMsg,
    saveExpenseCategory, saveExpenseEntry,
  }), [
    S, up, t, monthName, go, goTab, backNav,
    saveIncomeEntry, saveIncomeSource, refreshIncomeRecord, refreshIncomePattern,
    refreshIncomeCoverage, saveIncomeCoverage, saveWorkCostAmount, saveCustomWorkCost,
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
