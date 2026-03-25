import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { ENV } from '../utils/env';
import { googleBrowserLogin } from '../auth/googleAuth';

export interface RnProjectConfig {
  projectId: string;
  studioProjectId?: string;
  username: string;
  password: string;
  baseUrl: string;
  fileServiceUrl: string;
}

export class RnProjectManager {
  private config: RnProjectConfig;
  private authCookie?: string;

  constructor(config: RnProjectConfig) {
    this.config = config;
  }

  private get studioId(): string {
    return this.config.studioProjectId || this.config.projectId;
  }

  /**
   * Login to WaveMaker Studio and capture auth_cookie.
   * Automatically uses Google OAuth for stage-platform.wavemaker.ai.
   */
  async login(): Promise<string> {
    if (ENV.isGoogleAuth) {
      return this.loginWithGoogle();
    }
    return this.loginWithForm();
  }

  private async loginWithGoogle(): Promise<string> {
    console.log('[RN] Performing Google OAuth login via headless browser...');
    const result = await googleBrowserLogin({ headless: true });
    this.authCookie = result.cookieHeader;
    console.log('[RN] ✅ Google login successful');
    return this.authCookie;
  }

  private async loginWithForm(): Promise<string> {
    const baseUrl = this.config.baseUrl.replace(/\/$/, '');
    const loginUrl = `${baseUrl}/login/authenticate`;
    const loginPayload = new URLSearchParams({
      j_username: this.config.username,
      j_password: this.config.password
    });

    console.log(`[RN] Logging in to ${baseUrl}...`);

    try {
      const response = await axios.post(loginUrl, loginPayload.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        maxRedirects: 0,
        validateStatus: (status) => status === 302
      });

      const cookieLine = response.headers['set-cookie']?.find(
        (c: string) => c.startsWith('auth_cookie=')
      );

      if (!cookieLine) {
        throw new Error('auth_cookie not found in login response');
      }

      this.authCookie = cookieLine.split(';')[0];
      console.log('[RN] ✅ Login successful');
      return this.authCookie;
    } catch (error: any) {
      console.error('[RN] ❌ Login failed:', error?.message || error);
      throw error;
    }
  }

  /**
   * Export project to generate RN ZIP and get a direct download URL.
   * Mirrors mvn-expo.ts export flow with robust header set and simple parsing.
   */
  async exportProject(): Promise<string> {
    if (!this.authCookie) {
      await this.login();
    }

    const baseUrl = this.config.baseUrl.replace(/\/$/, '');
    const exportUrl = `${baseUrl}/studio/services/projects/${this.studioId}/export`;
    const cookieValue = this.authCookie!.split('=')[1];

    console.log(`[RN] Exporting project ${this.config.projectId} to ZIP...`);

    const data = {
      exportType: 'ZIP',
      targetName: this.config.projectId,
      excludeGeneratedUIApp: true
    };

    try {
      const response = await axios.post(exportUrl, data, {
        headers: {
          accept: 'application/json, text/plain, */*',
          'accept-language': 'en-US,en;q=0.9',
          'content-type': 'application/json',
          origin: baseUrl,
          priority: 'u=1, i',
          referer: `${baseUrl}/s/page/Main?project-id=${this.studioId}`,
          'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
          'sec-ch-ua-mobile': '?1',
          'sec-ch-ua-platform': '"Android"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin',
          'user-agent':
            'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
          'x-requested-with': 'XMLHttpRequest',
          Cookie: `auth_cookie=${cookieValue}`
        }
      });

      let downloadPath: string;

      if (typeof response.data === 'string') {
        downloadPath = response.data.trim().replace(/"/g, '');
      } else if (response.data && response.data.result) {
        downloadPath = response.data.result;
      } else {
        throw new Error('Unexpected response format from export API');
      }

      const downloadUrl = this.resolveDownloadUrl(downloadPath);

      console.log('[RN] ✅ Export successful. Download URL:', downloadUrl);
      return downloadUrl;
    } catch (error: any) {
      console.error('[RN] ❌ Export failed:', error?.message || error);
      throw error;
    }
  }

  /**
   * Trigger native-mobile build and poll jobs to get the RN ZIP endpoint.
   * Uses jobs outputObject.value (e.g. /file-service/{id}) as the download path.
   */
  async buildNativeMobileApp(profileName: string = 'development'): Promise<string> {
    if (!this.authCookie) {
      await this.login();
    }

    const baseUrl = this.config.baseUrl.replace(/\/$/, '');
    const cookieValue = this.authCookie!.split('=')[1];
    const buildUrl = `${baseUrl}/studio/services/projects/${this.config.projectId}/native-mobile/build/NATIVE_MOBILE?profileName=${profileName}`;
    console.log(`[RN] Building native mobile app (profile: ${profileName})...`);

    // Kick off build with retry logic for 500 errors
    let resp;
    let lastError: any;
    const maxRetries = 3;
    const retryDelayMs = 2000; // Wait 2 seconds between retries

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        resp = await axios.post(buildUrl, null, {
          headers: {
            accept: 'application/json, text/plain, */*',
            'content-length': '0',
            origin: baseUrl,
            referer: `${baseUrl}/s/page/Main?project-id=${this.config.projectId}`,
            Cookie: `auth_cookie=${cookieValue}`,
            'x-requested-with': 'XMLHttpRequest'
          },
          validateStatus: (status) => status < 500 || status >= 600  // Don't throw on 500, but do on other errors
        });

        if (resp.status === 500) {
          lastError = new Error(`Server error (500). Attempt ${attempt}/${maxRetries}`);
          console.log(`[RN] ⚠️ ${lastError.message}. Retrying in ${retryDelayMs}ms...`);
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, retryDelayMs));
            continue;
          }
          throw lastError;
        }
        break; // Success
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          console.log(`[RN] ⚠️ Build request failed: ${(error as any).message}. Retrying in ${retryDelayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        }
      }
    }

    if (!resp) {
      throw lastError || new Error('Failed to initiate build after retries');
    }

    const buildId: string | undefined = resp.data?.buildId || resp.data?.result;
    if (!buildId) {
      throw new Error('Build ID not found in response');
    }

    // Poll job list for the build's RN ZIP output
    const statusUrl = `${baseUrl}/studio/services/jobs/project/${this.studioId}`;
    const timeoutMs = 5 * 60 * 1000; // 5 min
    const pollMs = 5000; // 5s
    const start = Date.now();

    console.log(`[RN] ⏳ Build initiated: ${buildId}. Polling job status for RN ZIP...`);
    while (Date.now() - start < timeoutMs) {
      const statusResp = await axios.get(statusUrl, {
        headers: {
          Cookie: `auth_cookie=${cookieValue}`,
          'x-requested-with': 'XMLHttpRequest'
        }
      });

      if (Array.isArray(statusResp.data)) {
        // Step 1: Try to find the specific job for THIS buildId
        let job = statusResp.data.find((j: any) => j.id === buildId);

        // --- DEBUG LOGGING ---
        // Save the latest job status for this specific build to a file for transparency
        if (job) {
          try {
            const debugDir = path.join(process.cwd(), '.test-cache');
            if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
            const debugPath = path.join(debugDir, 'last-build-status.json');
            fs.writeFileSync(debugPath, JSON.stringify(job, null, 2), 'utf-8');
          } catch (e) {
            // Silently ignore debug logging errors to not block the build
          }
        }

        // Step 2: If found, check if it's completed and successful
        if (job) {
          if (job.completed === true) {
            if (job.failure === true) {
              console.error(`[RN] ❌ Build ${buildId} failed. Full job details logged to .test-cache/last-build-status.json`);
              console.error(`[RN] ❌ Failure summary:`, JSON.stringify(job, null, 2));
              throw new Error(`Build ${buildId} failed: ${job.error || 'Unknown error'}`);
            }
            if (job.outputObject?.value) {
              const downloadUrl = this.resolveDownloadUrl(job.outputObject.value);
              console.log(`[RN] ✅ Specific build ${buildId.substring(0, 8)} completed. RN ZIP ready at:`, downloadUrl);
              return downloadUrl;
            }
          }
          // Job found but not completed yet, continue polling
        }
        // Step 3: Fallback logic ONLY if specific job is missing from list AND we need a recent output
        else {
          console.log(`[RN] ⚠️  Specific build ${buildId.substring(0, 8)} not found in job list, looking for latest alternative...`);
          job = statusResp.data
            .filter(
              (j: any) =>
                j.type === 'NATIVE_MOBILE_ZIP' &&
                j.completed === true &&
                j.failure === false &&
                j.outputObject?.value
            )
            .sort((a: any, b: any) => (b.endTime || 0) - (a.endTime || 0))[0];

          if (job && job.outputObject?.value) {
            const downloadUrl = this.resolveDownloadUrl(job.outputObject.value);
            console.log('[RN] ⚠️ Falling back to latest successful RN ZIP:', downloadUrl);
            return downloadUrl;
          }
        }
      }

      await new Promise((r) => setTimeout(r, pollMs));
    }

    throw new Error('Timed out waiting for native mobile ZIP');
  }

  /**
   * Download RN project ZIP to outputDir and return the zip path.
   */
  async downloadProject(downloadUrl: string, outputDir: string): Promise<string> {
    if (!this.authCookie) {
      throw new Error('Not authenticated. Please login first.');
    }

    const cookieValue = this.authCookie.split('=')[1];
    const zipPath = path.join(outputDir, `${this.config.projectId}.zip`);

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`[RN] Downloading project ZIP to ${zipPath}...`);

    try {
      const response = await axios.get(downloadUrl, {
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          Cookie: `auth_cookie=${cookieValue}`,
          Referer: `${this.config.baseUrl.replace(/\/$/, '')}/s/page/Main?project-id=${this.studioId}`
        },
        responseType: 'stream'
      });

      const writer = fs.createWriteStream(zipPath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          const fileSize = fs.statSync(zipPath).size;
          console.log(`[RN] ✅ Download complete (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
          resolve(zipPath);
        });
        writer.on('error', reject);
      });
    } catch (error: any) {
      console.error('[RN] ❌ Download failed:', error?.message || error);
      throw error;
    }
  }

  /**
   * Aggressively remove a directory with retries and shell fallback.
   */
  private safeRemoveDir(dir: string): void {
    if (!fs.existsSync(dir)) return;

    const attempts = 3;
    for (let i = 0; i < attempts; i++) {
      try {
        // Try Node's rmSync with retries
        // @ts-ignore - maxRetries and retryDelay are supported in Node.js
        fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      } catch { }

      if (!fs.existsSync(dir)) return;

      // Fallback to shell rm -rf
      try {
        execSync(`rm -rf "${dir}"`);
      } catch { }

      if (!fs.existsSync(dir)) return;

      // As a last resort, rename then remove
      const trash = `${dir}.__trash_${Date.now()}_${i}`;
      try {
        fs.renameSync(dir, trash);
        execSync(`rm -rf "${trash}"`);
      } catch { }

      if (!fs.existsSync(dir)) return;

      // Short delay before next attempt
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }

    if (fs.existsSync(dir)) {
      throw new Error(`Failed to remove directory: ${dir}`);
    }
  }

  /**
   * Extract ZIP file to extractTo and return the path.
   */
  async extractZip(zipPath: string, extractTo: string): Promise<string> {
    console.log(`[RN] Extracting ${zipPath} -> ${extractTo} ...`);

    // Clean up existing directory with robust remover
    if (fs.existsSync(extractTo)) {
      try {
        this.safeRemoveDir(extractTo);
      } catch (e: any) {
        console.warn(`[RN] ⚠️  Could not fully clean ${extractTo}: ${e?.message || e}. Proceeding with overwrite.`);
      }
    }

    try {
      // -o to overwrite any residual files if present
      execSync(`unzip -q -o "${zipPath}" -d "${extractTo}"`);
      console.log('[RN] ✅ Extraction complete');
      return extractTo;
    } catch (error: any) {
      console.error('[RN] ❌ Extraction failed:', error?.message || error);
      throw error;
    }
  }

  /**
   * Normalize RN project dependencies for public registry installs.
   * - Strips `-next.*` prerelease from @wavemaker/* versions (falls back to stable)
   * - Optionally downgrades to `latest` if stripped semver is invalid
   * - Removes package-lock.json to avoid lock mismatch after rewriting
   */
  private normalizeDependencies(projectPath: string): void {
    const pkgPath = path.join(projectPath, 'package.json');
    if (!fs.existsSync(pkgPath)) return;

    const pkgRaw = fs.readFileSync(pkgPath, 'utf-8');
    let pkg: any;
    try {
      pkg = JSON.parse(pkgRaw);
    } catch {
      console.warn('[RN] ⚠️  Could not parse package.json for normalization');
      return;
    }

    const normalizeMap = (deps: Record<string, string> | undefined) => {
      if (!deps) return 0;
      let changes = 0;
      for (const [name, ver] of Object.entries(deps)) {
        if (!name.startsWith('@wavemaker/')) continue;

        const v = (ver || '').trim();
        // Match optional ^ or ~, capture base x.y.z, and optional prerelease (-next.* / -rc.* / -beta.* / -alpha.*)
        const m = v.match(/^([~^]?)(\d+\.\d+\.\d+)(?:-[0-9A-Za-z.-]+)?$/);
        if (m) {
          const stable = m[2];
          if (v.includes('-')) {
            // Had prerelease, normalize to stable without range to avoid hitting non-existent tags
            deps[name] = stable;
            changes++;
            console.log(`[RN] 🔧 Normalized ${name}@${ver} -> ${deps[name]}`);
            continue;
          }
        }

        // Fallback: if version explicitly contains -next/-rc/-beta/-alpha but pattern didn't match (e.g., ranges), set to latest
        if (/-next\.|-rc\.|-beta\.|-alpha\./.test(v) || /-next$|-rc$|-beta$|-alpha$/.test(v)) {
          deps[name] = 'latest';
          changes++;
          console.log(`[RN] 🔧 Normalized ${name}@${ver} -> ${deps[name]}`);
        }
      }
      return changes;
    };

    const changed = normalizeMap(pkg.dependencies) + normalizeMap(pkg.devDependencies);
    if (changed > 0) {
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
      const lockPath = path.join(projectPath, 'package-lock.json');
      if (fs.existsSync(lockPath)) {
        try {
          fs.rmSync(lockPath, { force: true });
          console.log('[RN] 🧹 Removed existing package-lock.json to regenerate with normalized versions');
        } catch { }
      }
    }
  }

  /**
   * Install npm dependencies in the extracted RN project
   */
  async installDependencies(projectPath: string): Promise<void> {
    console.log(`[RN] Installing dependencies in ${projectPath}...`);

    try {
      // Normalize any private/next dependencies to public stable versions
      this.normalizeDependencies(projectPath);

      // Use legacy peer deps to avoid peer conflicts in upstream templates
      execSync('npm install', {
        cwd: projectPath,
        stdio: 'inherit'
      });
      console.log('[RN] ✅ Dependencies installed');
    } catch (error: any) {
      console.error('[RN] ❌ Dependency installation failed:', error?.message || error);
      throw error;
    }
  }

  /**
   * Complete workflow: login, export, download, extract, install
   */
  async prepareProject(outputBaseDir: string, profileName: string = 'development'): Promise<string> {
    try {
      console.log('\n[RN] 📥 Starting RN project preparation...\n');

      // Ensure logged in
      if (!this.authCookie) {
        await this.login();
      }

      // Get download URL (export-based)
      const downloadUrl = await this.buildNativeMobileApp(profileName);

      // Download ZIP
      const zipPath = await this.downloadProject(downloadUrl, outputBaseDir);

      // Extract ZIP
      const extractPath = path.join(outputBaseDir, 'rn-project');
      await this.extractZip(zipPath, extractPath);

      // Optionally install dependencies (default: skip)
      if (process.env.RN_INSTALL_DEPS === 'true') {
        await this.installDependencies(extractPath);
      } else {
        console.log('[RN] ⏭️  Skipping npm install (RN_INSTALL_DEPS != "true"). Build tools will handle dependencies.');
      }

      console.log(`\n[RN] ✅ Project prepared successfully at: ${extractPath}\n`);
      return extractPath;
    } catch (error) {
      console.error('\n[RN] ❌ Failed to prepare RN project\n');
      throw error;
    }
  }

  /**
   * Normalize any jobs output value or raw id into a full file-service URL.
   * Accepts:
   *  - Full URL: https://host/file-service/<id>
   *  - Absolute path: /file-service/<id>
   *  - Bare id: <id>
   */
  resolveDownloadUrl(value: string): string {
    if (!value) {
      throw new Error('Empty download path');
    }
    const base = this.config.baseUrl.replace(/\/$/, '');
    const fsBase = this.config.fileServiceUrl.replace(/\/$/, '');
    if (value.startsWith('http')) return value;
    if (value.startsWith('/')) return `${base}${value}`;
    return `${fsBase}/${value}`;
  }

  /**
   * Prepare project from a known download path or URL (skips build).
   */
  async prepareFromDownload(downloadPathOrUrl: string, outputBaseDir: string): Promise<string> {
    try {
      console.log('\n[RN] 📥 Preparing RN project from provided download path...\n');

      if (!this.authCookie) {
        await this.login();
      }

      const resolvedUrl = this.resolveDownloadUrl(downloadPathOrUrl);

      const zipPath = await this.downloadProject(resolvedUrl, outputBaseDir);
      const extractPath = path.join(outputBaseDir, 'rn-project');
      await this.extractZip(zipPath, extractPath);

      // Optionally install dependencies (default: skip)
      if (process.env.RN_INSTALL_DEPS === 'true') {
        await this.installDependencies(extractPath);
      } else {
        console.log('[RN] ⏭️  Skipping npm install (RN_INSTALL_DEPS != "true"). Build tools will handle dependencies.');
      }

      console.log(`\n[RN] ✅ Project prepared successfully at: ${extractPath}\n`);
      return extractPath;
    } catch (error) {
      console.error('\n[RN] ❌ Failed to prepare RN project from download path\n');
      throw error;
    }
  }
}
