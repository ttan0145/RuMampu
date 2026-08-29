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

// EN: US8.1 record summary for Iteration 1. It counts only user-provided dated
// income and expense entries because those are the current model's financial
// records with business dates. Work costs and commitments are excluded because
// they are recurring monthly items, not dated entries. Calculated values and
// FinancialPeriod rows are also excluded because they are derived/supporting data.
// 中文：US8.1 在 Iteration 1 的记录摘要逻辑。这里只统计用户输入且带业务日期的收入和支出，
// 因为它们才是当前模型中的带日期财务记录。Work costs 和 commitments 是重复性的月度项目，
// 不是带日期的记录，所以排除。计算结果和 FinancialPeriod 行属于派生/辅助数据，也不计入。
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

  // EN: Arrow function helper shared by income and expense loops. Because dates
  // are stored as ISO strings (YYYY-MM-DD), lexical string comparison correctly
  // finds the latest business date after invalid dates are ignored.
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

  // EN: entryCount is deliberately simple: saved income entries plus saved
  // expense entries. The returned object is the complete US8.1 summary contract
  // consumed by Your Record.
  // 中文：entryCount 故意保持简单：已保存收入记录数 + 已保存支出记录数。返回对象就是
  // “记录档案”页面消费的完整 US8.1 摘要契约。
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
