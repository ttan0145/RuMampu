/* What "How buying works" and the monthly check state as a timing, a share or a
   rule, with where each one comes from and when it was checked (AC5.10.9,
   AC5.11.4), and the Schedule H stages the project timeline is built from.
   Pure data with no React Native import, so the unit tests can read it.

   A checked date is the day the page was read, not the day a rule came into
   force (docs/epic-5/LEARN_SOURCES.md). Nothing here is marked official: the
   2015 text of Schedules G and H could not be opened, and the subsale timings
   are contract terms, not law (RuMampu_全面审查_2026-10-09/15). */

/* The same shape as LN_SRC in learn-data.ts: name, link, checked date. */
export const BUY_SRC: Record<string, { n: string; h: string; d: string }> = {
  guides: {
    n: 'Agent and lawyer guides (iProperty, DNH, HBA)',
    h: 'https://www.iproperty.com.my/guides/documents-and-paperwork-buying-a-house-in-malaysia-71908',
    d: '9 October 2026',
  },
  hda: {
    n: 'Housing Development (Control and Licensing) Regulations 1989, Schedule H',
    h: 'https://hba.org.my/laws/housing_reg/1989/PU(A)%2058-1989.htm',
    d: '9 October 2026',
  },
  cimb: {
    n: 'CIMB: Home loan',
    h: 'https://www.cimb.com.my/en/personal/day-to-day-banking/financing/property-financing/homeloan.html',
    d: '9 October 2026',
  },
};

/* practice: common practice or a contract term, not a legal rule; the source and
   the checked date are shown. unverified: no source could be opened, or the
   primary text has not been checked, so the line says so instead of a date. */
export type FactStatus = 'practice' | 'unverified';
export interface BuyFact { status: FactStatus; src: keyof typeof BUY_SRC | null; note?: string }

export const BUY_FACTS: Record<string, BuyFact> = {
  /* subsale: the earnest deposit, usually 2 to 3% */
  book: { status: 'practice', src: 'guides' },
  /* subsale: the SPA within about 14 days */
  spa: { status: 'practice', src: 'guides', note: 'p7_src_spa_n' },
  /* subsale: completion 3 to 4 months later */
  comp: { status: 'practice', src: 'guides', note: 'p7_src_comp_n' },
  /* subsale: the first instalment about a month after the bank pays in full */
  keys: { status: 'unverified', src: null, note: 'p7_src_keys_n' },
  /* project: every stage share, and how long the build takes */
  sched: { status: 'unverified', src: 'hda', note: 'p7_src_hda_n' },
  /* the monthly check: the age at which banks end a loan */
  age: { status: 'practice', src: 'cimb', note: 'p7_src_age_n' },
};

/* Schedule H stages, % of the price. The description is a string key. */
export const SCHED: [string, string, number][] = [
  ['1', 'p7_h1', 10], ['2(a)', 'p7_h2a', 10], ['2(b)', 'p7_h2b', 15], ['2(c)', 'p7_h2c', 10], ['2(d)', 'p7_h2d', 10],
  ['2(e)', 'p7_h2e', 10], ['2(f)', 'p7_h2f', 5], ['2(g)', 'p7_h2g', 2.5], ['2(h)', 'p7_h2h', 2.5], ['3', 'p7_h3', 17.5],
  ['4', 'p7_h4', 2.5], ['5', 'p7_h5', 5],
];
