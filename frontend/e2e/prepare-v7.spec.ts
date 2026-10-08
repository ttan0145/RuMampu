import { expect, Page } from '@playwright/test';
import { e2ePost, test } from './support/fixtures';
import { API, openGuestApp, pinGuestClientId } from './support/app';

/* Prepare for a house (v7 design): the path of three checks, and "Can I pay
   each month?" as a six-screen lesson. Starts from the twelve-month gig-driver
   scenario with a kept RM 300,000 price test, so every figure is from the server. */

async function keepPriceTest(page: Page, price: number): Promise<void> {
  await page.getByRole('tab', { name: 'House', exact: true }).click();
  await page.getByText('Test a house', { exact: true }).click();
  const fromPrice = page.getByText('Work it out from the price instead', { exact: true });
  const priceLabel = page.getByText('Property price', { exact: true });
  await expect(priceLabel.or(fromPrice).first()).toBeVisible();
  if (await fromPrice.isVisible()) await fromPrice.click();
  await page.locator('input:visible').nth(0).fill(String(price));
  await page.getByText('The house', { exact: true }).click();
  await page.getByText('Run the test', { exact: true }).last().click();
  await expect(page.getByText(/months would run short|All \d+ months would carry it/)).toBeVisible();
  await page.getByText('Save test', { exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Save test', exact: true }).click();
  await expect(page.getByText('Saved tests', { exact: true }).first()).toBeVisible();
}

test('Prepare path: the monthly lesson runs six screens and saving it moves the path on', async ({ page }) => {
  await pinGuestClientId(page);
  const loaded = await e2ePost(page, `${API}/dev/scenarios/my-gig-driver-12m/load/`, { data: { confirm_reset: true } });
  expect(loaded.status()).toBe(201);
  await openGuestApp(page);
  await keepPriceTest(page, 300000);

  await page.getByRole('tab', { name: 'House', exact: true }).click();
  await page.getByText('Prepare for a house', { exact: true }).click();
  await expect(page.getByTestId('prep-banner')).toContainText('RM 300,000');
  await expect(page.getByTestId('prep-bubble')).toContainText('3 things left before you buy.');
  await expect(page.getByTestId('prep-node-2')).toHaveAccessibleName(/^Documents & financing: Is my paperwork ready\? 0 of 5 documents/);

  await page.getByTestId('prep-node-0').click();
  await expect(page.getByTestId('lesson-answer')).toBeVisible();
  await expect(page.getByTestId('lesson-answer')).toContainText('90% loan at 4.30%, over 35 years');
  await expect(page.getByRole('progressbar')).toHaveAccessibleName('Step 1 of 6');

  await page.getByTestId('lesson-next').click();                       // 2: where the payment goes
  await expect(page.getByText('Year 1', { exact: true })).toBeVisible();
  await page.getByTestId('lesson-next').click();                       // 3: pick how long
  const answer = await page.getByTestId('lesson-years-25').innerText();
  await page.getByTestId('lesson-years-25').click();
  await expect(page.getByTestId('lesson-years-25')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('lesson-next').click();                       // 4: rates
  await expect(page.getByText('Skip', { exact: true })).toBeVisible();
  await page.getByText("Yes, I'd manage", { exact: true }).click();
  await expect(page.getByText(/Keep your cushion ready anyway/)).toBeVisible();
  await page.getByTestId('lesson-next').click();                       // 5: full monthly bill
  await expect(page.getByTestId('lesson-bills-total')).toBeVisible();
  await expect(page.getByText('Quit rent and assessment', { exact: true })).toBeVisible();
  await page.getByTestId('lesson-next').click();                       // 6: cushion
  await expect(page.getByText('Keep a cushion', { exact: true })).toBeVisible();
  await page.getByTestId('lesson-next').click();                       // summary

  await expect(page.getByText('Monthly check done', { exact: true })).toBeVisible();
  // the 25-year choice carries into the numbers to remember
  const monthly = answer.match(/RM [\d,]+/)?.[0] ?? '';
  await expect(page.getByTestId('lesson-remember')).toContainText(monthly);
  await page.getByTestId('lesson-save').click();
  await page.getByLabel('Back').click();

  await expect(page.getByTestId('prep-bubble')).toContainText('2 things left before you buy.');
  await expect(page.getByTestId('prep-node-0')).toHaveAccessibleName(/Saved to your plan/);
});

test('AC7.1.1: with no home yet, Prepare still leads to homeownership monitoring', async ({ page }) => {
  await openGuestApp(page);
  await page.getByRole('tab', { name: 'House', exact: true }).click();
  await page.getByText('Prepare for a house', { exact: true }).click();
  await expect(page.getByTestId('prep-use-home')).toBeVisible();
  await page.getByTestId('prep-monitoring').click();

  await expect(page.getByText('Homeownership monitoring', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/preview|prototype/i)).toHaveCount(0);
  await expect(page.getByText('Once you buy, keep recording your months. RuMampu puts your earlier test beside what actually happened.', { exact: true })).toBeVisible();
  await expect(page.getByText('This separates planning months from the months after you bought the home.', { exact: true })).toBeVisible();
  await expect(page.getByText('Estimates become actuals. The purchase itself happens outside RuMampu.', { exact: true })).toBeVisible();
});
