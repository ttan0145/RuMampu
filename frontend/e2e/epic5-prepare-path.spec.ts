import { expect, Page } from '@playwright/test';
import { e2ePost, test } from './support/fixtures';
import { ac } from './support/acceptance';
import { API, endGuestSession, openGuestFast, reloadApp, seedKeptTest } from './support/app';

/* Epic 5, Iteration 3 — US5.9 Prepare for one home, US5.10 the monthly check, US5.11 How buying works.
   Written from the Prepare path as built on 8 October 2026 (commit 1c037a7) against the V9 requirement text.
   Where the build contradicts the V9 wording, the AC is registered with deferredAc() (from ./support/acceptance)
   and the reason is written down instead of being made to pass. */

test.setTimeout(300_000);

const DISCLAIMER = 'Illustration only. Not a loan offer or approval.';

async function keepPriceTest(page: Page, price: number): Promise<void> {
  await page.getByRole('tab', { name: 'House', exact: true }).click();
  // A first visit shows Test a house; once a test is kept (Home and Saving v2) the entry is the Your dream house card, which opens the last result.
  const testEntry = page.getByText('Test a house', { exact: true }).or(page.getByText('Your dream house', { exact: true }));
  await testEntry.first().click();
  const editHouse = page.getByText('Edit house', { exact: true });
  if (await editHouse.isVisible({ timeout: 3000 }).catch(() => false)) await editHouse.click();
  const fromPrice = page.getByText('Work it out from the price instead', { exact: true });
  const priceLabel = page.getByText('Property price', { exact: true });
  await expect(priceLabel.or(fromPrice).first()).toBeVisible();
  if (await fromPrice.isVisible()) await fromPrice.click();
  await page.getByPlaceholder('e.g. 250,000').fill(String(price));
  await page.getByText('The house', { exact: true }).click();
  await page.getByText('Run the test', { exact: true }).last().click();
  const result = page.getByText(/months would run short|All \d+ months would carry it/);
  const noCommitments = page.getByText('I have no commitments', { exact: true });
  await expect(result.or(noCommitments).first()).toBeVisible();
  if (await noCommitments.isVisible()) await noCommitments.click();
  await expect(result).toBeVisible();
  // Home and Saving v2 (d992fa4): every test that runs is kept straight away under its price; the House tab lists it under Saved tests.
  await page.getByRole('tab', { name: 'House', exact: true }).click();
  await expect(page.getByText('Saved tests', { exact: true }).first()).toBeVisible();
}

