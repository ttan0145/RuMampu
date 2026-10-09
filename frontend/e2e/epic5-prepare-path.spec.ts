import { expect, Page } from '@playwright/test';
import { e2ePost, test } from './support/fixtures';
import { ac, deferredAc } from './support/acceptance';
import { API, openGuestApp, pinGuestClientId } from './support/app';

/* Epic 5, Iteration 3 — US5.9 Prepare for one home, US5.10 the monthly check, US5.11 How buying works.
   Written from the Prepare path as built on 8 October 2026 (commit 1c037a7) against the V9 requirement text.
   Where the build contradicts the V9 wording, the AC is registered with deferredAc() and the reason is
   written down instead of being made to pass. */

test.setTimeout(300_000);

const DISCLAIMER = 'Illustration only. Not a loan offer or approval.';

async function keepPriceTest(page: Page, price: number): Promise<void> {
  await page.getByRole('tab', { name: 'House', exact: true }).click();
  await page.getByText('Test a house', { exact: true }).click();
  const fromPrice = page.getByText('Work it out from the price instead', { exact: true });
  const priceLabel = page.getByText('Property price', { exact: true });
  await expect(priceLabel.or(fromPrice).first()).toBeVisible();
  if (await fromPrice.isVisible()) await fromPrice.click();
  await page.getByPlaceholder('e.g. 250,000').fill(String(price));
  await page.getByText('The house', { exact: true }).click();
  await page.getByText('Run the test', { exact: true }).last().click();
  await expect(page.getByText(/months would run short|All \d+ months would carry it/)).toBeVisible();
  await page.getByText('Save test', { exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Save test', exact: true }).click();
  await expect(page.getByText('Saved tests', { exact: true }).first()).toBeVisible();
}

async function seededApp(page: Page): Promise<void> {
  await pinGuestClientId(page);
  const loaded = await e2ePost(page, `${API}/dev/scenarios/my-gig-driver-12m/load/`, { data: { confirm_reset: true } });
  expect(loaded.status()).toBe(201);
  await openGuestApp(page);
}

async function openPrepare(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'House', exact: true }).click();
  await page.getByText('Prepare for a house', { exact: true }).click();
}

/* the monthly lesson's six screens: answer, split, pick, rates, bills, cushion, then the summary */
async function runLessonToSummary(page: Page): Promise<void> {
  for (let i = 0; i < 6; i += 1) await page.getByTestId('lesson-next').click();
  await expect(page.getByText('Monthly check done', { exact: true })).toBeVisible();
}

const bodyText = (page: Page) => page.locator('body').innerText();

