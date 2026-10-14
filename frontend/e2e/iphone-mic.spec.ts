import { expect, test } from '@playwright/test';
import { openGuestFast } from './support/app';

test.describe('iPhone audio transcription', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', message => { if (message.text().includes('[RuMampu speech]')) console.log(message.text()); });
    await page.route('**/api/v1/**', route => route.fulfill({
      status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'offline', message: 'offline' } }),
    }));
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0_1 like Mac OS X) AppleWebKit/605.1.15 Version/27.0 Mobile/15E148 Safari/604.1' });
      if (!localStorage.getItem('rumampu_local_state')) localStorage.setItem('rumampu_local_state', JSON.stringify({ version: 1, aiDisclosureAccepted: true, voiceDisclosureAccepted: true }));
      // Use the browser's actual MediaRecorder with a synthetic audio stream.
      // Safari SpeechRecognition must never be used on this route.
      class ForbiddenRecognizer { constructor() { throw new Error('iPhone must not use Web Speech'); } }
      Object.defineProperty(window, 'webkitSpeechRecognition', { value: ForbiddenRecognizer, configurable: true });
      (window as any).__micTracks = [];
      Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => {
        const context = new AudioContext();
        const destination = context.createMediaStreamDestination();
        const oscillator = context.createOscillator();
        oscillator.connect(destination);
        oscillator.start();
        void context.resume();
        const tracks = destination.stream.getTracks();
        (window as any).__micTracks.push(...tracks);
        tracks[0].addEventListener('ended', () => { oscillator.stop(); void context.close(); });
        return destination.stream;
      } } });
    });
    await openGuestFast(page);
  });

  test('Ask Ruma captures twice, uploads only after Stop, and releases the microphone', async ({ page }) => {
    let uploads = 0;
    await page.route('**/assistant/transcribe/', async route => {
      uploads++;
      expect(route.request().method()).toBe('POST');
      expect(route.request().headers()['content-type']).toContain('multipart/form-data');
      expect(route.request().postDataBuffer()!.length).toBeGreaterThan(100);
      expect(route.request().postDataBuffer()!.toString()).toContain('audio_consent');
      await new Promise(resolve => setTimeout(resolve, 150));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: `question ${uploads}` }) });
    });
    await page.getByLabel('Ask Ruma', { exact: true }).click();
    await page.getByLabel('Start voice input', { exact: true }).click();
    await expect(page.getByText(/On iPhone, RuMampu records up to 30 seconds/)).toBeVisible();
    expect(uploads).toBe(0);
    await page.getByRole('button', { name: 'Continue with microphone', exact: true }).click();
    for (let recording = 1; recording <= 2; recording++) {
      await expect(page.getByLabel('Stop voice input', { exact: true })).toBeVisible();
      await page.waitForTimeout(500);
      expect(uploads).toBe(recording - 1);
      await page.getByLabel('Stop voice input', { exact: true }).click();
      await expect(page.getByPlaceholder('Type a question')).toHaveValue(recording === 1 ? 'question 1' : 'question 1 question 2');
      expect(await page.evaluate(() => (window as any).__micTracks.every((track: MediaStreamTrack) => track.readyState === 'ended'))).toBe(true);
      if (recording === 1) await page.getByLabel('Start voice input', { exact: true }).click();
    }
    expect(uploads).toBe(2);
  });

  test('one consent covers both features and survives reload', async ({ page }) => {
    await page.getByLabel('Ask Ruma', { exact: true }).click();
    await page.getByLabel('Start voice input', { exact: true }).click();
    await expect(page.getByTestId('voice-disclosure')).toBeVisible();
    await page.getByRole('button', { name: 'Continue with microphone', exact: true }).click();
    await expect(page.getByLabel('Stop voice input', { exact: true })).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('rumampu_local_state') || '{}').audioUploadConsentAccepted)).toBe(true);
    await page.reload();
    await page.getByRole('tab', { name: 'Home', exact: true }).click({ trial: true });
    await page.getByLabel('Ask Ruma', { exact: true }).click();
    await page.getByLabel('Start voice input', { exact: true }).click();
    await expect(page.getByLabel('Stop voice input', { exact: true })).toBeVisible();
    await expect(page.getByTestId('voice-disclosure')).toBeHidden();
    await page.getByLabel('Close', { exact: true }).click();
    await page.getByLabel('What would you like to add?').click();
    await page.getByText('Say it', { exact: true }).click();
    await expect(page.getByTestId('voice-disclosure')).toBeHidden();
    await page.getByRole('button', { name: 'Tap to start talking', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Tap to stop', exact: true })).toBeVisible();
  });

  test('declining voice consent leaves typing available and uploads nothing', async ({ page }) => {
    let uploads = 0;
    await page.route('**/assistant/transcribe/', route => { uploads++; return route.abort(); });
    await page.getByLabel('Ask Ruma', { exact: true }).click();
    await page.getByPlaceholder('Type a question').fill('My typed question');
    await page.getByLabel('Start voice input', { exact: true }).click();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByPlaceholder('Type a question')).toHaveValue('My typed question');
    expect(uploads).toBe(0);
    expect(await page.evaluate(() => (window as any).__micTracks.length)).toBe(0);
  });

  test('Say waits for fresh audio consent and routes the returned words for review', async ({ page }) => {
    await page.route('**/assistant/transcribe/', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'How much did I spend?' }) }));
    await page.getByLabel('What would you like to add?').click();
    await page.getByText('Say it', { exact: true }).click();
    await expect(page.getByText(/On iPhone, RuMampu records up to 30 seconds/)).toBeVisible();
    await page.getByRole('button', { name: 'Continue with microphone', exact: true }).click();
    await expect(page.getByText(/Listening…/)).toBeVisible();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Tap to stop', exact: true }).click();
    await expect(page.getByPlaceholder('Type a question')).toHaveValue('How much did I spend?');
  });

  test('closing during recording discards audio and permits the next recording', async ({ page }) => {
    let uploads = 0;
    await page.route('**/assistant/transcribe/', route => { uploads++; return route.fulfill({ status: 200, contentType: 'application/json', body: '{"text":"next attempt"}' }); });
    await page.getByLabel('Ask Ruma', { exact: true }).click();
    await page.getByLabel('Start voice input', { exact: true }).click();
    await page.getByRole('button', { name: 'Continue with microphone', exact: true }).click();
    await expect(page.getByLabel('Stop voice input', { exact: true })).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await expect(page.getByLabel('Start voice input', { exact: true })).toBeVisible();
    expect(uploads).toBe(0);
    expect(await page.evaluate(() => (window as any).__micTracks.every((track: MediaStreamTrack) => track.readyState === 'ended'))).toBe(true);
    await page.getByLabel('Start voice input', { exact: true }).click();
    await expect(page.getByLabel('Stop voice input', { exact: true })).toBeVisible();
  });

  test('a free-tier quota response returns the microphone to a retryable state', async ({ page }) => {
    await page.route('**/assistant/transcribe/', route => route.fulfill({ status: 429, contentType: 'application/json', body: '{"error":{"code":"speech_rate_limited","message":"Please wait and try again."}}' }));
    await page.getByLabel('Ask Ruma', { exact: true }).click();
    await page.getByLabel('Start voice input', { exact: true }).click();
    await page.getByRole('button', { name: 'Continue with microphone', exact: true }).click();
    await expect(page.getByLabel('Stop voice input', { exact: true })).toBeVisible();
    await page.waitForTimeout(500);
    await page.getByLabel('Stop voice input', { exact: true }).click();
    await expect(page.getByLabel('Start voice input', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => (window as any).__micTracks.every((track: MediaStreamTrack) => track.readyState === 'ended'))).toBe(true);
  });
});
