/**
 * compare-styles.ts
 *
 * Fetches RN style objects for all widgets from two preview sources:
 *   1. Remote: stage-platform (inplaceDeploy, or --remote-url to skip deploy)
 *   2. Local:  localhost RN preview (default http://localhost:19009, or --local-url)
 *
 * Compares the two sets and reports structural and value differences,
 * including __trace array entries (CSS variable bindings).
 *
 * Usage:
 *   npx ts-node scripts/compare-styles.ts
 *   npx ts-node scripts/compare-styles.ts --widget button
 *   npx ts-node scripts/compare-styles.ts --remote-url https://stage-platform.wavemaker.ai/run-xxx/Proj
 *   npx ts-node scripts/compare-styles.ts --local-url http://localhost:19009
 *   npx ts-node scripts/compare-styles.ts --headless
 *   npx ts-node scripts/compare-styles.ts --skip-fetch-remote   (reuse cached remote styles)
 *   npx ts-node scripts/compare-styles.ts --skip-fetch-local    (reuse cached local styles)
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { chromium, Page } from '@playwright/test';
import { ENV } from '../src/utils/env';
import { googleBrowserLogin } from '../src/auth/googleAuth';
import { StudioClient } from '../src/api/studioClient';
import { ensureAuthCookies } from '../src/playwright/helpers';
import { studioWidgetsPropertyAccess } from '../wdio/utils/studioWidgetAccess';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ARTIFACTS_DIR = path.join(process.cwd(), 'artifacts', 'style-comparison');
const TOKEN_SLOTS_PATH = path.join(process.cwd(), 'wdio', 'config', 'widget-token-slots.json');
const CSV_DIR = path.join(process.cwd(), 'tests', 'testdata', 'mobile');
const CACHE_DIR = path.join(process.cwd(), '.test-cache');
const DEFAULT_LOCAL_URL = 'http://localhost:19009';

const WIDGET_PAGE_NAME_MAP: Record<string, string> = {
  formcontrols: 'formC',
  'form-wrapper': 'formC',
  navbar: 'Main',
  tabbar: 'Main',
  picture: 'Picture',
  carousel: 'Carousel',
  'button-group': 'ButtonGroup',
  icon: 'Icon',
  lottie: 'Lottie',
  audio: 'Audio',
  webview: 'Webview',
  message: 'Message',
  spinner: 'Spinner',
  search: 'Search',
  'progress-bar': 'ProgressBar',
  'progress-circle': 'ProgressCircle',
  'dropdown-menu': 'DropdownMenu',
  popover: 'Popover',
  login: 'Login',
  'modal-dialog': 'ModalDialog',
  fileupload: 'FileUpload',
  calendar: 'Calendar',
  slider: 'Slider',
  rating: 'Rating',
  currency: 'Currency',
  select: 'Select',
  'panel-footer': 'panel',
  camera: 'Camera',
  datetime: 'Datetime',
  video: 'Video',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DiffEntry {
  path: string;
  type: 'only_in_remote' | 'only_in_local' | 'changed';
  remoteValue?: any;
  localValue?: any;
}

interface WidgetComparison {
  widget: string;
  remote: { fetched: boolean; url: string; keyCount: number; error?: string };
  local: { fetched: boolean; url: string; keyCount: number; error?: string };
  diffs: DiffEntry[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isLocalUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return false;
  }
}

function resolvePageName(widget: string): string {
  return WIDGET_PAGE_NAME_MAP[widget] || widget;
}

function loadTokenSlots(): Record<string, { tokenSlots: Array<{ tokenType: string; properties: string[] }> }> {
  const raw = fs.readFileSync(TOKEN_SLOTS_PATH, 'utf-8');
  const parsed = JSON.parse(raw);
  delete parsed.$schema;
  delete parsed.description;
  return parsed;
}

function loadFirstStudioWidgetName(widget: string): string | null {
  const csvPath = path.join(CSV_DIR, `${widget}-widget-variants.csv`);
  if (!fs.existsSync(csvPath)) return null;

  const lines = fs.readFileSync(csvPath, 'utf-8').trim().split('\n');
  if (lines.length < 2) return null;

  const firstDataLine = lines[1].trim();
  if (!firstDataLine) return null;

  const parts = firstDataLine.split(',');
  return parts[1]?.trim() || null;
}

function getStyleCommand(widget: string, studioWidgetName: string): string {
  const stylesKey = (widget === 'cards' || widget === 'formcontrols') ? 'calcStyles' : 'styles';

  if (widget === 'cards') {
    return `wm.App.appConfig.currentPage.Widgets.supportedLocaleList1.itemWidgets[0].card1._INSTANCE.${stylesKey}`;
  }
  if (widget === 'formcontrols') {
    return `wm.App.appConfig.currentPage.Widgets.supportedLocaleForm1.formWidgets.entestkey.${stylesKey}`;
  }
  return `wm.App.appConfig.currentPage.Widgets${studioWidgetsPropertyAccess(studioWidgetName)}._INSTANCE.${stylesKey}`;
}

function collectKeys(obj: any, prefix = ''): string[] {
  const keys: string[] = [];
  if (obj == null || typeof obj !== 'object') return keys;
  for (const key of Object.keys(obj)) {
    if (key === '__trace') continue;
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const val = obj[key];
    if (val != null && typeof val === 'object' && !Array.isArray(val)) {
      keys.push(...collectKeys(val, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

// ---------------------------------------------------------------------------
// Deep Diff — includes __trace arrays in the comparison
// ---------------------------------------------------------------------------

function deepDiff(remote: any, local: any, currentPath = ''): DiffEntry[] {
  const diffs: DiffEntry[] = [];

  if (remote === local) return diffs;

  const remoteIsArr = Array.isArray(remote);
  const localIsArr  = Array.isArray(local);

  // Both arrays (handles __trace arrays and any other array values)
  if (remoteIsArr && localIsArr) {
    const maxLen = Math.max(remote.length, local.length);
    for (let i = 0; i < maxLen; i++) {
      const childPath = `${currentPath}[${i}]`;
      if (i >= remote.length) {
        diffs.push({ path: childPath, type: 'only_in_local',  localValue:  local[i] });
      } else if (i >= local.length) {
        diffs.push({ path: childPath, type: 'only_in_remote', remoteValue: remote[i] });
      } else {
        diffs.push(...deepDiff(remote[i], local[i], childPath));
      }
    }
    return diffs;
  }

  const remoteIsObj = remote != null && typeof remote === 'object' && !remoteIsArr;
  const localIsObj  = local  != null && typeof local  === 'object' && !localIsArr;

  // Type mismatch or differing primitives
  if (!remoteIsObj || !localIsObj) {
    diffs.push({ path: currentPath, type: 'changed', remoteValue: remote, localValue: local });
    return diffs;
  }

  // Both plain objects — recurse into every key (including __trace)
  const allKeys = new Set([...Object.keys(remote), ...Object.keys(local)]);

  for (const key of allKeys) {
    const childPath = currentPath ? `${currentPath}.${key}` : key;

    if (!(key in local)) {
      diffs.push({ path: childPath, type: 'only_in_remote', remoteValue: remote[key] });
    } else if (!(key in remote)) {
      diffs.push({ path: childPath, type: 'only_in_local', localValue: local[key] });
    } else {
      diffs.push(...deepDiff(remote[key], local[key], childPath));
    }
  }

  return diffs;
}

// ---------------------------------------------------------------------------
// Style Fetching
// ---------------------------------------------------------------------------

/**
 * Navigate to a widget's RN preview page and wait for the RN app to load.
 *
 * URL patterns:
 *   Local:  {base}/rn-bundle/index.html#/{pageName}  (matches observed localhost URL format)
 *   Remote: {base}/rn-bundle/#/{pageName}             (matches stage-platform deploy URL format)
 */
