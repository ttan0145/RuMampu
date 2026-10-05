import type { AppState } from './state';

/* The one pot the user has set aside (v5 AC5.2.17, AC10.4.3): what they already had
   (the cash they report on Upfront cash), what the plan has added (days they declared
   saved) and what finished months moved in. Each part is counted once, and every
   screen that says "what I have" reads this total. Kept free of app imports so the
   arithmetic can be tested on its own. */
export function potParts(s: AppState): { had: number; plan: number; moved: number; total: number } {
  const had = Math.max(0, +s.data.cashOnHand || 0);
  const plan = Math.max(0, s.village?.savedRm ?? 0);
  const moved = Math.max(0, s.potMoved || 0);
  return { had, plan, moved, total: had + plan + moved };
}

export function potSum(s: AppState): number {
  return potParts(s).total;
}

/* The part of the pot the cash-buffer shield already holds (Epic 10). A day ticked
   while the shield fills is added to what the plan has added and to the shield, so
   it is already promised to the buffer. Never more than the pot itself. */
export function potHeld(s: AppState): number {
  const shield = Math.max(0, +(s.buffer?.saved ?? 0) || 0);
  return Math.min(potSum(s), shield);
}

/* What the pot holds towards the upfront cash: the pot less what the shield holds,
   so the same ringgit is never counted for both goals. Upfront cash ("You have"),
   the House card and the gap on Home all read this. */
export function potForUpfront(s: AppState): number {
  return potSum(s) - potHeld(s);
}
