import { AppData } from './mock';

/* Derived calculations — ported verbatim from the prototype. All pure functions over the data. */

export interface MonthRow { y: number; m: number; gross: number; net: number; surplus: number }
export interface RecordSummary {
  recordedMonthCount: number;
  entryCount: number;
  latestEntryDate: string | null;
}

export const EXP_FULL_DAYS = 20;

export function nf(v: number): string { return Math.round(v).toLocaleString('en-MY') }
export function rm(v: number): string { return 'RM ' + nf(v) }
export function rmx(v: number): string {
  const r = Math.round(v * 100) / 100;
  return Number.isInteger(r) ? rm(r) : 'RM ' + r.toFixed(2);
}

export function workCostTotal(data: AppData): number {
  return data.workCosts.reduce((a, c) => a + (+c.a || 0), 0);
}

export interface ExpMonth { total: number; days: Set<string> }
export function expByMonth(data: AppData): Map<number, ExpMonth> {
  const map = new Map<number, ExpMonth>();
  for (const e of data.expenses) {
    const key = (+e.d.slice(0, 4)) * 12 + (+e.d.slice(5, 7) - 1);
    if (!map.has(key)) map.set(key, { total: 0, days: new Set() });
    const r = map.get(key)!; r.total += (+e.a || 0); r.days.add(e.d);
  }
  return map;
}

export function commitDaily(data: AppData): number {
  const c = data.commitments;
  return [...c.living, ...c.debts, ...c.savings].filter(x => x.dv).reduce((a, x) => a + (+x.a || 0), 0);
}

export function commitTotal(data: AppData): number {
  const c = data.commitments;
  return [...c.living, ...c.debts, ...c.savings].reduce((a, x) => a + (+x.a || 0), 0);
}

export function commitFor(data: AppData, key: number): number {
  const e = expByMonth(data).get(key);
  if (e && e.days.size >= EXP_FULL_DAYS) return commitTotal(data) - commitDaily(data) + e.total;
  return commitTotal(data);
}

export function monthsAgg(data: AppData): MonthRow[] {
  const map = new Map<number, { y: number; m: number; gross: number }>();
  for (const e of data.income) {
    const y = +e.d.slice(0, 4), m = +e.d.slice(5, 7) - 1;
    const key = y * 12 + m;
    if (!map.has(key)) map.set(key, { y, m, gross: 0 });
    map.get(key)!.gross += (+e.a || 0);
  }
  const wc = workCostTotal(data);
  return [...map.values()].sort((a, b) => (a.y * 12 + a.m) - (b.y * 12 + b.m))
    .map(r => ({ ...r, net: r.gross - wc, surplus: r.gross - wc - commitFor(data, r.y * 12 + r.m) }));
}

function datedMonthKey(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(value);
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return Number(match[1]) * 12 + month - 1;
}

export function recordSummary(data: AppData): RecordSummary {
  const months = new Set<number>();
  let latestEntryDate: string | null = null;
  const addDate = (date: string) => {
    const key = datedMonthKey(date);
    if (key == null) return;
    months.add(key);
    if (latestEntryDate == null || date > latestEntryDate) latestEntryDate = date;
  };
  data.income.forEach(entry => addDate(entry.d));
  data.expenses.forEach(entry => addDate(entry.d));
  return {
    recordedMonthCount: months.size,
    entryCount: data.income.length + data.expenses.length,
    latestEntryDate,
  };
}

export function actualMonths(data: AppData): MonthRow[] {
  const em = expByMonth(data);
  return monthsAgg(data).filter(r => { const e = em.get(r.y * 12 + r.m); return e && e.days.size >= EXP_FULL_DAYS; });
}

export function recSpan(data: AppData): { from: MonthRow; to: MonthRow; list: MonthRow[] } | null {
  const a = monthsAgg(data);
  if (!a.length) return null;
  return { from: a[0], to: a[a.length - 1], list: a };
}

export function latestExpMonth(data: AppData): number | null {
  const keys = [...expByMonth(data).keys()];
  if (!keys.length) return null;
  return Math.max(...keys);
}

export function expCatTotals(data: AppData, key: number): Map<string, number> {
  const totals = new Map<string, number>();
  for (const e of data.expenses) {
    const k = (+e.d.slice(0, 4)) * 12 + (+e.d.slice(5, 7) - 1);
    if (k !== key) continue;
    totals.set(e.c, (totals.get(e.c) || 0) + (+e.a || 0));
  }
  return totals;
}