async function navigateToPreviewUrl(
  page: Page,
  widget: string,
  baseUrl: string,
  cookie: string,
  isLocal: boolean,
): Promise<string> {
  const pageName = resolvePageName(widget);
  const trimmed = baseUrl.replace(/\/$/, '');
  const finalUrl = isLocal
    ? `${trimmed}/rn-bundle/index.html#/${pageName}`
    : `${trimmed}/rn-bundle/#/${pageName}`;

  if (!isLocal && cookie) {
    await ensureAuthCookies(page, finalUrl, cookie);
  }

  await page.goto(finalUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

  try {
    await page.waitForLoadState('networkidle', { timeout: 20000 });
  } catch { /* best effort */ }

  const MAIN_PAGE_WIDGETS = ['navbar', 'tabbar'];
  const isMainPage = MAIN_PAGE_WIDGETS.includes(widget);
  const RN_LOADED_SELECTOR = isMainPage
    ? "//h1[normalize-space()='MainPage']"
    : "//div[@aria-label='mobile_navbar1_backbtn_icon']";
  const maxWaitMs = isLocal ? 30000 : 60000;

  console.log(`    ⏳ Waiting for RN preview (${isMainPage ? 'MainPage heading' : 'navbar back-button'})...`);

  try {
    await page.waitForSelector(RN_LOADED_SELECTOR, { state: 'visible', timeout: maxWaitMs });
    console.log(`    ✅ RN loaded`);
  } catch {
    console.log(`    ⚠️  RN load selector not found within ${maxWaitMs / 1000}s — proceeding anyway`);
  }

  return finalUrl;
}

async function fetchStylesObject(page: Page, command: string): Promise<any> {
  const maxWaitMs = 30000;
  const pollIntervalMs = 2000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const result = await page.evaluate((cmd: string) => {
      try {
        const fn = new Function(`return ${cmd}`);
        const obj = fn();
        if (obj && typeof obj === 'object') return JSON.parse(JSON.stringify(obj));
        return { __pending: true };
      } catch (e: any) {
        return { __error: e.message || String(e) };
      }
    }, command);

    if (result && !result.__error && !result.__pending) return result;

    if (
      result?.__error &&
      !result.__error.includes('Cannot read properties of undefined') &&
      !result.__error.includes('is not defined')
    ) {
      console.log(`    ❌ Style command failed: ${result.__error}`);
      return null;
    }

    await page.waitForTimeout(pollIntervalMs);
  }

  const final = await page.evaluate((cmd: string) => {
    try {
      const fn = new Function(`return ${cmd}`);
      return JSON.parse(JSON.stringify(fn()));
    } catch (e: any) {
      return { __error: e.message || String(e) };
    }
  }, command);

  if (final?.__error) {
    console.log(`    ❌ Style command timed out: ${final.__error}`);
    return null;
  }
  return final ?? null;
}

