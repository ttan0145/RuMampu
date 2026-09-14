import { AppState, BufferState, PlanState } from './state';
import { villageEnsure, villageRemove, villageSpawn } from './village';
import { HousingTestResult } from '../../types/housing';
import { getHousingTestResult } from '../../services/housingSession';
import { upfrontNeed } from './fees';
import { logIt } from './log';
import { rm } from './calc';

/* v22 saving plan — the month's target split into small, uneven daily amounts
   that add up exactly. Ported verbatim from the prototype: same seeded PRNG so
   the same target always yields the same daily split. All functions mutate the
   draft state passed by up(). */

export function planEnsure(s: AppState): PlanState {
  const d = new Date();
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const n = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  if (!s.plan || s.plan.key !== key) {
    s.plan = { key, target: 500, n, amounts: new Array(n).fill(0), done: new Array(n).fill(false), seed: 1 };
    planRegen(s.plan);
  }
  return s.plan;
}

export function planRegen(p: PlanState): void {
  const idx: number[] = [];
  let fixed = 0;
  const skipped = p.skipped ?? [];
  for (let i = 0; i < p.n; i++) {
    if (p.done[i]) fixed += p.amounts[i];
    else if (skipped[i]) p.amounts[i] = 0;  /* 10.9.1: spread over the rest */
    else idx.push(i);
  }
  if (!idx.length) return;
  const rem = Math.max(0, p.target - fixed);
  let seed = (p.target * 7919 + p.seed * 104729 + p.n) >>> 0;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const w = idx.map(() => 0.35 + rnd() * 1.3);
  const sw = w.reduce((a, b) => a + b, 0);
  const raw = w.map(x => rem * x / sw);
  const fl = raw.map(Math.floor);
  const left = rem - fl.reduce((a, b) => a + b, 0);
  const order = raw.map((x, i) => [x - fl[i], i] as [number, number]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; k < left; k++) fl[order[k % order.length][1]]++;
  idx.forEach((i, k) => { p.amounts[i] = fl[k]; });
}

export function planSaved(p: PlanState): number {
  return p.amounts.reduce((a, x, i) => a + (p.done[i] ? x : 0), 0);
}

export function planToggle(s: AppState, i: number): void {
  const p = planEnsure(s);
  if (p.paused) return;             /* 10.9.2: a paused month changes nothing */
  if (p.skipped?.[i]) return;       /* unskip first, then save */
  p.done[i] = !p.done[i];
  const amount = p.amounts[i];
  /* LeanKit 10.3 Amendment 1: a tick is savings the user DECLARED — the app
     cannot verify money moved, so it never silently changes the balance the
     house test reads. The declared total lives in savedRm and the buffer. */
  /* The truthful lifetime total behind the game (US10.8 anchoring). */
  const vv = villageEnsure(s);
  vv.savedRm = Math.max(0, vv.savedRm + (p.done[i] ? amount : -amount));
  logIt(s, p.done[i] ? 'lg_saved_day' : 'lg_unsaved_day', { a: rm(amount) });
  /* Epic 10: while the shield is filling, saved days feed the buffer, not the
     game. Setup/explain/village (and pre-Epic-10 sessions) keep the village
     mechanic exactly as before. */
  if (planPhase(s, getHousingTestResult()) === 'buffer') {
    if (p.done[i]) addToBuffer(s, amount);
    else removeFromBuffer(s, amount);
    return;
  }
  if (p.done[i]) villageSpawn(s);
  else villageRemove(s);
}

/* LeanKit 10.9.1 — toggle a day between skipped and planned. Its amount is
   redistributed across the remaining unskipped, unsaved days. */
export function planSkip(s: AppState, i: number): void {
  const p = planEnsure(s);
  if (p.paused || p.done[i]) return;
  if (!p.skipped) p.skipped = new Array(p.n).fill(false);
  p.skipped[i] = !p.skipped[i];
  planRegen(p);
}

/* LeanKit 10.9.2 — pause/resume; nothing counts as missed while paused. */
export function planPause(s: AppState): void {
  const p = planEnsure(s);
  p.paused = !p.paused;
}

/* LeanKit 10.11 — reset this month's plan; the record, the village and the
   declared savings are untouched. */
export function planReset(s: AppState): void {
  s.plan = null;
  planEnsure(s);
}

/* LeanKit 10.10.3 — what a finished month left (the remaining-balance
   formula), listed for the user to move into the pot by their own control. */
export function planMonthsLeft(s: AppState, commitMonthly: number): { key: string; left: number }[] {
  const now = new Date();
  const thisKey = now.getFullYear() * 12 + now.getMonth();
  const keyOf = (d: string) => (+d.slice(0, 4)) * 12 + (+d.slice(5, 7) - 1);
  const months = new Map<number, number>();
  for (const e of s.data.income) {
    const k = keyOf(e.d);
    if (k < thisKey) months.set(k, (months.get(k) ?? 0) + (+e.a || 0));
  }
  for (const e of s.data.workCostEntries) {
    const k = keyOf(e.d);
    if (months.has(k)) months.set(k, (months.get(k) ?? 0) - (+e.a || 0));
  }
  return [...months.entries()]
    .map(([k, v]) => ({ key: `${Math.floor(k / 12)}-${String((k % 12) + 1).padStart(2, '0')}`, left: Math.round(v - commitMonthly) }))
    .filter(m => m.left > 0 && !s.potMovedMonths.includes(m.key))
    .sort((a, b) => b.key.localeCompare(a.key))
    .slice(0, 3);
}