test.describe('Epic 5 — Prepare path, monthly check and How buying works (Iteration 3)', { tag: '@epic5' }, () => {
  test('US5.9 — Choose or type a home first', { tag: '@us5.9' }, async ({ page }) => {
    await openGuestApp(page);
    await ac('AC5.9.2', 'Choose or type a home first', async () => {
      await openPrepare(page);
      await expect(page.getByText('Which home are you preparing for?', { exact: true })).toBeVisible();
      await expect(page.getByText('Or type in a home', { exact: true })).toBeVisible();
      // no house test gives a price, so there is nothing to pick from yet
      await expect(page.getByText('Pick from my house tests', { exact: true })).toHaveCount(0);
      await expect(page.getByTestId('prep-banner')).toHaveCount(0);
      await expect(page.getByLabel('Name or address')).toBeVisible();
      await expect(page.getByLabel('Price')).toBeVisible();
      await expect(page.getByText('Type of home', { exact: true })).toBeVisible();
      await expect(page.getByText('Subsale or project?', { exact: true })).toBeVisible();
      await page.getByLabel('Name or address').fill('Taman Test terrace');
      await page.getByLabel('Price').fill('450000');
      await page.getByText('Project', { exact: true }).click();
      await page.getByTestId('prep-use-home').click();
      await expect(page.getByTestId('prep-banner')).toContainText('Taman Test terrace');
      await expect(page.getByTestId('prep-banner')).toContainText('RM 450,000');
      await expect(page.getByTestId('prep-banner')).toContainText('project');
      await expect(page.getByTestId('prep-node-0')).toBeVisible();
    });
  });

  test('US5.9 — Prepare for one home, step by step', { tag: '@us5.9' }, async ({ page }) => {
    await seededApp(page);
    await keepPriceTest(page, 300000);
    await keepPriceTest(page, 400000);

    await ac('AC5.9.1', 'One home for every step', async () => {
      await openPrepare(page);
      await expect(page.getByTestId('prep-banner')).toContainText('RM');
      await expect(page.getByTestId('prep-banner')).toContainText(/subsale|project/);
      await page.getByRole('button', { name: 'Change home', exact: true }).click();
      await expect(page.getByText('The home you’re preparing for', { exact: true }).or(page.getByText("The home you're preparing for", { exact: true })).first()).toBeVisible();
      await expect(page.getByText('From your house tests', { exact: true })).toBeVisible();
      // each kept test is listed under its name with its price beneath (the default name is the price)
      await expect(page.getByRole('button', { name: /^RM 300,000/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /^RM 400,000/ })).toBeVisible();
      await expect(page.getByText('Test a new house first', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: /^RM 300,000/ }).click();
      await expect(page.getByTestId('prep-banner')).toContainText('RM 300,000');
      // every step works from that home: the monthly step carries the loan on RM 300,000
      await expect(page.getByTestId('prep-node-0')).toHaveAccessibleName(/Can I pay each month\? RM [\d,]+ a month/);
    });

    await ac('AC5.9.3', 'Four steps, none locked', async () => {
      await expect(page.getByTestId('prep-node-0')).toHaveAccessibleName(/Can I pay each month\? RM [\d,]+ a month/);
      await expect(page.getByTestId('prep-node-1')).toHaveAccessibleName(/Do I have the cash\? RM [\d,]+ upfront/);
      await expect(page.getByTestId('prep-node-2')).toHaveAccessibleName(/Is my paperwork ready\? 0 of 5 documents/);
      await expect(page.getByTestId('prep-node-3')).toHaveAccessibleName(/Got the keys\?/);
      // the paperwork step opens first, with nothing before it done
      await page.getByTestId('prep-node-2').click();
      await expect(page.getByText('Your documents', { exact: true })).toBeVisible();
      await page.getByLabel('Back').click();
      await expect(page.getByTestId('prep-banner')).toBeVisible();
    });

    await ac('AC5.9.4', 'What counts as done (monthly and paperwork ticks; the cash tick is not reached here)', async () => {
      // paperwork: all five documents
      await page.getByTestId('prep-node-2').click();
      for (const key of ['dc_bank', 'dc_ehail', 'dc_statdec', 'dc_epf', 'dc_commitlist']) {
        await page.getByTestId(`doc-${key}`).click();
      }
      await page.getByLabel('Back').click();
      await expect(page.getByTestId('prep-node-2')).toHaveAccessibleName(/All ready/);
      // monthly: only once the monthly check is saved to the plan
      await expect(page.getByTestId('prep-node-0')).not.toHaveAccessibleName(/Saved to your plan/);
      await page.getByTestId('prep-node-0').click();
      await runLessonToSummary(page);
      await page.getByTestId('lesson-save').click();
      await page.getByLabel('Back').click();
      await expect(page.getByTestId('prep-node-0')).toHaveAccessibleName(/Saved to your plan/);
      // cash is not covered by a pot that has nothing in it; the keys step carries no progress
      await expect(page.getByTestId('prep-node-1')).toHaveAccessibleName(/to go/);
      await expect(page.getByTestId('prep-node-3')).not.toHaveAccessibleName(/All ready|Saved|Covered/);
    });

    deferredAc('AC5.9.5', 'Say what is left without a verdict',
      'The build says "You’re ready to buy! Save your plan for your own reference." once all three steps are done (strings.ts p7_ready), which the AC and the rule that RuMampu never says a user is ready or approved forbid (V9 build note, conflict with 10.15.4). A test of the required wording would fail until the copy is changed.');
    await expect(page.getByTestId('prep-bubble')).toContainText('1 thing left before you buy.');

    await ac('AC5.9.6', 'Keep a copy of my plan', async () => {
      const popupPromise = page.waitForEvent('popup');
      await page.getByTestId('prep-pdf').click();
      const popup = await popupPromise;
      await popup.waitForLoadState('domcontentloaded');
      const plan = await popup.locator('body').innerText();
      expect(plan).toContain('RuMampu buying plan, for my own reference');
      expect(plan).toContain('RM 300,000');
      expect(plan).toContain('Loan amount');
      expect(plan).toContain('Interest rate');
      expect(plan).toContain('Upfront cash');
      expect(plan).toContain('Cash buffer');
      expect(plan).toContain('Ready');
      expect(plan).toContain(DISCLAIMER);
      await popup.close();
    });

    // Coming back within the open app keeps the home, the answers and the finished steps ...
    await page.getByLabel('Back').click();
    await page.getByRole('tab', { name: 'Money', exact: true }).click();
    await openPrepare(page);
    await expect(page.getByTestId('prep-banner')).toContainText('RM 300,000');
    await expect(page.getByTestId('prep-node-0')).toHaveAccessibleName(/Saved to your plan/);
    await expect(page.getByTestId('prep-node-2')).toHaveAccessibleName(/All ready/);
    // ... but a guest who reopens the page lands on the guest entry again and Prepare starts empty (observed, not asserted).
    await openGuestApp(page);
    await openPrepare(page);
    const keptAfterReopen = await page.getByTestId('prep-banner').count();
    test.info().annotations.push({ type: 'observation', description: `AC5.9.7: after reopening the page as a guest the Prepare banner count is ${keptAfterReopen} (0 = the home and steps were not kept).` });
    deferredAc('AC5.9.7', 'Kept on this device',
      'Within the open app the home, answers and finished steps stay, but a guest who reopens the page (a full reload) is sent through the guest entry again and Prepare starts empty with no kept house tests, which the guest-entry copy ("Your records will not be kept after you fully close the app") describes. Whether the path persists on the same device for a signed-in account was not verified. The AC says "when I come back on the same device", so it is not claimed as passed.');
  });

  test('US5.10 — Check what paying each month would be like', { tag: '@us5.10' }, async ({ page }) => {
    await seededApp(page);
    await keepPriceTest(page, 600000);
    await openPrepare(page);
    await page.getByTestId('prep-node-0').click();

    await ac('AC5.10.1', 'The monthly payment first', async () => {
      await expect(page.getByTestId('lesson-answer')).toContainText(/RM [\d,.]+ \/month/);
      await expect(page.getByTestId('lesson-answer')).toContainText('90% loan at 4.30%, over 35 years');
      await expect(page.getByTestId('lesson-answer')).toContainText('Your typical month:');
    });

    deferredAc('AC5.10.2', 'Compare with my month, without a rating',
      'The build rates the share with the words Comfortable (35% or less), Tight (up to 50%) and Heavy (above 50%) and colours the rate rows by the same cut-offs (V9 build note; prep7.ts fitOf, strings p7_fit_*). The AC forbids any rating and the cut-offs have no published source, so the required behaviour is not built.');

    await ac('AC5.10.3', 'Where the payment goes', async () => {
      await page.getByTestId('lesson-next').click();
      await expect(page.getByText('Year 1', { exact: true })).toBeVisible();
      await expect(page.getByText('Year 18', { exact: true })).toBeVisible();
      await expect(page.getByText('Year 35', { exact: true })).toBeVisible();
      await expect(page.getByText('Pays down your loan', { exact: true })).toBeVisible();
      await expect(page.getByText('Interest to the bank', { exact: true })).toBeVisible();
      // one interest share for each of the three years shown
      expect(await page.getByText('interest', { exact: true }).count()).toBeGreaterThanOrEqual(3);
    });

    await ac('AC5.10.4', 'Pick how long and how much the bank lends', async () => {
      await page.getByTestId('lesson-next').click();
      for (const years of [25, 30, 35]) {
        await expect(page.getByTestId(`lesson-years-${years}`)).toContainText(`${years} years`);
        await expect(page.getByTestId(`lesson-years-${years}`)).toContainText(/RM [\d,]+/);
        await expect(page.getByTestId(`lesson-years-${years}`)).toContainText(/RM [\d,]+ interest in total/);
      }
      await expect(page.getByText('How much the bank lends', { exact: true })).toBeVisible();
      await expect(page.getByText('80%', { exact: true })).toBeVisible();
      await expect(page.getByText('90%', { exact: true })).toBeVisible();
      await expect(page.locator('body')).toContainText(/You put down RM 60,000\. The bank lends RM 540,000\./);
      await page.getByText('80%', { exact: true }).click();
      await expect(page.locator('body')).toContainText(/You put down RM 120,000\. The bank lends RM 480,000\./);
      await page.getByTestId('lesson-years-25').click();
      await expect(page.getByTestId('lesson-years-25')).toHaveAttribute('aria-checked', 'true');
    });

    await ac('AC5.10.5', 'If rates go up', async () => {
      await page.getByTestId('lesson-next').click();
      await expect(page.getByText('What if rates go up?', { exact: true })).toBeVisible();
      await expect(page.getByText('Now', { exact: true })).toBeVisible();
      await expect(page.getByText('+1%', { exact: true })).toBeVisible();
      await expect(page.getByText('+2%', { exact: true })).toBeVisible();
      await expect(page.getByText('4.30%', { exact: true })).toBeVisible();
      await expect(page.getByText('5.30%', { exact: true })).toBeVisible();
      await expect(page.getByText('6.30%', { exact: true })).toBeVisible();
      await expect(page.locator('body')).toContainText(/could you still pay it every month\?/);
      const before = ((await bodyText(page)).match(/RM [\d,.]+/g) ?? []).join('|');
      await page.getByText("Yes, I'd manage", { exact: true }).click();
      await expect(page.getByText(/Keep your cushion ready anyway/)).toBeVisible();
      const after = ((await bodyText(page)).match(/RM [\d,.]+/g) ?? []).join('|');
      expect(after).toBe(before);
    });

    // The full monthly bill for a landed home; the condo case is checked in the typed-home test below.
    await page.getByTestId('lesson-next').click();
    await expect(page.getByTestId('lesson-bills-total')).toBeVisible();
    await page.getByTestId('lesson-next').click();
    await page.getByTestId('lesson-next').click();
    await expect(page.getByText('Monthly check done', { exact: true })).toBeVisible();

    await ac('AC5.10.8', 'Three numbers to keep', async () => {
      const monthly = (await page.getByTestId('lesson-remember').innerText()).match(/RM [\d,]+/)?.[0] ?? '';
      expect(monthly).not.toBe('');
      await expect(page.getByTestId('lesson-remember')).toContainText('every month');
      await expect(page.getByTestId('lesson-remember')).toContainText('if rates rise 1%');
      await expect(page.getByTestId('lesson-remember')).toContainText('cushion to keep');
      await page.getByText('Full loan summary', { exact: true }).click();
      await expect(page.getByText('Loan amount', { exact: true })).toBeVisible();
      await expect(page.getByText('Interest rate', { exact: true })).toBeVisible();
      await expect(page.getByText('Tenure', { exact: true })).toBeVisible();
      await expect(page.getByText('Total interest over the loan', { exact: true })).toBeVisible();
      await expect(page.getByText('Total you repay the bank', { exact: true })).toBeVisible();
      await expect(page.locator('body')).toContainText(DISCLAIMER);
      await page.getByTestId('lesson-save').click();
      await page.getByLabel('Back').click();
      await expect(page.getByTestId('prep-node-0')).toHaveAccessibleName(/Saved to your plan/);
    });

    deferredAc('AC5.10.9', 'Say where every figure comes from',
      'The build uses no provenance label on this check apart from "Our guess" on the monthly bill (V9 build note); figures from the record or the test are not labelled your data or calculated, the defaults for rate and tenure are not marked as assumptions, and the age-70 rule on Pick how long names no source. The required labelling is not built.');

    await ac('AC5.10.7', 'A cushion from my own months', async () => {
      await page.getByTestId('prep-node-0').click();
      await page.getByText('Cushion', { exact: true }).click();
      await expect(page.getByText('Keep a cushion', { exact: true })).toBeVisible();
      await expect(page.getByText(/Your pot covers RM [\d,]+/)).toBeVisible();
      await expect(page.locator('body')).toContainText(/The biggest drop ran from [A-Za-z]+ to [A-Za-z]+: RM [\d,]+\./);
      const add = page.getByText(/^Add RM [\d,]+ to my saving plan$/);
      await expect(add).toBeVisible();
      await add.click();
      await expect(page.getByText('Saving plan', { exact: true }).first()).toBeVisible();
    });
  });

  test('US5.10 — My full monthly bill for a condo', { tag: '@us5.10' }, async ({ page }) => {
    await openGuestApp(page);
    await openPrepare(page);
    await page.getByLabel('Price').fill('450000');
    await page.getByText('Condo or apartment', { exact: true }).click();
    await page.getByTestId('prep-use-home').click();
    await page.getByTestId('prep-node-0').click();
    await ac('AC5.10.6', 'My full monthly bill', async () => {
      for (let i = 0; i < 4; i += 1) await page.getByTestId('lesson-next').click();
      await expect(page.getByText('Your full monthly bill', { exact: true })).toBeVisible();
      await expect(page.getByText('Loan instalment', { exact: true })).toBeVisible();
      await expect(page.getByText('Quit rent and assessment', { exact: true })).toBeVisible();
      await expect(page.getByText('Fire insurance', { exact: true })).toBeVisible();
      await expect(page.getByText('Maintenance and sinking fund', { exact: true })).toBeVisible();
      // each starting amount is marked as a guess until it is changed
      await expect(page.getByText('Our guess', { exact: true })).toHaveCount(3);
      await expect(page.getByText('Every month', { exact: true })).toBeVisible();
      const before = await page.getByTestId('lesson-bills-total').innerText();
      await page.getByLabel('Fire insurance').fill('90');
      await expect(page.getByText('Our guess', { exact: true })).toHaveCount(2);
      await expect(page.getByTestId('lesson-bills-total')).not.toHaveText(before);
    });
  });

  test('US5.11 — See how buying works for my kind of home', { tag: '@us5.11' }, async ({ page }) => {
    await seededApp(page);
    await keepPriceTest(page, 300000);
    await openPrepare(page);

    await ac('AC5.11.2', 'A subsale in five steps', async () => {
      await page.getByTestId('prep-how').click();
      await expect(page.getByText('Subsale', { exact: true })).toBeVisible();
      await expect(page.getByText('Project', { exact: true })).toBeVisible();
      for (const step of ['Book the home', 'Sign the sale agreement (SPA)', 'Sign the loan agreement', 'Completion, 3 to 4 months later', 'Keys, then the first instalment']) {
        await expect(page.getByText(step, { exact: true })).toBeVisible();
      }
      await expect(page.getByText('You pay', { exact: true })).toHaveCount(4);
      await expect(page.getByText('Bank pays', { exact: true })).toHaveCount(1);
      await expect(page.locator('body')).toContainText(/The bank pays the seller RM [\d,]+\. You pay nothing more here\./);
    });

    await ac('AC5.11.1', 'Subsale or project', async () => {
      await page.getByText('Project', { exact: true }).click();
      await expect(page.getByText('Sign the SPA', { exact: true })).toBeVisible();
      await expect(page.getByText('Book the home', { exact: true })).toHaveCount(0);
      // the choice is kept when I leave Prepare and come back
      await page.getByLabel('Back').click();
      await page.getByRole('tab', { name: 'Money', exact: true }).click();
      await openPrepare(page);
      await expect(page.getByTestId('prep-banner')).toContainText('project');
      await page.getByTestId('prep-how').click();
      await expect(page.getByText('Sign the SPA', { exact: true })).toBeVisible();
    });

    await ac('AC5.11.3', 'A project as it is built', async () => {
      for (const step of ['Sign the SPA', 'While it is being built', 'Keys: water and electricity ready', 'Title and retention']) {
        await expect(page.getByText(step, { exact: true }).first()).toBeVisible();
      }
      await expect(page.locator('body')).toContainText(/You pay interest only on what has been paid out/);
      await page.getByText('Full payment schedule (Schedule H)', { exact: true }).click();
      await expect(page.getByText('Stakeholder retention', { exact: true })).toBeVisible();
      await expect(page.getByText('Total', { exact: true })).toBeVisible();
    });

    deferredAc('AC5.11.4', 'Timings and shares name their source',
      'No timing or share on How buying works carries a source or a checked date ("usually 2 to 3%", "within about 14 days", "3 to 4 months later", the Schedule H stage percentages) and the amounts carry no provenance label; Schedule H is named without its regulation (V9 build note). The required sourcing is not built.');
  });
});