// ---------------------------------------------------------------------------
// Report Generation
// ---------------------------------------------------------------------------

function formatValue(val: any): string {
  if (val === null) return 'null';
  if (val === undefined) return 'undefined';
  if (typeof val === 'object') {
    const keyCount = Object.keys(val).filter(k => k !== '__trace').length;
    return `{object, ${keyCount} keys}`;
  }
  return JSON.stringify(val);
}

function generateHtmlReport(
  comparisons: WidgetComparison[],
  remoteUrl: string,
  localUrl: string,
): string {
  const templatePath = path.join(__dirname, 'comparison-report.template.html');
  let template = fs.readFileSync(templatePath, 'utf-8');

  // Slim each comparison down to only what the template needs
  const reportData = comparisons.map(c => ({
    widget:       c.widget,
    remoteKeys:   c.remote.keyCount,
    localKeys:    c.local.keyCount,
    remoteFetched: c.remote.fetched,
    localFetched:  c.local.fetched,
    remoteError:  c.remote.error ?? null,
    localError:   c.local.error ?? null,
    diffs: c.diffs.map(d => ({
      path:        d.path,
      type:        d.type,
      remoteValue: d.remoteValue ?? null,
      localValue:  d.localValue ?? null,
    })),
  }));

  // Inject data and meta into template
  template = template.replace('__REPORT_DATA__', JSON.stringify(reportData));

  // Stamp generated date and source URLs into the page meta
  const date = new Date().toLocaleString();
  template = template.replace(
    '<span id="gen-date"></span>',
    `<span id="gen-date">${date}</span>`,
  );
  template = template.replace(
    /Remote: stage-platform\.wavemaker\.ai/,
    `Remote: ${remoteUrl.replace(/https?:\/\//, '').slice(0, 60)}`,
  );
  template = template.replace(
    /Local: localhost:19009/,
    `Local: ${localUrl.replace(/https?:\/\//, '').slice(0, 60)}`,
  );

  return template;
}

