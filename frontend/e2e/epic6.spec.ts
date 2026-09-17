import { expect, Page } from '@playwright/test';
import path from 'node:path';
import { e2eGet, test } from './support/fixtures';
import { ac, deferredAc } from './support/acceptance';
import { API, captureEvidence, openGuestApp, openMoneyScreen, syncClientIdFromBrowser } from './support/app';

/* Epic 6 — AI Insights & Alerts (US/AC v5, 17 September 2026).
   Both stories call a Groq model through the backend. The model is not part
   of what these tests check, so its two endpoints are answered by Playwright
   route handlers with fixed JSON. That keeps every run deterministic and
   offline, and lets the tests exercise the branches a live model would only
   produce by chance (partial receipt, non-receipt photo, model failure, rate
   limit). Prompt rules and record use are covered by the backend unit tests
   in finance/test_assistant.py and finance/test_receipt_scan.py. */

const RECEIPT_SCAN = '**/api/v1/expenses/receipt-scan/';
const ASSISTANT_CHAT = '**/api/v1/assistant/chat/';
const PHOTO = path.resolve(__dirname, '../assets/images/RuMampu_AppIcon_512.png');

type ScanReply = { is_receipt: boolean; merchant: string | null; date: string | null; total: string | null; category_slug: string | null };

async function answerScan(page: Page, reply: ScanReply | { status: number }): Promise<void> {
  await page.route(RECEIPT_SCAN, route => {
    if ('status' in reply) return route.fulfill({ status: reply.status, contentType: 'application/json', body: JSON.stringify({ error: { code: 'receipt_scan_unreadable', message: 'unreadable' } }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reply) });
  });
}

/* The scan tab's tappable area opens the photo library, which on web is a
   native file chooser; Playwright hands it the app icon. */
async function choosePhoto(page: Page): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /Scan a receipt/ }).click();
  await (await chooser).setFiles(PHOTO);
}

async function openReceiptScan(page: Page): Promise<void> {
  await openGuestApp(page);
  await syncClientIdFromBrowser(page);
  await openMoneyScreen(page, 'Daily expenses');
  await page.getByText('Scan', { exact: true }).click();
  await expect(page.getByRole('button', { name: /Scan a receipt/ })).toBeVisible();
}

