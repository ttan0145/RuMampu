/* Prepare v7 state, kept apart from prep7.ts so state.tsx and persist.ts can
   import it without pulling in the fee and plan modules. */

export const DOC_KEYS = ['dc_bank', 'dc_ehail', 'dc_statdec', 'dc_epf', 'dc_commitlist'];

export interface PrepState {
  /* what-ifs from the monthly lesson; null = the house test's own figure */
  margin: number | null;
  years: number | null;
  age: string;
  /* monthly home bills the person changed; null = our guess */
  mHome: { maint: number | null; quit: number | null; fire: number | null };
  strata: boolean;
  /* subsale or project, for "How buying works" */
  kind: 'done' | 'uc';
  /* lesson position (0-5, 6 = the summary), finished, saved, the rates question */
  step: number;
  done: boolean;
  saved: boolean;
  quiz: 'yes' | 'no' | null;
  /* the name of a home typed in on Prepare (a tested home keeps its test's name) */
  name: string;
  /* the price of a home typed in on Prepare; 0 = none. Kept apart from the house-test form. */
  price: number;
}

export const PREP_DEFAULT: PrepState = {
  margin: null, years: null, age: '', mHome: { maint: null, quit: null, fire: null },
  strata: false, kind: 'done', step: 0, done: false, saved: false, quiz: null, name: '', price: 0,
};

export function validPrep(v: unknown): v is PrepState {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  const numOrNull = (x: unknown) => x === null || (typeof x === 'number' && Number.isFinite(x) && x >= 0);
  const m = p.mHome as Record<string, unknown> | undefined;
  return numOrNull(p.margin) && numOrNull(p.years) && typeof p.age === 'string'
    && !!m && numOrNull(m.maint) && numOrNull(m.quit) && numOrNull(m.fire)
    && typeof p.strata === 'boolean' && (p.kind === 'done' || p.kind === 'uc')
    && typeof p.step === 'number' && typeof p.done === 'boolean' && typeof p.saved === 'boolean'
    && (p.quiz === null || p.quiz === 'yes' || p.quiz === 'no')
    && (p.name === undefined || typeof p.name === 'string')
    && (p.price === undefined || (typeof p.price === 'number' && Number.isFinite(p.price) && p.price >= 0));
}

