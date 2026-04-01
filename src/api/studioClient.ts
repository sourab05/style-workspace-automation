import axios, { AxiosInstance, AxiosError } from 'axios';
import qs from 'qs';
import { ENV } from '../utils/env';
import { googleBrowserLogin } from '../auth/googleAuth';
import http from 'http';
import https from 'https';

export interface StudioClientOptions {
  baseUrl: string;
  apiKey?: string;
  cookie?: string;
  projectId: string;
}

export class StudioClient {
  private http: AxiosInstance;
  private projectId: string;
  private authCookie?: string;
  private cookieFromEnv: boolean;

  constructor(options: StudioClientOptions) {
    this.projectId = options.projectId;
    this.authCookie = options.cookie;
    this.cookieFromEnv = !!options.cookie;

    const baseUrl = options.baseUrl.replace(/\/$/, '');
    const httpAgent = new http.Agent({ keepAlive: true });
    const httpsAgent = new https.Agent({ keepAlive: true });

    this.http = axios.create({
      baseURL: baseUrl,
      headers: {
        'Content-Type': 'application/json',
        accept: 'application/json, text/plain, */*',
        'x-requested-with': 'XMLHttpRequest',
        ...(options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {}),
        ...(options.cookie ? { Cookie: options.cookie } : {}),
        ...(ENV.studioOrigin ? { Origin: ENV.studioOrigin } : {}),
        ...(ENV.studioReferer ? { Referer: ENV.studioReferer } : {}),
      },
      timeout: 60000,
      httpAgent,
      httpsAgent,
    });

    this.http.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401 && !error.config?.headers?.['X-Retry-After-Auth']) {
          try {
            // 1) Check if STUDIO_COOKIE was set by a prior login in this process
            //    (e.g. global-setup ran Google login before this client was created)
            const envCookie = process.env.STUDIO_COOKIE;
            if (envCookie && envCookie !== this.authCookie) {
              console.log('[StudioClient] Found STUDIO_COOKIE from prior login, using it...');
              this.updateAuthCookie(envCookie);
              if (error.config?.headers) {
                (error.config.headers as any)['Cookie'] = envCookie;
                (error.config.headers as any)['X-Retry-After-Auth'] = 'true';
                return this.http.request(error.config);
              }
            }

            // 2) Try reading the cached cookie file (written by global-setup)
            const cachedCookie = this.tryReadCachedCookie();
            if (cachedCookie && cachedCookie !== this.authCookie) {
              console.log('[StudioClient] Found cached auth cookie file, using it...');
              this.updateAuthCookie(cachedCookie);
              process.env.STUDIO_COOKIE = cachedCookie;
              if (error.config?.headers) {
                (error.config.headers as any)['Cookie'] = cachedCookie;
                (error.config.headers as any)['X-Retry-After-Auth'] = 'true';
                return this.http.request(error.config);
              }
            }

            // 3) No cached cookie available — perform fresh login
            if (!this.cookieFromEnv) {
              console.log(`Authentication failed, attempting to re-login (method: ${ENV.authMethod})...`);
              let newCookie: string | null = null;
              if (ENV.isPlatformDB && ENV.studioUsername && ENV.studioPassword) {
                newCookie = await this.loginWithPlatformDB(ENV.studioUsername, ENV.studioPassword);
              } else if (ENV.isGoogleAuth) {
                newCookie = await this.loginWithGoogle();
              } else if (ENV.studioUsername && ENV.studioPassword) {
                newCookie = await this.login(ENV.studioUsername, ENV.studioPassword);
              }

              if (newCookie) {
                this.updateAuthCookie(newCookie);
                process.env.STUDIO_COOKIE = newCookie;
                if (error.config) {
                  console.log('[StudioClient] Retrying request with new auth cookie...');
                  if (error.config.headers) {
                    (error.config.headers as any)['Cookie'] = newCookie;
                    (error.config.headers as any)['X-Retry-After-Auth'] = 'true';
                  }
                  return this.http.request(error.config);
                }
              }
            }
          } catch (loginError) {
            console.error('Re-authentication failed:', loginError);
          }
        }
        return Promise.reject(error);
      }
    );
  }

  private updateAuthCookie(cookie: string) {
    this.authCookie = cookie;
    this.http.defaults.headers.common['Cookie'] = cookie;
    console.log(`[StudioClient] Updated auth cookie headers. Cookie length: ${cookie?.length}`);
  }

  private tryReadCachedCookie(): string | null {
    try {
      const fs = require('fs');
      const path = require('path');
      // Check the auth-cookie.txt written by global-setup
      const cookieFile = path.join(process.cwd(), '.test-cache', 'auth-cookie.txt');
      if (fs.existsSync(cookieFile)) {
        const cookie = fs.readFileSync(cookieFile, 'utf-8').trim();
        if (cookie) return cookie;
      }
      // Also check the Google auth session cache
      const sessionFile = path.join(process.cwd(), '.test-cache', 'google-auth-state.json');
      if (fs.existsSync(sessionFile)) {
        const raw = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
        if (raw.cookieHeader) return raw.cookieHeader;
      }
    } catch { }
    return null;
  }

  async updateToken(tokenPath: string, value: unknown): Promise<void> {
    // POST /projects/:id/style/tokens
    await this.http.post(`/projects/${this.projectId}/style/tokens`, {
      path: tokenPath,
      value,
    });
  }

  // async rollbackToken(tokenPath: string): Promise<void> {
  //   await this.http.post(`/projects/${this.projectId}/style/tokens/rollback`, {
  //     path: tokenPath,
  //   });
  // }

  async publishAndBuild(): Promise<void> {
    const path = ENV.studioPublishPath.replace('${PROJECT_ID}', this.projectId);
    try {
      await this.http.post(path);
    } catch (e: any) {
      if (e?.response?.status === 404) {
        // Some envs may not require or expose publish; ignore 404
        return;
      }
      throw e;
    }
  }

  /**
   * Waits for the build to propagate after publishAndBuild().
   * Uses a configurable delay. If the Studio API exposes a build-status
   * endpoint in the future, this can be upgraded to polling.
   */
  async waitForBuildPropagation(delayMs: number = 5000): Promise<void> {
    console.log(`   ⏳ Waiting ${delayMs}ms for build propagation...`);
    await new Promise(r => setTimeout(r, delayMs));
  }

  /**
   * Updates a component override file with the given payload
   */
  async updateComponentOverride(component: string, payload: unknown): Promise<void> {
    const url = `/studio/services/projects/${this.projectId}/resources/content/web/design-tokens/overrides/components/${component}/${component}.json`;

    try {
      // Perform the request and validate response
      const response = await this.http.post(url, JSON.stringify(payload), {
        headers: {
          'content-type': 'text/plain',
          'accept': 'application/json, text/plain, */*',
          'x-requested-with': 'XMLHttpRequest'
        },
      });
      if (response.status !== 200) {
        throw new Error(`Failed to update component override. Status: ${response.status}`);
      }
    } catch (error: any) {
      if (error.response) {
        console.error('Component override update failed:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          url: url,
        });
      }
      throw error;
    }
  }

  async getComponentOverride(component: string): Promise<any> {
    const url = `/studio/services/projects/${this.projectId}/resources/content/web/design-tokens/overrides/components/${component}/${component}.json`;
    try {
      const response = await this.http.get(url);
      return response.data;
    } catch (error: any) {
      if (error.response) {
        console.error('Component override get failed:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          url: url,
        });
      }
      throw error;
    }
  }


  /** Login to Studio using form-encoded credentials; returns auth_cookie string */
  async login(username: string, password: string): Promise<string> {
    const loginPayload = qs.stringify({ j_username: username, j_password: password });

    // Build robust headers for login
    const baseUrl =
      (this.http.defaults.baseURL as string)?.replace(/\/$/, '') ||
      (ENV.studioBaseUrl || '').replace(/\/$/, '');
    const referer =
      `${baseUrl}${(ENV.canvasPath || 's/style/widgets/button?project-id=${PROJECT_ID}').replace('${PROJECT_ID}', this.projectId)}`;
    const origin = baseUrl;

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      accept: 'application/json, text/plain, */*',
      origin,
      referer,
      'x-requested-with': 'XMLHttpRequest',
    } as Record<string, string>;

    let lastError: any;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const loginRes = await this.http.post(ENV.studioLoginPath, loginPayload, {
          headers,
          maxRedirects: 0,
          validateStatus: (status) => status === 302,
          timeout: 60000,
        });

        const setCookies = loginRes.headers['set-cookie'] || [];
        // Step 1: try to get auth_cookie and JSESSIONID from login response
        let authCookieLine = setCookies.find((c: string) => c.startsWith('auth_cookie='));
        let jsessionLine = setCookies.find((c: string) => c.startsWith('JSESSIONID='));

        // Step 2: if auth_cookie is not present, hit the canvas page once to allow Studio to issue auth_cookie
        if (!authCookieLine) {
          try {
            const canvasPath = (ENV.canvasPath || 's/style/widgets/button?project-id=${PROJECT_ID}')
              .replace('${PROJECT_ID}', this.projectId);

            const canvasRes = await this.http.get(canvasPath, {
              maxRedirects: 0,
              validateStatus: () => true,
            });

            const canvasSetCookies = canvasRes.headers['set-cookie'] || [];
            authCookieLine = canvasSetCookies.find((c: string) => c.startsWith('auth_cookie='));
            // Also update JSESSIONID if the canvas response sets it
            if (!jsessionLine) {
              jsessionLine = canvasSetCookies.find((c: string) => c.startsWith('JSESSIONID='));
            }
          } catch (e) {
            console.warn('[StudioClient] Canvas fetch after login failed while trying to obtain auth_cookie:', (e as any)?.message || e);
          }
        }

        if (!authCookieLine && !jsessionLine) {
          console.error('Login failed: no usable auth cookie/JSESSIONID found in login/canvas "set-cookie" headers.');
          console.error('Login set-cookie headers:', setCookies);
          throw new Error('auth_cookie/JSESSIONID not found in login/canvas response.');
        }

        // Build combined cookie header: always include auth_cookie if present, and JSESSIONID if present
        const parts: string[] = [];
        if (authCookieLine) {
          parts.push(authCookieLine.split(';')[0]);
        }
        if (jsessionLine) {
          parts.push(jsessionLine.split(';')[0]);
        }
        const combinedCookie = parts.join('; ');

        this.updateAuthCookie(combinedCookie);
        return combinedCookie;
      } catch (error: any) {
        lastError = error;
        const transient = error?.code === 'ECONNABORTED' || !error?.response;
        console.warn(`[Studio Login] Attempt ${attempt} failed${transient ? ' (transient)' : ''}:`, error?.message || error);

        if (!transient || attempt === 3) {
          console.error('Login request failed:', error?.message || error);
          if (error?.response) {
            console.error('Response data:', JSON.stringify(error.response.data, null, 2));
            console.error('Response status:', error.response.status);
            console.error('Response headers:', JSON.stringify(error.response.headers, null, 2));
          } else if (error?.request) {
            console.error('No response received:', error.request);
          }
          break;
        }

        // Backoff before retry
        await new Promise((r) => setTimeout(r, attempt * 2000));
      }
    }

    throw new Error(`Login failed for user ${username}.`);
  }

  /**
   * Login via Google OAuth using a browser.
   * Used when STUDIO_BASE_URL points to stage-platform.wavemaker.ai.
   * Opens a visible browser for manual 2FA; caches session for future runs.
   */
  async loginWithGoogle(): Promise<string> {
    console.log('[StudioClient] Performing Google OAuth login...');
    const result = await googleBrowserLogin();
    this.updateAuthCookie(result.cookieHeader);
    process.env.STUDIO_COOKIE = result.cookieHeader;
    return result.cookieHeader;
  }

  /**
   * Login via Platform DB REST API (no browser required).
   * Used for wavemaker.ai domains (stage-platform, platform).
   * Sends credentials with X-WM-AUTH-PROVIDER: Platform DB header.
   */
  async loginWithPlatformDB(username: string, password: string): Promise<string> {
    const baseUrl =
      (this.http.defaults.baseURL as string)?.replace(/\/$/, '') ||
      (ENV.studioBaseUrl || '').replace(/\/$/, '');

    console.log(`[StudioClient] Performing Platform DB login at ${baseUrl}...`);

    const loginPayload = qs.stringify({
      j_username: username,
      j_password: password,
      regButton: 'Login',
    });

    let lastError: any;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const loginRes = await this.http.post(ENV.studioLoginPath, loginPayload, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-WM-AUTH-PROVIDER': 'Platform DB',
          },
          maxRedirects: 0,
          validateStatus: (status) => status === 302,
          timeout: 60000,
        });

        const setCookies = loginRes.headers['set-cookie'] || [];
        let authCookieLine = setCookies.find((c: string) => c.startsWith('auth_cookie='));
        let jsessionLine = setCookies.find((c: string) => c.startsWith('JSESSIONID='));

        if (!authCookieLine && !jsessionLine) {
          console.error('[PlatformDB] No auth cookies in response. set-cookie:', setCookies);
          throw new Error('Platform DB login: no auth_cookie/JSESSIONID in response.');
        }

        const parts: string[] = [];
        if (authCookieLine) parts.push(authCookieLine.split(';')[0]);
        if (jsessionLine) parts.push(jsessionLine.split(';')[0]);
        const combinedCookie = parts.join('; ');

        console.log(`[StudioClient] Platform DB login successful (attempt ${attempt})`);
        this.updateAuthCookie(combinedCookie);
        return combinedCookie;
      } catch (error: any) {
        lastError = error;
        const transient = error?.code === 'ECONNABORTED' || !error?.response;
        console.warn(`[PlatformDB Login] Attempt ${attempt} failed${transient ? ' (transient)' : ''}:`, error?.message || error);

        if (!transient || attempt === 3) break;
        await new Promise((r) => setTimeout(r, attempt * 2000));
      }
    }

    throw new Error(`Platform DB login failed for user ${username}: ${lastError?.message || lastError}`);
  }

  /** Trigger in-place deploy; returns preview URL if provided by server */
  async inplaceDeploy(): Promise<string | undefined> {
    const path = ENV.studioDeployPath.replace('${PROJECT_ID}', this.projectId);
    try {
      const res = await this.http.post(path, {}, {
        headers: { 'Accept': 'application/json' },
      });

      if (res.status !== 200 || typeof res.data !== 'object' || !res.data.result) {
        console.warn(`Failed to retrieve webPreviewUrl. Status: ${res.status}`);
        return undefined;
      }

      const resultUrl = res.data.result;
      const previewUrl = resultUrl.startsWith('http') ? resultUrl : `https:${resultUrl}`;
      return previewUrl;

    } catch (error: any) {
      console.error(`In-place deploy request failed: ${error.message}`);
      if (error.response) {
        console.error(`Response status: ${error.response.status}`);
        console.error('Server response:', JSON.stringify(error.response.data, null, 2));
      }
      return undefined;
    }
  }
}
