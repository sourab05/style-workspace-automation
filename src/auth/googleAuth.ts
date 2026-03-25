import { chromium, Page, BrowserContext } from '@playwright/test';
import { ENV } from '../utils/env';
import * as fs from 'fs';
import * as path from 'path';

export interface GoogleAuthResult {
  cookieHeader: string;
  storageState?: any;
}

const CACHE_DIR = path.join(process.cwd(), '.test-cache');
const SESSION_FILE = path.join(CACHE_DIR, 'google-auth-state.json');
const PROFILE_DIR = path.join(CACHE_DIR, 'google-browser-profile');

/**
 * Performs Google OAuth login on stage-platform.wavemaker.ai.
 *
 * Uses a persistent browser profile so Google remembers "trust this device".
 * On the very first run (or when session expires), a **visible** browser
 * window opens for the user to complete 2-Step Verification manually.
 * After that, the session is cached and reused for ~12 hours, and the
 * persistent profile means Google won't re-prompt 2FA on this machine.
 */
export async function googleBrowserLogin(options?: {
  page?: Page;
  headless?: boolean;
}): Promise<GoogleAuthResult> {
  const email = ENV.googleEmail;
  const password = ENV.googlePassword;

  if (!email || !password) {
    throw new Error(
      'Google auth credentials missing. Set GOOGLE_EMAIL and GOOGLE_PASSWORD in .env'
    );
  }

  // Fast path: try cached session
  const cached = tryLoadCachedSession();
  if (cached) {
    const valid = await verifyCachedSession(cached);
    if (valid) {
      console.log('[GoogleAuth] Reusing cached session (still valid)');
      return cached;
    }
    console.log('[GoogleAuth] Cached session expired, performing fresh login...');
  }

  const baseUrl = ENV.studioBaseUrl.replace(/\/$/, '');

  // If an existing page is supplied (e.g. from global-setup), use it directly
  if (options?.page) {
    const result = await loginInPage(options.page, baseUrl, email, password);
    saveCachedSession(result);
    return result;
  }

  // Launch persistent browser context — preserves Google "trusted device" state
  if (!fs.existsSync(PROFILE_DIR)) {
    fs.mkdirSync(PROFILE_DIR, { recursive: true });
  }

  // Always headed so the user can see and complete 2FA when needed
  console.log(
    '[GoogleAuth] Launching browser for Google login...\n' +
    '             If 2FA is prompted, complete it in the browser window.\n' +
    '             The session will be saved for future runs (~12h).'
  );

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
    ],
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });

  const page = context.pages()[0] || (await context.newPage());

  try {
    const result = await loginInPage(page, baseUrl, email, password);
    result.storageState = await context.storageState();
    saveCachedSession(result);
    return result;
  } finally {
    await context.close();
  }
}

// ---------------------------------------------------------------------------
// Core login flow
// ---------------------------------------------------------------------------

async function loginInPage(
  page: Page,
  baseUrl: string,
  email: string,
  password: string,
): Promise<GoogleAuthResult> {
  console.log(`[GoogleAuth] Navigating to ${baseUrl}/login ...`);
  await page.goto(`${baseUrl}/login`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });

  // Already authenticated from persistent profile?
  if (isOnStudioPage(page.url(), baseUrl)) {
    console.log('[GoogleAuth] Already authenticated via persistent session');
    return extractCookies(page);
  }

  // Click the Google sign-in button
  await clickGoogleButton(page, baseUrl);

  // Fill email + password
  await fillGoogleCredentials(page, email, password);

  // Handle 2FA automatically via TOTP if secret is configured, otherwise wait for manual
  await handle2FA(page);

  // Handle any post-2FA pages (device prompt, consent, "Yes it was me", etc.)
  await handlePostAuthPages(page);

  console.log('[GoogleAuth] Waiting for Studio redirect...');
  await page.waitForURL(
    (url) => isOnStudioPage(url.toString(), baseUrl),
    { timeout: process.env.GOOGLE_TOTP_SECRET ? 90_000 : 180_000 },
  );

  await page.waitForTimeout(3000);
  await page.waitForLoadState('domcontentloaded');

  console.log('[GoogleAuth] Login complete, extracting cookies...');
  return extractCookies(page);
}

