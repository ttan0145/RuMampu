import { AppState } from './state';

/* v24 upfront fee engine — every scale is a published figure, ported verbatim
   from the prototype (rumampu24), sources noted per function. */

/* Stamp Act 1949 (Act 378), First Schedule item 32(a): 1% / 2% / 3% / 4%
   bands, on every RM100 or fractional part. */
export function stampDutyTransfer(price: number): number {
  price = Math.max(0, +price || 0);
  if (!price) return 0;
  const unit = (x: number) => Math.ceil(x / 100);
  let duty = unit(Math.min(price, 100000)) * 1;
  if (price > 100000) duty += unit(Math.min(price, 500000) - 100000) * 2;
  if (price > 500000) duty += unit(Math.min(price, 1000000) - 500000) * 3;
  if (price > 1000000) duty += unit(price - 1000000) * 4;
  return duty;
}

/* Stamp Act item 27(a): RM5.00 for each RM1,000 or part thereof financed. */
export function stampDutyLoan(loan: number): number {
  loan = Math.max(0, +loan || 0);
  if (!loan) return 0;
  return Math.ceil(loan / 1000) * 5;
}

/* Solicitors' Remuneration Order 2023, P.U. (A) 207/2023, Tables A: first
   RM500,000 at 1.25% (minimum RM500), the rest taken at 1%. */
export function legalFee(v: number): number {
  v = Math.max(0, +v || 0);
  if (!v) return 0;
  let f = Math.min(v, 500000) * 0.0125;
  if (v > 500000) f += (v - 500000) * 0.01;
  return Math.max(500, Math.round(f));
}

/* Board of Valuers fee scale (Rule 48, item 3): 1/4% first RM100k, 1/5% to
   RM2m, 1/6% to RM7m, minimum RM400. */
export function valuationFee(v: number): number {
  v = Math.max(0, +v || 0);
  if (!v) return 0;
  let f = Math.min(v, 100000) * 0.0025;
  if (v > 100000) f += (Math.min(v, 2000000) - 100000) * 0.002;
  if (v > 2000000) f += (Math.min(v, 7000000) - 2000000) / 600;
  return Math.max(400, Math.round(f));
}

export interface UfSource { name: string | null; price: number; dep: number; saved: boolean }

/* Which price the upfront figures work from: the chosen saved test, else the
   price on the house screen. */
export function ufSource(s: AppState): UfSource {
  const k = s.ufTest != null && s.keptTests[s.ufTest] ? s.keptTests[s.ufTest] : null;
  const kPrice = k?.propertyPrice == null ? 0 : Number(k.propertyPrice) || 0;
  if (k && kPrice) {
    return { name: k.name ?? null, price: kPrice, dep: Number(k.scenario?.deposit) || 0, saved: true };
  }
  const h = s.data.house;
  if (h.knownPayment == null && (h.price ?? 0) > 0) {
    return { name: null, price: +(h.price ?? 0), dep: +h.deposit || 0, saved: false };
  }
  return { name: k?.name ?? null, price: 0, dep: 0, saved: !!k };
}

/* Stamp Duty (Exemption) Orders P.U.(A) 53/2021 and 54/2021, as amended:
   first home, RM500,000 or less, SPA dated 2021-2027. The scales above stay
   untouched; the exemption zeroes their result. */
export function ufExempt(s: AppState, price: number): boolean {
  return !!s.firstHome && price > 0 && price <= 500000;
}

export interface UpfrontFees {
  src: UfSource;
  t: number; l: number; t0: number; l0: number; exempt: boolean;
  spa: number; loanLegal: number; val: number;
}

export function upfrontFees(s: AppState): UpfrontFees {
  const src = ufSource(s);
  const loan = Math.max(0, src.price - src.dep);
  const t0 = stampDutyTransfer(src.price);
  const l0 = stampDutyLoan(loan);
  const exempt = ufExempt(s, src.price);
  return {
    src, t0, l0, exempt,
    t: exempt ? 0 : t0,
    l: exempt ? 0 : l0,
    spa: legalFee(src.price),
    loanLegal: legalFee(loan),
    val: valuationFee(src.price),
  };
}

function ufItem(s: AppState, id: string): { a: number } {
  return s.data.upfront.find(x => x.id === id) || { a: 0 };
}

/* Everything paid before moving in. The earnest deposit is part of the
   deposit, so it is never added on top; renovation counts only while its
   switch is on. */
export function upfrontNeed(s: AppState): number {
  const f = upfrontFees(s);
  const moveIn = s.data.upfront
    .filter(x => x.stage === 3 && (!x.sw || s.ufReno))
    .reduce((a, x) => a + (+x.a || 0), 0);
  return (f.src.dep || s.data.house.deposit) + f.t + f.l + f.spa + f.loanLegal + f.val
    + (+ufItem(s, 'mrta').a || 0) + moveIn;
}
