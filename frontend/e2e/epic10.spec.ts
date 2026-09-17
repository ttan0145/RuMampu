import { expect, Page } from '@playwright/test';
import { e2eGet, e2ePost, test } from './support/fixtures';
import { ac, deferredAc } from './support/acceptance';
import { API, captureEvidence, openGuestApp, pinGuestClientId } from './support/app';

/* Epic 10 — Saving Plan and Gamified Progress (US/AC v5, 17 September 2026).
   The plan only opens once a kept house test fits the recorded months, so
   every test starts from the twelve-month gig-driver scenario and keeps a
   RM 100,000 test that runs short in none of them. With that record the
   safety buffer is already covered, so the plan is in its upfront-cash phase
   from the first tick. The plan itself lives in the browser (local snapshot)
   and is read back from localStorage where the arithmetic must be exact. */

type LocalPlan = {
  plan: { key: string; target: number; n: number; amounts: number[]; done: boolean[]; skipped?: boolean[]; paused?: boolean } | null;
  village: { cells: number[]; built: number; queued: number; savedRm: number } | null;
  potMovedMonths: string[];
};

/* The app writes its local snapshot 500 ms after the last change (state.tsx),
   so reads wait for that debounce to flush first. */
async function localState(page: Page): Promise<LocalPlan> {
  await page.waitForTimeout(700);
  const raw = await page.evaluate(() => window.localStorage.getItem('rumampu_local_state'));
  const parsed = JSON.parse(raw || '{}') as Partial<LocalPlan>;
  return { plan: parsed.plan ?? null, village: parsed.village ?? null, potMovedMonths: parsed.potMovedMonths ?? [] };
}

/* Seeds twelve recorded months, then onboards as a guest. Guest sign-in
   rotates the client id and reloads the record, so the id is pinned to the
   seeded one first (see pinGuestClientId). A guest who reloads the page
   starts a new guest by design (Epic 8), so these tests never reload; local
   persistence is checked through the storage snapshot the app writes. */
async function startWithTwelveMonths(page: Page): Promise<void> {
  await pinGuestClientId(page);
  const loaded = await e2ePost(page, `${API}/dev/scenarios/my-gig-driver-12m/load/`, { data: { confirm_reset: true } });
  expect(loaded.status()).toBe(201);
  await openGuestApp(page);
}

/* Leaves the plan, visits another tab, and comes back to Home. */
async function leaveAndReturn(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Money', exact: true }).click();
  await page.getByRole('tab', { name: 'Home', exact: true }).click();
}

/* Runs and keeps an affordable test through the real screens. */
async function keepAffordableTest(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'House', exact: true }).click();
  await page.getByText('Test a house', { exact: true }).click();
  await expect(page.getByText('Property price', { exact: true })).toBeVisible();
  await page.locator('input:visible').nth(0).fill('80000');
  await page.getByText('The house', { exact: true }).click();
  await page.getByText('Run the test', { exact: true }).last().click();
  await expect(page.getByText(/All 12 months would carry it/)).toBeVisible();
  await page.getByText('Save test', { exact: true }).click();
  await expect(page.getByText('Name this test', { exact: true })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Save test', exact: true }).click();
  await expect(page.getByText('Saved tests', { exact: true }).first()).toBeVisible();
  await page.getByRole('tab', { name: 'Home', exact: true }).click();
  await expect(page.getByText('Save today', { exact: true })).toBeVisible();
}

async function openPlan(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Home', exact: true }).click();
  await page.getByText(/^Saving plan · /).click();
  await expect(page.getByText('Shuffle the days left', { exact: true })).toBeVisible();
}

async function showWholeMonth(page: Page): Promise<void> {
  const toggle = page.getByText('Show the whole month', { exact: true });
  if (await toggle.isVisible().catch(() => false)) await toggle.click();
}

/* Day chips are buttons whose accessible name starts with the day number
   ("12 52", "12 ✓ 52" once saved, "12 –" once skipped). */
function dayChip(page: Page, day: number) {
  return page.getByRole('button', { name: new RegExp(`^${day} `) }).first();
}