function isOnStudioPage(url: string, baseUrl: string): boolean {
  try {
    const host = new URL(url).hostname;
    const studioHost = new URL(baseUrl).hostname;
    return host === studioHost && !url.includes('/login');
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Google button detection
// ---------------------------------------------------------------------------

async function clickGoogleButton(page: Page, baseUrl: string): Promise<void> {
  const selectors = [
    'button:has-text("Sign in with Google")',
    'button:has-text("Continue with Google")',
    'button:has-text("Google")',
    'a:has-text("Sign in with Google")',
    'a:has-text("Continue with Google")',
    '[data-provider="google"]',
    '.google-login-btn',
    '.social-login-google',
    '#google-login',
  ];

  for (const sel of selectors) {
    const btn = page.locator(sel).first();
    if ((await btn.count()) > 0) {
      console.log(`[GoogleAuth] Clicking Google button: ${sel}`);
      await btn.click();
      await page.waitForTimeout(2000);
      return;
    }
  }

  // Page may have auto-redirected to Google already
  if (page.url().includes('accounts.google.com')) {
    console.log('[GoogleAuth] Already redirected to Google login');
    return;
  }

  throw new Error(
    `[GoogleAuth] Could not find Google login button on ${baseUrl}/login. ` +
    `Current URL: ${page.url()}`
  );
}

// ---------------------------------------------------------------------------
// Google credentials entry
// ---------------------------------------------------------------------------

async function fillGoogleCredentials(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  // Wait until we're on Google's login page
  await page
    .waitForURL((url) => url.toString().includes('accounts.google.com'), {
      timeout: 30_000,
    })
    .catch(() => {
      console.log('[GoogleAuth] Not on accounts.google.com, proceeding...');
    });

  // Email step (may be skipped if Google remembers the account from persistent profile)
  const emailInput = page.locator('input[type="email"]');
  if ((await emailInput.count()) > 0 && (await emailInput.isVisible())) {
    await emailInput.fill(email);
    console.log(`[GoogleAuth] Entered email: ${email}`);
    await page
      .locator('#identifierNext button, button:has-text("Next")')
      .first()
      .click();
    await page.waitForTimeout(2000);
  }

  // Password step
  let passwordInput = page.locator('input[type="password"]');
  let passwordVisible = await passwordInput.isVisible().catch(() => false);

  if (!passwordVisible) {
    // Google may show "Choose how you want to sign in" (/challenge/selection page)
    // Screenshot shows: "Enter your password" and "Try another way" as clickable options
    const isSelectionPage = page.url().includes('/challenge/selection') ||
      page.url().includes('/challenge/pwd');

    if (isSelectionPage) {
      console.log('[GoogleAuth] On challenge selection page, looking for password option...');
      await page.waitForTimeout(2000);

      // Try Playwright native clicks (real mouse events) — DOM .click() doesn't work on Google's elements
      const pwdSelectors = [
        'li:has-text("Enter your password")',
        'li:has-text("password")',
        '[data-challengeindex="0"]',
        'div[role="link"]:has-text("password")',
      ];

      let clicked = false;
      for (const sel of pwdSelectors) {
        try {
          const el = page.locator(sel).first();
          if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
            console.log(`[GoogleAuth] Clicking password option via: ${sel}`);
            await el.click();
            clicked = true;
            await page.waitForTimeout(3000);
            passwordInput = page.locator('input[type="password"]');
            passwordVisible = await passwordInput.isVisible().catch(() => false);
            if (passwordVisible) break;
          }
        } catch { continue; }
      }

      if (!clicked) {
        // Last resort: getByText
        try {
          await page.getByText('Enter your password').click({ timeout: 3000 });
          console.log('[GoogleAuth] Clicked password option via getByText');
          clicked = true;
          await page.waitForTimeout(3000);
          passwordInput = page.locator('input[type="password"]');
          passwordVisible = await passwordInput.isVisible().catch(() => false);
        } catch {}
      }

      if (!clicked) {
        console.log('[GoogleAuth] All approaches to click password option failed');
        const pageText = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || 'empty');
        console.log(`[GoogleAuth] Page text: ${pageText}`);
      }
    }
  }

  if (passwordVisible) {
    await passwordInput.fill(password);
    console.log('[GoogleAuth] Entered password');
    await page
      .locator('#passwordNext button, button:has-text("Next")')
      .first()
      .click();
    await page.waitForTimeout(3000);
  } else {
    console.log('[GoogleAuth] Password field not shown (session may still be active)');
  }
}

