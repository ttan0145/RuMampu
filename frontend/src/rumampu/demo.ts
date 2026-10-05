import { AppData, MOCK } from './mock';

/* v27b Sample months. Someone new can look around with an example record
   before starting their own. The months follow the calendar: the last sample
   month is always last month, so nothing reads as months-old data. Sample
   months live only in this session; they are never saved, never synced to an
   account, and the person's own record is put back the moment they leave. */

function shiftIso(iso: string, months: number): string {
  const y = +iso.slice(0, 4), m = +iso.slice(5, 7) - 1, d = +iso.slice(8, 10);
  const key = y * 12 + m + months;
  const ny = Math.floor(key / 12), nm = key % 12;
  const last = new Date(ny, nm + 1, 0).getDate();
  return `${ny}-${String(nm + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

export function sampleData(own: AppData): AppData {
  const data: AppData = JSON.parse(JSON.stringify(MOCK));
  const keyOf = (iso: string) => (+iso.slice(0, 4)) * 12 + (+iso.slice(5, 7) - 1);
  const lastSample = Math.max(...data.income.map(e => keyOf(e.d)));
  const now = new Date();
  const lastMonth = now.getFullYear() * 12 + now.getMonth() - 1;
  const by = lastMonth - lastSample;
  data.income = data.income.map(e => ({ ...e, d: shiftIso(e.d, by) }));
  data.workCostEntries = data.workCostEntries.map(e => ({ ...e, d: shiftIso(e.d, by) }));
  data.expenses = data.expenses.map(e => ({ ...e, d: shiftIso(e.d, by) }));
  /* The home being looked at stays the person's own. */
  data.house = { ...own.house };
  data.homeCosts = JSON.parse(JSON.stringify(own.homeCosts));
  return data;
}
