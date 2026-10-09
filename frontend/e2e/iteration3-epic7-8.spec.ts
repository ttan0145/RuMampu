import { expect, Page } from '@playwright/test';
import { e2eGet, e2ePost, test } from './support/fixtures';
import { API, openApp, openGuestApp, syncClientIdFromBrowser } from './support/app';
import { billReminderDateForMonth, isValidReminderDay, nextBillReminderDates } from '../src/rumampu/reminder-date';

async function openEarlierHousingTest(page: Page): Promise<void> {
  const loaded = await e2ePost(page, `${API}/dev/scenarios/my-gig-driver-12m/load/`, {
    data: { confirm_reset: true },
  });
  expect(loaded.status()).toBe(201);
  await openApp(page);
  await page.getByRole('tab', { name: 'House', exact: true }).click();
  await page.getByText('Test a house', { exact: true }).click();
  await page.locator('input:visible').nth(0).fill('250000');
  await page.getByText('The house', { exact: true }).click();
  await page.getByText('Run the test', { exact: true }).last().click();
  await expect(page.getByText('2 of 12 months would run short', { exact: true })).toBeVisible();
}


test('Iteration 3 Epic 7 saves an actual homeowner month and shows the cash position', async ({ page }) => {
  await openGuestApp(page);
  await syncClientIdFromBrowser(page);

  const record = await e2eGet(page, `${API}/income/record/`);
  const payload = await record.json();
  const source = payload.sources.find((item: { slug: string }) => item.slug === 'ehail');
  const income = await e2ePost(page, `${API}/income/entries/`, {
    data: {
      amount: '3500.00', date: '2026-09-04', source_id: source.id,
      entry_method: 'manual', confirm_outlier: true,
    },
  });
  expect(income.status()).toBe(201);
  const workCosts = await e2eGet(page, `${API}/work-costs/`);
  const petrol = (await workCosts.json()).find((item: { slug: string }) => item.slug === 'petrol');
  const workCost = await e2ePost(page, `${API}/work-costs/entries/`, {
    data: { amount: '500.00', date: '2026-09-05', category_id: petrol.id },
  });
  expect(workCost.status()).toBe(201);

  await page.getByRole('tab', { name: 'House', exact: true }).click();
  // v7 design: the House tab's "I've bought a home" opens Got the keys?
  await page.getByText('I’ve bought a home', { exact: true }).click();
  await expect(page.getByText('You can change the month later.', { exact: true })).toBeVisible();
  await expect(page.getByText('Estimates become actuals. The purchase itself happens outside RuMampu.', { exact: true })).toBeVisible();
  await page.getByLabel('Month you bought').fill('2026-09');
  await page.getByTestId('keys-bought').click();
  await page.getByTestId('keys-record').click();

  const homeCosts = page.getByLabel('Actual home costs');
  await homeCosts.click();
  await homeCosts.pressSequentially('2800');
  await homeCosts.blur();
  const savedResponse = page.waitForResponse(response =>
    response.request().method() === 'PUT' && response.url().endsWith('/api/v1/homeownership/months/')
  );
  await page.getByRole('button', { name: 'Save this month', exact: true }).click();
  expect((await savedResponse).status()).toBe(200);

  await expect(page.getByText('RM 3,500', { exact: true })).toBeVisible();
  await expect(page.getByText('− RM 500', { exact: true })).toBeVisible();
  await expect(page.getByText('RM 3,000', { exact: true })).toBeVisible();
  await expect(page.getByText('RM 200', { exact: true })).toBeVisible();
  const saved = await e2eGet(page, `${API}/homeownership/months/`);
  expect(saved.status()).toBe(200);
  expect((await saved.json()).months[0]).toMatchObject({
    month: '2026-09', recorded_income: '3500.00', work_costs: '500.00',
    income_after_work_costs: '3000.00', actual_home_costs: '2800.00', cash_position: '200.00', short: false,
  });
});