function generateTextReport(
  comparisons: WidgetComparison[],
  remoteUrl: string,
  localUrl: string,
): string {
  const lines: string[] = [
    '════════════════════════════════════════════════════════════════',
    '  RN STYLE COMPARISON REPORT',
    '════════════════════════════════════════════════════════════════',
    `  Generated: ${new Date().toLocaleString()}`,
    `  Remote:    ${remoteUrl}`,
    `  Local:     ${localUrl}`,
    `  Widgets:   ${comparisons.length}`,
    '',
  ];

  const identical = comparisons.filter(c => !c.remote.error && !c.local.error && c.diffs.length === 0);
  const withDiffs = comparisons.filter(c => c.diffs.length > 0);
  const remoteErrors = comparisons.filter(c => !!c.remote.error);
  const localErrors = comparisons.filter(c => !!c.local.error);
  const totalDiffs = comparisons.reduce((sum, c) => sum + c.diffs.length, 0);

  lines.push('════════════════════════════════════════════════════════════════');
  lines.push('  SUMMARY');
  lines.push('════════════════════════════════════════════════════════════════');
  lines.push(`  Total widgets:  ${comparisons.length}`);
  lines.push(`  Identical:      ${identical.length}`);
  lines.push(`  With diffs:     ${withDiffs.length}  (${totalDiffs} total diff entries)`);
  lines.push(`  Remote errors:  ${remoteErrors.length}`);
  lines.push(`  Local errors:   ${localErrors.length}`);
  lines.push('');

  // Widgets with differences
  for (const c of withDiffs) {
    lines.push('────────────────────────────────────────────────────────────────');
    lines.push(`  ${c.widget.toUpperCase()}  (${c.diffs.length} differences)`);
    lines.push(`  Remote: ${c.remote.keyCount} keys  |  Local: ${c.local.keyCount} keys`);
    lines.push('────────────────────────────────────────────────────────────────');

    const changed = c.diffs.filter(d => d.type === 'changed');
    const onlyRemote = c.diffs.filter(d => d.type === 'only_in_remote');
    const onlyLocal = c.diffs.filter(d => d.type === 'only_in_local');

    if (changed.length > 0) {
      lines.push(`  🔄 VALUE CHANGES (${changed.length}):`);
      for (const d of changed) {
        lines.push(`    ${d.path}`);
        lines.push(`      remote: ${formatValue(d.remoteValue)}`);
        lines.push(`      local:  ${formatValue(d.localValue)}`);
      }
      lines.push('');
    }

    if (onlyRemote.length > 0) {
      lines.push(`  🔴 ONLY IN REMOTE (${onlyRemote.length}):`);
      for (const d of onlyRemote) {
        lines.push(`    ${d.path}  =  ${formatValue(d.remoteValue)}`);
      }
      lines.push('');
    }

    if (onlyLocal.length > 0) {
      lines.push(`  🟢 ONLY IN LOCAL (${onlyLocal.length}):`);
      for (const d of onlyLocal) {
        lines.push(`    ${d.path}  =  ${formatValue(d.localValue)}`);
      }
      lines.push('');
    }
  }

  // Widgets with fetch errors
  const errored = comparisons.filter(c => c.remote.error || c.local.error);
  if (errored.length > 0) {
    lines.push('────────────────────────────────────────────────────────────────');
    lines.push('  ❌ FETCH ERRORS:');
    for (const c of errored) {
      if (c.remote.error) lines.push(`    ${c.widget}  [remote]: ${c.remote.error}`);
      if (c.local.error)  lines.push(`    ${c.widget}  [local]:  ${c.local.error}`);
    }
    lines.push('');
  }

  // Identical widgets list
  if (identical.length > 0) {
    lines.push('────────────────────────────────────────────────────────────────');
    lines.push('  ✅ IDENTICAL WIDGETS:');
    lines.push(`     ${identical.map(c => c.widget).join(', ')}`);
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const singleWidget   = args.includes('--widget')       ? args[args.indexOf('--widget') + 1]       : null;
  const headless       = args.includes('--headless');
  const remoteUrlArg   = args.includes('--remote-url')   ? args[args.indexOf('--remote-url') + 1]   : null;
  const localUrlArg    = args.includes('--local-url')    ? args[args.indexOf('--local-url') + 1]    : null;
  const skipFetchRemote = args.includes('--skip-fetch-remote');
  const skipFetchLocal  = args.includes('--skip-fetch-local');

  const localBaseUrl  = localUrlArg || DEFAULT_LOCAL_URL;
  const isRemoteLocal = remoteUrlArg ? isLocalUrl(remoteUrlArg) : false;

  // Only validate ENV if we need to deploy remotely
  if (!remoteUrlArg && !isRemoteLocal) {
    ENV.validate();
  } else if (isRemoteLocal) {
    console.log('🏠 Remote URL is also local — skipping auth validation');
  }

  if (!fs.existsSync(ARTIFACTS_DIR)) fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

  const tokenSlots = loadTokenSlots();
  const widgetList = singleWidget ? [singleWidget] : Object.keys(tokenSlots);

  console.log(`\n📋 Widgets to compare: ${widgetList.length}`);
  console.log(`   ${widgetList.join(', ')}\n`);
  console.log(`🏠 Local URL:  ${localBaseUrl}`);
  console.log(`🌐 Remote:     ${remoteUrlArg || '(will deploy via inplaceDeploy)'}\n`);

  // ── Remote auth ──
  let remoteCookie = '';

  if (!isRemoteLocal && !remoteUrlArg) {
    if (ENV.authMethod === 'wavemaker') {
      console.log('🔐 WaveMaker form login...');
      const client = new StudioClient({ baseUrl: ENV.studioBaseUrl, projectId: ENV.projectId });
      remoteCookie = await client.login(ENV.studioUsername, ENV.studioPassword);
    } else {
      console.log('🔐 Google login...');
      const authResult = await googleBrowserLogin({ headless });
      remoteCookie = authResult.cookieHeader;
    }
    console.log(`🔐 Login OK (cookie: ${remoteCookie.length} chars)`);
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(path.join(CACHE_DIR, 'auth-cookie.txt'), remoteCookie);
    process.env.STUDIO_COOKIE = remoteCookie;
  } else if (!isRemoteLocal && remoteUrlArg) {
    // Remote URL provided — still need auth cookies for the remote host
    if (ENV.studioUsername && ENV.studioPassword) {
      const client = new StudioClient({ baseUrl: ENV.studioBaseUrl, projectId: ENV.projectId });
      try {
        remoteCookie = await client.login(ENV.studioUsername, ENV.studioPassword);
        console.log(`🔐 Login OK (cookie: ${remoteCookie.length} chars)`);
        process.env.STUDIO_COOKIE = remoteCookie;
      } catch {
        console.log('⚠️  Auth skipped (login failed or credentials not set)');
      }
    }
  }

  // ── Remote deploy or use provided URL ──
  let remoteBaseUrl: string;

  if (remoteUrlArg) {
    remoteBaseUrl = remoteUrlArg;
    console.log(`🔗 Remote URL: ${remoteBaseUrl} (provided, skipping deploy)`);
  } else {
    const client = new StudioClient({
      baseUrl: ENV.studioBaseUrl,
      projectId: ENV.projectId,
      cookie: remoteCookie,
    });

    let deployUrl: string | undefined;
    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log(`🚀 In-place deploy (attempt ${attempt}/3)...`);
      deployUrl = await client.inplaceDeploy();
      if (deployUrl) break;
      if (attempt < 3) {
        const wait = attempt * 10;
        console.log(`   ⏳ Failed — retrying in ${wait}s...`);
        await new Promise(r => setTimeout(r, wait * 1000));
      }
    }

    if (!deployUrl) {
      console.error('\n❌ Deploy failed after 3 attempts.');
      console.error('   Tip: pass --remote-url to skip deploy and use a cached preview URL.');
      process.exit(1);
    }

    remoteBaseUrl = deployUrl;
    console.log(`✅ Deployed: ${remoteBaseUrl}`);
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(CACHE_DIR, 'preview-url.json'),
      JSON.stringify({ previewUrl: remoteBaseUrl, timestamp: new Date().toISOString() }),
    );
  }

  // ── Browser ──
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });

  // Load cached auth.json if present
  const authJsonPath = path.join(CACHE_DIR, 'auth.json');
  if (fs.existsSync(authJsonPath)) {
    try {
      const state = JSON.parse(fs.readFileSync(authJsonPath, 'utf-8'));
      if (state.cookies?.length) {
        await context.addCookies(state.cookies);
        console.log(`🍪 Loaded ${state.cookies.length} cookies from auth.json`);
      }
    } catch { /* ignore */ }
  }

  // Inject remote auth cookies into the browser context
  if (!isRemoteLocal && remoteCookie) {
    const deployDomain = new URL(remoteBaseUrl).hostname;
    const injected = remoteCookie
      .split(';')
      .map(c => c.trim())
      .filter(Boolean)
      .map(pair => {
        const [name, ...rest] = pair.split('=');
        return {
          name: name.trim(),
          value: rest.join('='),
          domain: deployDomain,
          path: '/',
          httpOnly: false,
          secure: true,
          sameSite: 'Lax' as const,
        };
      });
    await context.addCookies(injected);
  }

  const comparisons: WidgetComparison[] = [];

  // ── Per-widget fetch + compare ──
  for (const widget of widgetList) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  Widget: ${widget}`);
    console.log(`${'═'.repeat(60)}`);

    const studioName = loadFirstStudioWidgetName(widget);
    if (!studioName) {
      console.log(`  ⚠️  No CSV mapping found — skipping`);
      comparisons.push({
        widget,
        remote: { fetched: false, url: remoteBaseUrl, keyCount: 0, error: 'No CSV variant mapping' },
        local:  { fetched: false, url: localBaseUrl,  keyCount: 0, error: 'No CSV variant mapping' },
        diffs: [],
      });
      continue;
    }

    const pageName = resolvePageName(widget);
    const cmd = getStyleCommand(widget, studioName);
    console.log(`  📄 Page: ${pageName}  |  Instance: ${studioName}`);
    console.log(`  🧾 Command: ${cmd}`);

    // ── Fetch remote ──
    let remoteStyles: any = null;
    let remoteError: string | undefined;

    const cachedRemotePath = path.join(ARTIFACTS_DIR, `${widget}.remote.json`);

    if (skipFetchRemote && fs.existsSync(cachedRemotePath)) {
      remoteStyles = JSON.parse(fs.readFileSync(cachedRemotePath, 'utf-8'));
      console.log(`  📂 Remote: loaded from cache (${collectKeys(remoteStyles).length} keys)`);
    } else {
      const remotePage = await context.newPage();
      try {
        await navigateToPreviewUrl(remotePage, widget, remoteBaseUrl, remoteCookie, isRemoteLocal);
        remoteStyles = await fetchStylesObject(remotePage, cmd);
        if (!remoteStyles) {
          remoteError = 'Styles object not found in browser console';
        } else {
          fs.writeFileSync(cachedRemotePath, JSON.stringify(remoteStyles, null, 2));
          console.log(`  🌐 Remote: ✅ ${collectKeys(remoteStyles).length} leaf keys`);
        }
      } catch (err: any) {
        remoteError = err.message;
        console.log(`  🌐 Remote: ❌ ${remoteError}`);
      } finally {
        await remotePage.close();
      }
    }

    // ── Fetch local ──
    let localStyles: any = null;
    let localError: string | undefined;

    const cachedLocalPath = path.join(ARTIFACTS_DIR, `${widget}.local.json`);

    if (skipFetchLocal && fs.existsSync(cachedLocalPath)) {
      localStyles = JSON.parse(fs.readFileSync(cachedLocalPath, 'utf-8'));
      console.log(`  📂 Local:  loaded from cache (${collectKeys(localStyles).length} keys)`);
    } else {
      const localPage = await context.newPage();
      try {
        await navigateToPreviewUrl(localPage, widget, localBaseUrl, '', true);
        localStyles = await fetchStylesObject(localPage, cmd);
        if (!localStyles) {
          localError = 'Styles object not found in browser console';
        } else {
          fs.writeFileSync(cachedLocalPath, JSON.stringify(localStyles, null, 2));
          console.log(`  🏠 Local:  ✅ ${collectKeys(localStyles).length} leaf keys`);
        }
      } catch (err: any) {
        localError = err.message;
        console.log(`  🏠 Local:  ❌ ${localError}`);
      } finally {
        await localPage.close();
      }
    }

    // ── Compare ──
    const diffs = remoteStyles && localStyles ? deepDiff(remoteStyles, localStyles) : [];

    if (remoteStyles && localStyles) {
      if (diffs.length === 0) {
        console.log(`  ✅ Identical — no style differences`);
      } else {
        const ch = diffs.filter(d => d.type === 'changed').length;
        const or = diffs.filter(d => d.type === 'only_in_remote').length;
        const ol = diffs.filter(d => d.type === 'only_in_local').length;
        console.log(`  ⚡ ${diffs.length} diffs  [changed: ${ch}  only_remote: ${or}  only_local: ${ol}]`);
      }
    }

    comparisons.push({
      widget,
      remote: {
        fetched: !!remoteStyles,
        url: remoteBaseUrl,
        keyCount: remoteStyles ? collectKeys(remoteStyles).length : 0,
        error: remoteError,
      },
      local: {
        fetched: !!localStyles,
        url: localBaseUrl,
        keyCount: localStyles ? collectKeys(localStyles).length : 0,
        error: localError,
      },
      diffs,
    });
  }

  // ── Generate reports ──
  console.log(`\n${'═'.repeat(60)}`);
  console.log('  GENERATING REPORTS');
  console.log(`${'═'.repeat(60)}\n`);

  const jsonPath = path.join(ARTIFACTS_DIR, 'comparison-report.json');
  fs.writeFileSync(jsonPath, JSON.stringify(comparisons, null, 2));
  console.log(`📄 JSON: ${jsonPath}`);

  const txtReport = generateTextReport(comparisons, remoteBaseUrl, localBaseUrl);
  const txtPath = path.join(ARTIFACTS_DIR, 'comparison-report.txt');
  fs.writeFileSync(txtPath, txtReport);
  console.log(`📄 TXT:  ${txtPath}`);

  const htmlReport = generateHtmlReport(comparisons, remoteBaseUrl, localBaseUrl);
  const htmlPath = path.join(ARTIFACTS_DIR, 'comparison-report.html');
  fs.writeFileSync(htmlPath, htmlReport);
  console.log(`📄 HTML: ${htmlPath}`);

  const totalDiffs  = comparisons.reduce((s, c) => s + c.diffs.length, 0);
  const identical   = comparisons.filter(c => !c.remote.error && !c.local.error && c.diffs.length === 0).length;
  const withDiffs   = comparisons.filter(c => c.diffs.length > 0).length;
  const errors      = comparisons.filter(c => c.remote.error || c.local.error).length;

  console.log('\n📊 SUMMARY:');
  console.log(`   ✅ Identical:   ${identical} widgets`);
  console.log(`   ⚡ With diffs:  ${withDiffs} widgets  (${totalDiffs} total diff entries)`);
  console.log(`   ❌ Errors:      ${errors} widgets`);

  await browser.close();
  console.log('\n✅ Done.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
