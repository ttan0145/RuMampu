import type { ApiIncomeCoverage } from './api';

/** Format a two-decimal API money string without converting it through IEEE-754. */
export function formatApiMoney(value: string): string {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) return 'RM —';
  const integer = match[2].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const decimals = (match[3] || '').padEnd(2, '0').slice(0, 2);
  return `RM ${match[1]}${integer}.${decimals}`;
}

/** Convert the API's 1-based authoritative coverage result for existing 0-based month UIs. */
export function unrepresentedCoverageMonths(coverage: ApiIncomeCoverage | null): number[] {
  if (coverage?.answer !== 'yes') return [];
  return coverage.unrepresented_slower_months.map(month => month - 1);
}
