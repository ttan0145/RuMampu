import { expect, Page } from '@playwright/test';
import { test } from './support/fixtures';
import { ac } from './support/acceptance';
import { API, openGuestApp, reloadApp } from './support/app';

const SJKP = 'How SJKP helps if you don’t have a payslip';
const DISCLAIMER = 'This explains how things work. It isn’t advice on your decision, and RuMampu can’t tell you whether a bank will approve you.';
const LESSONS = [
  { tab: 'No payslip', id: 'sjkp', title: SJKP, pages: 5 },
  { tab: 'No payslip', id: 'docs', title: 'What to bring instead of a payslip', pages: 3 },
  { tab: 'No payslip', id: 'limit', title: 'What the RM360,000 limit reaches', pages: 2 },
  { tab: 'Upfront', id: 'moments', title: 'The three times you’ll need cash', pages: 2 },
  { tab: 'Upfront', id: 'deposit', title: 'The deposit, and why it can end up higher', pages: 4 },
  { tab: 'Upfront', id: 'fees', title: 'Legal fees, stamp duty and valuation', pages: 4 },
  { tab: 'Upfront', id: 'exemption', title: 'The first-home stamp duty exemption', pages: 4 },
  { tab: 'Upfront', id: 'movein', title: 'Moving-in costs nobody mentions', pages: 2 },
  { tab: 'Loan', id: 'bank', title: 'What a bank looks at before saying yes', pages: 2 },
  { tab: 'Loan', id: 'dsr', title: 'DSR, and why banks work it out differently', pages: 3 },
  { tab: 'Loan', id: 'credit', title: 'Your credit record: CCRIS', pages: 2 },
  { tab: 'Loan', id: 'thin', title: 'An empty credit record is not an approval', pages: 2 },
  { tab: 'Schemes', id: 'which', title: 'Which government schemes exist', pages: 3 },
  { tab: 'Schemes', id: 'ballot', title: 'Qualifying doesn’t guarantee a unit', pages: 2 },
  { tab: 'Schemes', id: 'resale', title: 'Check the resale conditions for the scheme', pages: 2 },
  { tab: 'Signing', id: 'spa', title: 'The SPA, step by step', pages: 3 },
  { tab: 'Signing', id: 'valuation', title: 'A lower valuation: a cash scenario', pages: 2 },
  { tab: 'Signing', id: 'deadlines', title: 'Dates that cost money if you miss them', pages: 1 },
  { tab: 'Signing', id: 'defects', title: 'Checking for defects before the window closes', pages: 3 },
] as const;

test.setTimeout(240_000);

/* The learning card with its read total now sits on the House tab; Prepare for a house is a path of steps. */
async function prepare(page: Page) {
  await page.getByRole('tab', { name: 'House', exact: true }).click();
  await expect(page.getByText('Learn what buying involves', { exact: true })).toBeVisible();
}

/* Prepare for a house: the path needs one home first, so a home is typed in when none is kept. */
async function prepareHub(page: Page) {
  await page.getByRole('tab', { name: 'House', exact: true }).click();
  await page.getByText('Prepare for a house', { exact: true }).click();
  const use = page.getByTestId('prep-use-home');
  const banner = page.getByTestId('prep-banner');
  await expect(use.or(banner).first()).toBeVisible();
  if (await use.isVisible()) {
    await page.getByLabel('Price').fill('450000');
    await use.click();
  }
  await expect(banner).toBeVisible();
}

async function learn(page: Page, topic = 'No payslip') {
  await prepare(page);
  await page.getByText('Learn what buying involves', { exact: true }).click();
  await page.getByRole('tab', { name: topic, exact: true }).click();
}

async function lesson(page: Page, id: string) {
  await page.getByTestId(`lesson-${id}`).click();
  await expect(page.getByText(/^Page \d+ of \d+$/)).toBeVisible();
}

async function firstPage(page: Page) {
  for (let i = 0; i < 5; i++) {
    if ((await page.getByText(/^Page \d+ of \d+$/).innerText()).match(/^Page (\d+)/)?.[1] === '1') return;
    await page.getByRole('button', { name: 'Back', exact: true }).click();
  }
  throw new Error('Back did not reach the first page within five steps.');
}

