import { AppData } from './mock';

/* Derived calculations — ported verbatim from the prototype. All pure functions over the data. */

export interface MonthRow { y: number; m: number; gross: number; net: number; surplus: number }

// EN: US8.1 uses this small return type so the Your Record screen can receive
// one focused summary object instead of reading several unrelated calculation
// structures. The fields are exactly the three pieces of record-summary UI:
// distinct recorded months, counted financial entries, and the latest business date.
// 中文：US8.1 使用这个精简返回类型，让“记录档案”页面接收一个专门的摘要对象，
// 而不是读取多个无关的计算结构。这里的三个字段正好对应 UI 中的三项记录摘要：
// 去重后的记录月份数、财务记录条数、以及最新业务日期。
export interface RecordSummary {
  recordedMonthCount: number;
  entryCount: number;
  latestEntryDate: string | null;
}

export const EXP_FULL_DAYS = 20;

/* v22 formats: whole ringgit everywhere; expenses (rmx) keep sen only when present. */
export function nf(v: number): string {
  const n = Math.round((Number(v) || 0) * 100) / 100;

  return n.toLocaleString('en-MY', {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export function rm(v: number): string {
  return 'RM ' + nf(v);
}

export function rmx(v: number): string {
  const r = Math.round((Number(v) || 0) * 100) / 100;
  return Number.isInteger(r) ? rm(r) : 'RM ' + r.toFixed(2);
}

export function workCostTotal(data: AppData): number {
  return data.workCostEntries.reduce((a, c) => a + (+c.a || 0), 0);
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
  const workCostsByMonth = new Map<number, number>();
  for (const entry of data.workCostEntries) {
    const key = datedMonthKey(entry.d);
    if (key == null) continue;
    workCostsByMonth.set(key, (workCostsByMonth.get(key) || 0) + (+entry.a || 0));
  }
  return [...map.values()].sort((a, b) => (a.y * 12 + a.m) - (b.y * 12 + b.m))
    .map(r => {
      const workCosts = workCostsByMonth.get(r.y * 12 + r.m) || 0;
      return { ...r, net: r.gross - workCosts, surplus: r.gross - workCosts - commitFor(data, r.y * 12 + r.m) };
    });
}

// EN: Convert an ISO business date such as "2026-08-25" into one sortable month
// key. The regex requires a full YYYY-MM-DD date, then captures year and month.
// Returning null lets callers ignore invalid/undated values without inventing a
// month. This helper intentionally works from user-facing financial dates, not
// database created_at or updated_at timestamps.
// 中文：把类似 “2026-08-25” 的 ISO 业务日期转换成可排序的月份 key。正则要求完整的
// YYYY-MM-DD 日期，并抓取年份和月份。返回 null 可以让调用方跳过无效或无日期的值，
// 不会凭空生成月份。这个 helper 故意使用用户财务记录日期，而不是数据库 created_at
// 或 updated_at 时间戳。
function datedMonthKey(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(value);
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return Number(match[1]) * 12 + month - 1;
}

// EN: US8.1 restores the Iteration 1 record boundary: Your Record summarises
// dated income and expense entries only. Work costs, commitments, FinancialPeriod
// rows, and calculated values stay outside these Epic 8 summary metrics.
// 中文：US8.1 恢复 Iteration 1 的记录边界：“记录档案”只汇总带日期的收入和支出记录。
// 工作成本、固定支出、FinancialPeriod 行和计算值都不计入这些 Epic 8 摘要指标。
export function recordSummary(data: AppData): RecordSummary {
  // EN: Set deduplicates month keys automatically. If the user records several
  // income or expense entries in the same calendar month, that month contributes
  // one recorded month to US8.1, not one month per entry.
  // 中文：Set 会自动去重月份 key。如果用户在同一个日历月录入多笔收入或支出，
  // 这个月对 US8.1 只贡献一个“已记录月份”，而不是每笔记录都算一个月。
  const months = new Set<number>();

  // EN: null is the empty-state value. When no dated income or expense entry has
  // been seen, the UI can show "No dated income or expense entries yet" instead
  // of displaying a misleading latest date.
  // 中文：null 表示空状态。当还没有任何带日期的收入或支出时，UI 可以显示
  // “还没有带日期的收入或支出记录”，而不是显示误导性的最近日期。
  let latestEntryDate: string | null = null;

  // EN: Arrow function helper shared by the income and expense loops. Because
  // dates are stored as ISO strings (YYYY-MM-DD), lexical string comparison
  // correctly finds the latest business date after invalid dates are ignored.
  // 中文：这是收入和支出循环共用的箭头函数 helper。因为日期以 ISO 字符串
  //（YYYY-MM-DD）存储，在跳过无效日期后，直接用字符串比较就能正确找到最新业务日期。
  const addDate = (date: string) => {
    const key = datedMonthKey(date);
    if (key == null) return;
    months.add(key);
    if (latestEntryDate == null || date > latestEntryDate) latestEntryDate = date;
  };

  // EN: forEach applies the same date handling to every saved income and expense
  // entry. This keeps the result independent of array order and avoids duplicating
  // the month/latest-date logic in two places.
  // 中文：forEach 会对每一笔已保存的收入和支出应用同一套日期处理逻辑。这样结果不依赖
  // 数组顺序，也避免在两个地方重复写月份和最近日期逻辑。
  data.income.forEach(entry => addDate(entry.d));
  data.expenses.forEach(entry => addDate(entry.d));

  // EN: entryCount deliberately follows the same boundary: saved income entries
  // plus saved expense entries, including multiple entries in the same month.
  // 中文：entryCount 也遵循同一边界：已保存收入记录数 + 已保存支出记录数；
  // 同一个月里的多笔记录仍分别计数。
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

/* v24 month filter: every month with an entry, newest first. */
export function monthKeysOf(arrs: { d: string }[][]): number[] {
  const set = new Set<number>();
  for (const a of arrs) for (const e of a) set.add((+e.d.slice(0, 4)) * 12 + (+e.d.slice(5, 7) - 1));
  return [...set].sort((a, b) => b - a);
}

export function pickMonth(sel: number | null, arrs: { d: string }[][]): { key: number | null; keys: number[] } {
  const ks = monthKeysOf(arrs);
  if (!ks.length) return { key: null, keys: ks };
  return { key: (sel != null && ks.includes(sel)) ? sel : ks[0], keys: ks };
}
