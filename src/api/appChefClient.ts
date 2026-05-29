import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import FormData from 'form-data';

const APPCHEF_BASE = 'https://www.wavemakeronline.com/AppChef/services/chef';
const WMO_LOGIN_URL = 'https://www.wavemakeronline.com/login/authenticate';
const POLL_INTERVAL_MS = 15_000;
const BUILD_TIMEOUT_MS = 45 * 60 * 1000;
const DEFAULT_IOS_CERT_ID = 1255;
const DEFAULT_IOS_CERT_PASSWORD = 'wavemaker123';

export interface AppChefBuildResult {
  apkUrl?: string;
  ipaUrl?: string;
  buildTaskIdAndroid?: string;
  buildTaskIdIos?: string;
}

/**
 * Automates AppChef builds from a React Native ZIP.
 *
 * Flow:
 *  1. Login to WMO → get auth_cookie + SESSION
 *  2. analyzeZip  → validate ZIP is REACT_NATIVE
 *  3. uploadFile  → upload ZIP, get file ID
 *  4. appsByName  → find existing app or null
 *  5. saveApp     → create / update app record, triggers initial build task
 *  6. buildTasks  → poll until build status = 2 (COMPLETED) or 4 (FAILED)
 *  7. downloadOutput → return signed download URLs for APK / IPA
 */
export class AppChefClient {
  private http: AxiosInstance;
  private cookies: string = '';

  constructor() {
    this.http = axios.create({
      baseURL: APPCHEF_BASE,
      timeout: 60_000,
      maxRedirects: 5,
    });
  }

