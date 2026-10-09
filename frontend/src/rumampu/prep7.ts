import { Platform, Share } from 'react-native';
import { getHousingScenario, getHousingTestResult, setHousingScenario, setHousingTestResult } from '../../services/housingSession';
import type { HousingTestResult, StartingLiquidityResult } from '../../types/housing';
import type { AppState } from './state';
import { rm as rmSen } from './calc';

const rm = (v: number) => rmSen(Math.round(v));
import { upfrontFees, upfrontNeed } from './fees';
import { potNow } from './plan';

/* Prepare for a house (v7 design): the home every answer works from, the monthly
   loan the lesson walks through, and the three checks on the path. The home and
   its price come from the same source as the Upfront cash screen (ufSource), so
   both screens always talk about one home. */

export { DOC_KEYS, PREP_DEFAULT, validPrep } from './prep7state';
export type { PrepState } from './prep7state';
import { DOC_KEYS } from './prep7state';

export const pmt = (L: number, ratePct: number, yrs: number): number => {
  const r = ratePct / 100 / 12, n = Math.max(1, yrs * 12);
  return r ? L * r / (1 - Math.pow(1 + r, -n)) : L / n;
};

export interface Loan {
  name: string | null; price: number; L: number; dep: number; mo: number; rate: number; yrs: number; m: number;
  total: number; interest: number; maxYrs: number;
}

/* AC10.12.2: choosing a kept test under Upfront cash points the whole saving goal at it,
   the safety money as well as the upfront cash, the same way opening a saved test does */
export function goalFromKept(k: { result?: unknown; scenario?: unknown } | undefined): void {
  const r = k?.result as HousingTestResult | undefined;
  if (!r || typeof r !== 'object' || !('tested_home_cost' in r) || !('starting_liquidity' in r)) return;
  setHousingTestResult(r);
  const sc = k?.scenario;
  if (sc && typeof sc === 'object' && 'id' in sc) setHousingScenario(sc as Parameters<typeof setHousingScenario>[0]);
}

/* the house test behind the figures: the chosen saved test, else the current one */
export function prepResult(s: AppState): HousingTestResult | null {
  const k = s.ufTest != null ? s.keptTests[s.ufTest] : undefined;
  const r = k?.result as HousingTestResult | undefined;
  if (r && Array.isArray(r.months)) return r;
  return s.testRan ? getHousingTestResult() : null;
}

function baseTerms(s: AppState): { rate: number; years: number } {
  const k = s.ufTest != null ? s.keptTests[s.ufTest] : undefined;
  const sc = (k?.scenario ?? getHousingScenario()) as { financing_rate?: unknown; tenure_years?: unknown } | null;
  const rate = Number(sc?.financing_rate) > 0 ? Number(sc?.financing_rate) : (s.data.house.rate || 4.3);
  const years = Number(sc?.tenure_years) > 0 ? Number(sc?.tenure_years) : (s.data.house.years || 35);
  return { rate, years };
}

/* The loan at the lesson's what-ifs, or at given overrides. */
export function prepLoan(s: AppState, o: { rate?: number; years?: number; margin?: number } = {}): Loan {
  const src = upfrontFees(s).src;
  const base = baseTerms(s);
  const price = src.price;
  const testMargin = price > 0 ? Math.round((price - (src.dep || s.data.house.deposit || price * 0.1)) / price * 100) : 90;
  const m = o.margin ?? s.prep.margin ?? Math.min(100, Math.max(0, testMargin));
  const age = +s.prep.age || 0;
  const maxYrs = age ? Math.max(5, Math.min(35, 70 - age)) : 35;
  const yrs = Math.min(maxYrs, o.years ?? s.prep.years ?? base.years);
  const rate = o.rate ?? base.rate;
  const L = Math.round(price * m / 100), mo = pmt(L, rate, yrs), total = mo * yrs * 12;
  return { name: src.name ?? (src.saved ? null : s.prep.name || null), price, L, dep: price - L, mo, rate, yrs, m, total, interest: total - L, maxYrs };
}

/* True when the tested home has no deposit and the loan share falls back to the usual 10%. */
export function depositAssumed(s: AppState): boolean {
  const src = upfrontFees(s).src;
  return src.price > 0 && !src.typed && !(src.dep || s.data.house.deposit);
}

/* Where the loan terms come from (AC5.10.9): 'user' when the share, the rate and
   the years all come from the house test or from a choice made in this check;
   'assume' when any of them is a RuMampu starting point (the 10% deposit
   fallback, 4.3%, 35 years). A typed 4.3 cannot be told from the default, so a
   value equal to the default counts as assumed. */
export function termsProv(s: AppState): 'user' | 'assume' {
  const src = upfrontFees(s).src;
  const base = baseTerms(s);
  const share = s.prep.margin != null || !!(src.dep || s.data.house.deposit);
  const rate = base.rate !== 4.3;
  const years = s.prep.years != null || base.years !== 35;
  return share && rate && years ? 'user' : 'assume';
}

/* interest and principal in the payment after k months */
export function amort(c: Loan, k: number): { int: number; prin: number } {
  const r = c.rate / 100 / 12;
  const B = r ? c.L * Math.pow(1 + r, k) - c.mo * (Math.pow(1 + r, k) - 1) / r : c.L - c.mo * k;
  const int = Math.max(0, B * r);
  return { int, prin: c.mo - int };
}