// ---------------------------------------------------------------------------
// Post-auth page handling (device prompts, consent, etc.)
// ---------------------------------------------------------------------------

async function handlePostAuthPages(page: Page): Promise<void> {
  // Give the page a moment to load after 2FA
  await page.waitForTimeout(3000);

  // Already on Studio — nothing to handle
  if (!page.url().includes('accounts.google.com')) {
    return;
  }

  const currentUrl = page.url();
  console.log(`[GoogleAuth] Post-2FA page detected: ${currentUrl.split('?')[0]}`);

  // If we landed on the TOTP page but code wasn't filled yet, fill it now
  if (currentUrl.includes('/challenge/totp')) {
    const totpSecret = process.env.GOOGLE_TOTP_SECRET;
    const totpInput = page.locator('#totpPin').first();
    if (totpSecret && await totpInput.isVisible().catch(() => false)) {
      const inputVal = await totpInput.inputValue().catch(() => '');
      if (!inputVal) {
        console.log('[GoogleAuth] TOTP page reached via post-auth, filling code now...');
        await fillAndSubmitTotp(page, totpInput, totpSecret);
        await page.waitForTimeout(5000);
        if (!page.url().includes('accounts.google.com')) {
          console.log('[GoogleAuth] Redirected to Studio after TOTP fill');
          return;
        }
      }
    }
  }

  // Look for common post-auth buttons: "Yes", "Continue", "Allow", "Next", "Confirm", "I agree"
  const actionSelectors = [
    'button:has-text("Yes")',
    'button:has-text("Continue")',
    'button:has-text("Allow")',
    'button:has-text("Next")',
    'button:has-text("Confirm")',
    'button:has-text("I agree")',
    'button:has-text("Done")',
    'button:has-text("Yes, it")',
    '#confirm button',
    '#submit_approve_access',
    'button[type="submit"]',
  ];

  for (const sel of actionSelectors) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible().catch(() => false)) {
      console.log(`[GoogleAuth] Clicking post-auth button: ${sel}`);
      await btn.click();
      await page.waitForTimeout(5000);

      if (!page.url().includes('accounts.google.com')) {
        console.log('[GoogleAuth] Redirected away from Google after post-auth click');
        return;
      }
      break;
    }
  }

  // Check for "Don't ask again" / "Remember this device" checkbox
  const rememberCheckbox = page.locator(
    'input[type="checkbox"], ' +
    'label:has-text("Don\'t ask again"), ' +
    'label:has-text("Remember this device")'
  ).first();
  if (await rememberCheckbox.isVisible().catch(() => false)) {
    console.log('[GoogleAuth] Checking "Don\'t ask again" checkbox...');
    await rememberCheckbox.click().catch(() => {});
    await page.waitForTimeout(1000);
  }

  // Try clicking any remaining action buttons after checkbox
  for (const sel of actionSelectors) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible().catch(() => false)) {
      console.log(`[GoogleAuth] Clicking post-checkbox button: ${sel}`);
      await btn.click();
      await page.waitForTimeout(5000);
      break;
    }
  }

  console.log(`[GoogleAuth] Post-auth handling complete. Current URL: ${page.url().split('?')[0]}`);
}

// ---------------------------------------------------------------------------
// 2FA handling (TOTP)
// ---------------------------------------------------------------------------