async function lastPage(page: Page) {
  // Every lesson has at most five pages. A bounded walk fails if Next never advances.
  for (let i = 0; i < 5; i++) {
    if (await page.getByRole('button', { name: 'Finish', exact: true }).count()) return;
    await page.getByRole('button', { name: 'Next', exact: true }).click();
  }
  throw new Error('The lesson did not reach Finish within five pages.');
}

async function login(page: Page, email: string, password: string) {
  await page.goto('/');
  await page.getByPlaceholder('name@example.com').fill(email);
  await page.getByPlaceholder('Your password').fill(password);
  const response = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/auth/login/'));
  await page.getByText('Log in', { exact: true }).last().click();
  expect((await response).status()).toBe(200);
  await page.getByRole('tab', { name: 'Home', exact: true }).click({ trial: true, timeout: 90_000 });
  await expect(page.getByText('Getting RuMampu ready', { exact: true })).toHaveCount(0);
}

test.describe('Epic 5 — Learn what buying involves', { tag: '@epic5' }, () => {
  let readerToken: string | undefined;
  test.afterEach(async ({ page }) => {
    if (!readerToken) return;
    const cleanup = await page.request.delete(`${API}/auth/record/`, { headers: { Authorization: `Token ${readerToken}` } });
    readerToken = undefined;
    expect(cleanup.status()).toBe(204);
  });

  test('US5.5 — Learn what buying involves before I commit', { tag: '@us5.5' }, async ({ page }, info) => {
    await openGuestApp(page);
    await ac('AC5.5.1', 'Open the explanations from Prepare', async () => {
      await prepareHub(page);
      await page.getByText('New to buying?', { exact: true }).click();
      await expect(page.getByText('Your learning', { exact: true })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'No payslip', exact: true })).toBeVisible();
    });
    await ac('AC5.5.2', 'Sections shown as tabs', async () => {
      await expect(page.getByRole('tablist').getByRole('tab')).toHaveText(['No payslip', 'Upfront', 'Loan', 'Schemes', 'Signing']);
      await page.getByRole('tab', { name: 'No payslip', exact: true }).click();
      await expect(page.getByTestId('lesson-sjkp')).toBeVisible();
    });

    const layouts: { title: string; page: number; viewport: string; client: number; scroll: number }[] = [];
    const endings: string[] = [];
    await ac('AC5.5.3', 'Every explanation names its source and date', async () => {
      for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 740 }]) {
        await page.setViewportSize(viewport);
        for (const item of LESSONS) {
          await page.getByRole('tab', { name: item.tab, exact: true }).click();
          await lesson(page, item.id);
          await firstPage(page);
          for (let number = 1; number <= item.pages; number++) {
            await expect(page.getByText(`Page ${number} of ${item.pages}`, { exact: true })).toBeVisible();
            const size = await page.getByTestId('screen-scroll').evaluate(el => ({ client: el.clientHeight, scroll: el.scrollHeight }));
            layouts.push({ title: item.title, page: number, viewport: `${viewport.width}x${viewport.height}`, ...size });
            if (number < item.pages) await page.getByRole('button', { name: 'Next', exact: true }).click();
          }
          const sources = page.getByTestId('lesson-sources');
          await expect(sources).toBeVisible();
          const rows = sources.locator('[data-testid^="lesson-source-"]');
          expect(await rows.count(), item.title).toBeGreaterThan(0);
          for (const row of await rows.all()) {
            await expect(row).toContainText(/^Source: .+\. Checked \d{1,2} \w+ \d{4}\.$/);
            await expect(row.getByRole('link')).toBeVisible();
          }
          endings.push(await sources.innerText());
          await page.getByRole('button', { name: 'Finish', exact: true }).click();
        }
      }
    });
    await ac('AC5.5.8', 'Not advice', async () => {
      expect(endings).toHaveLength(38);
      for (const ending of endings) expect(ending).toContain(DISCLAIMER);
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await ac('AC5.5.4', 'Government sources only', async () => {
      await page.getByRole('tab', { name: 'Schemes', exact: true }).click();
      await lesson(page, 'which');
      await firstPage(page);
      await expect(page.getByTestId('lesson-page')).toContainText('PR1MA');
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await expect(page.getByTestId('lesson-page')).toContainText('SPNB');
      await lastPage(page);
      await expect(page.getByTestId('lesson-sources')).toContainText('PR1MA: Eligibility');
      await expect(page.getByTestId('lesson-sources')).toContainText('MyGovernment: RMR');
      await page.getByRole('button', { name: 'Finish', exact: true }).click();
      await page.getByRole('tab', { name: 'No payslip', exact: true }).click();
      await lesson(page, 'sjkp');
      await lastPage(page);
      await page.evaluate(() => {
        (window as unknown as { opened: string[] }).opened = [];
        window.open = ((url?: string | URL) => { (window as unknown as { opened: string[] }).opened.push(String(url)); return null; }) as typeof window.open;
      });
      await page.getByRole('link', { name: 'SJKP’s participating institutions' }).click();
      expect(await page.evaluate(() => (window as unknown as { opened: string[] }).opened)).toContain('https://www.sjkp.com.my/en/fi-partners');
    });
    await ac('AC5.5.10', 'Move between pages with buttons', async () => {
      await page.getByRole('button', { name: 'Back', exact: true }).click();
      await expect(page.getByText('Page 4 of 5', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Finish', exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await expect(page.getByText('Page 5 of 5', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Finish', exact: true }).click();
      await expect(page.getByTestId('lesson-sjkp')).toBeVisible();
    });
    await ac('AC5.5.7', 'Explain terms where they appear', async () => {
      await lesson(page, 'sjkp');
      await firstPage(page);
      await page.getByRole('button', { name: 'SJKP', exact: true }).click();
      await expect(page.getByText('Syarikat Jaminan Kredit Perumahan. It guarantees home loans, so a bank can lend to people it might otherwise turn down.', { exact: true })).toBeVisible();
      await expect(page.getByText('Page 1 of 5', { exact: true })).toBeVisible();
    });
    await ac('AC5.5.5', 'Reach the right tab from each tool', async () => {
      await prepareHub(page);
      await page.getByTestId('prep-node-1').click();
      await page.getByText('What these costs are', { exact: true }).click();
      await expect(page.getByTestId('lesson-fees')).toBeVisible();
      await prepareHub(page);
      await page.getByTestId('prep-node-2').click();
      await page.getByText('What to bring instead of a payslip', { exact: true }).click();
      await expect(page.getByTestId('lesson-docs')).toBeVisible();
    });
    await ac('AC5.5.6', 'Show my own figure where one exists', async () => {
      await page.getByRole('tab', { name: 'House', exact: true }).click();
      await page.getByText('Test a house', { exact: true }).click();
      await page.locator('input:visible').nth(0).fill('300000');
      await page.getByText('The house', { exact: true }).click();
      await page.getByText('10%', { exact: true }).click();
      await learn(page);
      const figures = [
        { tab: 'No payslip', id: 'sjkp', page: 4, amount: 'RM 360,000', provenance: 'CALCULATED' },
        { tab: 'Upfront', id: 'deposit', page: 3, amount: 'RM 30,000', provenance: 'YOUR DATA' },
        { tab: 'Upfront', id: 'exemption', page: 4, amount: 'RM 6,350', provenance: 'CALCULATED' },
        { tab: 'Signing', id: 'valuation', page: 2, amount: 'RM 13,500', provenance: 'ASSUMPTION' },
        { tab: 'Upfront', id: 'fees', page: 4, amount: 'RM 7,125', provenance: 'CALCULATED' },
      ];
      for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 740 }]) {
        await page.setViewportSize(viewport);
        for (const item of figures) {
          await page.getByRole('tab', { name: item.tab, exact: true }).click();
          await lesson(page, item.id);
          await firstPage(page);
          for (let n = 1; n < item.page; n++) await page.getByRole('button', { name: 'Next', exact: true }).click();
          await expect(page.getByTestId('lesson-page')).toContainText(item.amount);
          await expect(page.getByTestId('lesson-page')).toContainText(item.provenance);
          const size = await page.getByTestId('screen-scroll').evaluate(el => ({ client: el.clientHeight, scroll: el.scrollHeight }));
          layouts.push({ title: `Personal figure: ${item.id}`, page: item.page, viewport: `${viewport.width}x${viewport.height}`, ...size });
          if (!(viewport.width === 360 && item.id === 'fees')) {
            await lastPage(page);
            await page.getByRole('button', { name: 'Finish', exact: true }).click();
          }
        }
      }
    });
    await ac('AC5.5.9', 'One idea per page', async () => {
      await info.attach('Lesson page dimensions, including personal figures', {
        body: Buffer.from(JSON.stringify(layouts, null, 2)), contentType: 'application/json',
      });
      expect(layouts).toHaveLength(112);
      for (const size of layouts) {
        expect(size.client, `${size.title}, page ${size.page}, ${size.viewport}`).toBeGreaterThan(0);
      }
      expect(layouts.filter(size => size.scroll > size.client + 1)).toEqual([]);
      await expect(page.getByTestId('lesson-page')).toHaveCSS('opacity', '1');
      await expect.poll(async () => {
        const source = await page.getByTestId('lesson-sources').boundingBox();
        const assistant = await page.getByRole('button', { name: 'Ask Ruma', exact: true }).boundingBox();
        if (!source || !assistant) return false;
        return assistant.y >= source.y + source.height || assistant.y + assistant.height <= source.y
          || assistant.x >= source.x + source.width || assistant.x + assistant.width <= source.x;
      }, { message: 'The assistant settles clear of the source and disclaimer.' }).toBe(true);
      await info.attach('Personal fees at 360 × 740', {
        body: await page.screenshot({ path: '../output/playwright/epic-5/evidence/ac5.5.6_ac5.5.9__personal-fees-small-phone.png' }),
        contentType: 'image/png',
      });
      await page.setViewportSize({ width: 390, height: 844 });
    });
    await ac('AC5.5.11', 'Refer EPF out rather than explain it', async () => {
      await page.getByRole('button', { name: 'Finish', exact: true }).click();
      await expect(page.getByText('If you have EPF savings, you may be able to use part of them toward buying a home. That has its own rules, so RuMampu doesn’t cover it here.', { exact: true })).toBeVisible();
      await page.getByRole('link', { name: 'Check with KWSP', exact: true }).click();
      expect(await page.evaluate(() => (window as unknown as { opened: string[] }).opened)).toContain('https://www.kwsp.gov.my/');
    });
  });

  test('US5.6 — Find what applies to someone without a payslip', { tag: '@us5.6' }, async ({ page }) => {
    await openGuestApp(page);
    await ac('AC5.6.1', 'A tab for irregular income', async () => {
      await learn(page);
      await expect(page.getByRole('tab', { name: 'No payslip', exact: true })).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByTestId('lesson-docs')).toContainText('What to bring instead of a payslip');
    });
    await ac('AC5.6.2', 'Explain the financing guarantee and its limits', async () => {
      await lesson(page, 'sjkp');
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await expect(page.getByTestId('lesson-page')).toContainText('120%');
      await expect(page.getByTestId('lesson-page')).toContainText('RM360,000');
      await expect(page.getByTestId('lesson-page')).toContainText('RM500,000');
      await expect(page.getByTestId('lesson-page')).toContainText('Eligibility does not mean approval.');
      await lastPage(page);
      await page.getByRole('button', { name: 'Finish', exact: true }).click();
    });
    await ac('AC5.6.3', 'Link documents to the checklist', async () => {
      await lesson(page, 'docs');
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await expect(page.getByTestId('lesson-page')).toContainText('Bank or deposit statements');
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await page.getByRole('button', { name: /^Open your document checklist/ }).click();
      await page.getByLabel('What this is').click();
      await expect(page.getByText('65% check: needs review', { exact: true })).toBeVisible();
      await page.getByText('Done', { exact: true }).click();
      await expect(page.getByTestId('doc-dc_bank')).toHaveAttribute('aria-checked', 'false');
      await expect(page.getByText('Bank statements, 6 months', { exact: true })).toBeVisible();
    });
  });

  test("US5.7 — See what I've already read", { tag: '@us5.7' }, async ({ page, browser }) => {
    const email = `epic5-reader-${Date.now()}@example.com`, password = 'Passw0rd123';
    const registered = await page.request.post(`${API}/auth/register/`, { data: { email, password } });
    expect(registered.status()).toBe(201);
    const { token } = await registered.json();
    readerToken = token;
    const seeded = await page.request.patch(`${API}/auth/me/`, { headers: { Authorization: `Token ${token}` }, data: { preferred_language: 'en', onboarding_completed: true } });
    expect(seeded.status()).toBe(200);
    await login(page, email, password);
    await learn(page);
    await ac('AC5.7.1', 'Show progress on each explanation', async () => {
      await lesson(page, 'sjkp');
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await page.getByLabel('Back', { exact: true }).click();
      await expect(page.getByTestId('lesson-sjkp')).toContainText('2/5');
    });
    await ac('AC5.7.3', 'Resume where I stopped', async () => {
      await lesson(page, 'sjkp');
      await expect(page.getByText('Page 2 of 5', { exact: true })).toBeVisible();
    });
    const synced = page.waitForResponse(r => r.request().method() === 'PATCH' && r.url().endsWith('/auth/me/') && r.request().postDataJSON()?.learning_progress?.sjkp === 5);
    await ac('AC5.7.2', "Grey out what I've finished", async () => {
      await lastPage(page);
      await page.getByRole('button', { name: 'Finish', exact: true }).click();
      await expect(page.getByTestId('lesson-sjkp')).toContainText('Read');
      await expect(page.getByTestId('lesson-sjkp')).toHaveCSS('opacity', '0.66');
      await lesson(page, 'sjkp');
      await expect(page.getByText('Page 1 of 5', { exact: true })).toBeVisible();
      await page.getByLabel('Back', { exact: true }).click();
    });
    await ac('AC5.7.4', 'Show progress for each section and overall', async () => {
      await expect(page.getByText('1 of 3 done', { exact: true })).toBeVisible();
      await prepare(page);
      await expect(page.getByTestId('learn-total-progress')).toContainText('1 of 19 explanations read');
    });
    await ac('AC5.7.5', 'Keep progress between sessions', async () => {
      expect((await synced).status()).toBe(200);
      await reloadApp(page);
      await learn(page);
      await expect(page.getByTestId('lesson-sjkp')).toContainText('Read');
      const second = await browser.newContext({ baseURL: new URL(page.url()).origin, viewport: { width: 390, height: 844 } });
      try {
        const otherPage = await second.newPage();
        await login(otherPage, email, password);
        await learn(otherPage);
        await expect(otherPage.getByTestId('lesson-sjkp')).toContainText('Read');
        await prepare(otherPage);
        await expect(otherPage.getByTestId('learn-total-progress')).toContainText('1 of 19 explanations read');
      } finally { await second.close(); }
    });
    await ac('AC5.7.6', 'Nothing is locked behind reading', async () => {
      await prepareHub(page);
      await page.getByTestId('prep-node-1').click();
      await expect(page.getByTestId('upfront-summary')).toBeVisible();
      await learn(page);
      for (const id of ['docs', 'limit']) {
        await lesson(page, id); await lastPage(page);
        await page.getByRole('button', { name: 'Finish', exact: true }).click();
      }
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.getByText(/badge|streak|reward|earned|congratulations/i)).toHaveCount(0);
      await prepareHub(page);
      await page.getByTestId('prep-node-2').click();
      await expect(page.getByTestId('doc-dc_bank')).toHaveAttribute('aria-checked', 'false');
      await expect(page.getByText('Bank statements, 6 months', { exact: true })).toBeVisible();
    });
  });
});
