/**
 * Authenticated Playwright context for WaveMaker Studio.
 *
 * Shared by scripts that drive the Studio UI (token slots scraper,
 * token highlight verifier). Supports the three auth methods the framework
 * knows about: WaveMaker REST login, Platform DB REST login, Google OAuth.
 */

import { chromium, Page, BrowserContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { ENV } from '../utils/env';
import { googleBrowserLogin } from './googleAuth';

/**
 * Perform the login and install the session cookies on an existing context.
 *
 * Split out of getAuthenticatedContext so long-running scripts can re-run it
 * when Studio expires the session mid-sweep. The Platform DB / WaveMaker paths
 * are a REST call plus addCookies, so re-auth is cheap; the Google OAuth path
 * drives the browser and is slower.
 */
export async function applyStudioAuth(
  context: BrowserContext,
  page: Page,
  tag = 'Studio'
): Promise<void> {
  const baseUrl = ENV.studioBaseUrl.replace(/\/$/, '');
  const projectId = ENV.projectId;
  if (ENV.authMethod === 'wavemaker') {
    console.log(`[${tag}] Authenticating via WaveMaker REST login (StudioClient)...`);
    const { StudioClient } = await import('../api/studioClient');
    const client = new StudioClient({ baseUrl, projectId });
    const cookie = await client.login(ENV.studioUsername, ENV.studioPassword);

    const baseUrlObj = new URL(baseUrl);
    const cookiePairs = cookie.split(';').map(c => c.trim()).filter(Boolean);
    for (const pair of cookiePairs) {
      const eqIdx = pair.indexOf('=');
      const name  = eqIdx === -1 ? pair : pair.slice(0, eqIdx).trim();
      const value = eqIdx === -1 ? ''   : pair.slice(eqIdx + 1).trim();
      if (name) {
        await context.addCookies([{ name, value, domain: baseUrlObj.hostname, path: '/' }]);
      }
    }
    process.env.STUDIO_COOKIE = cookie;
    console.log(`[${tag}] WaveMaker REST login successful (cookie: ${cookie.length} chars)`);
  } else if (ENV.isPlatformDB) {
    console.log(`[${tag}] Authenticating via Platform DB REST login...`);
    const { StudioClient } = await import('../api/studioClient');
    const client = new StudioClient({ baseUrl, projectId });
    const cookie = await client.loginWithPlatformDB(ENV.studioUsername, ENV.studioPassword);

    const baseUrlObj = new URL(baseUrl);
    for (const part of cookie.split('; ')) {
      const [name, value] = part.split('=');
      if (name && value) {
        await context.addCookies([{
          name: name.trim(),
          value: value.trim(),
          domain: baseUrlObj.hostname,
          path: '/',
        }]);
      }
    }
  } else {
    console.log(`[${tag}] Authenticating via Google OAuth...`);
    const authResult = await googleBrowserLogin({ page, headless: false });
    if (!authResult.cookieHeader) {
      throw new Error('Failed to authenticate');
    }
  }

  console.log(`[${tag}] Authentication successful`);
}

export async function getAuthenticatedContext(
  tag = 'Studio'
): Promise<{ context: BrowserContext; page: Page }> {
  const profileDir = path.join(process.cwd(), '.test-cache', 'google-browser-profile');
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }

  // A crashed run leaves SingletonLock behind and Chromium then refuses to
  // start ("Failed to create a ProcessSingleton"), blocking every later run.
  // The lock is a symlink named <host>-<pid>; clear it only when that pid is
  // gone, so a genuinely concurrent run is never disturbed.
  const lock = path.join(profileDir, 'SingletonLock');
  try {
    const target = fs.readlinkSync(lock);
    const pid = parseInt(target.split('-').pop() || '', 10);
    let alive = false;
    if (pid) {
      try { process.kill(pid, 0); alive = true; } catch { alive = false; }
    }
    if (alive) {
      throw new Error(
        `Browser profile is in use by pid ${pid}. Another run is active — wait for it ` +
        `to finish, or kill it. Concurrent runs also share one Studio account, and a ` +
        `second login can invalidate the first session mid-sweep.`
      );
    }
    fs.unlinkSync(lock);
    console.log(`[${tag}] Cleared stale profile lock from dead pid ${pid}`);
  } catch (e: any) {
    if (e.message?.startsWith('Browser profile is in use')) throw e;
    // No lock, or unreadable — nothing to clean up.
  }

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
    ],
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
  });

  const page = context.pages()[0] || (await context.newPage());
  await applyStudioAuth(context, page, tag);
  return { context, page };
}

/**
 * Is the current page an unauthenticated one? Studio bounces expired sessions
 * to a login route, and the SPA can also render a login form in place.
 */
export async function isLoggedOut(page: Page): Promise<boolean> {
  try {
    const url = page.url();
    if (/\/login|\/oauth|accounts\.google\.com|\/sign-?in/i.test(url)) return true;
    return await page.evaluate(() =>
      !!document.querySelector('input[type="password"], form[name="loginForm"], .login-container, wms-login'));
  } catch {
    return false;
  }
}
