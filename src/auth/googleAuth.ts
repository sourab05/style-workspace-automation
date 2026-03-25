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

  // Wait for 2FA + consent + redirect back to Studio (user handles 2FA manually)
  console.log('[GoogleAuth] Waiting for login to complete (including any 2FA)...');
  await page.waitForURL(
    (url) => isOnStudioPage(url.toString(), baseUrl),
    { timeout: 180_000 }, // 3 min for manual 2FA
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

  // Password step (may be skipped if session is still partially valid)
  const passwordInput = page.locator('input[type="password"]');
  try {
    await passwordInput.waitFor({ state: 'visible', timeout: 10_000 });
    await passwordInput.fill(password);
    console.log('[GoogleAuth] Entered password');
    await page
      .locator('#passwordNext button, button:has-text("Next")')
      .first()
      .click();
    await page.waitForTimeout(3000);
  } catch {
    console.log('[GoogleAuth] Password field not shown (session may still be active)');
  }
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
