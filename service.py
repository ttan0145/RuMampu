from collections import defaultdict
from decimal import Decimal

EXP_FULL_DAYS = 20


def _num(value):
    if value in (None, ''):
        return 0.0
    return float(value)


def financing_amount(property_price, deposit):
    return max(0.0, _num(property_price) - _num(deposit))


def calculate_monthly_instalment(principal, annual_rate, years):
    principal = _num(principal)
    annual_rate = _num(annual_rate)
    years = int(years or 0)
    if principal <= 0 or years <= 0:
        return 0.0
    monthly_rate = annual_rate / 100 / 12
    months = years * 12
    if monthly_rate == 0:
        return principal / months
    return principal * monthly_rate / (1 - (1 + monthly_rate) ** (-months))


def calculate_total_home_cost(monthly_instalment, additional_costs):
    extras = sum(_num(item.get('amount', item.get('a', 0))) for item in additional_costs or [])
    return _num(monthly_instalment) + extras


def calculation_result(data):
    principal = financing_amount(data['property_price'], data['deposit'])
    known = data.get('known_monthly_payment')
    monthly = _num(known) if known is not None else calculate_monthly_instalment(
        principal, data['financing_rate'], data['tenure_years']
    )
    total = calculate_total_home_cost(monthly, data.get('additional_costs', []))
    return {
        'financing_amount': round(principal, 2),
        'monthly_instalment': round(monthly, 2),
        'total_monthly_cost': round(total, 2),
    }


def scenario_instalment(scenario):
    if scenario.known_monthly_payment is not None:
        return float(scenario.known_monthly_payment)
    return calculate_monthly_instalment(
        financing_amount(scenario.property_price, scenario.deposit),
        scenario.financing_rate,
        scenario.tenure_years,
    )


def scenario_total_monthly_cost(scenario):
    costs = [{'amount': c.amount} for c in scenario.additional_costs.all()]
    return calculate_total_home_cost(scenario_instalment(scenario), costs)


def _month_key(date_string):
    # Input from the existing React Native prototype is YYYY-MM-DD.
    year = int(date_string[0:4])
    month = int(date_string[5:7])
    return year, month


def _expense_months(expenses):
    result = defaultdict(lambda: {'total': 0.0, 'days': set()})
    for entry in expenses or []:
        key = _month_key(entry['d'])
        result[key]['total'] += _num(entry.get('a'))
        result[key]['days'].add(entry['d'])
    return result


def _flatten_commitments(commitments):
    return (
        commitments.get('living', []) +
        commitments.get('debts', []) +
        commitments.get('savings', [])
    )


def _monthly_commitment(commitments, expense_month):
    all_items = _flatten_commitments(commitments)
    base = sum(_num(item.get('a')) for item in all_items)
    if expense_month and len(expense_month['days']) >= EXP_FULL_DAYS:
        variable_estimates = sum(_num(item.get('a')) for item in all_items if item.get('dv'))
        return base - variable_estimates + expense_month['total']
    return base


def pre_housing_check(data):
    income_by_month = defaultdict(float)
    for entry in data.get('income', []):
        income_by_month[_month_key(entry['d'])] += _num(entry.get('a'))

    work_cost = sum(_num(item.get('a')) for item in data.get('work_costs', []))
    expense_months = _expense_months(data.get('expenses', []))
    commitments = data.get('commitments', {})

    rows = []
    for year, month in sorted(income_by_month):
        gross = income_by_month[(year, month)]
        usable_income = gross - work_cost
        existing_costs = _monthly_commitment(commitments, expense_months.get((year, month)))
        surplus = usable_income - existing_costs
        rows.append({
            'year': year,
            'month': month,
            'gross_income': round(gross, 2),
            'usable_income': round(usable_income, 2),
            'existing_costs': round(existing_costs, 2),
            'surplus': round(surplus, 2),
            'shortfall': round(max(0.0, -surplus), 2),
        })

    short_rows = [row for row in rows if row['shortfall'] > 0]
    worst = max(short_rows, key=lambda row: row['shortfall']) if short_rows else None
    return {
        'has_existing_shortfall': bool(short_rows),
        'tested_months': len(rows),
        'largest_existing_gap': worst['shortfall'] if worst else 0,
        'worst_month': ({'year': worst['year'], 'month': worst['month']} if worst else None),
        'months': rows,
    }


def _median(values):
    values = sorted(values)
    count = len(values)
    if count == 0:
        return 0.0
    middle = count // 2
    if count % 2:
        return values[middle]
    return (values[middle - 1] + values[middle]) / 2


def property_price_from_monthly_payment(monthly_payment, annual_rate, years, deposit=0):
    """Convert a monthly mortgage instalment to an indicative property price.

    This is deliberately a financing-math conversion only. It is not a valuation,
    eligibility decision or financing offer.
    """
    payment = max(0.0, _num(monthly_payment))
    annual_rate = _num(annual_rate)
    years = int(years or 0)
    deposit = max(0.0, _num(deposit))
    if payment <= 0 or years <= 0:
        return deposit

    monthly_rate = annual_rate / 100 / 12
    months = years * 12
    if monthly_rate == 0:
        principal = payment * months
    else:
        principal = payment * (1 - (1 + monthly_rate) ** (-months)) / monthly_rate
    return principal + deposit


