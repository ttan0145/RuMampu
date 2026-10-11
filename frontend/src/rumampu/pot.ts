import type { AppState } from './state';

/* The one pot the user has set aside (v5 AC5.2.17, AC10.4.3): what they already had
   (the cash they report on Upfront cash), what the plan has added (days they declared
   saved) and what finished months moved in. Each part is counted once, and every
   screen that says "what I have" reads this total. Kept free of app imports so the
   arithmetic can be tested on its own. */
export function potParts(s: AppState): { had: number; plan: number; moved: number; used: number; total: number } {
  const had = Math.max(0, +s.data.cashOnHand || 0);
  const plan = Math.max(0, +(s.village?.savedRm ?? 0) || 0);
  const moved = Math.max(0, s.potMoved || 0);
  /* What was drawn from the safety buffer has been spent, so it leaves the pot. */
  const used = Math.max(0, +(s.buffer?.used ?? 0) || 0);
  return { had, plan, moved, used, total: Math.max(0, had + plan + moved - used) };
}

export function potSum(s: AppState): number {
  return potParts(s).total;
}

/* US5.8 (AC5.8.1, AC5.8.5): the cash buffer is held first. The part of the pot held
   is the smaller of the pot and the buffer worked out from the kept house test;
   with no test, or a buffer of RM 0, nothing is held. */
export function potHeld(s: AppState, bufferTarget: number): number {
  return Math.min(potSum(s), Math.max(0, +bufferTarget || 0));
}

/* What the pot counts towards the upfront cash: the pot less what the buffer holds,
   so the same ringgit is never counted for both goals (AC5.8.2). */
export function potForUpfront(s: AppState, bufferTarget: number): number {
  return potSum(s) - potHeld(s, bufferTarget);
}
