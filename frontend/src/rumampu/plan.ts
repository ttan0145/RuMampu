import { AppState, PlanState } from './state';
import { villageEnsure, villageRemove, villageSpawn } from './village';

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
    /* demo seed: the first four days of the month are already saved, one Pondok each */
    const seeded = Math.min(4, d.getDate() - 1);
    const v = villageEnsure(s);
    const spots = [5, 6, 9, 10];
    for (let i = 0; i < seeded; i++) {
      s.plan.done[i] = true;
      s.data.cashOnHand += s.plan.amounts[i];
      v.cells[spots[i]] = 1;
      v.built++;
    }
  }
  return s.plan;
}

export function planRegen(p: PlanState): void {
  const idx: number[] = [];
  let fixed = 0;
  for (let i = 0; i < p.n; i++) {
    if (p.done[i]) fixed += p.amounts[i];
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
  p.done[i] = !p.done[i];
  s.data.cashOnHand += p.done[i] ? p.amounts[i] : -p.amounts[i];
  if (p.done[i]) villageSpawn(s);
  else villageRemove(s);
}
