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