def housing_test_result(data, scenario):
    """US3.4 + US3.5 result calculated from the recorded financial months.

    The pre-housing monthly surplus is the amount available after work costs and
    existing commitments. The tested home cost is then compared against that
    amount for every recorded month.
    """
    pre = pre_housing_check(data)
    tested_cost = scenario_total_monthly_cost(scenario)

    monthly = []
    for row in pre['months']:
        available = row['surplus']
        existing_shortfall = max(0.0, _num(row.get('shortfall')))
        post_housing_residual = available - tested_cost
        total_shortfall = max(0.0, -post_housing_residual)

        # A housing-created shortfall is a month that was not short before housing,
        # but becomes short after the tested home cost is applied. For a month
        # already short, housing still deepens the gap, but it is not labelled as
        # a newly created shortfall.
        housing_created_shortfall = total_shortfall if existing_shortfall == 0 else 0.0
        housing_added_gap = max(0.0, total_shortfall - existing_shortfall)

        if total_shortfall == 0:
            shortfall_type = 'none'
        elif existing_shortfall > 0:
            shortfall_type = 'existing_and_worsened_by_housing'
        else:
            shortfall_type = 'housing_created'

        monthly.append({
            **row,
            'available_for_home': round(available, 2),
            'tested_home_cost': round(tested_cost, 2),
            'post_housing_residual': round(post_housing_residual, 2),
            'is_short': total_shortfall > 0,
            'existing_shortfall': round(existing_shortfall, 2),
            'housing_created_shortfall': round(housing_created_shortfall, 2),
            'housing_added_gap': round(housing_added_gap, 2),
            'total_shortfall': round(total_shortfall, 2),
            'shortfall_type': shortfall_type,
            # Kept for compatibility with the existing Result chart.
            'housing_shortfall': round(total_shortfall, 2),
        })

    short_rows = [row for row in monthly if row['is_short']]
    existing_short_rows = [row for row in monthly if row['existing_shortfall'] > 0]
    housing_created_rows = [row for row in monthly if row['shortfall_type'] == 'housing_created']
    capacities = [row['available_for_home'] for row in monthly]

    carrying = None
    if capacities:
        lower = min(capacities)
        upper = _median(capacities)
        extras = sum(_num(cost.amount) for cost in scenario.additional_costs.all())
        lower_mortgage_payment = max(0.0, lower - extras)
        upper_mortgage_payment = max(0.0, upper - extras)
        carrying = {
            'lower_monthly_amount': round(lower, 2),
            'upper_monthly_amount': round(upper, 2),
            'tested_monthly_home_cost': round(tested_cost, 2),
            'lower_meaning': 'Every recorded month covered this amount.',
            'upper_meaning': 'Half of the recorded months covered this amount.',
            'indicative_property_price_lower': round(property_price_from_monthly_payment(
                lower_mortgage_payment, scenario.financing_rate, scenario.tenure_years, scenario.deposit
            ), 2),
            'indicative_property_price_upper': round(property_price_from_monthly_payment(
                upper_mortgage_payment, scenario.financing_rate, scenario.tenure_years, scenario.deposit
            ), 2),
            'property_price_limitation': 'Indicative only. Not a valuation, not an offer.',
        }

    return {
        'scenario_id': scenario.id,
        'tested_home_cost': round(tested_cost, 2),
        'tested_months': len(monthly),
        'short_month_count': len(short_rows),
        'existing_short_month_count': len(existing_short_rows),
        'housing_created_short_month_count': len(housing_created_rows),
        'largest_gap': round(max((row['total_shortfall'] for row in short_rows), default=0.0), 2),
        'largest_existing_gap': round(max((row['existing_shortfall'] for row in existing_short_rows), default=0.0), 2),
        'largest_housing_created_gap': round(max((row['housing_created_shortfall'] for row in housing_created_rows), default=0.0), 2),
        'months': monthly,
        'carrying_range': carrying,
    }



---
state

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AppData, MOCK } from './mock';
import { Lang, STRINGS } from './strings';
import { CoverageState, preHousingOk } from './calc';
import {
  createExpense as createExpenseRequest,
  createExpenseCategory as createExpenseCategoryRequest,
  createWorkCost as createWorkCostRequest,
  createIncomeEntry as createIncomeEntryRequest,
  createIncomeSource as createIncomeSourceRequest,
  fetchCommitments,
  fetchExpenseCategories,
  fetchExpenses,
  fetchIncomeRecord,
  fetchWorkCosts,
  INCOME_API_ENABLED,
  isOutlierConfirmation,
  updateCommitment as updateCommitmentRequest,
  updateWorkCost as updateWorkCostRequest,
} from './api';

/* Central app state — mirrors the prototype's `S` object and navigation model. */