/* ---- Epic 10: buffer shield & phased savings --------------------------------

   The RM500 constant above collapses three different goals (cash buffer,
   upfront cash, instalment capacity) into one number. These functions resolve
   real targets instead: the BUFFER phase saves toward the house test's
   starting-liquidity trough, and the VILLAGE game only opens once that shield
   is full. Every target comes from the user's own record — nothing invented. */

/* A judgement call, not data-derived — the highest-stakes number in the flow.
   A monthly gap within RM150 of zero is 'marginal', which is NOT affordable.
   Revisit against real figures before tuning. */
export const FEASIBILITY_MARGIN = 150;

export type Feasibility = 'affordable' | 'marginal' | 'out_of_reach';

/* setup: no house test yet, so no honest target exists.
   explain: no affordable option — show the shortfall, not a countdown.
   buffer: filling the shield.  village: shield full, game open. */
export type PlanPhase = 'setup' | 'explain' | 'buffer' | 'village';

/* gap = residual income − instalment. The backend already nets those per
   month (post_housing_residual); the gate reads the median month so a single
   bad month doesn't condemn a house and a single good one doesn't excuse it. */
export function feasibilityGap(result: HousingTestResult): number {
  const r = result.months.map(m => Number(m.post_housing_residual) || 0).sort((a, b) => a - b);
  if (!r.length) return 0;
  const mid = Math.floor(r.length / 2);
  return r.length % 2 ? r[mid] : (r[mid - 1] + r[mid]) / 2;
}

export function feasibility(result: HousingTestResult): Feasibility {
  const gap = feasibilityGap(result);
  if (gap >= 0) return 'affordable';
  return gap >= -FEASIBILITY_MARGIN ? 'marginal' : 'out_of_reach';
}

/* Buffer target: the cumulative trough the backend already computes
   (starting_liquidity), whole ringgit. 0 is a valid answer, not an error. */
export function bufferTargetOf(result: HousingTestResult): number {
  return Math.max(0, Math.round(Number(result.starting_liquidity?.required_amount) || 0));
}

/* Upfront cash still owed — the village phase's target. The v24 fee engine
   works legal, valuation and stamp duty out from the tested price. */
export { upfrontNeed } from './fees';

export function bufferEnsure(s: AppState): BufferState {
  if (!s.buffer) {
    s.buffer = { saved: 0, overflow: 0, target: null, houseCost: null, prevTarget: null, msg: null };
  }
  return s.buffer;
}

/* Re-resolve the target from the latest house test. When a different house
   moves the target, the user gets told (msg 'moved') — never silently: the
   buffer is the one number that must feel dependable. Mutates; call in up(). */
export function syncBufferTarget(s: AppState, result: HousingTestResult | null): BufferState {
  const b = bufferEnsure(s);
  if (!result) return b;
  const target = bufferTargetOf(result);
  const houseCost = Math.round(Number(result.tested_home_cost) || 0);
  if (b.target !== null && b.houseCost !== null && houseCost !== b.houseCost && target !== b.target) {
    b.prevTarget = b.target;
    b.msg = 'moved';
  }
  b.target = target;
  b.houseCost = houseCost;
  return b;
}

/* Caps at the target; the excess is still the user's money, so it spills
   into the village phase (overflow) instead of being discarded. Call in up(). */
export function addToBuffer(s: AppState, amount: number): void {
  const b = bufferEnsure(s);
  const a = Math.max(0, Math.round(Number(amount) || 0));
  if (!a) return;
  const room = b.target === null ? a : Math.max(0, b.target - b.saved);
  const into = Math.min(a, room);
  b.saved += into;
  b.overflow += a - into;
}

/* Undo of a ticked day — not shield use, so no 'used' event. Reverses the
   add the same way it landed: overflow first, then the shield itself. */
export function removeFromBuffer(s: AppState, amount: number): void {
  const b = bufferEnsure(s);
  let a = Math.max(0, Math.round(Number(amount) || 0));
  const fromOverflow = Math.min(a, b.overflow);
  b.overflow -= fromOverflow;
  a -= fromOverflow;
  b.saved = Math.max(0, b.saved - a);
}

/* Using the shield IS the shield working. The calm 'used' event is recorded
   here in the transition — no red, no loss animation, no broken streak — so
   a view refactor can't accidentally turn buffer use into a failure. */
export function drawDownBuffer(s: AppState, amount: number): void {
  const b = bufferEnsure(s);
  const a = Math.max(0, Math.round(Number(amount) || 0));
  if (!a) return;
  b.saved = Math.max(0, b.saved - a);
  b.msg = 'used';
}

/* One source of truth for what the plan shows and whether the game is
   available. Pure read — safe to call during render. */
export function planPhase(s: AppState, result: HousingTestResult | null): PlanPhase {
  if (!result) return 'setup';
  if (feasibility(result) !== 'affordable') return 'explain';
  const saved = s.buffer?.saved ?? 0;
  return saved < bufferTargetOf(result) ? 'buffer' : 'village';
}

/* Point the month's daily split at the phase target: the buffer still owed,
   or the upfront cash still short. Ticked days grow the buffer/cash in step
   with planSaved, so the desired number stays stable as days are ticked and
   the split only regenerates when the phase target genuinely moves. */
export function planResolveTarget(s: AppState, result: HousingTestResult | null): void {
  const phase = planPhase(s, result);
  if (phase !== 'buffer' && phase !== 'village') return;
  const p = planEnsure(s);
  const done = planSaved(p);
  const desired = phase === 'buffer'
    ? Math.max(0, (bufferEnsure(s).target ?? 0) - bufferEnsure(s).saved + done)
    : Math.max(0, upfrontNeed(s) - s.data.cashOnHand + done);
  if (p.target !== desired) {
    p.target = desired;
    planRegen(p);
  }
}