test('Epic 7 comparison distinguishes a missing earlier test from missing actual months', async ({ page }) => {
  await openGuestApp(page);
  await page.getByRole('tab', { name: 'House', exact: true }).click();
  // v7 design: the House tab's "I've bought a home" opens Got the keys?
  await page.getByText('I’ve bought a home', { exact: true }).click();
  await page.getByLabel('Month you bought').fill('2026-10');
  await page.getByTestId('keys-bought').click();
  await page.getByTestId('keys-mbm').click();

  await expect(page.getByText('No earlier housing test is available.', { exact: true })).toBeVisible();
  await expect(page.getByText('No completed post-purchase month yet', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Record a month', exact: true })).toBeVisible();
  await expect(page.getByText('0 of 0', { exact: true })).toHaveCount(0);
});

test('Epic 7 keeps the earlier test visible before the first actual month is complete', async ({ page }) => {
  await openEarlierHousingTest(page);
  await page.getByRole('tab', { name: 'House', exact: true }).click();
  // v7 design: the House tab's "I've bought a home" opens Got the keys?
  await page.getByText('I’ve bought a home', { exact: true }).click();
  await page.getByLabel('Month you bought').fill('2026-10');
  await page.getByTestId('keys-bought').click();
  await page.getByTestId('keys-mbm').click();

  await expect(page.getByText('YOUR EARLIER TEST', { exact: true })).toBeVisible();
  await expect(page.getByText('2 of 12', { exact: true })).toBeVisible();
  await expect(page.getByText('recorded months would have run short', { exact: true })).toBeVisible();
  await expect(page.getByText(/CALCULATED/)).toBeVisible();
  await expect(page.getByText('No completed post-purchase month yet', { exact: true })).toBeVisible();
  await expect(page.getByText('0 of 0', { exact: true })).toHaveCount(0);
});

test('Epic 7 actual home cost starts empty and gains YOUR DATA only after save', async ({ page }) => {
  await openGuestApp(page);
  await page.getByRole('tab', { name: 'House', exact: true }).click();
  // v7 design: the House tab's "I've bought a home" opens Got the keys?
  await page.getByText('I’ve bought a home', { exact: true }).click();
  await page.getByLabel('Month you bought').fill('2026-10');
  await page.getByTestId('keys-bought').click();
  await page.getByTestId('keys-record').click();

  const homeCosts = page.getByLabel('Actual home costs');
  const card = page.getByTestId('pv-actual-cost-card');
  await expect(homeCosts).toHaveValue('');
  await expect(card.getByText(/YOUR DATA/)).toHaveCount(0);
  await homeCosts.fill('1234');
  await page.getByRole('button', { name: 'Save this month', exact: true }).click();
  await expect(card.getByText(/YOUR DATA/)).toBeVisible();
});


test('Iteration 3 Epic 8 offers income and expense reminders and keeps retention safeguards system-managed', async ({ page }) => {
  await openGuestApp(page);
  await page.getByRole('tab', { name: 'Profile', exact: true }).click();

  await expect(page.getByText('Notifications', { exact: true })).toBeVisible();
  const incomeSwitch = page.getByRole('switch', { name: 'Income reminder' });
  const expenseSwitch = page.getByRole('switch', { name: 'Expenses reminder' });
  await expect(incomeSwitch).not.toBeChecked();
  await expect(expenseSwitch).not.toBeChecked();
  await expect(page.getByRole('switch', { name: 'Bill reminders' })).toHaveCount(0);
  await expect(page.getByRole('switch', { name: 'Record safety warnings' })).toHaveCount(0);
  await expect(page.getByText('Reminders are optional. Record-retention safeguards remain automatic.', { exact: true })).toBeVisible();

  // Turning a reminder on opens the sheet; cancelling leaves it off.
  await incomeSwitch.click();
  await expect(page.getByText('Choose when RuMampu reminds you to note what you earned.', { exact: true })).toBeVisible();
  for (const repeat of ['Every day', 'Every week', 'Every month']) {
    await expect(page.getByRole('radio', { name: repeat, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('radio', { name: 'Once', exact: true })).toHaveCount(0);
  await page.getByText('Cancel', { exact: true }).click();
  await expect(incomeSwitch).not.toBeChecked();
});

test('bill reminder dates accept 1–31 and clamp missing days to the month end', () => {
  for (const day of [1, 28, 29, 30, 31]) expect(isValidReminderDay(day)).toBeTruthy();
  for (const day of [0, 32, -1, 1.5, Number.NaN]) expect(isValidReminderDay(day)).toBeFalsy();

  const cases: Array<[number, number, number, number]> = [
    [2027, 3, 31, 30],
    [2027, 1, 31, 28],
    [2028, 1, 31, 29],
    [2027, 1, 30, 28],
    [2028, 1, 29, 29],
  ];
  for (const [year, month, selectedDay, expectedDay] of cases) {
    const scheduled = billReminderDateForMonth(year, month, selectedDay, '18:45');
    expect(scheduled.getDate()).toBe(expectedDay);
    expect(scheduled.getHours()).toBe(18);
    expect(scheduled.getMinutes()).toBe(45);
  }

  const rolling = nextBillReminderDates(31, '09:15', new Date(2027, 0, 1, 0, 0), 4);
  expect(rolling.map(date => [date.getMonth(), date.getDate()])).toEqual([
    [0, 31], [1, 28], [2, 31], [3, 30],
  ]);
  expect(rolling.every(date => date.getHours() === 9 && date.getMinutes() === 15)).toBeTruthy();
});

test('income and expense reminders keep their own repeat and time, and bills no longer carry reminders', async ({ page }) => {
  await openGuestApp(page);
  await page.getByRole('tab', { name: 'Money', exact: true }).click();
  await page.getByText('Bills and limits', { exact: true }).click();
  await expect(page.getByText('Enter the bills you usually pay each month.', { exact: true })).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Rent reminder' })).toHaveCount(0);

  await page.getByRole('tab', { name: 'Profile', exact: true }).click();
  const incomeSwitch = page.getByRole('switch', { name: 'Income reminder' });
  const expenseSwitch = page.getByRole('switch', { name: 'Expenses reminder' });

  await incomeSwitch.click();
  await page.getByRole('radio', { name: 'Every day', exact: true }).click();
  await page.getByLabel('Time (24-hour HH:MM)').fill('21:00');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(incomeSwitch).toBeChecked();
  await expect(page.getByText('Every day, 21:00', { exact: true })).toBeVisible();

  await expenseSwitch.click();
  await page.getByRole('radio', { name: 'Every month', exact: true }).click();
  for (const invalidDay of ['0', '32', 'not-a-day']) {
    await page.getByLabel('Day of month').fill(invalidDay);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Choose a whole number from 1 to 31.', { exact: true })).toBeVisible();
  }
  await page.getByRole('radio', { name: 'Every week', exact: true }).click();
  await page.getByRole('radio', { name: 'Mon', exact: true }).click();
  await page.getByLabel('Time (24-hour HH:MM)').fill('08:30');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(expenseSwitch).toBeChecked();
  await expect(page.getByText('Every Mon, 08:30', { exact: true })).toBeVisible();

  // Turning one off is immediate and leaves the other as it was.
  await incomeSwitch.click();
  await expect(incomeSwitch).not.toBeChecked();
  await expect(expenseSwitch).toBeChecked();

  await expect.poll(async () => page.evaluate(() => {
    const local = JSON.parse(window.localStorage.getItem('rumampu_local_state') || '{}');
    return local.notificationPreferences?.reminders || {};
  })).toEqual({
    income: expect.objectContaining({ repeat: 'daily', time: '21:00', enabled: false }),
    expenses: expect.objectContaining({ repeat: 'weekly', weekday: 1, time: '08:30', enabled: true }),
  });
});