async function handle2FA(page: Page): Promise<void> {
  const totpSecret = process.env.GOOGLE_TOTP_SECRET;
  if (!totpSecret) {
    console.log('[GoogleAuth] No GOOGLE_TOTP_SECRET set, waiting for manual 2FA...');
    return;
  }

  // Wait a moment for the 2FA page to load after password entry
  await page.waitForTimeout(3000);

  // If already redirected to Studio, no 2FA needed
  if (!page.url().includes('accounts.google.com')) {
    console.log('[GoogleAuth] Already past 2FA (no Google page), continuing...');
    return;
  }

  // Check if we're on a "Choose how you want to sign in" page (not 2FA) — need password first
  const enterPasswordOption = page.locator(
    'div[role="link"]:has-text("Enter your password"), ' +
    'li:has-text("Enter your password"), ' +
    'button:has-text("Enter your password")'
  ).first();
  if (await enterPasswordOption.isVisible().catch(() => false)) {
    console.log('[GoogleAuth] Sign-in method selection detected, not 2FA — skipping handle2FA');
    return;
  }

  // Check if TOTP input is already visible (direct Authenticator challenge)
  const directTotp = page.locator('#totpPin').first();
  if (await directTotp.isVisible().catch(() => false)) {
    console.log('[GoogleAuth] TOTP input already visible, filling directly...');
    await fillAndSubmitTotp(page, directTotp, totpSecret);
    return;
  }

  // We might be on the 2FA method selection page OR a specific 2FA challenge page
  const isSelectionPage = page.url().includes('/challenge/selection');

  if (isSelectionPage) {
    // Already on the method selection list — directly pick Google Authenticator
    console.log('[GoogleAuth] On 2FA method selection page, picking Google Authenticator...');
    await clickAuthenticatorOption(page);
  } else {
    // On a specific challenge page (push notification, SMS, etc.) — click "Try another way" first
    const tryAnotherWay = page.locator(
      'button:has-text("Try another way"), ' +
      'a:has-text("Try another way")'
    ).first();

    try {
      await tryAnotherWay.waitFor({ state: 'visible', timeout: 5_000 });
      console.log('[GoogleAuth] Non-TOTP 2FA detected, clicking "Try another way"...');
      await tryAnotherWay.click();
      await page.waitForTimeout(3000);
      await clickAuthenticatorOption(page);
    } catch {
      console.log('[GoogleAuth] No "Try another way" link found, checking for direct TOTP input...');
    }
  }

  // Wait for navigation away from the selection page to the TOTP page
  console.log('[GoogleAuth] Waiting for TOTP page to load...');
  try {
    await page.waitForURL(url => !url.toString().includes('/challenge/selection'), { timeout: 15_000 });
    console.log(`[GoogleAuth] Navigated to: ${page.url().split('?')[0]}`);
  } catch {
    console.log('[GoogleAuth] URL did not change from selection page');
  }
  await page.waitForTimeout(2000);

  // Now look for the TOTP input field (avoid input[type="tel"] — matches phone number fields)
  const totpSelectors = [
    '#totpPin',
    'input[name="totpPin"]',
    'input[name="pin"]',
    'input[autocomplete="one-time-code"]',
    'input[type="text"][aria-label*="code" i]',
    'input[type="number"]',
  ];
  
  let totpInput = await findVisibleElement(page, totpSelectors);

  if (!totpInput) {
    console.log('[GoogleAuth] TOTP input not immediately visible, waiting 5s more...');
    console.log(`[GoogleAuth] Current URL: ${page.url()}`);
    await page.waitForTimeout(5000);
    totpInput = await findVisibleElement(page, totpSelectors);
  }

  if (!totpInput) {
    console.log('[GoogleAuth] No TOTP input found after all attempts, waiting for manual 2FA...');
    console.log(`[GoogleAuth] Page title: ${await page.title()}`);
    console.log(`[GoogleAuth] Current URL: ${page.url()}`);
    return;
  }

  await fillAndSubmitTotp(page, totpInput, totpSecret);
}

async function findVisibleElement(page: Page, selectors: string[]) {
  for (const sel of selectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible().catch(() => false)) {
      console.log(`[GoogleAuth] Found element with selector: ${sel}`);
      return el;
    }
  }
  return null;
}

async function clickAuthenticatorOption(page: Page): Promise<void> {
  // Use Playwright's native click (simulates real mouse events) — page.evaluate DOM click doesn't work on Google's custom elements
  const selectors = [
    'li:has-text("Google Authenticator")',
    'li:has-text("Authenticator")',
    'li:has-text("authenticator")',
    'li:has-text("verification code")',
    '[data-challengetype="6"]',
    'div[role="link"]:has-text("Authenticator")',
    'div[role="link"]:has-text("verification code")',
  ];

  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log(`[GoogleAuth] Clicking Authenticator option via Playwright: ${sel}`);
        await el.click();
        await page.waitForTimeout(5000);
        return;
      }
    } catch { continue; }
  }

  // Last resort: click by text content using getByText
  try {
    await page.getByText('Authenticator').first().click({ timeout: 3000 });
    console.log('[GoogleAuth] Clicked Authenticator option via getByText');
    await page.waitForTimeout(5000);
    return;
  } catch {}

  console.log('[GoogleAuth] Could not find Authenticator option in list');
}

