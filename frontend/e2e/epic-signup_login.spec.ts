import { expect, Page } from '@playwright/test';
import { test } from './support/fixtures';
import { captureEvidence } from './support/app';

const API = 'http://localhost:8000/api/v1';
const TEST_PASSWORD = 'Passw0rd123';
const useNeon = process.env.PLAYWRIGHT_USE_NEON === '1';
const existingEmail = process.env.RUMAMPU_E2E_EMAIL?.trim();
const existingPassword = process.env.RUMAMPU_E2E_PASSWORD;
const useExistingAccount = useNeon && Boolean(existingEmail && existingPassword);

test.setTimeout(120_000);

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function dismissSplash(page: Page): Promise<void> {
  await page.goto('/');

  const splash = page.getByLabel('RuMampu');
  if (await splash.isVisible().catch(() => false)) {
    await splash.click({ force: true });
    await expect(splash).toHaveCount(0, { timeout: 5000 }).catch(() => undefined);
  }
}

async function createCompletedAccountForLogin(page: Page, email: string): Promise<void> {
  const registerResponse = await page.request.post(`${API}/auth/register/`, {
    data: {
      email,
      password: TEST_PASSWORD,
    },
  });

  expect(registerResponse.status(), await registerResponse.text()).toBe(201);
  const registered = await registerResponse.json();
  expect(registered.token).toBeTruthy();

  const completeResponse = await page.request.patch(`${API}/auth/me/`, {
    headers: {
      Authorization: `Token ${registered.token}`,
    },
    data: {
      preferred_language: 'en',
      onboarding_completed: true,
    },
  });

  expect(completeResponse.status(), await completeResponse.text()).toBe(200);
}

async function openLogin(page: Page): Promise<void> {
  await dismissSplash(page);

  await expect(page.getByText('Log in', { exact: true }).last()).toBeVisible();
  await expect(page.getByPlaceholder('name@example.com')).toBeVisible();
  await expect(page.getByPlaceholder('Your password')).toBeVisible();
}

async function openSignup(page: Page): Promise<void> {
  await openLogin(page);
  await page.getByText('Create an account', { exact: true }).last().click();

  await expect(page.getByText('Create an account', { exact: true }).first()).toBeVisible();
  await expect(page.getByPlaceholder('name@example.com')).toBeVisible();
  await expect(page.getByPlaceholder('At least 8 characters')).toBeVisible();
  await expect(page.getByPlaceholder('Type it again')).toBeVisible();
  await expect(page.getByText('Create account', { exact: true }).last()).toBeVisible();
}

test.describe('Epic 8 — Login and Sign up', () => {
  test('Login — displays form and logs an existing account in successfully @epic8 @login', async ({ page }) => {
    const email = useExistingAccount ? existingEmail! : uniqueEmail('epic8-login');
    const password = useExistingAccount ? existingPassword! : TEST_PASSWORD;
    if (!useExistingAccount) {
      await createCompletedAccountForLogin(page, email);
    }

    await openLogin(page);

    // Evidence: login form exists and contains the expected fields/actions.
    await captureEvidence(page, 'epic-8-auth', '01-login-form.png');

    await page.getByPlaceholder('name@example.com').fill(email);
    await page.getByPlaceholder('Your password').fill(password);

    const loginResponse = page.waitForResponse(response =>
      response.request().method() === 'POST'
      && response.url().endsWith('/api/v1/auth/login/')
    );

    await page.getByText('Log in', { exact: true }).last().click();

    const response = await loginResponse;
    expect(response.status(), await response.text()).toBe(200);

    await expect(page.getByRole('tab', { name: 'Home', exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('tab', { name: 'Money', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'House', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Profile', exact: true })).toBeVisible();

    // The auth token proves the authenticated session has been established.
    await expect.poll(
      async () => page.evaluate(() => window.localStorage.getItem('rumampu_auth_token')),
      { timeout: 10000 },
    ).not.toBeNull();
    await expect(page.getByText('Getting RuMampu ready', { exact: true }))
      .toHaveCount(0, { timeout: 90_000 });

    await captureEvidence(page, 'epic-8-auth', '02-login-success-home.png');
  });

  test('Login — rejects empty credentials with a visible validation message @epic8 @login', async ({ page }) => {
    await openLogin(page);

    await page.getByText('Log in', { exact: true }).last().click();

    await expect(page.getByText('Enter your email and password.', { exact: true })).toBeVisible();
    await captureEvidence(page, 'epic-8-auth', '03-login-required-fields-validation.png');
  });

  test('Sign up — displays account fields and validates invalid details @epic8 @signup', async ({ page }) => {
    await openSignup(page);

    await captureEvidence(page, 'epic-8-auth', '04-signup-form.png');

    // Invalid email.
    await page.getByPlaceholder('name@example.com').fill('not-an-email');
    await page.getByPlaceholder('At least 8 characters').fill(TEST_PASSWORD);
    await page.getByPlaceholder('Type it again').fill(TEST_PASSWORD);
    await page.getByText('Create account', { exact: true }).last().click();
    await expect(page.getByText('Enter a valid email address.', { exact: true })).toBeVisible();

    // Password mismatch.
    await page.getByPlaceholder('name@example.com').fill(uniqueEmail('epic8-validation'));
    await page.getByPlaceholder('At least 8 characters').fill(TEST_PASSWORD);
    await page.getByPlaceholder('Type it again').fill('Passw0rd999');
    await page.getByText('Create account', { exact: true }).last().click();
    await expect(page.getByText('Passwords do not match.', { exact: true })).toBeVisible();

    await captureEvidence(page, 'epic-8-auth', '05-signup-validation.png');
  });

  test('Sign up — creates a new account through the UI and enters onboarding @epic8 @signup', async ({ page }) => {
    const email = uniqueEmail('epic8-signup');

    await openSignup(page);

    await page.getByPlaceholder('name@example.com').fill(email);
    await page.getByPlaceholder('At least 8 characters').fill(TEST_PASSWORD);
    await page.getByPlaceholder('Type it again').fill(TEST_PASSWORD);

    const registerResponse = page.waitForResponse(response =>
      response.request().method() === 'POST'
      && response.url().endsWith('/api/v1/auth/register/')
    );

    await page.getByText('Create account', { exact: true }).last().click();

    const response = await registerResponse;
    expect(response.status(), await response.text()).toBe(201);

    // A newly created account enters the real account onboarding flow.
    await expect(page.getByText('Step 1 of 3', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('What RuMampu does', { exact: true })).toBeVisible();

    await expect.poll(
      async () => page.evaluate(() => window.localStorage.getItem('rumampu_auth_token')),
      { timeout: 10000 },
    ).not.toBeNull();

    await captureEvidence(page, 'epic-8-auth', '06-signup-success-onboarding.png');
  });
});