/* The typical month after work costs: the middle of the tested months. */
export function typicalMonth(s: AppState): number | null {
  const r = prepResult(s);
  const v = (r?.months || []).map(m => Number(m.usable_income)).filter(x => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

export type Fit = 'ok' | 'warn' | 'bad';
export const fitOf = (share: number): Fit => (share <= 0.35 ? 'ok' : share <= 0.5 ? 'warn' : 'bad');

export function cushion(s: AppState): (StartingLiquidityResult & { covered: number; still: number }) | null {
  const liq = prepResult(s)?.starting_liquidity;
  if (!liq || !liq.months?.length) return null;
  const covered = Math.min(potNow(s).buf, liq.required_amount);
  return { ...liq, covered, still: Math.max(0, liq.required_amount - covered) };
}

export function monthlyBills(s: AppState, c: Loan): { k: 'inst' | 'maint' | 'quit' | 'fire'; a: number; guess: boolean }[] {
  const strata = s.prep.strata, d = { maint: 150, quit: strata ? 20 : 30, fire: strata ? 30 : 60 };
  const v = (k: 'maint' | 'quit' | 'fire') => ({ k, a: s.prep.mHome[k] ?? d[k], guess: s.prep.mHome[k] == null });
  return [{ k: 'inst' as const, a: c.mo, guess: false }, ...(strata ? [v('maint')] : []), v('quit'), v('fire')];
}

/* The three checks on the path. */
export function prepChecks(s: AppState) {
  const c = prepLoan(s);
  const need = upfrontNeed(s), have = potNow(s).up, gap = Math.max(0, need - have);
  const cashP = need > 0 ? Math.min(1, have / need) : 0;
  const dn = DOC_KEYS.filter(k => s.docsChecked.includes(k)).length;
  return {
    c, need, have, gap, cashP, dn,
    loan: { done: s.prep.saved, p: s.prep.saved ? 1 : s.prep.done ? 0.8 : 0 },
    cash: { done: need > 0 && gap === 0, p: cashP },
    docs: { done: dn === DOC_KEYS.length, p: dn / DOC_KEYS.length },
  };
}

/* Money due at each step of a subsale purchase. */
export function stageCash(s: AppState, c: Loan) {
  const f = upfrontFees(s);
  const earnestIn = +(s.data.upfront.find(x => x.id === 'earnest')?.a ?? 0) || 0;
  const earnest = earnestIn || Math.round(c.price * 0.02);
  const mrta = +(s.data.upfront.find(x => x.id === 'mrta')?.a ?? 0) || 0;
  return {
    book: earnest,
    spa: Math.max(0, c.dep - earnest) + f.spa + f.t,
    loan: f.loanLegal + f.l + f.val + mrta,
    /* the earnest deposit was typed on Upfront cash; otherwise 2% is RuMampu's assumption */
    bookTyped: earnestIn > 0,
  };
}

/* Schedule H stages, % of the price, kept with their sources in buying-facts.ts (AC5.11.4). */
export { SCHED } from './buying-facts';
import { SCHED } from './buying-facts';
export function schedRows(c: Loan) {
  const P = c.price;
  let cum = 0, youLeft = P - c.L;
  return SCHED.map(([code, desc, pct]) => {
    const billed = P * pct / 100, you = Math.min(youLeft, billed);
    youLeft -= you;
    const bank = billed - you;
    cum += bank;
    return { code, desc, pct, billed, you, bank, int: cum * c.rate / 100 / 12 };
  });
}

/* "Save my plan as PDF": the browser's print dialog on the web; elsewhere the
   same plan as text through the share sheet. */
export async function savePlan(s: AppState, t: (k: string, v?: Record<string, string | number>) => string): Promise<'printed' | 'shared' | 'none'> {
  const ck = prepChecks(s), c = ck.c, cu = cushion(s);
  const d = new Date().toLocaleDateString(s.lang === 'zh' ? 'zh-CN' : s.lang === 'ms' ? 'ms-MY' : 'en-MY', { day: 'numeric', month: 'long', year: 'numeric' });
  const rows: [string, string][] = [
    [t('p7_k_price'), rm(c.price)],
    [t('p7_k_loan'), `${rm(c.L)} (${c.m}%)`],
    [t('p7_k_rate'), t('p7_k_rate_v', { r: c.rate.toFixed(2) })],
    [t('p7_k_tenure'), t('p7_years', { n: c.yrs })],
    [t('p7_b_inst'), rm(c.mo)],
    [t('p7_k_int'), rm(c.interest)],
    [t('p7_pdf_up'), rm(ck.need)],
    ...(cu ? [[t('p7_pdf_buf'), rm(cu.required_amount)] as [string, string]] : []),
    ...DOC_KEYS.map(k => [t(k), s.docsChecked.includes(k) ? t('p7_pdf_ready') : t('p7_pdf_toget')] as [string, string]),
  ];
  const title = c.name || rm(c.price);
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const esc = (x: string) => x.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string));
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
      <style>body{font-family:system-ui,sans-serif;color:#253738;margin:32px;max-width:640px}h1{font-size:22px;margin:4px 0}
      .m{color:#5d6d6e;font-size:12px}table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px}
      td{padding:7px 4px;border-bottom:1px solid #dde4e3}td:last-child{text-align:right;font-weight:600}</style></head>
      <body><div class="m">${esc(t('p7_pdf_head'))}</div><h1>${esc(title)}</h1><div class="m">${esc(t('p7_pdf_prep', { d }))}</div>
      <table>${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>
      <p class="m" style="margin-top:18px">${esc(t('p7_disc'))}</p></body></html>`;
    const w = window.open('', '_blank');
    if (!w) return 'none';
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
    return 'printed';
  }
  await Share.share({ title, message: [t('p7_pdf_head'), title, ...rows.map(([k, v]) => `${k}: ${v}`), '', t('p7_disc')].join('\n') });
  return 'shared';
}