test.describe('Epic 6 — AI Insights & Alerts', { tag: '@epic6' }, () => {
  test('US6.1 — Scan and categorise expenses from receipts', { tag: '@us6.1' }, async ({ page }) => {
    await answerScan(page, { is_receipt: true, merchant: 'Restoran Nasi Kandar Lin', date: '2026-09-10', total: '12.50', category_slug: 'meals' });
    await openReceiptScan(page);

    await ac('AC6.1.1', 'Upload or capture a receipt', async () => {
      await expect(page.getByText('Take or choose a photo of the receipt.', { exact: true })).toBeVisible();
      await expect(page.getByText('Take a photo', { exact: true })).toBeVisible();
      await choosePhoto(page);
    });

    await ac('AC6.1.2', 'Extract receipt information', async () => {
      await expect(page.getByText('Read from your receipt. Check it before saving.', { exact: true })).toBeVisible();
      const inputs = page.locator('input:visible');
      await expect(inputs.nth(0)).toHaveValue('Restoran Nasi Kandar Lin');
      await expect(inputs.nth(1)).toHaveValue('2026-09-10');
      await expect(inputs.nth(2)).toHaveValue('12.5');
    });

    await ac('AC6.1.3', 'Suggest an expense category', async () => {
      await expect(page.getByText('Meals', { exact: true })).toBeVisible();
      await expect(page.getByText('AI SUGGESTION', { exact: true })).toBeVisible();
    });

    await ac('AC6.1.4', 'Identify the category as an AI suggestion', async () => {
      await expect(page.getByText('FROM RECEIPT', { exact: true })).toHaveCount(3);
      await expect(page.getByText('AI SUGGESTION', { exact: true })).toHaveCount(1);
      await expect(page.getByText('YOUR DATA', { exact: true })).toHaveCount(0);
    });

    await ac('AC6.1.5', 'Allow the user to change the suggested category', async () => {
      await page.getByText('Groceries', { exact: true }).click();
      await expect(page.getByText('AI SUGGESTION', { exact: true })).toHaveCount(0);
    });

    await ac('AC6.1.6', 'Allow correction of extracted information', async () => {
      const inputs = page.locator('input:visible');
      await inputs.nth(0).fill('Nasi Kandar Lin edited');
      await inputs.nth(1).fill('2026-09-11');
      await inputs.nth(2).fill('13.00');
      await expect(inputs.nth(0)).toHaveValue('Nasi Kandar Lin edited');
    });

    await ac('AC6.1.7', 'Require confirmation before saving', async () => {
      const response = await e2eGet(page, `${API}/expenses/`);
      expect(await response.json()).toHaveLength(0);
    });

    await ac('AC6.1.8', 'Save the confirmed expense', async () => {
      await page.getByText('Add expense', { exact: true }).click();
      await expect(page.getByText(/Saved\./).first()).toBeVisible();
      const response = await e2eGet(page, `${API}/expenses/`);
      const entries = await response.json();
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ entry_method: 'receipt', merchant: 'Nasi Kandar Lin edited', amount: '13.00', user_confirmed: true });
    });

    await captureEvidence(page, 'epic-6', 'ac6.1.1-8__receipt-scan.png');
  });

  test('US6.1 — Unreadable, partial and non-receipt photos', { tag: '@us6.1' }, async ({ page }) => {
    await answerScan(page, { is_receipt: true, merchant: null, date: '2026-09-10', total: null, category_slug: null });
    await openReceiptScan(page);
    await choosePhoto(page);

    await ac('AC6.1.9', 'Handle unreadable or incomplete receipts', async () => {
      await expect(page.getByText('Some details couldn’t be read from the receipt. Fill in the empty fields before saving.', { exact: true })).toBeVisible();
      const inputs = page.locator('input:visible');
      await expect(inputs.nth(0)).toHaveValue('');
      await expect(inputs.nth(1)).toHaveValue('2026-09-10');
      await expect(inputs.nth(2)).toHaveValue('');
      // Saving with the total still empty is refused, and nothing is written.
      await page.getByText('Add expense', { exact: true }).click();
      const response = await e2eGet(page, `${API}/expenses/`);
      expect(await response.json()).toHaveLength(0);
    });

    await ac('AC6.1.10', 'Do not invent missing receipt information', async () => {
      // Only the one value that was read carries the tag; empty fields carry none.
      await expect(page.getByText('FROM RECEIPT', { exact: true })).toHaveCount(1);
      await expect(page.getByText('AI SUGGESTION', { exact: true })).toHaveCount(0);
    });

    await page.getByText('Retake', { exact: true }).click();
    await answerScan(page, { is_receipt: false, merchant: null, date: null, total: null, category_slug: null });
    await choosePhoto(page);
    await expect(page.getByText('That photo doesn’t look like a receipt. Try a clearer photo of the receipt itself.', { exact: true })).toBeVisible();

    await answerScan(page, { status: 502 });
    await choosePhoto(page);
    // Shown as a note under the scan area and as a toast, so two matches.
    await expect(page.getByText('The receipt could not be read right now. Try again, or add the expense manually.', { exact: true }).first()).toBeVisible();
    await captureEvidence(page, 'epic-6', 'ac6.1.9-10__partial-receipt.png');
  });

  test('US6.2 — Ask RuMampu about my financial situation', { tag: '@us6.2' }, async ({ page }) => {
    const requests: Array<Record<string, unknown>> = [];
    await page.route(ASSISTANT_CHAT, route => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      requests.push(body);
      const messages = body.messages as Array<{ content: string }>;
      const last = messages[messages.length - 1]?.content || '';
      const reply = /where|add/i.test(last)
        ? 'Tap Money, then Add income. There is no separate save step.'
        : 'Your recorded months show income of RM 3,500 in August. This explains your own numbers only.';
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reply }) });
    });

    await ac('AC6.2.10', 'Do not display the assistant before login', async () => {
      await page.goto('/');
      const splash = page.getByLabel('RuMampu');
      if (await splash.isVisible().catch(() => false)) await splash.click();
      await expect(page.getByText('Continue as guest', { exact: true }).last()).toBeVisible();
      await expect(page.getByLabel('Ask Ruma')).toHaveCount(0);
    });

    await openGuestApp(page);

    await ac('AC6.2.9', 'Display the AI assistant throughout the logged-in experience', async () => {
      await expect(page.getByLabel('Ask Ruma')).toBeVisible();
      await page.getByRole('tab', { name: 'Money', exact: true }).click();
      await expect(page.getByLabel('Ask Ruma')).toBeVisible();
      await page.getByRole('tab', { name: 'House', exact: true }).click();
      await expect(page.getByLabel('Ask Ruma')).toBeVisible();
      await page.getByRole('tab', { name: 'Home', exact: true }).click();
    });

    await ac('AC6.2.15', 'Display the AI assistant as a floating bubble', async () => {
      // One bubble, not a header control: it exists exactly once on the page.
      await expect(page.getByLabel('Ask Ruma')).toHaveCount(1);
    });

    await ac('AC6.2.11', 'Open the assistant from any logged-in page', async () => {
      await page.getByLabel('Ask Ruma').click();
      await expect(page.getByText('Ask Ruma', { exact: true }).last()).toBeVisible();
      await expect(page.getByPlaceholder('Type a question')).toBeVisible();
    });

    await ac('AC6.2.1', 'Access the AI financial guidance chatbot', async () => {
      await expect(page.getByText(/Ask me about your record/)).toBeVisible();
      await expect(page.getByLabel('Send')).toBeVisible();
    });

    await ac('AC6.2.12', 'Preserve the current page when opening the assistant', async () => {
      // The Home content stays mounted behind the pop-up.
      await expect(page.getByText('Money', { exact: true }).last()).toBeAttached();
    });

    await ac('AC6.2.2', 'Ask questions in natural language', async () => {
      await expect(page.getByText('Can I afford a RM 250k home?', { exact: true })).toBeVisible();
      await page.getByPlaceholder('Type a question').fill('How much did I earn last month?');
      await page.getByLabel('Send').click();
      await expect(page.getByText(/RM 3,500 in August/)).toBeVisible();
    });

    await ac('AC6.2.3', 'Use the user\'s RuMampu record when relevant', async () => {
      // The request carries the conversation, the app language and the
      // on-screen labels; the backend adds the record snapshot itself.
      expect(requests).toHaveLength(1);
      expect(requests[0]).toMatchObject({ language: 'en' });
      expect(requests[0]).toHaveProperty('ui_labels');
      expect(requests[0]).toHaveProperty('term_labels');
      const messages = requests[0].messages as Array<{ role: string; content: string }>;
      expect(messages[messages.length - 1]).toMatchObject({ role: 'user', content: 'How much did I earn last month?' });
    });

    await ac('AC6.2.14', 'Guide users to relevant RuMampu features', async () => {
      await page.getByPlaceholder('Type a question').fill('Where do I add income?');
      await page.getByLabel('Send').click();
      await expect(page.getByText('Tap Money, then Add income. There is no separate save step.', { exact: true })).toBeVisible();
      expect((requests[1].ui_labels as Record<string, string>).add_income).toBe('Add income');
    });

    await ac('AC6.2.13', 'Avoid presenting guidance as guaranteed financial advice', async () => {
      await expect(page.getByText('Explanations from your own record. Not financial advice.', { exact: true })).toBeVisible();
    });

    await ac('AC6.2.8', 'Acknowledge insufficient information', async () => {
      // Backend unit tests own the wording; here the app must surface a
      // limited-information reply unchanged and keep the chat open.
      await page.unroute(ASSISTANT_CHAT);
      await page.route(ASSISTANT_CHAT, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reply: 'Only 1 month is recorded, so this answer leans on a small base. Add more months from Money, Income.' }) }));
      await page.getByPlaceholder('Type a question').fill('Which are my slow months?');
      await page.getByLabel('Send').click();
      await expect(page.getByText(/Only 1 month is recorded/)).toBeVisible();
    });

    // Rate limit and errors are shown as app copy, never as a blank reply.
    await page.unroute(ASSISTANT_CHAT);
    await page.route(ASSISTANT_CHAT, route => route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: { code: 'assistant_rate_limited', message: 'limit' } }) }));
    await page.getByPlaceholder('Type a question').fill('One more');
    await page.getByLabel('Send').click();
    await expect(page.getByText('The assistant has reached today’s message limit. Try again tomorrow.', { exact: true })).toBeVisible();

    await captureEvidence(page, 'epic-6', 'ac6.2.1-15__ask-ruma.png', { resetScroll: false });

    // Closing is the EXIT sign only; the bubble comes back.
    await page.getByLabel('Done').click();
    await expect(page.getByPlaceholder('Type a question')).toHaveCount(0);
    await expect(page.getByLabel('Ask Ruma')).toBeVisible();

    deferredAc('AC6.2.4', 'Explain financial results in simple language', 'Model output; covered by backend unit tests (finance/test_assistant.py).');
    deferredAc('AC6.2.5', 'Answer questions about income patterns', 'Model output; covered by backend unit tests.');
    deferredAc('AC6.2.6', 'Answer questions about spending', 'Model output; covered by backend unit tests.');
    deferredAc('AC6.2.7', 'Answer questions about housing-test results', 'Model output; covered by backend unit tests.');
  });

  test('US6.3 — Be reminded of a bill I chose, on the day I chose', { tag: '@us6.3' }, async () => {
    for (const [id, title] of [
      ['AC6.3.1', 'I choose the day and the time'],
      ['AC6.3.2', 'The reminder opens a pre-filled entry'],
      ['AC6.3.3', 'Nothing is written until I confirm'],
      ['AC6.3.4', 'A confirmed entry is my data'],
      ['AC6.3.5', 'Permission asked once, with the reason'],
      ['AC6.3.6', 'Reminders are only about what I set'],
    ] as const) {
      deferredAc(id, title, 'NEW in US/AC v5; not built (needs notification permission handling).');
    }
  });
});
