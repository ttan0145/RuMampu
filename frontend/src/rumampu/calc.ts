import { AppData } from './mock';

/* Derived calculations — ported verbatim from the prototype. All pure functions over the data. */

export interface CoverageState { answer: 'yes' | 'no' | 'notsure' | null; slow: number[] }

export interface MonthRow { y: number; m: number; gross: number; net: number; surplus: number }
export interface TestRow extends MonthRow { short: boolean; gap: number }

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

export function actualMonths(data: AppData): MonthRow[] {
  const em = expByMonth(data);
  return monthsAgg(data).filter(r => { const e = em.get(r.y * 12 + r.m); return e && e.days.size >= EXP_FULL_DAYS; });
}

export function instalment(P: number, rate: number, years: number): number {
  if (P <= 0) return 0;
  const r = rate / 1200, n = years * 12;
  if (r === 0) return P / n;
  return P * r / (1 - Math.pow(1 + r, -n));
}

export function extrasTotal(data: AppData): number {
  return data.homeCosts.reduce((a, c) => a + (+c.a || 0), 0);
}

export function currentInstalment(data: AppData): number {
  const h = data.house;
  if (h.knownPayment != null) return +h.knownPayment;
  return instalment(Math.max(0, h.price - h.deposit), h.rate, h.years);
}

export function totalHomeCost(data: AppData): number {
  return currentInstalment(data) + extrasTotal(data);
}

export function priceForInstalment(data: AppData, M: number): number {
  const h = data.house, r = h.rate / 1200, n = h.years * 12;
  if (M <= 0) return 0;
  if (r === 0) return M * n;
  return M * (1 - Math.pow(1 + r, -n)) / r;
}

export function testRows(data: AppData, cost: number, shockPct?: number): TestRow[] {
  const f = 1 - (shockPct || 0) / 100;
  return monthsAgg(data).map(r => {
    const surplus = (r.net * f) - commitFor(data, r.y * 12 + r.m);
    return { ...r, surplus, short: surplus < cost, gap: Math.max(0, cost - surplus) };
  });
}

export function carryRange(data: AppData): { lo: number; hi: number } | null {
  const s = monthsAgg(data).map(r => r.surplus).sort((a, b) => a - b);
  if (!s.length) return null;
  const lo = s[0];
  const hi = (s.length % 2) ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  return { lo, hi };
}

export function bufferNeed(data: AppData, cost: number): { need: number; rows: { y: number; m: number; bal: number }[] } {
  let bal = 0, min = 0;
  const rows = monthsAgg(data).map(r => {
    bal += r.surplus - cost; if (bal < min) min = bal;
    return { y: r.y, m: r.m, bal };
  });
  return { need: Math.max(0, -min), rows };
}

export function recSpan(data: AppData): { from: MonthRow; to: MonthRow; list: MonthRow[] } | null {
  const a = monthsAgg(data);
  if (!a.length) return null;
  return { from: a[0], to: a[a.length - 1], list: a };
}

export function slowUnseen(data: AppData, coverage: CoverageState): number[] {
  const sp = recSpan(data);
  if (!sp || coverage.answer !== 'yes' || !coverage.slow.length) return [];
  const seen = new Set(sp.list.map(r => r.m));
  return coverage.slow.filter(m => !seen.has(m));
}

export function upfrontNeed(data: AppData): number {
  return data.house.deposit + data.upfront.reduce((a, c) => a + (+c.a || 0), 0);
}

export function preHousingOk(data: AppData): boolean {
  const rows = testRows(data, 0);
  return rows.length > 0 && Math.min(...rows.map(r => r.surplus)) >= 0;
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
