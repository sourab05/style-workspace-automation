import { Page } from '@playwright/test';
import { StudioClient } from '../../src/api/studioClient';
import { ENV } from '../../src/utils/env';
import { ensureAuthCookies, toHaveSnapshot, waitForPageLoad } from '../../src/playwright/helpers';
import { googleBrowserLogin } from '../../src/auth/googleAuth';
import data from '../testdata/data.json';

class StudioScreen {
  private page: Page;
  private cookieHeader?: string;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Perform Studio login and capture a Cookie header (auth_cookie + JSESSIONID) that
   * can be reused for both browser navigation and StudioClient API calls.
   *
   * Automatically detects whether to use Google OAuth or WaveMaker form login
   * based on STUDIO_BASE_URL (stage-platform.wavemaker.ai → Google).
   */
  async login(): Promise<string> {
    if (ENV.studioCookie) {
      this.cookieHeader = ENV.studioCookie;
      await ensureAuthCookies(this.page, ENV.studioBaseUrl, this.cookieHeader);
      return this.cookieHeader;
    }

    if (ENV.isGoogleAuth) {
      return this.googleLogin();
    }

    return this.wavemakerLogin();
  }

  private async googleLogin(): Promise<string> {
    console.log('🔐 Performing Google OAuth login (stage-platform detected)...');

    const result = await googleBrowserLogin({ page: this.page });
    this.cookieHeader = result.cookieHeader;
    process.env.STUDIO_COOKIE = this.cookieHeader;

    console.log('🔑 Captured Studio cookie header from Google login');
    return this.cookieHeader;
  }

  private async wavemakerLogin(): Promise<string> {
    if (!ENV.studioUsername || !ENV.studioPassword) {
      throw new Error('Studio credentials not found (STUDIO_USERNAME / STUDIO_PASSWORD).');
    }

    const baseUrl = ENV.studioBaseUrl.replace(/\/$/, '');
    const loginUrl = `${baseUrl}/login`;
    console.log(`🔐 Performing WaveMaker UI login at: ${loginUrl}`);

    await this.page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

    await this.page.fill('input[name="username"], input[name="j_username"]', ENV.studioUsername);
    await this.page.fill('input[name="password"], input[name="j_password"]', ENV.studioPassword);
    await this.page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")');

    await waitForPageLoad(this.page);

    const cookies = await this.page.context().cookies();
    const headerParts: string[] = [];

    const authCookie = cookies.find((c) => c.name === 'auth_cookie');
    if (authCookie) {
      headerParts.push(`auth_cookie=${authCookie.value}`);
    }
    const jsession = cookies.find((c) => c.name === 'JSESSIONID');
    if (jsession) {
      headerParts.push(`JSESSIONID=${jsession.value}`);
    }

    if (!headerParts.length) {
      console.warn('⚠️ UI login completed but no auth_cookie/JSESSIONID found in browser cookies.');
    }

    this.cookieHeader = headerParts.join('; ');
    process.env.STUDIO_COOKIE = this.cookieHeader;

    console.log('🔑 Captured Studio cookie header from WaveMaker login:', this.cookieHeader);
    return this.cookieHeader;
  }

  async takeBaseScreenshots(): Promise<void> {
    const page = this.page;
    console.log('🔐 Starting takeBaseScreenshots with authentication...');

    // Ensure the user is authenticated before navigating
    await ensureAuthCookies(page, ENV.studioBaseUrl, this.cookieHeader || ENV.studioCookie);

    // 1. Take base screenshot for the Canvas view
    const canvasUrl = `${ENV.studioBaseUrl}${data.studio.mainPageUrl.replace('${PROJECT_ID}', ENV.projectId)}`;
    console.log(`🌐 Navigating to canvas: ${canvasUrl}`);

    let retries = 2;
    let success = false;

    while (retries > 0 && !success) {
      try {
        await page.goto(canvasUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await waitForPageLoad(page);

        // Check if we're on login page (redirected due to auth failure)
        const currentUrl = page.url();
        console.log(`📍 Current URL after navigation: ${currentUrl}`);

        if (currentUrl.includes('/login') || currentUrl.includes('auth')) {
          console.warn('⚠️ Redirected to login page - authentication failed');

          if (retries > 1) {
            console.log('🔄 Retrying with fresh cookies...');
            await ensureAuthCookies(page, ENV.studioBaseUrl, this.cookieHeader || ENV.studioCookie);
            retries--;
            continue;
          } else {
            throw new Error('Authentication failed after retries - still on login page');
          }
        }

        // Wait for the canvas page element to confirm we're on the right page
        await page.locator(data.studio.titleXpath).waitFor({ state: 'visible', timeout: 60000 });
        console.log('✅ Successfully loaded canvas page');
        success = true;

      } catch (error) {
        retries--;
        if (retries > 0) {
          console.log(`⚠️ Error loading canvas, retrying... (${retries} attempts left)`);
          console.error(error);
          await page.waitForTimeout(2000);
        } else {
          console.error('❌ Failed to load canvas after retries');
          throw error;
        }
      }
    }

    console.log('📸 Taking baseline screenshot: base-canvas (will be saved to screenshots/base-image/)');
    await toHaveSnapshot(page, 'base-canvas');

    // 2. Take base screenshot for the Preview view
    const client = new StudioClient({
      baseUrl: ENV.studioBaseUrl,
      projectId: ENV.projectId,
      cookie: this.cookieHeader || ENV.studioCookie,
    });

    const previewUrl = await client.inplaceDeploy();
    if (previewUrl) {
      console.log(`🌐 Navigating to preview: ${previewUrl}`);
      await ensureAuthCookies(page, previewUrl, this.cookieHeader || ENV.studioCookie);
      await page.goto(previewUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await waitForPageLoad(page);
      console.log('📸 Taking baseline screenshot: base-preview (will be saved to screenshots/base-image/)');
      await toHaveSnapshot(page, 'base-preview');
    } else {
      console.warn('Could not get preview URL, skipping base preview screenshot.');
    }
  }
}

export default StudioScreen;
