import { test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

/* The page of the running test, registered by the shared fixture
   (support/fixtures.ts), so every AC step can leave its own screenshot. */
let evidencePage: Page | null = null;
export function setEvidencePage(page: Page | null): void {
  evidencePage = page;
}

/* With UPDATE_EVIDENCE=1, each passing AC step saves the screen it ended on as
   output/playwright/epic-N/evidence/acN.M.K__title__spec.png. */
async function stepEvidence(id: string, title: string): Promise<void> {
  if (process.env.UPDATE_EVIDENCE !== '1' || !evidencePage || evidencePage.isClosed()) return;
  /* a step with no screen open (a pure logic check) leaves no blank picture */
  if (evidencePage.url() === 'about:blank') return;
  const epic = id.match(/^AC(\d+)\./)?.[1];
  if (!epic) return;
  /* the spec's name keeps two specs that check the same AC from overwriting each other */
  const spec = path.basename(test.info().file).replace(/\.spec\.ts$/, '');
  const directory = path.resolve(__dirname, `../../../output/playwright/epic-${epic}/evidence`);
  mkdirSync(directory, { recursive: true });
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  /* let sheets and toasts finish their entrance animation first */
  await evidencePage.waitForTimeout(450).catch(() => undefined);
  await evidencePage.screenshot({ path: path.join(directory, `${id.toLowerCase()}__${slug}__${spec}.png`), fullPage: true })
    .catch(() => undefined);
}

/**
 * Registers one acceptance criterion as a named Playwright report step.
 * Keep the AC id as a string literal so the traceability checker can verify it.
 */
export async function ac<T>(
  id: `AC${number}.${number}.${number}`,
  title: string,
  body: () => Promise<T>,
): Promise<T> {
  return test.step(`${id} — ${title}`, async () => {
    const result = await body();
    await stepEvidence(id, title);
    return result;
  });
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