async function fillAndSubmitTotp(page: Page, input: any, totpSecret: string): Promise<void> {
  const { TOTP, Secret } = await import('otpauth');
  const totp = new TOTP({
    secret: Secret.fromBase32(totpSecret.replace(/\s+/g, '').toUpperCase()),
    digits: 6,
    period: 30,
  });
  const code = totp.generate();

  console.log('[GoogleAuth] Auto-filling 2FA TOTP code...');
  await input.fill(code);

  // Try multiple submit button selectors
  const submitSelectors = [
    '#totpNext button',
    '#totpNext',
    'button:has-text("Next")',
    'button:has-text("Verify")',
    'button[type="button"]:near(#totpPin)',
  ];

  for (const sel of submitSelectors) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible().catch(() => false)) {
      console.log(`[GoogleAuth] Clicking submit button: ${sel}`);
      await btn.click();
      break;
    }
  }

  await page.waitForTimeout(3000);
  console.log('[GoogleAuth] 2FA code submitted');
}

// ---------------------------------------------------------------------------
// Cookie extraction
// ---------------------------------------------------------------------------

async function extractCookies(page: Page): Promise<GoogleAuthResult> {
  const cookies = await page.context().cookies();
  const headerParts: string[] = [];

  const authCookie = cookies.find((c) => c.name === 'auth_cookie');
  if (authCookie) headerParts.push(`auth_cookie=${authCookie.value}`);

  const jsession = cookies.find((c) => c.name === 'JSESSIONID');
  if (jsession) headerParts.push(`JSESSIONID=${jsession.value}`);

  if (!headerParts.length) {
    const sessionCookies = cookies.filter(
      (c) =>
        c.name.toLowerCase().includes('session') ||
        c.name.toLowerCase().includes('auth') ||
        c.name.toLowerCase().includes('token')
    );
    for (const sc of sessionCookies) {
      headerParts.push(`${sc.name}=${sc.value}`);
    }
  }

  if (!headerParts.length) {
    console.warn(
      '[GoogleAuth] No auth cookies found. Sending all cookies:',
      cookies.map((c) => c.name).join(', ')
    );
    for (const c of cookies) {
      headerParts.push(`${c.name}=${c.value}`);
    }
  }

  const cookieHeader = headerParts.join('; ');
  console.log(
    `[GoogleAuth] Captured cookie header (length: ${cookieHeader.length})`
  );

  return { cookieHeader };
}

// ---------------------------------------------------------------------------
// Session caching
// ---------------------------------------------------------------------------

function saveCachedSession(result: GoogleAuthResult): void {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    fs.writeFileSync(
      SESSION_FILE,
      JSON.stringify({
        cookieHeader: result.cookieHeader,
        storageState: result.storageState,
        timestamp: Date.now(),
      })
    );
    console.log('[GoogleAuth] Session cached for future runs');
  } catch (e: any) {
    console.warn('[GoogleAuth] Failed to cache session:', e?.message);
  }
}

function tryLoadCachedSession(): GoogleAuthResult | null {
  try {
    if (!fs.existsSync(SESSION_FILE)) return null;
    const raw = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));

    const MAX_AGE_MS = 12 * 60 * 60 * 1000;
    if (Date.now() - raw.timestamp > MAX_AGE_MS) {
      console.log('[GoogleAuth] Cached session older than 12h, ignoring');
      return null;
    }

    return {
      cookieHeader: raw.cookieHeader,
      storageState: raw.storageState,
    };
  } catch {
    return null;
  }
}

async function verifyCachedSession(cached: GoogleAuthResult): Promise<boolean> {
  try {
    const baseUrl = ENV.studioBaseUrl.replace(/\/$/, '');
    const resp = await fetch(`${baseUrl}/studio/services/projects`, {
      headers: { Cookie: cached.cookieHeader },
      redirect: 'manual',
    });
    return resp.status >= 200 && resp.status < 400;
  } catch {
    return false;
  }
}