export type Route =
  | 'home' | 'money' | 'income' | 'incomeimport' | 'workcosts' | 'commit' | 'pattern' | 'coverage' | 'record'
  | 'expenses' | 'expadd' | 'expscan' | 'expmonths' | 'exlimits'
  | 'house' | 'homecost' | 'precheck' | 'result' | 'range' | 'compare' | 'shock'
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
  incomeSync: 'disabled' | 'loading' | 'ready' | 'error';
  workCostSync: 'disabled' | 'loading' | 'ready' | 'error';
  commitmentSync: 'disabled' | 'loading' | 'ready' | 'error';
  expenseSync: 'disabled' | 'loading' | 'ready' | 'error';
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
    incomeSync: INCOME_API_ENABLED ? 'loading' : 'disabled',
    workCostSync: INCOME_API_ENABLED ? 'loading' : 'disabled',
    commitmentSync: INCOME_API_ENABLED ? 'loading' : 'disabled',
    expenseSync: INCOME_API_ENABLED ? 'loading' : 'disabled',
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
  runTest: () => void;
  saveIncomeEntry: (input: SaveIncomeInput) => Promise<'saved' | 'outlier'>;
  saveIncomeSource: (name: string) => Promise<string>;
  refreshIncomeRecord: () => Promise<void>;
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
      } catch {
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

  const goTab = useCallback((tab: Tab) => {
    up(s => {
      s.stack = [];
      if (tab === 'test') s.route = s.testRan ? 'result' : 'house';
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
      if (target === 'test') s.route = s.testRan ? 'result' : 'house';
      else s.route = target;
    });
  }, [up]);

  const runTest = useCallback(() => {
    up(s => {
      s.stack.push(s.route);
      s.howOpen = false; s.rgHowOpen = false;
      s.testRan = true;
      s.route = 'result';
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

  const toast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg({ msg, key: Date.now() });
    toastTimer.current = setTimeout(() => setToastMsg(null), 1800);
  }, []);

  const value = useMemo<Ctx>(() => ({
    S, up, t, monthName, go, goTab, backNav, runTest,
    saveIncomeEntry, saveIncomeSource, refreshIncomeRecord, saveWorkCostAmount, saveCustomWorkCost,
    saveCommitmentAmount, toast, toastMsg,
    saveExpenseCategory, saveExpenseEntry,
  }), [
    S, up, t, monthName, go, goTab, backNav, runTest,
    saveIncomeEntry, saveIncomeSource, refreshIncomeRecord, saveWorkCostAmount, saveCustomWorkCost,
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

---
house

export interface HousingCostInput {
  category: string;
  amount: number;
}

export interface HousingScenarioPayload {
  property_price: number;
  deposit: number;
  financing_rate: number;
  tenure_years: number;
  known_monthly_payment: number | null;
  additional_costs?: HousingCostInput[];
}

export interface HousingScenarioResponse extends HousingScenarioPayload {
  id: number;
  financing_amount: number;
  monthly_instalment: number;
  total_monthly_cost: number;
  created_at: string;
  updated_at: string;
}

export interface PreHousingMonthResult {
  year: number;
  month: number; // 1-12 from Django
  gross_income: number;
  usable_income: number;
  existing_costs: number;
  surplus: number;
  shortfall: number;
}

export interface PreHousingResult {
  provenance: 'calculated_from_user_record';
  work_cost_basis: 'recorded_entries_by_month';
  has_existing_shortfall: boolean;
  tested_months: number;
  largest_existing_gap: number;
  worst_month: { year: number; month: number } | null;
  months: PreHousingMonthResult[];
}


export interface HousingTestMonthResult extends PreHousingMonthResult {
  available_for_home: number;
  tested_home_cost: number;
  post_housing_residual: number;
  is_short: boolean;
  existing_shortfall: number;
  housing_created_shortfall: number;
  housing_added_gap: number;
  total_shortfall: number;
  shortfall_type: 'none' | 'housing_created' | 'existing_and_worsened_by_housing';
  housing_shortfall: number;
}

export interface CarryingRangeResult {
  lower_monthly_amount: number;
  upper_monthly_amount: number;
  tested_monthly_home_cost: number;
  lower_meaning: string;
  upper_meaning: string;
  indicative_property_price_lower: number;
  indicative_property_price_upper: number;
  property_price_limitation: string;
}

export interface HousingTestResult {
  scenario_id: number;
  tested_home_cost: number;
  tested_months: number;
  short_month_count: number;
  existing_short_month_count: number;
  housing_created_short_month_count: number;
  largest_gap: number;
  largest_existing_gap: number;
  largest_housing_created_gap: number;
  months: HousingTestMonthResult[];
  carrying_range: CarryingRangeResult | null;
}


---
test

import React from 'react';
import { createHousingScenario, runHousingTest, runPreHousingCheck, updateHousingScenario } from '../../../services/housingService';
import {
  getHousingScenarioId, getHousingTestResult, getPreHousingResult,
  setHousingScenarioId, setHousingTestResult, setPreHousingResult,
} from '../../../services/housingSession';
import { Text, View } from 'react-native';
import { useApp } from '../state';
import {
  currentInstalment, monthsAgg, nf, rm, slowUnseen, testRows, totalHomeCost,
} from '../calc';
import {
  BodyS, Btn, BtnLine, BtnQuiet, Card, Chip, Chips, Display, Divider, EditList,
  Fig, FigRow, IcLab, KV, NoteC, NumInput, P, Prov,
} from '../ui';
import { C, DISP_FONT } from '../theme';
import { Band, Waterline } from '../charts';
import { ScreenShell } from './shell';

export function HouseScreen() {
  const { S, t, up, go, toast } = useApp();
  const [saving, setSaving] = React.useState(false);
  const h = S.data.house;
  const inst = currentInstalment(S.data);
  const known = h.knownPayment != null;
  return (
    <ScreenShell back title={t('th_title')}>
      {!known ? (
        <>
          <Card gap={8}>
            <View style={{ gap: 6 }}>
              <BodyS muted>{t('th_price')}</BodyS>
              <NumInput value={h.price} onNum={n => up(s => { s.data.house.price = n; })} />
            </View>
            <View style={{ gap: 6 }}>
              <BodyS muted>{t('th_dep')}</BodyS>
              <NumInput value={h.deposit} onNum={n => up(s => { s.data.house.deposit = Math.max(0, n); })} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <BodyS muted>{t('th_dep0')}</BodyS>
              <Prov p="official" />
            </View>
            <KV k={t('th_fin')}><Fig value={rm(Math.max(0, h.price - h.deposit))} p="calc" /></KV>
            <View style={{ gap: 6 }}>
              <BodyS muted>{t('th_rate')}</BodyS>
              <NumInput decimal value={h.rate} onNum={n => up(s => { s.data.house.rate = n; })} />
            </View>
            <View style={{ gap: 6 }}>
              <BodyS muted>{t('th_ten')}</BodyS>
              <NumInput value={h.years} onNum={n => up(s => { s.data.house.years = n || 1; })} />
            </View>
          </Card>
          <KV k={t('th_inst')}><Fig value={rm(inst)} p="calc" cls="h-l" /></KV>
          <BtnLine label={t('th_known')} onPress={() => up(s => {
            s.data.house.knownPayment = Math.round(currentInstalment(s.data));
          })} />
        </>
      ) : (
        <>
          <Card gap={8}>
            <View style={{ gap: 6 }}>
              <BodyS muted>{t('th_knownamt')}</BodyS>
              <NumInput value={+(h.knownPayment || 0)} onNum={n => up(s => { s.data.house.knownPayment = n; })} />
            </View>
            <FigRow p="user" />
          </Card>
          <BtnLine label={t('cancel')} onPress={() => up(s => { s.data.house.knownPayment = null; })} />
        </>
      )}
      <Btn label={t('th_next') + ' →'} onPress={() => {
        if (saving) return;
        setSaving(true);
        void createHousingScenario(S.data)
          .then(result => {
            setHousingScenarioId(result.id);
            setPreHousingResult(null);
            go('homecost');
          })
          .catch(() => toast('Could not save the housing scenario. Check that the Django backend is running.'))
          .finally(() => setSaving(false));
      }} />
    </ScreenShell>
  );
}

export function HomecostScreen() {
  const { S, t, up, go, toast } = useApp();
  const [checking, setChecking] = React.useState(false);
  const inst = currentInstalment(S.data);
  const total = totalHomeCost(S.data);
  return (
    <ScreenShell back title={t('tc_title')}>
      <Fig value={rm(total)} p="calc" cls="h-xl" />
      <BodyS muted>{t('tc_point')}</BodyS>
      <BtnQuiet arrow={false} onPress={() => up(s => { s.tcOpen = !s.tcOpen; })}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <P>{t('tc_break')}</P>
          <Text style={{ fontSize: 16, color: C.ink }}>{S.tcOpen ? '−' : '+'}</Text>
        </View>
      </BtnQuiet>
      {S.tcOpen ? (
        <Card gap={8}>
          <KV k={t('tc_inst')}>
            <Fig value={rm(inst)} p={S.data.house.knownPayment != null ? 'user' : 'calc'} />
          </KV>
          <EditList
            list={S.data.homeCosts.map(c => ({ ...c, p: 'assume' }))}
            onNum={(i, n) => up(s => { s.data.homeCosts[i].a = n; })}
          />
        </Card>
      ) : null}
      <Btn label={t('tc_run') + ' →'} onPress={() => {
        if (checking) return;
        setChecking(true);
        void (async () => {
          try {
            let scenarioId = getHousingScenarioId();
            if (scenarioId == null) {
              const created = await createHousingScenario(S.data);
              scenarioId = created.id;
              setHousingScenarioId(created.id);
            }
            await updateHousingScenario(scenarioId, S.data);
            const result = await runPreHousingCheck(S.data);
            setPreHousingResult(result);

            // Always calculate the historical housing result so the backend can
            // distinguish existing versus housing-induced shortfalls. The visible
            // flow still follows the original HTML: existing shortfall ->
            // "Before the house" first; otherwise -> Result.
            const housingResult = await runHousingTest(scenarioId, S.data);
            setHousingTestResult(housingResult);
            up(state => {
              state.testRan = true;
              state.howOpen = false;
              state.rgHowOpen = false;
            });

            if (result.has_existing_shortfall) {
              go('precheck');
              return;
            }

            go('result');
          } catch {
            toast('Could not run the housing check. Check that the Django backend is running.');
          } finally {
            setChecking(false);
          }
        })();
      }} />
    </ScreenShell>
  );
}

export function PrecheckScreen() {
  const { t, monthName, goTab, up } = useApp();
  const result = getPreHousingResult();
  React.useEffect(() => {
    up(state => { state.stack = ['house']; });
  }, [up]);
  const worst = result?.worst_month;
  const monthIndex = worst ? worst.month - 1 : 0;
  const gap = result?.largest_existing_gap || 0;
  return (
    <ScreenShell back title={t('pc_title')}>
      <Display cls="h-l">{t('pc_msg', { m: monthName(monthIndex), x: nf(gap) })}</Display>
      <FigRow p="calc" />
      <BodyS muted>{t('pc_msg2')}</BodyS>
      <Btn label={t('pc_btn')} onPress={() => goTab('money')} />
    </ScreenShell>
  );
}

export function ResultScreen() {
  const { S, t, monthName, up, go, toast } = useApp();
  React.useEffect(() => {
    up(state => { state.stack = ['house']; });
  }, [up]);

  const result = getHousingTestResult();
  if (!result) return <ScreenShell back title={t('rs_title')} />;

  const cost = result.tested_home_cost;
  const rows = result.months.map(r => ({
    m: r.month - 1,
    surplus: r.available_for_home,
    short: r.is_short,
    gap: r.total_shortfall,
  }));
  const n = result.tested_months;
  const s = result.short_month_count;
  const g = result.largest_gap;
  const un = slowUnseen(S.data, S.coverage);

  let lead: React.ReactNode;
  const headline = s ? t('headline', { s, n }) : t('headline_zero', { n });
  if (un.length) {
    lead = (
      <>
        <NoteC><Display cls="h-l">{t('rs_limit_slow', { m: un.map(monthName).join(', ') })}</Display></NoteC>
        <Display cls="h-m">{headline}</Display>
        <FigRow p="calc" />
      </>
    );
  } else if (n < 4) {
    lead = (
      <>
        <NoteC><Display cls="h-l">{t('rs_limit_thin', { n })}</Display></NoteC>
        <Display cls="h-m">{headline}</Display>
        <FigRow p="calc" />
      </>
    );
  } else {
    lead = (
      <>
        <Display cls="h-xl">{headline}</Display>
        <FigRow p="calc" />
      </>
    );
  }

  return (
    <ScreenShell back title={t('rs_title')}>
      {lead}
      {s ? <KV k={t('gap_lbl')}><Fig value={rm(g)} p="calc" /></KV> : null}
      <Waterline rows={rows} cost={cost} lineLabel prov="calc" monthName={monthName} />
      <BtnLine label={t('rs_how')} onPress={() => up(x2 => { x2.howOpen = !x2.howOpen; })} />
      {S.howOpen ? <Card><BodyS>{t('rs_how_body', { c: nf(cost) })}</BodyS></Card> : null}
      <BtnLine label={t('rs_keep')} onPress={() => {
        up(x2 => {
          x2.keptTests.push({
            pay: Math.round(cost),
            s,
            n,
            g: Math.round(g),
          });
        });
        toast(t('rs_kept'));
      }} />
      <View style={{ gap: 8 }}>
        <BtnQuiet onPress={() => go('range')}><IcLab name="band"><P>{t('rs_range')}</P></IcLab></BtnQuiet>
        <BtnQuiet onPress={() => go('compare')}><IcLab name="columns"><P>{t('rs_compare')}</P></IcLab></BtnQuiet>
        <BtnQuiet onPress={() => go('shock')}><IcLab name="trend"><P>{t('rs_shock')}</P></IcLab></BtnQuiet>
      </View>
    </ScreenShell>
  );
}

export function RangeScreen() {
  const { S, t, up } = useApp();
  const result = getHousingTestResult();
  const cr = result?.carrying_range;
  if (!cr) return <ScreenShell back title={t('rs_range')} />;

  const h = S.data.house;
  const loValue = cr.lower_monthly_amount;
  const hiValue = cr.upper_monthly_amount;
  const you = cr.tested_monthly_home_cost;
  const lo = loValue * 0.8;
  const hiS = Math.max(hiValue, you, loValue + 1) * 1.15;
  const pos = (v: number) => Math.min(100, Math.max(0, (v - lo) / (hiS - lo) * 100));

  return (
    <ScreenShell back title={t('rs_range')}>
      <Display cls="h-l">{t('rg_lead', { a: nf(loValue), b: nf(hiValue) })}</Display>
      <FigRow p="calc" />
      <Band
        loPct={pos(loValue)} hiPct={pos(hiValue)} pinPct={pos(you)}
        pinTop={rm(you)} pinBottom={t('rg_pin')} prov="calc"
      />
      <BtnLine label={t('rg_how')} onPress={() => up(s => { s.rgHowOpen = !s.rgHowOpen; })} />
      {S.rgHowOpen ? (
        <Card>
          <BodyS>{t('rg_how_body', { a: nf(loValue), b: nf(hiValue) })}</BodyS>
        </Card>
      ) : null}
      <Divider />
      <P>{t('rg_price', {
        r: h.rate,
        y: h.years,
        p: nf(cr.indicative_property_price_lower),
        q: nf(cr.indicative_property_price_upper),
      })}</P>
      <FigRow p="assume" />
      <BodyS muted>{cr.property_price_limitation || t('rg_ind')}</BodyS>
    </ScreenShell>
  );
}

export function CompareScreen() {
  const { S, t, monthName, up } = useApp();
  const n = monthsAgg(S.data).length;
  return (
    <ScreenShell back title={t('rs_compare')}>
      <BodyS muted>{t('cp_note')}</BodyS>
      {S.data.comparePayments.map((p, i) => {
        const rows = testRows(S.data, p);
        const s = rows.filter(r => r.short).length;
        const g = Math.max(...rows.map(r => r.gap), 0);
        return (
          <Card key={i} gap={8}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <NumInput
                value={p} style={{ width: 118 }}
                onNum={x => up(st => { st.data.comparePayments[i] = Math.max(0, x); })}
              />
              <View style={{ alignItems: 'flex-end', gap: 2, flexShrink: 1 }}>
                <Text style={{ fontSize: 13, lineHeight: 18, color: C.ink, fontWeight: '700' }}>
                  {t('cp_short', { s, n })}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <BodyS muted>{t('cp_gap', { g: nf(g) })}</BodyS>
                  <Prov p="calc" />
                </View>
              </View>
            </View>
            <Waterline rows={rows} cost={p} small monthName={monthName} />
          </Card>
        );
      })}
    </ScreenShell>
  );
}

export function ShockScreen() {
  const { S, t, monthName, up } = useApp();
  const cost = totalHomeCost(S.data);
  const p = S.shock;
  const rows = testRows(S.data, cost, p);
  const n = rows.length, s = rows.filter(r => r.short).length;
  const preset = [0, 10, 20].includes(p);
  const showCustom = !preset || S.sheet === 'shockcustom';
  return (
    <ScreenShell back title={t('rs_shock')}>
      <Chips>
        {[0, 10, 20].map(v => (
          <Chip key={v} label={v === 0 ? '0%' : `−${v}%`} on={p === v}
            onPress={() => up(x => { x.shock = v; x.sheet = null; })} />
        ))}
        <Chip label={t('sh_custom')} on={!preset}
          onPress={() => up(x => { x.sheet = 'shockcustom'; })} />
      </Chips>
      {showCustom ? (
        <View style={{ gap: 6 }}>
          <BodyS muted>{t('sh_pct')}</BodyS>
          <NumInput value={p} onNum={x => up(st => { st.shock = Math.min(90, Math.max(0, x)); })} />
        </View>
      ) : null}
      <Display cls="h-l">{t('sh_head', { p, s, n })}</Display>
      <FigRow p="assume" />
      {s ? (
        <KV k={t('gap_lbl')}>
          <Fig value={rm(Math.max(...rows.map(r => r.gap), 0))} p="calc" />
        </KV>
      ) : null}
      <Waterline rows={rows} cost={cost} lineLabel prov="assume" monthName={monthName} />
      <BodyS muted>{t('sh_note')}</BodyS>
    </ScreenShell>
  );
}



----

test

import React from 'react';
import { createHousingScenario, runHousingTest, runPreHousingCheck, updateHousingScenario } from '../../../services/housingService';
import {
  getHousingScenarioId, getHousingTestResult, getPreHousingResult,
  setHousingScenarioId, setHousingTestResult, setPreHousingResult,
} from '../../../services/housingSession';
import { Text, View } from 'react-native';
import { useApp } from '../state';
import {
  currentInstalment, monthsAgg, nf, rm, slowUnseen, testRows, totalHomeCost,
} from '../calc';
import {
  BodyS, Btn, BtnLine, BtnQuiet, Card, Chip, Chips, Display, Divider, EditList,
  Fig, FigRow, IcLab, KV, NoteC, NumInput, P, Prov,
} from '../ui';
import { C, DISP_FONT } from '../theme';
import { Band, Waterline } from '../charts';
import { ScreenShell } from './shell';

export function HouseScreen() {
  const { S, t, up, go, toast } = useApp();
  const [saving, setSaving] = React.useState(false);
  const h = S.data.house;
  const inst = currentInstalment(S.data);
  const known = h.knownPayment != null;
  return (
    <ScreenShell back title={t('th_title')}>
      {!known ? (
        <>
          <Card gap={8}>
            <View style={{ gap: 6 }}>
              <BodyS muted>{t('th_price')}</BodyS>
              <NumInput value={h.price} onNum={n => up(s => { s.data.house.price = n; })} />
            </View>
            <View style={{ gap: 6 }}>
              <BodyS muted>{t('th_dep')}</BodyS>
              <NumInput value={h.deposit} onNum={n => up(s => { s.data.house.deposit = Math.max(0, n); })} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <BodyS muted>{t('th_dep0')}</BodyS>
              <Prov p="official" />
            </View>
            <KV k={t('th_fin')}><Fig value={rm(Math.max(0, h.price - h.deposit))} p="calc" /></KV>
            <View style={{ gap: 6 }}>
              <BodyS muted>{t('th_rate')}</BodyS>
              <NumInput decimal value={h.rate} onNum={n => up(s => { s.data.house.rate = n; })} />
            </View>
            <View style={{ gap: 6 }}>
              <BodyS muted>{t('th_ten')}</BodyS>
              <NumInput value={h.years} onNum={n => up(s => { s.data.house.years = n || 1; })} />
            </View>
          </Card>
          <KV k={t('th_inst')}><Fig value={rm(inst)} p="calc" cls="h-l" /></KV>
          <BtnLine label={t('th_known')} onPress={() => up(s => {
            s.data.house.knownPayment = Math.round(currentInstalment(s.data));
          })} />
        </>
      ) : (
        <>
          <Card gap={8}>
            <View style={{ gap: 6 }}>
              <BodyS muted>{t('th_knownamt')}</BodyS>
              <NumInput value={+(h.knownPayment || 0)} onNum={n => up(s => { s.data.house.knownPayment = n; })} />
            </View>
            <FigRow p="user" />
          </Card>
          <BtnLine label={t('cancel')} onPress={() => up(s => { s.data.house.knownPayment = null; })} />
        </>
      )}
      <Btn label={t('th_next') + ' →'} onPress={() => {
        if (saving) return;
        setSaving(true);
        void createHousingScenario(S.data)
          .then(result => {
            setHousingScenarioId(result.id);
            setPreHousingResult(null);
            go('homecost');
          })
          .catch(() => toast('Could not save the housing scenario. Check that the Django backend is running.'))
          .finally(() => setSaving(false));
      }} />
    </ScreenShell>
  );
}

export function HomecostScreen() {
  const { S, t, up, go, toast } = useApp();
  const [checking, setChecking] = React.useState(false);
  const inst = currentInstalment(S.data);
  const total = totalHomeCost(S.data);
  return (
    <ScreenShell back title={t('tc_title')}>
      <Fig value={rm(total)} p="calc" cls="h-xl" />
      <BodyS muted>{t('tc_point')}</BodyS>
      <BtnQuiet arrow={false} onPress={() => up(s => { s.tcOpen = !s.tcOpen; })}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <P>{t('tc_break')}</P>
          <Text style={{ fontSize: 16, color: C.ink }}>{S.tcOpen ? '−' : '+'}</Text>
        </View>
      </BtnQuiet>
      {S.tcOpen ? (
        <Card gap={8}>
          <KV k={t('tc_inst')}>
            <Fig value={rm(inst)} p={S.data.house.knownPayment != null ? 'user' : 'calc'} />
          </KV>
          <EditList
            list={S.data.homeCosts.map(c => ({ ...c, p: 'assume' }))}
            onNum={(i, n) => up(s => { s.data.homeCosts[i].a = n; })}
          />
        </Card>
      ) : null}
      <Btn label={t('tc_run') + ' →'} onPress={() => {
        if (checking) return;
        setChecking(true);
        void (async () => {
          try {
            let scenarioId = getHousingScenarioId();
            if (scenarioId == null) {
              const created = await createHousingScenario(S.data);
              scenarioId = created.id;
              setHousingScenarioId(created.id);
            }
            await updateHousingScenario(scenarioId, S.data);
            const result = await runPreHousingCheck(S.data);
            setPreHousingResult(result);

            // Always calculate the historical housing result so the backend can
            // distinguish existing versus housing-induced shortfalls. The visible
            // flow still follows the original HTML: existing shortfall ->
            // "Before the house" first; otherwise -> Result.
            const housingResult = await runHousingTest(scenarioId, S.data);
            setHousingTestResult(housingResult);
            up(state => {
              state.testRan = true;
              state.howOpen = false;
              state.rgHowOpen = false;
            });

            if (result.has_existing_shortfall) {
              go('precheck');
              return;
            }

            go('result');
          } catch {
            toast('Could not run the housing check. Check that the Django backend is running.');
          } finally {
            setChecking(false);
          }
        })();
      }} />
    </ScreenShell>
  );
}

export function PrecheckScreen() {
  const { t, monthName, goTab, up } = useApp();
  const result = getPreHousingResult();
  React.useEffect(() => {
    up(state => { state.stack = ['house']; });
  }, [up]);
  const worst = result?.worst_month;
  const monthIndex = worst ? worst.month - 1 : 0;
  const gap = result?.largest_existing_gap || 0;
  return (
    <ScreenShell back title={t('pc_title')}>
      <Display cls="h-l">{t('pc_msg', { m: monthName(monthIndex), x: nf(gap) })}</Display>
      <FigRow p="calc" />
      <BodyS muted>{t('pc_msg2')}</BodyS>
      <Btn label={t('pc_btn')} onPress={() => goTab('money')} />
    </ScreenShell>
  );
}

export function ResultScreen() {
  const { S, t, monthName, up, go, toast } = useApp();
  React.useEffect(() => {
    up(state => { state.stack = ['house']; });
  }, [up]);

  const result = getHousingTestResult();
  if (!result) return <ScreenShell back title={t('rs_title')} />;

  const cost = result.tested_home_cost;
  const rows = result.months.map(r => ({
    m: r.month - 1,
    surplus: r.available_for_home,
    short: r.is_short,
    gap: r.total_shortfall,
  }));
  const n = result.tested_months;
  const s = result.short_month_count;
  const g = result.largest_gap;
  const un = slowUnseen(S.data, S.coverage);

  let lead: React.ReactNode;
  const headline = s ? t('headline', { s, n }) : t('headline_zero', { n });
  if (un.length) {
    lead = (
      <>
        <NoteC><Display cls="h-l">{t('rs_limit_slow', { m: un.map(monthName).join(', ') })}</Display></NoteC>
        <Display cls="h-m">{headline}</Display>
        <FigRow p="calc" />
      </>
    );
  } else if (n < 4) {
    lead = (
      <>
        <NoteC><Display cls="h-l">{t('rs_limit_thin', { n })}</Display></NoteC>
        <Display cls="h-m">{headline}</Display>
        <FigRow p="calc" />
      </>
    );
  } else {
    lead = (
      <>
        <Display cls="h-xl">{headline}</Display>
        <FigRow p="calc" />
      </>
    );
  }

  return (
    <ScreenShell back title={t('rs_title')}>
      {lead}
      {s ? <KV k={t('gap_lbl')}><Fig value={rm(g)} p="calc" /></KV> : null}
      <Waterline rows={rows} cost={cost} lineLabel prov="calc" monthName={monthName} />
      <BtnLine label={t('rs_how')} onPress={() => up(x2 => { x2.howOpen = !x2.howOpen; })} />
      {S.howOpen ? <Card><BodyS>{t('rs_how_body', { c: nf(cost) })}</BodyS></Card> : null}
      <BtnLine label={t('rs_keep')} onPress={() => {
        up(x2 => {
          x2.keptTests.push({
            pay: Math.round(cost),
            s,
            n,
            g: Math.round(g),
          });
        });
        toast(t('rs_kept'));
      }} />
      <View style={{ gap: 8 }}>
        <BtnQuiet onPress={() => go('range')}><IcLab name="band"><P>{t('rs_range')}</P></IcLab></BtnQuiet>
        <BtnQuiet onPress={() => go('compare')}><IcLab name="columns"><P>{t('rs_compare')}</P></IcLab></BtnQuiet>
        <BtnQuiet onPress={() => go('shock')}><IcLab name="trend"><P>{t('rs_shock')}</P></IcLab></BtnQuiet>
      </View>
    </ScreenShell>
  );
}

export function RangeScreen() {
  const { S, t, up } = useApp();
  const result = getHousingTestResult();
  const cr = result?.carrying_range;
  if (!cr) return <ScreenShell back title={t('rs_range')} />;

  const h = S.data.house;
  const loValue = cr.lower_monthly_amount;
  const hiValue = cr.upper_monthly_amount;
  const you = cr.tested_monthly_home_cost;
  const lo = loValue * 0.8;
  const hiS = Math.max(hiValue, you, loValue + 1) * 1.15;
  const pos = (v: number) => Math.min(100, Math.max(0, (v - lo) / (hiS - lo) * 100));

  return (
    <ScreenShell back title={t('rs_range')}>
      <Display cls="h-l">{t('rg_lead', { a: nf(loValue), b: nf(hiValue) })}</Display>
      <FigRow p="calc" />
      <Band
        loPct={pos(loValue)} hiPct={pos(hiValue)} pinPct={pos(you)}
        pinTop={rm(you)} pinBottom={t('rg_pin')} prov="calc"
      />
      <BtnLine label={t('rg_how')} onPress={() => up(s => { s.rgHowOpen = !s.rgHowOpen; })} />
      {S.rgHowOpen ? (
        <Card>
          <BodyS>{t('rg_how_body', { a: nf(loValue), b: nf(hiValue) })}</BodyS>
        </Card>
      ) : null}
      <Divider />
      <P>{t('rg_price', {
        r: h.rate,
        y: h.years,
        p: nf(cr.indicative_property_price_lower),
        q: nf(cr.indicative_property_price_upper),
      })}</P>
      <FigRow p="assume" />
      <BodyS muted>{cr.property_price_limitation || t('rg_ind')}</BodyS>
    </ScreenShell>
  );
}

export function CompareScreen() {
  const { S, t, monthName, up } = useApp();
  const n = monthsAgg(S.data).length;
  return (
    <ScreenShell back title={t('rs_compare')}>
      <BodyS muted>{t('cp_note')}</BodyS>
      {S.data.comparePayments.map((p, i) => {
        const rows = testRows(S.data, p);
        const s = rows.filter(r => r.short).length;
        const g = Math.max(...rows.map(r => r.gap), 0);
        return (
          <Card key={i} gap={8}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <NumInput
                value={p} style={{ width: 118 }}
                onNum={x => up(st => { st.data.comparePayments[i] = Math.max(0, x); })}
              />
              <View style={{ alignItems: 'flex-end', gap: 2, flexShrink: 1 }}>
                <Text style={{ fontSize: 13, lineHeight: 18, color: C.ink, fontWeight: '700' }}>
                  {t('cp_short', { s, n })}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <BodyS muted>{t('cp_gap', { g: nf(g) })}</BodyS>
                  <Prov p="calc" />
                </View>
              </View>
            </View>
            <Waterline rows={rows} cost={p} small monthName={monthName} />
          </Card>
        );
      })}
    </ScreenShell>
  );
}

export function ShockScreen() {
  const { S, t, monthName, up } = useApp();
  const cost = totalHomeCost(S.data);
  const p = S.shock;
  const rows = testRows(S.data, cost, p);
  const n = rows.length, s = rows.filter(r => r.short).length;
  const preset = [0, 10, 20].includes(p);
  const showCustom = !preset || S.sheet === 'shockcustom';
  return (
    <ScreenShell back title={t('rs_shock')}>
      <Chips>
        {[0, 10, 20].map(v => (
          <Chip key={v} label={v === 0 ? '0%' : `−${v}%`} on={p === v}
            onPress={() => up(x => { x.shock = v; x.sheet = null; })} />
        ))}
        <Chip label={t('sh_custom')} on={!preset}
          onPress={() => up(x => { x.sheet = 'shockcustom'; })} />
      </Chips>
      {showCustom ? (
        <View style={{ gap: 6 }}>
          <BodyS muted>{t('sh_pct')}</BodyS>
          <NumInput value={p} onNum={x => up(st => { st.shock = Math.min(90, Math.max(0, x)); })} />
        </View>
      ) : null}
      <Display cls="h-l">{t('sh_head', { p, s, n })}</Display>
      <FigRow p="assume" />
      {s ? (
        <KV k={t('gap_lbl')}>
          <Fig value={rm(Math.max(...rows.map(r => r.gap), 0))} p="calc" />
        </KV>
      ) : null}
      <Waterline rows={rows} cost={cost} lineLabel prov="assume" monthName={monthName} />
      <BodyS muted>{t('sh_note')}</BodyS>
    </ScreenShell>
  );
}