/* Loads the 12-month record through the API, seeds the house tests this spec starts from, then opens the app past the entry. */
async function seededApp(page: Page, prices: number[] = []): Promise<void> {
  const loaded = await e2ePost(page, `${API}/dev/scenarios/my-gig-driver-12m/load/`, { data: { confirm_reset: true } });
  expect(loaded.status()).toBe(201);
  for (const price of prices) await seedKeptTest(page, price);
  await openGuestFast(page);
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
  let accountToken: string | undefined;
  test.afterEach(async ({ page }) => {
    if (!accountToken) return;
    const cleanup = await page.request.delete(`${API}/auth/record/`, { headers: { Authorization: `Token ${accountToken}` } });
    accountToken = undefined;
    expect([200, 204]).toContain(cleanup.status());
  });

  test('US5.9 — Kept on this device for a signed-in account', { tag: '@us5.9' }, async ({ page }) => {
    const email = `epic5-prepare-${Date.now()}@example.com`, password = 'Passw0rd123';
    const registered = await page.request.post(`${API}/auth/register/`, { data: { email, password } });
    expect(registered.status()).toBe(201);
    const { token } = await registered.json();
    accountToken = token;
    const seeded = await page.request.patch(`${API}/auth/me/`, { headers: { Authorization: `Token ${token}` }, data: { preferred_language: 'en', onboarding_completed: true } });
    expect(seeded.status()).toBe(200);
    await endGuestSession(page);
    await page.goto('/');
    await page.getByPlaceholder('name@example.com').fill(email);
    await page.getByPlaceholder('Your password').fill(password);
    const response = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/auth/login/'));
    await page.getByText('Log in', { exact: true }).last().click();
    expect((await response).status()).toBe(200);
    await page.getByRole('tab', { name: 'Home', exact: true }).click({ trial: true, timeout: 90_000 });

    await test.step('AC5.9.7 for a signed-in account', async () => {
      await keepPriceTest(page, 300000);
      await openPrepare(page);
      await page.getByTestId('prep-node-2').click();
      // the account keeps the ticks on the server; wait for the save that carries all five before reloading
      const saved = page.waitForResponse(r => r.request().method() === 'PATCH' && r.url().endsWith('/auth/me/')
        && (r.request().postDataJSON()?.docs_checked?.length ?? 0) === 5);
      for (const key of ['dc_bank', 'dc_ehail', 'dc_statdec', 'dc_epf', 'dc_commitlist']) {
        await page.getByTestId(`doc-${key}`).click();
      }
      expect((await saved).status()).toBe(200);
      await page.getByLabel('Back').click();
      await reloadApp(page);
      await openPrepare(page);
      await expect(page.getByTestId('prep-banner')).toContainText('RM 300,000');
      await expect(page.getByTestId('prep-node-2')).toHaveAccessibleName(/All ready/);
    });
  });

  test('US5.9 — Choose or type a home first', { tag: '@us5.9' }, async ({ page }) => {
    await openGuestFast(page);
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
    await seededApp(page, [300000, 400000]);

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

    await ac('AC5.9.5', 'Say what is left without a verdict', async () => {
      // two steps are done, so the line counts what is left and names the next one: the cash
      await expect(page.getByTestId('prep-bubble')).toContainText('1 thing left before you buy.');
      await expect(page.getByTestId('prep-bubble')).toContainText(/You have \d+% of the cash\. RM [\d,]+ to go\./);
      // enough cash on hand covers what the home needs, so all three steps are done
      await page.getByTestId('prep-node-1').click();
      await page.getByLabel('Cash I have now', { exact: true }).fill('100000');
      await page.getByLabel('Back').click();
      await expect(page.getByTestId('prep-node-1')).toHaveAccessibleName(/Covered/);
      // ... and the line says so without calling me ready or approved (copy changed 2026-10-09)
      await expect(page.getByTestId('prep-bubble')).toContainText('All three steps are done. Save your plan for your own reference.');
      await expect(page.getByTestId('prep-bubble')).not.toContainText(/ready to buy|approved/i);
    });

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

    await ac('AC5.9.7', 'Kept on this device', async () => {
      // a reload of the same tab keeps the guest record, so the home and the finished steps are still there
      await reloadApp(page);
      await openPrepare(page);
      await expect(page.getByTestId('prep-banner')).toContainText('RM 300,000');
      await expect(page.getByTestId('prep-node-0')).toHaveAccessibleName(/Saved to your plan/);
      await expect(page.getByTestId('prep-node-1')).toHaveAccessibleName(/Covered/);
      await expect(page.getByTestId('prep-node-2')).toHaveAccessibleName(/All ready/);
      // closing the tab ends the guest session: a new tab in the same browser starts at the guest entry
      const tab = await page.context().newPage();
      await tab.goto('/');
      await expect(tab.getByText('Continue as guest', { exact: true }).last()).toBeVisible({ timeout: 30000 });
      await tab.close();
    });
  });

  test('US5.10 — Check what paying each month would be like', { tag: '@us5.10' }, async ({ page }) => {
    await seededApp(page, [600000]);
    await openPrepare(page);
    await page.getByTestId('prep-node-0').click();

    await ac('AC5.10.1', 'The monthly payment first', async () => {
      await expect(page.getByTestId('lesson-answer')).toContainText(/RM [\d,.]+ \/month/);
      await expect(page.getByTestId('lesson-answer')).toContainText('90% loan at 4.30%, over 35 years');
      await expect(page.getByTestId('lesson-answer')).toContainText('Your typical month:');
    });

    await ac('AC5.10.2', 'Compare with my month: the share in figures and words', async () => {
      // the share of the typical month, as a figure and in words; the Comfortable / Tight / Heavy word
      // beside it stays by the owner's decision of 2026-10-09 (docs/epic-5/README.md)
      await expect(page.getByTestId('lesson-fit-fact')).toContainText(/the instalment is RM [\d,]+, about \d+% of your typical month\./);
      await expect(page.getByTestId('lesson-answer')).toContainText(/\d+% loan/);
    });

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

    // AC5.10.9 (where every figure comes from) walks the six screens in its own test below.

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
    await openGuestFast(page);
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

  test('US5.10 — Say where every figure comes from', { tag: '@us5.10' }, async ({ page }) => {
    await seededApp(page, [600000]);
    await openPrepare(page);
    await page.getByTestId('prep-node-0').click();

    await ac('AC5.10.9', 'Say where every figure comes from', async () => {
      // the first screen: the instalment is calculated; the test carries RuMampu's 4.30% and 35 years, so the terms are an assumption
      await expect(page.getByTestId('prov-answer')).toContainText('CALCULATED');
      await expect(page.getByTestId('prov-terms')).toContainText('ASSUMPTION');
      await page.getByTestId('lesson-prov-info').click();
      await expect(page.getByText('Where these figures come from', { exact: true })).toBeVisible();
      await expect(page.getByText(/Monthly instalment: worked out from the price/)).toBeVisible();
      await expect(page.getByText(/RuMampu's usual starting point/)).toBeVisible();
      await page.getByText('Done', { exact: true }).click();
      await expect(page.getByText('Where these figures come from', { exact: true })).toHaveCount(0);
      // where the payment goes: calculated
      await page.getByTestId('lesson-next').click();
      await expect(page.getByTestId('prov-split')).toContainText('CALCULATED');
      // pick how long: the figures are calculated, and the age rule names its source
      await page.getByTestId('lesson-next').click();
      await expect(page.getByTestId('prov-lends')).toContainText('CALCULATED');
      await page.getByLabel('Your age').fill('40');
      await expect(page.locator('body')).toContainText('Banks commonly end the loan by age 70, so up to 30 years for you.');
      await expect(page.getByTestId('fact-age')).toContainText('Common practice, not a legal rule. CIMB lends up to 35 years or to age 70, whichever is earlier; other banks set their own limit. Source: CIMB: Home loan. Checked 9 October 2026.');
      await page.getByLabel('Your age').fill('');
      // what if rates go up: the higher rates are what-ifs
      await page.getByTestId('lesson-next').click();
      await expect(page.getByTestId('prov-rates')).toContainText('CALCULATED');
      await expect(page.getByTestId('prov-whatif')).toContainText('ASSUMPTION');
      await expect(page.getByText('+1% and +2% are what-ifs, not a forecast.', { exact: true })).toBeVisible();
      // the full monthly bill: the instalment is calculated, a guess stays a guess, a changed amount is my data
      await page.getByTestId('lesson-next').click();
      await expect(page.getByTestId('prov-inst')).toContainText('CALCULATED');
      await expect(page.getByText('Our guess', { exact: true })).toHaveCount(2);
      await page.getByLabel('Fire insurance').fill('90');
      await expect(page.getByTestId('prov-fire')).toContainText('YOUR DATA');
      await expect(page.getByText('Our guess', { exact: true })).toHaveCount(1);
      // the cushion comes from my recorded months
      await page.getByTestId('lesson-next').click();
      await expect(page.getByTestId('prov-cushion')).toContainText('CALCULATED');
      // the summary: three calculated numbers, and the loan summary says which rows are assumed and which are calculated
      await page.getByTestId('lesson-next').click();
      await expect(page.getByText('Monthly check done', { exact: true })).toBeVisible();
      await expect(page.getByTestId('prov-remember')).toContainText('CALCULATED');
      await page.getByText('Full loan summary', { exact: true }).click();
      await expect(page.getByTestId('prov-sum-terms')).toContainText('ASSUMPTION');
      await expect(page.getByTestId('prov-sum-calc')).toContainText('CALCULATED');
    });
  });

  test('US5.11 — See how buying works for my kind of home', { tag: '@us5.11' }, async ({ page }) => {
    await seededApp(page, [300000]);
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

    await ac('AC5.11.4', 'Timings and shares name their source', async () => {
      // project: the shares name their regulation and say they are not yet checked against the gazette text
      await expect(page.getByTestId('fact-sched').first()).toContainText('Unverified. Shares follow Schedule H of the Housing Development (Control and Licensing) Regulations 1989 for strata homes');
      await expect(page.getByTestId('fact-sched').first()).toContainText('secondary sources read 9 October 2026');
      await expect(page.getByTestId('fact-sched').first()).toContainText('Source: Housing Development (Control and Licensing) Regulations 1989, Schedule H.');
      await expect(page.getByTestId('prov-tl-uc_keys')).toContainText('CALCULATED');
      // subsale: each timing carries its status, its source and the checked date, or is marked unverified
      await page.getByText('Subsale', { exact: true }).click();
      await expect(page.getByTestId('fact-book')).toContainText('Common practice, not a legal rule. Source: Agent and lawyer guides (iProperty, DNH, HBA). Checked 9 October 2026.');
      await expect(page.getByTestId('fact-spa')).toContainText('Common practice, not a legal rule. Your offer letter sets the date. Source: Agent and lawyer guides (iProperty, DNH, HBA). Checked 9 October 2026.');
      await expect(page.getByTestId('fact-comp')).toContainText('Many agreements give 3 months, plus 1 month with interest.');
      await expect(page.getByTestId('fact-keys')).toContainText('Unverified. The bank sets when the first instalment is due.');
      // every amount carries its provenance label: the 2% earnest deposit is RuMampu's assumption, the rest is calculated
      await expect(page.getByTestId('prov-tl-book')).toContainText('ASSUMPTION');
      await expect(page.getByTestId('prov-tl-spa')).toContainText('CALCULATED');
      await expect(page.getByTestId('prov-tl-comp')).toContainText('CALCULATED');
      await expect(page.getByTestId('prov-tl-keys')).toContainText('CALCULATED');
    });
  });
});
