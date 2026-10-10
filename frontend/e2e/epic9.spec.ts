import { expect, Page } from '@playwright/test';
import { test } from './support/fixtures';
import { openGuestApp, syncClientIdFromBrowser } from './support/app';

const ACTION_PREVIEW = '**/api/v1/assistant/action-preview/';

async function acceptAiDisclosure(page: Page): Promise<void> {
  const disclosure = page.getByText('Before you use RuMampu AI', { exact: true });
  if (await disclosure.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Continue with AI', exact: true }).click();
  }
}

async function openTypedVoiceFallback(page: Page): Promise<void> {
  await page.getByLabel('What would you like to add?').click();
  await page.getByText('Say it', { exact: true }).click();
  await acceptAiDisclosure(page);
  await expect(page.getByLabel('Type what you earned or spent instead')).toBeVisible();
}

async function submitDescription(page: Page, text: string): Promise<void> {
  await page.getByLabel('Type what you earned or spent instead').fill(text);
  await page.getByText('Read it', { exact: true }).click();
  await acceptAiDisclosure(page);
}

async function installFakeSpeechRecognition(page: Page): Promise<void> {
  await page.evaluate(() => {
    class FakeSpeechRecognition extends EventTarget {
      lang = '';
      interimResults = false;
      continuous = false;
      maxAlternatives = 1;
      start() {
        (window as any).__speechStarts = ((window as any).__speechStarts || 0) + 1;
        this.dispatchEvent(new Event('start'));
      }
      stop() { this.dispatchEvent(new Event('end')); }
      abort() {
        (window as any).__speechAborts = ((window as any).__speechAborts || 0) + 1;
        this.dispatchEvent(new Event('end'));
      }
    }
    Object.defineProperty(window, 'SpeechRecognition', { value: FakeSpeechRecognition, configurable: true });
  });
}

