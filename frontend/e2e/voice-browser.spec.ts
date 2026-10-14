import { expect, test, type Page } from '@playwright/test';
import { openGuestFast } from './support/app';

async function installFakeSpeechRecognition(page: Page): Promise<void> {
  await page.evaluate(() => {
    class FakeSpeechRecognition extends EventTarget {
      lang = '';
      interimResults = false;
      continuous = false;
      maxAlternatives = 1;
      start() {
        (window as any).__speechStarts = ((window as any).__speechStarts || 0) + 1;
        (window as any).__speechRecognizer = this;
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

test.describe('Browser voice sessions', () => {
  test.beforeEach(async ({ page }) => {
    // These tests isolate browser recognition from backend availability.
    await page.route('**/api/v1/**', route => route.fulfill({
      status: 503, contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'offline', message: 'offline' } }),
    }));
    await page.addInitScript(() => {
      Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined, configurable: true });
      localStorage.setItem('rumampu_local_state', JSON.stringify({ version: 1, aiDisclosureAccepted: true }));
    });
    await openGuestFast(page);
  });

  test('web Say recording needs a tap and can capture a second session', async ({ page }) => {
    const messages: string[] = [];
    page.on('console', message => messages.push(message.text()));
    await installFakeSpeechRecognition(page);
    await page.getByLabel('What would you like to add?').click();
    await page.getByText('Say it', { exact: true }).click();
    await expect.poll(() => page.evaluate(() => (window as any).__speechStarts || 0)).toBe(0);
    await page.getByRole('button', { name: 'Continue with microphone', exact: true }).click();
    await expect(page.getByText(/Listening…/)).toBeVisible();
    await page.evaluate(() => {
      (window as any).__oldRecognizer = (window as any).__speechRecognizer;
      (window as any).__speechRecognizer.dispatchEvent(new Event('end'));
    });
    await expect(page.getByText(/Listening…/)).toHaveCount(0);
    await page.getByRole('button', { name: 'Tap to start talking', exact: true }).click();
    await expect.poll(() => page.evaluate(() => (window as any).__speechStarts)).toBe(2);
    await page.evaluate(() => {
      (window as any).__oldRecognizer.dispatchEvent(new Event('end'));
      const alternatives = Object.assign([{ transcript: 'Can I afford a house?', confidence: 1 }], { isFinal: true });
      const result = Object.assign(new Event('result'), { resultIndex: 0, results: [alternatives] });
      (window as any).__speechRecognizer.dispatchEvent(result);
    });
    await expect(page.getByText('“Can I afford a house?”', { exact: true })).toBeVisible();
    expect(messages.some(message => message.includes('[RuMampu speech] start requested'))).toBe(true);
    expect(messages.some(message => message.includes('[RuMampu speech] result'))).toBe(true);
    expect(messages.some(message => message.includes('requestPermissionsAsync is not supported'))).toBe(false);
    expect(messages.some(message => message.includes('Can I afford a house?'))).toBe(false);
  });

  test('web Say recovers when a recognizer never sends start', async ({ page }) => {
    await installFakeSpeechRecognition(page);
    await page.evaluate(() => {
      (window as any).SpeechRecognition.prototype.start = function () {
        (window as any).__speechRecognizer = this;
      };
    });
    await page.clock.install();
    await page.getByLabel('What would you like to add?').click();
    await page.getByText('Say it', { exact: true }).click();
    await page.getByRole('button', { name: 'Continue with microphone', exact: true }).click();
    await expect(page.getByText(/Listening…/)).toHaveCount(0);
    await page.clock.runFor(12001);
    await expect(page.getByText('No speech was recognised. Try again or type the entry instead.', { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as any).__speechAborts || 0)).toBe(1);
  });

  test('web Ask Ruma ends recognition without automatic restart and accepts another tap', async ({ page }) => {
    await installFakeSpeechRecognition(page);
    await page.getByLabel('Ask Ruma', { exact: true }).click();
    await page.getByLabel('Start voice input', { exact: true }).click();
    await expect(page.getByLabel('Stop voice input', { exact: true })).toBeVisible();
    await page.evaluate(() => (window as any).__speechRecognizer.dispatchEvent(new Event('end')));
    await expect(page.getByLabel('Start voice input', { exact: true })).toBeVisible();
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => (window as any).__speechStarts)).toBe(1);
    await page.getByLabel('Start voice input', { exact: true }).click();
    await page.evaluate(() => {
      const alternatives = Object.assign([{ transcript: 'How much did I spend?', confidence: 1 }], { isFinal: true });
      (window as any).__speechRecognizer.dispatchEvent(Object.assign(new Event('result'), {
        resultIndex: 0, results: [alternatives],
      }));
    });
    await expect(page.getByPlaceholder('Listening…')).toHaveValue('How much did I spend?');
    await page.getByLabel('Stop voice input', { exact: true }).click();
  });

});
