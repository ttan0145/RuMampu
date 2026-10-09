/* Epic 7 month arithmetic, kept free of React so it can be unit-tested.
   Months are 'YYYY-MM' strings, which sort in calendar order. */

export function monthOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function isMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** Every month from `from` to `to`, both included; empty if either is invalid or from > to. */
export function monthsBetween(from: string, to: string): string[] {
  if (!isMonth(from) || !isMonth(to) || from > to) return [];
  const out: string[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  for (;;) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    if (key > to) break;
    out.push(key);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

/** AC 7.1.7 / 7.2.1: every month that can be recorded since buying, newest first. */
export function postPurchaseMonths(purchaseMonth: string, now: Date): string[] {
  return monthsBetween(purchaseMonth, monthOf(now)).reverse();
}

/** AC 7.3.5: completed months since buying that have no actual home costs yet, oldest first. */
export function unrecordedCompletedMonths(purchaseMonth: string, recordedMonths: string[], now: Date): string[] {
  const current = monthOf(now);
  const recorded = new Set(recordedMonths);
  return monthsBetween(purchaseMonth, current).filter(month => month < current && !recorded.has(month));
}

/** How many months of the earlier test fall on or after the purchase month. */
export function testedMonthsAfterPurchase(testedMonths: string[], purchaseMonth: string): number {
  if (!isMonth(purchaseMonth)) return 0;
  return testedMonths.filter(month => month >= purchaseMonth).length;
}

/** How many months since buying have ended, so the recorded ones can be shown against them. */
export function completedMonthsSincePurchase(purchaseMonth: string, now: Date): number {
  const current = monthOf(now);
  return monthsBetween(purchaseMonth, current).filter(month => month < current).length;
}