test.describe('Epic 9 — Voice Assisted Quick Entry', { tag: '@epic9' }, () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true });
      Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined, configurable: true });
      localStorage.setItem('rumampu_local_state', JSON.stringify({ version: 1, aiDisclosureAccepted: true }));
    });
    await openGuestApp(page);
    await syncClientIdFromBrowser(page);
  });

  test('local fallback understands colloquial amounts and spoken dates', async ({ page }) => {
    await page.route(ACTION_PREVIEW, route => route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'assistant_unavailable', message: 'offline' } }),
    }));
    await openTypedVoiceFallback(page);
    await submitDescription(page, 'I earned twelve fifty from Grab last Friday');

    await expect(page.getByText('Check before saving', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Amount')).toHaveValue('12.5');
    await expect(page.getByText('E-hailing', { exact: true })).toBeVisible();
    await expect(page.getByText('Please check', { exact: true })).toHaveCount(0);
  });

  test('local fallback keeps a separate spoken date for each entry', async ({ page }) => {
    await page.route(ACTION_PREVIEW, route => route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'assistant_unavailable', message: 'offline' } }),
    }));
    await openTypedVoiceFallback(page);
    await submitDescription(page, 'earned 50 from Grab today then spent 10 on petrol yesterday');

    await expect(page.getByLabel('Date')).toHaveCount(2);
    await expect(page.getByText('Today', { exact: true })).toHaveCount(1);
    await expect(page.getByText('Yesterday', { exact: true })).toHaveCount(1);
  });

  test('partial understanding transfers proposed fields into Manual entry', async ({ page }) => {
    await page.route(ACTION_PREVIEW, route => route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'assistant_unavailable', message: 'offline' } }),
    }));
    await openTypedVoiceFallback(page);
    await submitDescription(page, 'earned 20 today');

    await page.getByRole('button', { name: 'Finish in Manual entry', exact: true }).click();
    await expect(page.getByText('Proposed from voice', { exact: true })).toHaveCount(2);
    await expect(page.locator('input[inputmode="decimal"]').first()).toHaveValue('20');
    await expect(page.getByRole('radio', { name: 'E-hailing', exact: true })).toHaveAttribute('aria-checked', 'false');
  });

  test('page exit aborts Say an entry recognition and clears the draft', async ({ page }) => {
    await installFakeSpeechRecognition(page);
    await page.getByLabel('What would you like to add?').click();
    await page.getByText('Say it', { exact: true }).click();
    await acceptAiDisclosure(page);
    await page.getByRole('button', { name: 'Continue with microphone', exact: true }).click();
    await expect(page.getByText(/Listening…/)).toBeVisible();

    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));

    await expect.poll(() => page.evaluate(() => (window as any).__speechAborts || 0)).toBe(1);
    await expect(page.getByText(/Listening…/)).toHaveCount(0);
    await expect(page.getByText('You said', { exact: true })).toHaveCount(0);
  });

  test('opening Ask Ruma ends Say an entry before its microphone can start', async ({ page }) => {
    await installFakeSpeechRecognition(page);
    await page.getByLabel('What would you like to add?').click();
    await page.getByText('Say it', { exact: true }).click();
    await acceptAiDisclosure(page);
    await page.getByRole('button', { name: 'Continue with microphone', exact: true }).click();
    await expect(page.getByText(/Listening…/)).toBeVisible();

    /* The quick-add veil normally prevents this click. Invoke the control
       directly to verify the invariant if surfaces overlap programmatically. */
    await page.getByLabel('Ask Ruma', { exact: true }).evaluate((element: HTMLElement) => element.click());

    await expect.poll(() => page.evaluate(() => (window as any).__speechAborts || 0)).toBe(1);
    await expect(page.getByPlaceholder('Type a question')).toBeVisible();
    await expect(page.getByText(/Listening…/)).toHaveCount(0);
  });

  test('unclear fields must be confirmed or corrected before save', async ({ page }) => {
    await page.route(ACTION_PREVIEW, route => route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'assistant_unavailable', message: 'offline' } }),
    }));
    await openTypedVoiceFallback(page);
    await submitDescription(page, 'spent 20 on something today');

    const save = page.getByRole('button', { name: 'Save', exact: true });
    await expect(page.getByText('Please check', { exact: true })).toBeVisible();
    await expect(save).toBeDisabled();
    await page.getByRole('button', { name: 'I checked this draft', exact: true }).click();
    await expect(save).toBeDisabled();
    await page.getByLabel('Category').click();
    await page.getByText('Other', { exact: true }).click();
    await expect(save).toBeEnabled();
  });

  test('Ask Ruma leaves an unclear expense category blank for the user', async ({ page }) => {
    await page.route(ACTION_PREVIEW, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ready',
        message: '',
        actions: [{
          kind: 'expense', amount: '20.00', date: '2026-10-06', target_id: '', target_label: '',
        }],
      }),
    }));

    await page.getByLabel('Ask Ruma', { exact: true }).click();
    await acceptAiDisclosure(page);
    await page.getByPlaceholder('Type a question').fill('I spent 20 today');
    await page.getByLabel('Send').click();

    const confirm = page.getByRole('button', { name: 'Confirm and save', exact: true });
    await expect(page.getByText('Review before saving', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Category', { exact: true })).toBeVisible();
    await expect(confirm).toBeDisabled();

    await page.getByRole('button', { name: 'Meals', exact: true }).click();
    await expect(confirm).toBeEnabled();
  });

  test('Ask Ruma keeps the page open for a combined income and expense review', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.route(ACTION_PREVIEW, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ready',
        message: '',
        actions: [
          {
            kind: 'income', amount: '500.00', date: '2026-10-08',
            target_id: '', target_label: 'Fighting',
          },
          {
            kind: 'expense', amount: '20.00', date: '2026-10-08',
            target_id: '', target_label: "McDonald's",
          },
        ],
      }),
    }));

    await page.getByLabel('Ask Ruma', { exact: true }).click();
    await acceptAiDisclosure(page);
    await page.getByPlaceholder('Type a question').fill(
      "I got an income of 500 ringgit from fighting and I ate at McDonald's that cost 20 ringgit",
    );
    await page.getByLabel('Send').click();

    await expect(page.getByText('Review before saving', { exact: true })).toBeVisible();
    await expect(page.getByText(/Fighting/)).toBeVisible();
    await expect(page.getByText(/McDonald's/).last()).toBeVisible();
    await expect(page.getByPlaceholder('Type a question')).toBeVisible();
    await page.waitForTimeout(500);
    expect(pageErrors).toEqual([]);
  });

  test('Say an entry keeps and saves a new category from the users words', async ({ page }) => {
    await page.route(ACTION_PREVIEW, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ready',
        message: '',
        actions: [{
          kind: 'expense', amount: '18.00', date: '2026-10-06',
          target_id: '', target_label: 'Cat food',
          confidence: { kind: 'high', amount: 'high', date: 'high', target: 'high' },
        }],
      }),
    }));

    await openTypedVoiceFallback(page);
    await submitDescription(page, 'I spent 18 on cat food yesterday');

    await expect(page.getByText('Cat food', { exact: true })).toBeVisible();
    const save = page.getByRole('button', { name: 'Save', exact: true });
    await expect(save).toBeEnabled();
    const categoryRequest = page.waitForRequest(request =>
      request.url().endsWith('/api/v1/expense-categories/') && request.method() === 'POST');
    const expenseRequest = page.waitForRequest(request =>
      request.url().endsWith('/api/v1/expenses/') && request.method() === 'POST');
    await save.click();

    expect((await categoryRequest).postDataJSON()).toEqual({ name: 'Cat food' });
    expect((await expenseRequest).postDataJSON().category_id).toEqual(expect.any(Number));
  });

  test('Ask Ruma saves a clear new category instead of changing it to Other', async ({ page }) => {
    await page.route(ACTION_PREVIEW, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ready',
        message: '',
        actions: [{
          kind: 'expense', amount: '35.00', date: '2026-10-06',
          target_id: '', target_label: 'School books',
        }],
      }),
    }));

    await page.getByLabel('Ask Ruma', { exact: true }).click();
    await acceptAiDisclosure(page);
    await page.getByPlaceholder('Type a question').fill('I spent 35 on school books');
    await page.getByLabel('Send').click();

    await expect(page.getByText(/School books/)).toBeVisible();
    const confirm = page.getByRole('button', { name: 'Confirm and save', exact: true });
    await expect(confirm).toBeEnabled();
    const categoryRequest = page.waitForRequest(request =>
      request.url().endsWith('/api/v1/expense-categories/') && request.method() === 'POST');
    await confirm.click();
    expect((await categoryRequest).postDataJSON()).toEqual({ name: 'School books' });
  });

  test('Say an entry keeps and saves a custom income source from the users words', async ({ page }) => {
    await page.route(ACTION_PREVIEW, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ready',
        message: '',
        actions: [{
          kind: 'income', amount: '500.00', date: '2026-10-08',
          target_id: '', target_label: 'Work',
          confidence: { kind: 'high', amount: 'high', date: 'high', target: 'high' },
        }],
      }),
    }));

    await openTypedVoiceFallback(page);
    await submitDescription(page, "I earned 500 from my work at McDonald's");

    await expect(page.getByText('Work', { exact: true })).toBeVisible();
    const sourceRequest = page.waitForRequest(request =>
      request.url().endsWith('/api/v1/income/sources/') && request.method() === 'POST');
    const incomeRequest = page.waitForRequest(request =>
      request.url().endsWith('/api/v1/income/entries/') && request.method() === 'POST');
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    expect((await sourceRequest).postDataJSON()).toEqual({ name: 'Work' });
    expect((await incomeRequest).postDataJSON().source_id).toEqual(expect.any(Number));
  });

  test('Ask Ruma saves a custom income source instead of forcing a preset', async ({ page }) => {
    await page.route(ACTION_PREVIEW, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ready',
        message: '',
        actions: [{
          kind: 'income', amount: '250.00', date: '2026-10-08',
          target_id: '', target_label: 'Clubs',
        }],
      }),
    }));

    await page.getByLabel('Ask Ruma', { exact: true }).click();
    await acceptAiDisclosure(page);
    await page.getByPlaceholder('Type a question').fill('I earned 250 from clubs');
    await page.getByLabel('Send').click();

    await expect(page.getByText(/Clubs/)).toBeVisible();
    const sourceRequest = page.waitForRequest(request =>
      request.url().endsWith('/api/v1/income/sources/') && request.method() === 'POST');
    await page.getByRole('button', { name: 'Confirm and save', exact: true }).click();
    expect((await sourceRequest).postDataJSON()).toEqual({ name: 'Clubs' });
  });

  test('questions and non-entry actions are routed to editable Ask Ruma text', async ({ page }) => {
    await page.route(ACTION_PREVIEW, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'not_action', message: '', actions: [] }),
    }));
    await openTypedVoiceFallback(page);
    await submitDescription(page, 'Can I afford a house?');

    await expect(page.getByPlaceholder('Type a question')).toHaveValue('Can I afford a house?');
    await expect(page.getByText('Say it', { exact: true })).toHaveCount(0);
  });

  test('closing the preview discards its transient transcript', async ({ page }) => {
    await page.route(ACTION_PREVIEW, route => route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'assistant_unavailable', message: 'offline' } }),
    }));
    await openTypedVoiceFallback(page);
    await submitDescription(page, 'earned 50 from Grab today');
    await expect(page.getByText('You said', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByText('Say it', { exact: true }).click();
    await expect(page.getByText('You said', { exact: true })).toHaveCount(0);
  });
});
