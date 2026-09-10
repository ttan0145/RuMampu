import { test } from '@playwright/test';

/**
 * Registers one acceptance criterion as a named Playwright report step.
 * Keep the AC id as a string literal so the traceability checker can verify it.
 */
export async function ac<T>(
  id: `AC${number}.${number}.${number}`,
  title: string,
  body: () => Promise<T>,
): Promise<T> {
  return test.step(`${id} — ${title}`, body);
}

/**
 * Records an explicitly deferred acceptance criterion without presenting it as
 * implemented. The traceability gate counts this separately from executable ACs.
 */
export function deferredAc(
  id: `AC${number}.${number}.${number}`,
  title: string,
  reason: string,
): void {
  test.info().annotations.push({
    type: 'deferred-ac',
    description: `${id} — ${title}: ${reason}`,
  });
}