  /**
   * Retry a function once on failure with a delay between attempts.
   */
  private async withRetry<T>(label: string, fn: () => Promise<T>, maxAttempts = 2, delayMs = 5000): Promise<T> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err: any) {
        const status = err?.response?.status;
        const code = err?.code;
        if (attempt < maxAttempts) {
          console.warn(`[AppChef] ${label} failed (attempt ${attempt}/${maxAttempts}, status=${status ?? code ?? err?.message}), retrying in ${delayMs}ms...`);
          await new Promise(r => setTimeout(r, delayMs));
        } else {
          throw err;
        }
      }
    }
    throw new Error(`[AppChef] ${label} failed after ${maxAttempts} attempts`);
  }

  // ── Auth ─────────────────────────────────────────────────────────────────

  async login(username: string, password: string): Promise<void> {
    return this.withRetry('login', () => this._doLogin(username, password));
  }

  private async _doLogin(username: string, password: string): Promise<void> {
    console.log('[AppChef] Step 1/3: Logging in to WMO...');

    // ─── Step 1: WMO global login → auth_cookie ──────────────────────────────
    const wmoPayload = new URLSearchParams({ j_username: username, j_password: password });
    const wmoResp = await axios.post(WMO_LOGIN_URL, wmoPayload.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
      maxRedirects: 0,
      validateStatus: (s) => s < 400,
      timeout: 15_000,
    });
    const wmoCookies: string[] = (wmoResp.headers['set-cookie'] as string[] | undefined) || [];
    if (!wmoCookies.length) {
      throw new Error('[AppChef] WMO login failed — no cookies returned. Check credentials.');
    }
    const authCookieEntry = wmoCookies.find((c) => c.startsWith('auth_cookie='));
    if (!authCookieEntry) {
      throw new Error('[AppChef] WMO login did not return auth_cookie');
    }
    const authCookie = authCookieEntry.split(';')[0];

    // ─── Step 2: Get accountId from /login/rest/profile ──────────────────────
    console.log('[AppChef] Step 2/3: Fetching profile for accountId...');
    const profileResp = await axios.get('https://www.wavemakeronline.com/login/rest/profile', {
      headers: { Cookie: authCookie, 'X-Requested-With': 'XMLHttpRequest' },
      validateStatus: () => true,
      timeout: 15_000,
    });
    const accountId: string | undefined = profileResp.data?.accountId;
    if (!accountId) {
      throw new Error(`[AppChef] Could not fetch accountId from profile (status ${profileResp.status})`);
    }
    console.log(`[AppChef]   accountId=${accountId}`);

    // ─── Step 3: AppChef Spring Security login → SESSION cookie ──────────────
    // AppChef expects:  j_username = "wm:<email>"   j_password = "<accountId>"
    console.log('[AppChef] Step 3/3: AppChef j_spring_security_check...');
    const appChefPayload = new URLSearchParams({
      j_username: `wm:${username}`,
      j_password: accountId,
      j_rememberme: 'false',
    });
    const appChefResp = await axios.post(
      'https://www.wavemakeronline.com/AppChef/j_spring_security_check',
      appChefPayload.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest',
          Referer: 'https://www.wavemakeronline.com/AppChef/',
          Cookie: authCookie,
        },
        maxRedirects: 0,
        validateStatus: () => true,
        timeout: 15_000,
      },
    );
    const appChefCookies: string[] = (appChefResp.headers['set-cookie'] as string[] | undefined) || [];
    const sessionEntry = appChefCookies.find((c) => c.startsWith('SESSION='));
    if (!sessionEntry) {
      throw new Error(
        `[AppChef] j_spring_security_check did not return SESSION cookie ` +
        `(status ${appChefResp.status}, body ${JSON.stringify(appChefResp.data).slice(0, 200)})`
      );
    }
    const sessionCookie = sessionEntry.split(';')[0];

    this.cookies = `${sessionCookie}; ${authCookie}`;
    console.log(`[AppChef] ✅ Login successful (SESSION + auth_cookie acquired)`);
  }

  private authHeaders() {
    return {
      Cookie: this.cookies,
      'X-Requested-With': 'XMLHttpRequest',
      Referer: 'https://www.wavemakeronline.com/AppChef/',
    };
  }

  // ── Step 1: analyzeZip ───────────────────────────────────────────────────

  async analyzeZip(zipPath: string): Promise<{ bundleId: string; displayName: string; iconFileId: number; iconFile: any }> {
    return this.withRetry('analyzeZip', async () => {
      console.log('[AppChef] Analyzing ZIP...');
      const form = new FormData();
      form.append('file', fs.createReadStream(zipPath), path.basename(zipPath));
      form.append('type', 'REACT_NATIVE');

      const resp = await this.http.post('/analyzeZip', form, {
        headers: { ...this.authHeaders(), ...form.getHeaders() },
      });
      if (!resp.data || resp.data.error) {
        throw new Error(`[AppChef] analyzeZip failed: ${JSON.stringify(resp.data)}`);
      }

      const bundleId    = resp.data.name as string;
      const displayName = resp.data.displayName as string;
      const iconFile    = resp.data.file;
      const iconFileId  = iconFile?.id as number;

      if (!bundleId) throw new Error('[AppChef] analyzeZip: missing name (bundle ID) in response');
      if (!iconFileId) throw new Error('[AppChef] analyzeZip: missing icon file ID in response');
      console.log(`[AppChef] ZIP analysis OK — bundle=${bundleId} displayName=${displayName} iconId=${iconFileId}`);
      return { bundleId, displayName, iconFileId, iconFile };
    });
  }

  // ── Step 2: uploadFile ────────────────────────────────────────────────────

  async uploadFile(zipPath: string): Promise<number> {
    return this.withRetry('uploadFile', async () => {
      console.log('[AppChef] Uploading ZIP file...');
      const form = new FormData();
      form.append('name', '');
      form.append('path', 'apps/cordova');
      form.append('isPublic', 'false');
      form.append('file', fs.createReadStream(zipPath), path.basename(zipPath));

      const resp = await this.http.post('/uploadFile', form, {
        headers: { ...this.authHeaders(), ...form.getHeaders() },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });

      const fileId: number | undefined = resp.data?.id ?? resp.data?.fileId;
      if (!fileId) {
        throw new Error(`[AppChef] uploadFile returned no file ID: ${JSON.stringify(resp.data)}`);
      }
      console.log(`[AppChef] File uploaded — ID=${fileId}`);
      return fileId;
    });
  }

  // ── Step 3: find existing app ─────────────────────────────────────────────

  async findAppByName(bundleId: string): Promise<{ appId: string; id: number } | null> {
    const resp = await this.http.get('/appsByName', {
      params: { name: bundleId, page: 1, size: 20 },
      headers: this.authHeaders(),
    });
    const items: any[] = resp.data?.content || resp.data || [];
    const match = items.find((a: any) => a.name === bundleId);
    if (match) {
      console.log(`[AppChef] Found existing app — appId=${match.appId}, id=${match.id}`);
      return { appId: match.appId, id: match.id };
    }
    return null;
  }

  // ── iOS Certificate Management ──────────────────────────────────────────────

  /**
   * List all iOS certificates for the current user.
   * Returns array of certificate objects with id, name, locked status, etc.
   */
  async listIosCertificates(): Promise<any[]> {
    const resp = await this.http.get('/iosCertificates', {
      params: { page: 1, size: 100 },
      headers: this.authHeaders(),
    });
    return resp.data?.content || (Array.isArray(resp.data) ? resp.data : []);
  }

  /**
   * Get a specific iOS certificate by ID.
   */
  async getIosCertificate(certId: number): Promise<any> {
    const resp = await this.http.get('/iosCertificate', {
      params: { id: certId },
      headers: this.authHeaders(),
    });
    return resp.data;
  }

  /**
   * Unlock an iOS certificate (needed before using it for a build if it's locked).
   * Uses saveIosCertificate endpoint with the unlock password.
   */
  async unlockIosCertificate(certId: number, unlockPassword: string): Promise<void> {
    const cert = await this.getIosCertificate(certId);
    if (!cert) throw new Error(`[AppChef] iOS certificate id=${certId} not found`);

    if (cert.locked) {
      console.log(`[AppChef] Unlocking iOS certificate id=${certId} (${cert.name})...`);
      const body = {
        ...cert,
        unlockPassword,
        locked: false,
        lockAfter: Date.now() + 24 * 60 * 60 * 1000, // 24h from now
      };
      await this.http.post('/saveIosCertificate', body, {
        headers: { ...this.authHeaders(), 'Content-Type': 'application/json' },
      });
      console.log(`[AppChef] ✅ Certificate unlocked`);
    } else {
      console.log(`[AppChef] iOS certificate id=${certId} already unlocked`);
    }
  }

  /**
   * Find the first available iOS certificate and unlock it.
   * Returns the certificate ID to pass to saveApp.
   */
  async resolveIosCertificate(opts?: { certId?: number; unlockPassword?: string }): Promise<number | null> {
    const password = opts?.unlockPassword || process.env.APPCHEF_IOS_CERT_PASSWORD || 'wavemaker123';

    if (opts?.certId) {
      await this.unlockIosCertificate(opts.certId, password);
      return opts.certId;
    }

    // Auto-discover: find the first certificate
    const certs = await this.listIosCertificates();
    if (certs.length === 0) {
      console.warn('[AppChef] ⚠️  No iOS certificates found — iOS builds will fail');
      return null;
    }

    const cert = certs[0];
    console.log(`[AppChef] Found iOS certificate: id=${cert.id} name="${cert.name}"`);
    await this.unlockIosCertificate(cert.id, password);
    return cert.id;
  }

  // ── Step 4: saveApp ───────────────────────────────────────────────────────

  async saveApp(opts: {
    cordovaZipFileId: number;
    iconFileId: number;
    iconFile?: any;
    bundleId: string;
    displayName: string;
    version: string;
    existingId?: number | null;
    existingAppId?: string | null;
    platform: 'android' | 'ios' | 'both';
    androidCertId?: number;
    iosCertId?: number;
  }): Promise<string> {
    console.log('[AppChef] Saving app record...');

    // Match the exact payload structure the AppChef UI sends:
    // - icon/file = icon from analyzeZip response
    // - cordovaZip = uploaded ZIP file ID
    // - platform = null (AppChef derives from cert config)
    const body: any = {
      id: opts.existingId ?? null,
      name: opts.bundleId,
      description: '',
      icon: opts.iconFileId,
      owner: null,
      appId: opts.existingAppId ?? null,
      displayName: opts.displayName,
      defaultBuildConfig: null,
      type: 'REACT_NATIVE',
      file: opts.iconFile || { id: opts.iconFileId },
      buildTaskByDefaultBuildConfig: {
        id: null,
        platform: null,
        lastUpdatedOn: Date.now(),
        appId: null,
        cordovaIosVersion: null,
        cordovaAndroidVersion: null,
        iosOutput: null,
        androidOutput: null,
        externalId: null,
        log: null,
        status: 3,
        cordovaVersion: null,
        cordovaZip: opts.cordovaZipFileId,
        buildType: 1,
        iosCertificateId: opts.iosCertId ?? null,
        androidCertificateId: opts.androidCertId ?? -1,
        androidCertificateName: opts.androidCertId ? undefined : '__DEBUG',
        version: opts.version,
        token: null,
        queuedOn: null,
        buildStartedOn: null,
        buildEndedOn: null,
        androidPackageType: 'apk',
        retryCount: 0,
        buildTaskStatus: null,
        fileByAndroidOutput: null,
        fileByCordovaZip: null,
        fileByIosOutput: null,
        fileByLog: null,
        buildTypeByBuildType: null,
        appByAppId: null,
      },
    };

    return this.withRetry('saveApp', async () => {
      let resp;
      try {
        resp = await this.http.post('/saveApp', body, {
          headers: { ...this.authHeaders(), 'Content-Type': 'application/json' },
        });
      } catch (err: any) {
        const errBody = err?.response?.data;
        console.error(`[AppChef] saveApp failed (${err?.response?.status}):`, JSON.stringify(errBody, null, 2));
        throw err;
      }

      const appId: string = resp.data?.appId ?? resp.data?.id;
      if (!appId) {
        throw new Error(`[AppChef] saveApp returned no appId: ${JSON.stringify(resp.data)}`);
      }
      console.log(`[AppChef] App saved — appId=${appId}`);
      return String(appId);
    });
  }

  // ── Step 5: poll buildTasks ───────────────────────────────────────────────

  /**
   * Poll buildTasks until buildTaskStatus.name === "SUCCESS" or "FAILURE".
   *
   * Actual AppChef response shape (confirmed):
   *   task.buildTaskStatus = { id: 3, name: "SUCCESS" }  ← success
   *   task.buildTaskStatus = { id: 4, name: "FAILURE" }  ← failed
   *   task.buildTaskStatus = { id: 1, name: "QUEUED" }
   *   task.buildTaskStatus = { id: 2, name: "IN_PROGRESS" }
   *
   * On success the APK/IPA direct S3 URL is at:
   *   task.fileByAndroidOutput.url  (Android)
   *   task.fileByIosOutput.url      (iOS)
   *
   * The externalId (e.g. "build-RoimmQuyJd") is used for the downloadOutput endpoint.
   */
  async pollBuildTasks(appId: string, platform: 'android' | 'ios' | 'both'): Promise<{
    android?: { buildTaskId: string; directUrl: string; downloadUrl: string };
    ios?: { buildTaskId: string; directUrl: string; downloadUrl: string };
  }> {
    // Note on field meanings (confirmed from live API response):
    //   task.externalId  = "build-RoimmQuyJd"              → used as buildTaskId in downloadOutput URL
    //   task.token       = "build-RoimmQuyJd-INlsQxiUkp"   → stored for reference / retries
    //   task.fileByAndroidOutput.url = pre-signed S3 URL   → preferred for direct APK download
    console.log(`[AppChef] Polling buildTasks for appId=${appId} every ${POLL_INTERVAL_MS / 1000}s (timeout ${BUILD_TIMEOUT_MS / 60000}m)...`);
    const started = Date.now();

    while (Date.now() - started < BUILD_TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

      const resp = await this.http.get('/buildTasks', {
        params: { appId, platform: 'all', page: 1, size: 100 },
        headers: this.authHeaders(),
      });

      // API returns a plain array (not paginated in practice)
      const tasks: any[] = Array.isArray(resp.data)
        ? resp.data
        : (resp.data?.content ?? []);

      const latest = this.latestTasksByPlatform(tasks);
      const elapsedMin = Math.round((Date.now() - started) / 60000);

      const aStatus = this.buildStatusName(latest.android);
      const iStatus = this.buildStatusName(latest.ios);
      console.log(`[AppChef] ${elapsedMin}m — Android: ${aStatus} | iOS: ${iStatus}`);

      if (aStatus === 'FAILURE') throw new Error(`[AppChef] Android build FAILED — taskId=${this.taskId(latest.android)}`);
      if (iStatus === 'FAILURE') throw new Error(`[AppChef] iOS build FAILED — taskId=${this.taskId(latest.ios)}`);

      const needAndroid = platform !== 'ios';
      const needIos    = platform !== 'android';
      const androidDone = !needAndroid || aStatus === 'SUCCESS';
      const iosDone     = !needIos    || iStatus === 'SUCCESS';

      if (androidDone && iosDone) {
        const result: any = {};
        if (needAndroid && latest.android) {
          // buildTaskId = externalId (e.g. "build-RoimmQuyJd") — used in downloadOutput URL
          // token       = externalId + suffix  (e.g. "build-RoimmQuyJd-INlsQxiUkp") — stored for reference
          // directUrl   = fileByAndroidOutput.url (pre-signed S3 URL, preferred for download)
          const id = this.taskId(latest.android);
          result.android = {
            buildTaskId: id,
            token:       latest.android.token ?? '',
            directUrl:   latest.android.fileByAndroidOutput?.url ?? '',
            downloadUrl: this.downloadUrl(id, 'android'),
          };
          console.log(`[AppChef] ✅ Android — taskId: ${id} | APK: ${result.android.directUrl || result.android.downloadUrl}`);
        }
        if (needIos && latest.ios) {
          const id = this.taskId(latest.ios);
          result.ios = {
            buildTaskId: id,
            token:       latest.ios.token ?? '',
            directUrl:   latest.ios.fileByIosOutput?.url ?? '',
            downloadUrl: this.downloadUrl(id, 'ios'),
          };
          console.log(`[AppChef] ✅ iOS — taskId: ${id} | IPA: ${result.ios.directUrl || result.ios.downloadUrl}`);
        }
        return result;
      }
    }
    throw new Error(`[AppChef] Build timed out after ${BUILD_TIMEOUT_MS / 60000} minutes`);
  }

  /** Returns buildTaskStatus.name (SUCCESS / FAILURE / IN_PROGRESS / QUEUED) or PENDING if no task yet. */
  private buildStatusName(task: any): string {
    return task?.buildTaskStatus?.name ?? 'PENDING';
  }

  /** externalId ("build-RoimmQuyJd") is used in downloadOutput; fall back to numeric id. */
  private taskId(task: any): string {
    return task?.externalId ?? String(task?.id ?? '');
  }

  private latestTasksByPlatform(tasks: any[]): { android?: any; ios?: any } {
    const byPlatform: { android?: any; ios?: any } = {};
    for (const t of tasks) {
      // platform is a string: "android" or "ios"
      const raw = String(t.platform ?? '').toLowerCase();
      const key: 'android' | 'ios' | null =
        raw.includes('android') ? 'android' : raw.includes('ios') ? 'ios' : null;
      if (!key) continue;

      const ts: number = t.lastUpdatedOn ?? t.queuedOn ?? 0;
      const cur: number = byPlatform[key]?.lastUpdatedOn ?? byPlatform[key]?.queuedOn ?? 0;
      if (!byPlatform[key] || ts > cur) byPlatform[key] = t;
    }
    return byPlatform;
  }

  // ── Step 6: download ──────────────────────────────────────────────────────

  downloadUrl(buildTaskId: string, platform: 'android' | 'ios'): string {
    return `${APPCHEF_BASE}/downloadOutput?buildTaskId=${buildTaskId}&platform=${platform}&download=true`;
  }

  async downloadBuild(buildTaskId: string, platform: 'android' | 'ios', destPath: string, _directUrl?: string): Promise<string> {
    return this.withRetry(`downloadBuild(${platform})`, async () => {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });

      // Always use the authenticated downloadOutput endpoint — the S3 direct URLs
      // are pre-signed and expire quickly (403 after expiry). downloadOutput streams
      // the file via the AppChef backend using the SESSION cookie.
      const url = this.downloadUrl(buildTaskId, platform);
      console.log(`[AppChef] Downloading ${platform} via downloadOutput → ${destPath}`);

      const resp = await axios.get(url, {
        headers: this.authHeaders(),
        responseType: 'stream',
        maxRedirects: 5,
      });

      await new Promise<void>((resolve, reject) => {
        const writer = fs.createWriteStream(destPath);
        resp.data.pipe(writer);
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      console.log(`[AppChef] ✅ Downloaded ${platform} → ${destPath}`);
      return destPath;
    });
  }

  // ── Full build flow ────────────────────────────────────────────────────────

  async buildFromZip(opts: {
    zipPath: string;
    /** Optional overrides — if omitted, values are read from analyzeZip response */
    bundleId?: string;
    displayName?: string;
    version?: string;
    platform: 'android' | 'ios' | 'both';
    destDir: string;
    androidCertId?: number;
    iosCertId?: number;
    username: string;
    password: string;
  }): Promise<{ apkPath?: string; ipaPath?: string }> {
    const version = opts.version ?? '0.0.1';

    await this.login(opts.username, opts.password);

    // analyzeZip returns bundleId + displayName + icon file from the ZIP itself
    const analyzed = await this.analyzeZip(opts.zipPath);
    const bundleId    = opts.bundleId    || analyzed.bundleId;
    const displayName = opts.displayName || analyzed.displayName;

    // Upload the ZIP — this becomes the cordovaZip file ID
    const cordovaZipFileId = await this.uploadFile(opts.zipPath);

    // For iOS builds, resolve and unlock the certificate
    let iosCertId = opts.iosCertId;
    if (opts.platform !== 'android' && !iosCertId) {
      const certId = Number(process.env.APPCHEF_IOS_CERT_ID) || DEFAULT_IOS_CERT_ID;
      const certPass = process.env.APPCHEF_IOS_CERT_PASSWORD || DEFAULT_IOS_CERT_PASSWORD;
      await this.unlockIosCertificate(certId, certPass);
      iosCertId = certId;
    }

    // Always create a fresh app record (id:null, appId:null) — this matches the
    // proven AppChef UI flow. Reusing an existing app record (id set) causes the
    // server to return 500 on /saveApp.
    const appId = await this.saveApp({
      cordovaZipFileId,
      iconFileId: analyzed.iconFileId,
      iconFile: analyzed.iconFile,
      bundleId,
      displayName,
      version,
      existingId: null,
      existingAppId: null,
      platform: opts.platform,
      androidCertId: opts.androidCertId,
      iosCertId,
    });

    const builds = await this.pollBuildTasks(appId, opts.platform);

    const result: { apkPath?: string; ipaPath?: string } = {};

    if (builds.android) {
      const apkPath = path.join(opts.destDir, 'app-debug.apk');
      await this.downloadBuild(builds.android.buildTaskId, 'android', apkPath, builds.android.directUrl);
      result.apkPath = apkPath;
    }
    if (builds.ios) {
      const ipaPath = path.join(opts.destDir, 'app-debug.ipa');
      await this.downloadBuild(builds.ios.buildTaskId, 'ios', ipaPath, builds.ios.directUrl);
      result.ipaPath = ipaPath;
    }

    return result;
  }
}
