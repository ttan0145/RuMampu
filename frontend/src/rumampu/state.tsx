import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AppData, MOCK } from './mock';
import { Lang, STRINGS } from './strings';
import { CoverageState, preHousingOk } from './calc';

/* Central app state — mirrors the prototype's `S` object and navigation model. */

export type Route =
  | 'home' | 'money' | 'income' | 'workcosts' | 'commit' | 'pattern' | 'coverage' | 'record'
  | 'expenses' | 'expadd' | 'expscan' | 'expmonths' | 'exlimits'
  | 'house' | 'homecost' | 'precheck' | 'result' | 'range' | 'compare' | 'shock'
  | 'prepare' | 'upfront' | 'buffer' | 'docs' | 'pv_switch' | 'pv_month' | 'pv_compare';

export type Tab = 'home' | 'money' | 'test' | 'prepare';

export const TAB_OF: Record<Route, Tab> = {
  home: 'home',
  money: 'money', income: 'money', workcosts: 'money', commit: 'money', pattern: 'money',
  coverage: 'money', record: 'money', expenses: 'money', expadd: 'money', expscan: 'money',
  expmonths: 'money', exlimits: 'money',
  house: 'test', homecost: 'test', precheck: 'test', result: 'test', range: 'test',
  compare: 'test', shock: 'test',
  prepare: 'prepare', upfront: 'prepare', buffer: 'prepare', docs: 'prepare',
  pv_switch: 'prepare', pv_month: 'prepare', pv_compare: 'prepare',
};

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
  coverage: CoverageState;
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
  sheet: string | null;
}

function initialState(): AppState {
  return {
    lang: 'en',
    route: 'home',
    stack: [],
    onboard: 0, onboarded: false, splash: true,
    data: JSON.parse(JSON.stringify(MOCK)),
    coverage: { answer: null, slow: [] },
    testRan: false,
    howOpen: false, rgHowOpen: false, tcOpen: false, dcOpen: false,
    docsChecked: [], keptTests: [],
    expDraft: { a: '', c: 'meals', d: '2026-08-23' },
    scan: { stage: 'pick' },
    exCatOpen: false, exMonthOpen: null,
    shock: 0,
    bought: false,
    incomeDraft: { a: '', d: '2026-08-21', s: 'ehail', flag: null },
    sheet: null,
  };
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
  runTest: () => void;
  toast: (msg: string) => void;
  toastMsg: { msg: string; key: number } | null;
}

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [S, setS] = useState<AppState>(initialState);
  const [toastMsg, setToastMsg] = useState<{ msg: string; key: number } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const up = useCallback((fn: (s: AppState) => void) => {
    setS(prev => {
      const next: AppState = JSON.parse(JSON.stringify(prev));
      fn(next);
      return next;
    });
  }, []);

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

  const goTab = useCallback((tab: Tab) => {
    up(s => {
      s.stack = [];
      if (tab === 'test') s.route = s.testRan ? (preHousingOk(s.data) ? 'result' : 'precheck') : 'house';
      else s.route = tab;
    });
  }, [up]);

  const backNav = useCallback(() => {
    up(s => {
      const prev = s.stack.pop();
      if (prev) { s.route = prev; return; }
      const tab = TAB_OF[s.route] || 'home';
      const root: Route = (tab === 'test') ? (s.testRan ? 'result' : 'house') : tab;
      const target: Tab = s.route === root ? 'home' : tab;
      s.stack = [];
      if (target === 'test') s.route = s.testRan ? (preHousingOk(s.data) ? 'result' : 'precheck') : 'house';
      else s.route = target;
    });
  }, [up]);

  const runTest = useCallback(() => {
    up(s => {
      s.stack.push(s.route);
      s.howOpen = false; s.rgHowOpen = false;
      if (!preHousingOk(s.data)) { s.route = 'precheck'; return; }
      s.testRan = true;
      s.route = 'result';
    });
  }, [up]);

  const toast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg({ msg, key: Date.now() });
    toastTimer.current = setTimeout(() => setToastMsg(null), 1800);
  }, []);

  const value = useMemo<Ctx>(() => ({
    S, up, t, monthName, go, goTab, backNav, runTest, toast, toastMsg,
  }), [S, up, t, monthName, go, goTab, backNav, runTest, toast, toastMsg]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