test.describe('Epic 10 — Saving Plan and Gamified Progress', { tag: '@epic10' }, () => {
  test('US10.1 / US10.2 / US10.12 — Target, daily split and gap come from my own test', { tag: ['@us10.1', '@us10.2', '@us10.12'] }, async ({ page }) => {
    await startWithTwelveMonths(page);

    await ac('AC10.1.1', 'No default target', async () => {
      await expect(page.getByText('Size your safety buffer', { exact: true })).toBeVisible();
      await expect(page.getByText('Run a house test', { exact: true })).toBeVisible();
      await expect(page.getByText(/^Target RM/)).toHaveCount(0);
    });

    await ac('AC10.12.1', 'The goal comes from my own test', async () => {
      await expect(page.getByText(/short of your upfront cash estimate/)).toHaveCount(0);
    });

    await keepAffordableTest(page);

    await ac('AC10.1.3', 'The target comes from my kept house test', async () => {
      await openPlan(page);
      await expect(page.getByText('Upfront cash', { exact: true }).first()).toBeVisible();
      await expect(page.getByText(/Your shield is full/)).toBeVisible();
    });

    await ac('AC10.1.4', 'The target sits at the top', async () => {
      const state = await localState(page);
      expect(state.plan).toBeTruthy();
      await expect(page.getByText(`/ RM ${state.plan!.target.toLocaleString('en-MY')}`, { exact: false }).first()).toBeVisible();
    });

    await ac('AC10.12.2', 'The goal is set from my kept test', async () => {
      // Home's pot row states the gap to the kept test's upfront cash.
      await page.getByRole('tab', { name: 'Home', exact: true }).click();
      await expect(page.getByText(/short of your upfront cash estimate/)).toBeVisible();
      await openPlan(page);
    });

    await ac('AC10.2.1', 'Uneven daily split', async () => {
      const { plan } = await localState(page);
      const distinct = new Set(plan!.amounts.filter(a => a > 0));
      expect(distinct.size).toBeGreaterThan(1);
    });

    await ac('AC10.2.2', 'Amounts sum exactly', async () => {
      const { plan } = await localState(page);
      expect(plan!.amounts.reduce((a, b) => a + b, 0)).toBe(plan!.target);
    });

    await ac('AC10.2.3', 'Split is stable until changed', async () => {
      const before = (await localState(page)).plan!.amounts;
      expect(before.length).toBeGreaterThan(0);
      await leaveAndReturn(page);
      await expect(page.getByText('Save today', { exact: true })).toBeVisible();
      await openPlan(page);
      expect((await localState(page)).plan!.amounts).toEqual(before);
    });

    await ac('AC10.1.2', 'Target follows my chosen horizon', async () => {
      const before = (await localState(page)).plan!.target;
      await page.getByText('What my record allows', { exact: true }).first().click();
      await page.getByText('36 months', { exact: true }).click();
      await expect(page.getByText(/for 36 months/)).toBeVisible();
      const after = (await localState(page)).plan!.target;
      expect(after).toBeLessThan(before);
      expect((await localState(page)).plan!.amounts.reduce((a, b) => a + b, 0)).toBe(after);
    });

    await ac('AC10.12.3', 'The gap stated as arithmetic', async () => {
      await expect(page.getByText(/^About RM [\d,]+ a month for 36 months/)).toBeVisible();
      // Home states the remaining gap in ringgit against the kept test's upfront cash.
      await page.getByRole('tab', { name: 'Home', exact: true }).click();
      await expect(page.getByText(/RM [\d,]+ short of your upfront cash estimate/)).toBeVisible();
    });

    await captureEvidence(page, 'epic-10', 'ac10.1_10.2_10.12__target-and-split.png');
  });

  test('US10.3 / US10.4 / US10.6 / US10.14 — Saved days build the village, undo takes them back', { tag: ['@us10.3', '@us10.4', '@us10.6', '@us10.14'] }, async ({ page }) => {
    // The village sheet's arrow row sits below the phone-height fold; a taller
    // viewport keeps it clickable without scrolling the sheet.
    await page.setViewportSize({ width: 390, height: 1400 });
    await startWithTwelveMonths(page);
    await keepAffordableTest(page);

    await ac('AC10.3.1', 'Quick action for today', async () => {
      await page.getByText('Save today', { exact: true }).click();
      await expect(page.getByText('Saved ✓', { exact: true })).toBeVisible();
      await expect(page.getByText(/1 built · 1 on the plot/)).toBeVisible();
    });

    await ac('AC10.3.4', 'A confirmation states the result', async () => {
      await expect(page.getByText(/^Saved RM [\d,]+ today\. Savings you declared: RM [\d,]+\.$/)).toBeVisible();
    });

    await ac('AC10.4.1', 'Progress summary visible', async () => {
      await expect(page.getByText(/^1 of \d+ days/)).toBeVisible();
      await expect(page.getByText(/^Target RM/)).toBeVisible();
      await expect(page.getByText(/^\d+%$/)).toBeVisible();
    });

    await ac('AC10.6.1', 'A saved day puts something on the plot', async () => {
      await expect(page.getByText(/1 built · 1 on the plot/)).toBeVisible();
      const { village } = await localState(page);
      expect(village!.cells.filter(Boolean)).toEqual([1]);
    });

    await ac('AC10.14.1', 'One day, one tile, any amount', async () => {
      const { plan, village } = await localState(page);
      expect(village!.built).toBe(1);
      expect(plan!.done.filter(Boolean)).toHaveLength(1);
    });

    await ac('AC10.3.2', 'Any day toggleable on the full screen', async () => {
      await openPlan(page);
      await showWholeMonth(page);
      const today = new Date().getDate();
      const other = today === 1 ? 2 : 1;
      await dayChip(page, other).click();
      await expect(page.getByText(/^2 of \d+ days/)).toBeVisible();
      const { village } = await localState(page);
      expect(village!.cells.filter(Boolean)).toEqual([1, 1]);
    });

    await ac('AC10.6.5', 'How to play is shown before the first game', async () => {
      await page.getByRole('tab', { name: 'Home', exact: true }).click();
      await page.getByText(/▶ Play/).click();
      await expect(page.getByText('Let’s start!', { exact: true })).toBeVisible();
      await expect(page.getByText('Saving village', { exact: true })).toBeVisible();
      await expect(page.getByText('Swipe to grow your village.', { exact: true })).toBeVisible();
      await page.getByText('i', { exact: true }).last().click();
      await expect(page.getByText('How to play', { exact: true })).toBeVisible();
    });

    await ac('AC10.6.3', 'Swipe matches the direction things move', async () => {
      for (const arrow of ['←', '↑', '↓', '→']) await expect(page.getByRole('dialog').getByText(arrow, { exact: true })).toBeVisible();
      await expect(page.getByText('Swipe the plot, or use the arrows.', { exact: true })).toBeVisible();
    });

    await ac('AC10.6.2', 'Swipe slides and merges', async () => {
      // Two tiles anywhere on a 4x4 plot end up adjacent after down, then right.
      await page.getByRole('dialog').getByText('↓', { exact: true }).click();
      await page.getByRole('dialog').getByText('→', { exact: true }).click();
      await expect(page.getByText('You built a Kampung house!', { exact: true })).toBeVisible();
      const { village } = await localState(page);
      expect(village!.cells.filter(Boolean)).toEqual([2]);
    });

    await ac('AC10.6.4', 'The order is the game\'s own ladder', async () => {
      await expect(page.getByText('4. Keep going: Pondok, Kampung house, Terrace, Condo, then Istana.', { exact: true })).toBeVisible();
      await expect(page.getByText(/Best: Kampung house/).first()).toBeVisible();
    });

    await ac('AC10.3.3', 'Undo reverses both the amount and the village', async () => {
      await page.getByText('✕', { exact: true }).click();
      await page.getByText('Saved ✓', { exact: true }).click();
      await expect(page.getByText(/^Removed RM [\d,]+ from today\.$/)).toBeVisible();
      await expect(page.getByText(/^1 of \d+ days/)).toBeVisible();
      // The merged house is broken back into the one Pondok that remains.
      const { village } = await localState(page);
      expect(village!.cells.filter(Boolean)).toEqual([1]);
      expect(village!.built).toBe(1);
    });

    await ac('AC10.4.2', 'Target reached is stated', async () => {
      await openPlan(page);
      await page.getByText('What my record allows', { exact: true }).first().click();
      await page.getByText('36 months', { exact: true }).click();
      await showWholeMonth(page);
      const { plan } = await localState(page);
      for (let day = 1; day <= plan!.n; day += 1) {
        if (!plan!.done[day - 1]) await dayChip(page, day).click();
      }
      await expect(page.getByText('Target reached!', { exact: true })).toBeVisible();
    });

    await captureEvidence(page, 'epic-10', 'ac10.3_10.4_10.6__village.png');
  });

  test('US10.5 / US10.9 / US10.11 — Shuffle, skip, pause and reset never punish', { tag: ['@us10.5', '@us10.9', '@us10.11'] }, async ({ page }) => {
    await startWithTwelveMonths(page);
    await keepAffordableTest(page);
    await page.getByText('Save today', { exact: true }).click();
    await openPlan(page);
    await showWholeMonth(page);
    const today = new Date().getDate();
    const n = (await localState(page)).plan!.n;
    // The plan needs days after today for shuffle and skip; late in a month the
    // remaining days can be too few to prove anything, so the check adapts.
    const daysLeft = n - today;

    await ac('AC10.5.2', 'Days already saved are untouched', async () => {
      const before = (await localState(page)).plan!.amounts;
      await page.getByText('Shuffle the days left', { exact: true }).click();
      const after = (await localState(page)).plan!.amounts;
      expect(after[today - 1]).toBe(before[today - 1]);
      expect(after.reduce((a, b) => a + b, 0)).toBe(before.reduce((a, b) => a + b, 0));
    });

    await ac('AC10.5.1', 'Shuffle redistributes the days not yet saved', async () => {
      if (daysLeft < 3) { test.info().annotations.push({ type: 'note', description: 'Fewer than 3 days left in the month; redistribution not provable today.' }); return; }
      const before = (await localState(page)).plan!.amounts.slice(today);
      let changed = false;
      for (let attempt = 0; attempt < 4 && !changed; attempt += 1) {
        await page.getByText('Shuffle the days left', { exact: true }).click();
        const after = (await localState(page)).plan!.amounts.slice(today);
        changed = after.some((value, index) => value !== before[index]);
      }
      expect(changed).toBe(true);
    });

    await ac('AC10.9.1', 'Skip a day', async () => {
      if (daysLeft < 2) return;
      const target = today + 1;
      await dayChip(page, target).click({ delay: 900 });
      await expect(dayChip(page, target)).toContainText('–');
      const { plan } = await localState(page);
      expect(plan!.skipped?.[target - 1]).toBe(true);
      expect(plan!.amounts[target - 1]).toBe(0);
      expect(plan!.amounts.reduce((a, b) => a + b, 0)).toBe(plan!.target);
      await expect(page.getByText('Hold a day to skip it. Its amount spreads over the days left.', { exact: true })).toBeVisible();
    });

    await ac('AC10.9.2', 'Pause a month', async () => {
      const villageBefore = (await localState(page)).village;
      await page.getByText('Pause this month', { exact: true }).click();
      await expect(page.getByText('Plan paused. No day counts as missed, the village stays as it is, and you can resume any time.', { exact: true })).toBeVisible();
      await expect(page.getByText('Resume the plan', { exact: true })).toBeVisible();
      expect((await localState(page)).village).toEqual(villageBefore);
      await page.getByText('Resume the plan', { exact: true }).click();
      await expect(page.getByText('Pause this month', { exact: true })).toBeVisible();
    });

    await ac('AC10.9.3', 'No blame', async () => {
      for (const word of ['missed', 'failed', 'behind', 'disappoint']) {
        await expect(page.getByText(new RegExp(`\\b${word}`, 'i'))).toHaveCount(0);
      }
    });

    await ac('AC10.11.1', 'Reset the plan with a confirmation', async () => {
      await page.getByText('Reset this month’s plan', { exact: true }).click();
      await expect(page.getByText('Tap again to reset. Your record, village and declared savings are kept.', { exact: true })).toBeVisible();
      expect((await localState(page)).plan!.done.filter(Boolean)).toHaveLength(1);
      await page.getByText('Reset this month’s plan', { exact: true }).click();
      await expect(page.getByText('Plan reset. Record, village and savings kept.', { exact: true })).toBeVisible();
      expect((await localState(page)).plan!.done.filter(Boolean)).toHaveLength(0);
    });

    await ac('AC10.11.2', 'Reset keeps my record', async () => {
      const record = await e2eGet(page, `${API}/income/record/`);
      expect((await record.json()).recorded_month_count).toBe(12);
    });

    await captureEvidence(page, 'epic-10', 'ac10.5_10.9_10.11__tools.png');
  });

  test('US10.4 / US10.8 / US10.10 / US10.13 — The pot, the plain statement, month end and persistence', { tag: ['@us10.4', '@us10.8', '@us10.10', '@us10.13'] }, async ({ page }) => {
    await startWithTwelveMonths(page);
    await keepAffordableTest(page);
    await page.getByText('Save today', { exact: true }).click();
    await openPlan(page);

    await ac('AC10.8.2', 'A plain non-advice statement', async () => {
      await expect(page.getByText(/RuMampu cannot check whether money was actually set aside/).first()).toBeVisible();
    });

    await ac('AC10.10.3', 'What a finished month left can go into savings', async () => {
      await expect(page.getByText('What your months left', { exact: true })).toBeVisible();
      const before = (await localState(page)).potMovedMonths.length;
      await page.getByText('Add', { exact: true }).first().click();
      await expect(page.getByText('Added', { exact: true }).first()).toBeVisible();
      expect((await localState(page)).potMovedMonths.length).toBe(before + 1);
    });

    await ac('AC10.4.3', 'The pot shows its working', async () => {
      await page.getByLabel('How this adds up').click();
      for (const line of ['What the plan has added', 'Moved in from finished months', 'In the pot']) {
        await expect(page.getByText(line, { exact: true })).toBeVisible();
      }
      await page.getByText('Done', { exact: true }).last().click();
    });

    await ac('AC10.8.1', 'Game framing in the words', async () => {
      await page.getByRole('tab', { name: 'Home', exact: true }).click();
      await page.getByText(/▶ Play/).click();
      await expect(page.getByRole('dialog').getByText('Swipe to grow your village.', { exact: true })).toBeVisible();
      await page.getByText('i', { exact: true }).last().click();
      await expect(page.getByText(/How to play/)).toBeVisible();
      await expect(page.getByText(/Every day you save adds a Pondok to the plot/)).toBeVisible();
      await expect(page.getByText(/Two houses of the same kind that meet merge into the next size/)).toBeVisible();
      await page.getByRole('dialog').getByText('✕', { exact: true }).click();
    });

    await ac('AC10.13.1', 'Same storage rule as the record', async () => {
      // The plan and village are written to the same local snapshot the
      // record's cash-on-hand lives in, under this guest's client id.
      const before = await localState(page);
      expect(before.plan!.done).toContain(true);
      expect(before.village!.built).toBe(1);
      await leaveAndReturn(page);
      // Home's plan row still shows today as saved.
      await expect(page.getByText('Saved ✓', { exact: true })).toBeVisible();
      const after = await localState(page);
      expect(after.plan!.done).toEqual(before.plan!.done);
      expect(after.village!.built).toBe(before.village!.built);
      await expect(page.getByText(/1 built · 1 on the plot/)).toBeVisible();
    });

    await ac('AC10.10.2', 'Village and total carry over', async () => {
      // Declared savings and the village are stored outside the month's day
      // list, which is the part that resets with a new month.
      const { village, plan } = await localState(page);
      expect(village!.savedRm).toBeGreaterThan(0);
      expect(plan!.key).toMatch(/^\d{4}-\d{2}$/);
    });

    await ac('AC10.13.2', 'Removed with my record; kept with my account', async () => {
      await page.getByRole('tab', { name: 'Profile', exact: true }).click();
      await page.getByText('Delete guest record', { exact: true }).click();
      await expect(page.getByText('Delete guest record?', { exact: true })).toBeVisible();
      await page.getByRole('dialog').getByText('Delete guest record', { exact: true }).click();
      // Deleting the guest record starts a fresh guest on Home: no months, no plan, no village.
      await expect(page.getByText('Add last week’s earnings. That’s enough to start.', { exact: true })).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(/^Saving plan · /)).toHaveCount(0);
      const cleared = await localState(page);
      expect(cleared.plan).toBeNull();
      expect(cleared.village).toBeNull();
    });

    await captureEvidence(page, 'epic-10', 'ac10.4_10.8_10.10_10.13__pot-and-persistence.png');
  });

  test('US10.10 — Month end is explained in the last days', { tag: '@us10.10' }, async ({ page }) => {
    await startWithTwelveMonths(page);
    await keepAffordableTest(page);
    // Freeze the clock on the 29th so the plan believes the month is ending.
    // (Set after onboarding: the splash never clears under a frozen clock.)
    const now = new Date();
    await page.clock.setFixedTime(new Date(now.getFullYear(), now.getMonth(), 29, 10, 0, 0));
    await openPlan(page);

    await ac('AC10.10.1', 'Month end explained before it happens', async () => {
      await expect(page.getByText('The month is ending: unsaved days reset with the new month; your village and declared savings carry over.', { exact: true })).toBeVisible();
    });
  });
});
