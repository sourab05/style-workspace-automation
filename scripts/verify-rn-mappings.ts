/**
 * verify-rn-mappings.ts
 *
 * Fetches live RN styles objects from the WaveMaker Studio RN preview
 * via browser console (page.evaluate with wm. prefix) and cross-references
 * them against mobileMapper.ts mappings and widget-token-slots.json.
 *
 * Usage:
 *   npx ts-node scripts/verify-rn-mappings.ts [--widget button] [--headless]
 *   npx ts-node scripts/verify-rn-mappings.ts --preview-url https://stage-platform.wavemaker.ai/run-xxxxx/ProjectName_master
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { chromium, Page } from '@playwright/test';
import { ENV } from '../src/utils/env';
import { googleBrowserLogin } from '../src/auth/googleAuth';
import { StudioClient } from '../src/api/studioClient';
import { MobileMapper } from '../wdio/utils/mobileMapper';
import { studioWidgetsPropertyAccess } from '../wdio/utils/studioWidgetAccess';
import { TokenMappingService } from '../src/tokens/mappingService';
import { ensureAuthCookies } from '../src/playwright/helpers';
import type { Widget } from '../src/matrix/widgets';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ARTIFACTS_DIR = path.join(process.cwd(), 'artifacts', 'rn-styles');
const TOKEN_SLOTS_PATH = path.join(process.cwd(), 'wdio', 'config', 'widget-token-slots.json');
const CSV_DIR = path.join(process.cwd(), 'tests', 'testdata', 'mobile');
const CACHE_DIR = path.join(process.cwd(), '.test-cache');

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
  'accordion-pane': 'accordion',
  camera: 'Camera',
  datetime: 'Datetime',
  video: 'Video',
};

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

/**
 * Build the browser console command with wm. prefix to get the full styles object.
 * Uses wm. prefix because page.evaluate() runs in the browser's global scope
 * and the RN app exposes its runtime via window.wm.
 */
function getStyleCommand(widget: string, studioWidgetName: string): string {
  const stylesKey = widget === 'cards' ? 'calcStyles' : 'styles';

  if (widget === 'cards') {
    return `wm.App.appConfig.currentPage.Widgets.supportedLocaleList1.itemWidgets[0].card1._INSTANCE.${stylesKey}`;
  }
  if (widget === 'formcontrols') {
    return `wm.App.appConfig.currentPage.Widgets.supportedLocaleForm1.formWidgets.entestkey._INSTANCE.styles`;
  }
  return `wm.App.appConfig.currentPage.Widgets${studioWidgetsPropertyAccess(studioWidgetName)}._INSTANCE.${stylesKey}`;
}

/**
 * Resolve a dot-separated path in a nested object.
 */
function resolvePath(obj: any, dotPath: string): any {
  const segments = dotPath.split('.');
  let current = obj;
  for (const seg of segments) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[seg];
  }
  return current;
}

/**
 * Collect all leaf keys from a nested object as dot-separated paths.
 */
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

function splitStylePath(dotPath: string): { prefix: string; property: string } {
  const segments = dotPath.split('.');
  return {
    prefix: segments.slice(0, -1).join('.'),
    property: segments[segments.length - 1],
  };
}

/**
 * Trace metadata often binds a shorthand RN property (padding, borderRadius)
 * while the resolved styles object stores longhands (paddingTop, borderTopLeftRadius).
 */
function isTraceEquivalentPath(traceFullPath: string, mappedPath: string): boolean {
  if (traceFullPath === mappedPath) return true;

  const trace = splitStylePath(traceFullPath);
  const mapped = splitStylePath(mappedPath);
  if (trace.prefix !== mapped.prefix) return false;

  const longhands = TokenMappingService.getLonghandProperties(trace.property);
  return longhands.includes(mapped.property);
}

function resolveTraceValue(obj: any, rnProperty: string): any {
  if (obj == null || typeof obj !== 'object') return undefined;

  if (obj[rnProperty] !== undefined) return obj[rnProperty];

  for (const longhand of TokenMappingService.getLonghandProperties(rnProperty)) {
    if (obj[longhand] !== undefined) return obj[longhand];
  }

  return undefined;
}

/**
 * Walk the styles object and collect all --wm- CSS variable bindings from __trace entries.
 *
 * Returns an array of:
 *   { namespace: 'root', rnProperty: 'backgroundColor', cssVar: '--wm-btn-background', resolvedValue: '#FF7250' }
 *
 * The __trace[].value objects contain entries like:
 *   "backgroundColor": "var(--wm-btn-background)"
 *
 * The namespace is the dot-path to the object containing the __trace (e.g. "root", "icon.icon").
 */
interface TraceBinding {
  namespace: string;
  rnProperty: string;
  cssVar: string;
  fullPath: string;
  resolvedValue: any;
}

function collectTraceBindings(obj: any, prefix = ''): TraceBinding[] {
  const bindings: TraceBinding[] = [];
  if (obj == null || typeof obj !== 'object') return bindings;

  // Check __trace at this level
  const traces = obj.__trace;
  if (Array.isArray(traces)) {
    for (const trace of traces) {
      if (trace?.value && typeof trace.value === 'object') {
        for (const [rnProp, rawVal] of Object.entries(trace.value)) {
          // Skip token-to-token assignments (e.g. "--wm-btn-background": "var(--wm-color-primary)")
          // We only want real style property bindings (e.g. "backgroundColor": "var(--wm-btn-background)")
          if (rnProp.startsWith('--')) continue;

          if (typeof rawVal === 'string' && rawVal.includes('var(--wm-')) {
            const match = rawVal.match(/var\((--wm-[a-z0-9-]+)\)/);
            if (match) {
              const cssVar = match[1];
              const fullPath = prefix ? `${prefix}.${rnProp}` : rnProp;
              const resolvedValue = resolveTraceValue(obj, rnProp);
              bindings.push({ namespace: prefix || '(top)', rnProperty: rnProp, cssVar, fullPath, resolvedValue });
            }
          }
        }
      }
    }
  }

  // Recurse into child objects
  for (const key of Object.keys(obj)) {
    if (key === '__trace') continue;
    const val = obj[key];
    if (val != null && typeof val === 'object' && !Array.isArray(val)) {
      const childPrefix = prefix ? `${prefix}.${key}` : key;
      bindings.push(...collectTraceBindings(val, childPrefix));
    }
  }

  return bindings;
}

/**
 * For a given token property (e.g. "background", "border.style", "icon.color"),
 * find the matching --wm- trace binding by constructing the expected CSS variable suffix.
 *
 * Token property "border.style" → expected suffix "-border-style"
 * Then look for trace bindings where cssVar ends with exactly that suffix.
 * e.g. "--wm-btn-border-style".endsWith("-border-style") → match
 */
function findTraceMatches(
  bindings: TraceBinding[],
  property: string,
): TraceBinding[] {
  // Convert property to kebab suffix: "border.style" → "border-style", "icon.color" → "icon-color"
  const kebab = property.replace(/\./g, '-').toLowerCase();
  const suffix = `-${kebab}`;

  return bindings.filter(b => b.cssVar.toLowerCase().endsWith(suffix));
}

interface StyleMatch {
  fullPath: string;
  rnProperty: string;
  resolvedValue: any;
}

/**
 * Scan the styles object for RN properties matching the expected name.
 * Used as a fallback when trace-based suggestions are empty.
 *
 * E.g. for token "border.style" → look for "borderStyle" keys anywhere in the styles object.
 */
function findPropertyInStyles(stylesObj: any, property: string, prefix = ''): StyleMatch[] {
  const matches: StyleMatch[] = [];
  if (stylesObj == null || typeof stylesObj !== 'object') return matches;

  // Convert token property to expected RN camelCase: "border.style" → "borderStyle"
  const parts = property.split('.');
  const rnName = parts.length === 1
    ? parts[0]
    : parts[0] + parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');

  for (const key of Object.keys(stylesObj)) {
    if (key === '__trace') continue;
    const fullPath = prefix ? `${prefix}.${key}` : key;
    const val = stylesObj[key];

    if (key === rnName && val != null && typeof val !== 'object') {
      matches.push({ fullPath, rnProperty: key, resolvedValue: val });
    }

    if (val != null && typeof val === 'object' && !Array.isArray(val)) {
      matches.push(...findPropertyInStyles(val, property, fullPath));
    }
  }

  return matches;
}

/**
 * Navigate to a widget's RN preview page and wait for the RN app to fully load.
 * Polls for window.wm.App to be defined (the RN bundle's global runtime).
 */
async function navigateToPreview(
  page: Page,
  widget: string,
  basePreviewUrl: string,
  cookie: string,
): Promise<void> {
  const pageName = resolvePageName(widget);
  const trimmed = basePreviewUrl.replace(/\/$/, '');
  const finalUrl = `${trimmed}/rn-bundle/#/${pageName}`;

  await ensureAuthCookies(page, finalUrl, cookie);
  await page.goto(finalUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

  try {
    await page.waitForLoadState('networkidle', { timeout: 20000 });
  } catch { /* best effort */ }

  // Wait for the RN preview to fully render by checking for a known UI element
  // Main page widgets (navbar, tabbar) don't have a back button — use the page heading instead
  const MAIN_PAGE_WIDGETS = ['navbar', 'tabbar'];
  const isMainPage = MAIN_PAGE_WIDGETS.includes(widget);
  const RN_LOADED_SELECTOR = isMainPage
    ? "//h1[normalize-space()='MainPage']"
    : "//div[@aria-label='mobile_navbar1_backbtn_icon']";
  const maxWaitMs = 60000;

  console.log(`  ⏳ Waiting for RN preview to load (${isMainPage ? 'MainPage heading' : 'navbar back-button'})...`);

  try {
    await page.waitForSelector(RN_LOADED_SELECTOR, { state: 'visible', timeout: maxWaitMs });
    console.log(`  ✅ RN preview loaded`);
  } catch {
    console.log(`  ⚠️  Navbar selector not visible within ${maxWaitMs / 1000}s, proceeding anyway`);
  }
}

/**
 * Wait for a specific widget instance to be available in the RN runtime,
 * then fetch its full styles object via browser console (page.evaluate).
 */
async function fetchStylesObject(
  page: Page,
  command: string,
): Promise<any> {
  // Poll for the specific widget styles to be available (widget may render after page init)
  const maxWaitMs = 30000;
  const pollIntervalMs = 2000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const result = await page.evaluate((cmd: string) => {
      try {
        const fn = new Function(`return ${cmd}`);
        const obj = fn();
        if (obj && typeof obj === 'object') {
          return JSON.parse(JSON.stringify(obj));
        }
        return { __pending: true, __type: typeof obj };
      } catch (e: any) {
        return { __error: e.message || String(e) };
      }
    }, command);

    if (result && !result.__error && !result.__pending && typeof result === 'object') {
      return result;
    }

    if (result?.__error && !result.__error.includes('Cannot read properties of undefined') && !result.__error.includes('is not defined')) {
      console.log(`  ❌ Style command failed: ${result.__error}`);
      return null;
    }

    await page.waitForTimeout(pollIntervalMs);
  }

  // Final attempt
  const finalResult = await page.evaluate((cmd: string) => {
    try {
      const fn = new Function(`return ${cmd}`);
      const obj = fn();
      return JSON.parse(JSON.stringify(obj));
    } catch (e: any) {
      return { __error: e.message || String(e) };
    }
  }, command);

  if (finalResult?.__error) {
    console.log(`  ❌ Style command failed after ${maxWaitMs / 1000}s: ${finalResult.__error}`);
    return null;
  }
  if (!finalResult || typeof finalResult !== 'object') {
    console.log(`  ❌ Style command returned non-object: ${typeof finalResult}`);
    return null;
  }
  return finalResult;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface MappingEntry {
  property: string;
  tokenType: string;
  mappedPath: string;
  reason: string;
  traceMatches: TraceBinding[];
  styleMatches: StyleMatch[];
}

interface MappingResult {
  widget: string;
  verified: Array<{ property: string; tokenType: string; mappedPath: string; cssVar: string }>;
  unverified: Array<{ property: string; tokenType: string; mappedPath: string; resolvedValue: any }>;
  invalid: MappingEntry[];
  unmapped: MappingEntry[];
  missingFromSlots: TraceBinding[];
  stylesFetched: boolean;
  error?: string;
}

async function main() {
  const args = process.argv.slice(2);
  const singleWidget  = args.includes('--widget')       ? args[args.indexOf('--widget') + 1]       : null;
  const headless      = args.includes('--headless');
  const previewUrlArg = args.includes('--preview-url')  ? args[args.indexOf('--preview-url') + 1]  : null;
  const isLocal       = previewUrlArg ? isLocalUrl(previewUrlArg) : false;

  // --use-cached: skip auth/deploy/browser, read from saved style snapshots
  const useCached  = args.includes('--use-cached');
  const stylesDirArg = args.includes('--styles-dir') ? args[args.indexOf('--styles-dir') + 1] : null;
  const stylesSuffix = args.includes('--styles-suffix') ? args[args.indexOf('--styles-suffix') + 1] : 'local';
  // default cached source: artifacts/style-comparison (produced by compare-styles.ts)
  const cachedStylesDir = stylesDirArg
    ? path.resolve(stylesDirArg)
    : path.join(process.cwd(), 'artifacts', 'style-comparison');

  if (!useCached && !isLocal) {
    ENV.validate();
  } else {
    if (useCached) console.log(`📂 Cached mode — reading styles from: ${cachedStylesDir}  (suffix: .${stylesSuffix}.json)`);
    else console.log('🏠 Local preview URL detected — skipping auth validation');
  }

  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }

  const tokenSlots = loadTokenSlots();
  const widgetList = singleWidget
    ? [singleWidget]
    : Object.keys(tokenSlots);

  console.log(`\n📋 Widgets to verify: ${widgetList.length}`);
  console.log(`   ${widgetList.join(', ')}\n`);

  // ── Cached mode: skip auth / deploy / browser entirely ─────────────────────
  if (useCached) {
    const results: MappingResult[] = [];

    for (const widget of widgetList) {
      console.log(`\n${'═'.repeat(60)}`);
      console.log(`  Widget: ${widget}`);
      console.log(`${'═'.repeat(60)}`);

      const result: MappingResult = {
        widget,
        verified: [],
        unverified: [],
        invalid: [],
        unmapped: [],
        missingFromSlots: [],
        stylesFetched: false,
      };

      // Load from cached snapshot
      const cachedPath = path.join(cachedStylesDir, `${widget}.${stylesSuffix}.json`);
      let stylesObj: any = null;

      if (fs.existsSync(cachedPath)) {
        stylesObj = JSON.parse(fs.readFileSync(cachedPath, 'utf-8'));
        result.stylesFetched = true;
        const keyCount = collectKeys(stylesObj).length;
        console.log(`  📂 Loaded from cache (${keyCount} leaf keys): ${cachedPath}`);

        // Mirror to rn-styles dir for consistency
        const outPath = path.join(ARTIFACTS_DIR, `${widget}.styles.json`);
        fs.writeFileSync(outPath, JSON.stringify(stylesObj, null, 2));
      } else {
        result.error = `No cached styles found at: ${cachedPath}`;
        console.log(`  ⚠️  ${result.error}`);
      }

      // Run the same mapping verification logic
      const widgetSlots = tokenSlots[widget];
      if (!widgetSlots?.tokenSlots) {
        console.log(`  ⚠️  No token slots defined for ${widget}`);
        results.push(result);
        continue;
      }

      const traceBindings = stylesObj ? collectTraceBindings(stylesObj) : [];
      if (traceBindings.length > 0) {
        console.log(`  🔍 Found ${traceBindings.length} --wm- trace bindings`);
      }

      verifyMappings(widget as Widget, widgetSlots, stylesObj, traceBindings, result);
      results.push(result);
    }

    await writeReports(results);
    return;
  }

  // ── Live mode: auth + deploy + browser ─────────────────────────────────────

  // --- Auth: skip entirely for local preview URLs ---
  let cookie: string;
  if (isLocal) {
    cookie = '';
    console.log('🏠 Local preview — skipping login');
  } else if (ENV.authMethod === 'platformdb') {
    console.log('🔐 Performing Platform DB login...');
    const client = new StudioClient({ baseUrl: ENV.studioBaseUrl, projectId: ENV.projectId });
    cookie = await client.loginWithPlatformDB(ENV.studioUsername, ENV.studioPassword);
    console.log(`🔐 Login successful (cookie length: ${cookie.length})`);
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(path.join(CACHE_DIR, 'auth-cookie.txt'), cookie);
    process.env.STUDIO_COOKIE = cookie;
  } else if (ENV.authMethod === 'wavemaker') {
    console.log('🔐 Performing WaveMaker form login...');
    const client = new StudioClient({ baseUrl: ENV.studioBaseUrl, projectId: ENV.projectId });
    cookie = await client.login(ENV.studioUsername, ENV.studioPassword);
    console.log(`🔐 Login successful (cookie length: ${cookie.length})`);
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(path.join(CACHE_DIR, 'auth-cookie.txt'), cookie);
    process.env.STUDIO_COOKIE = cookie;
  } else {
    console.log('🔐 Performing Google login...');
    const authResult = await googleBrowserLogin({ headless });
    cookie = authResult.cookieHeader;
    console.log(`🔐 Login successful (cookie length: ${cookie.length})`);
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(path.join(CACHE_DIR, 'auth-cookie.txt'), cookie);
    process.env.STUDIO_COOKIE = cookie;
  }

  // --- Deploy: always run inplaceDeploy first, cache the URL, reuse for all widgets ---
  let deployUrl: string | undefined;

  if (previewUrlArg) {
    deployUrl = previewUrlArg;
    console.log(`🔗 Using provided preview URL (skipping deploy): ${deployUrl}`);
  } else {
    const client = new StudioClient({
      baseUrl: ENV.studioBaseUrl,
      projectId: ENV.projectId,
      cookie,
    });

    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log(`🚀 Triggering in-place deploy (attempt ${attempt}/3)...`);
      deployUrl = await client.inplaceDeploy();
      if (deployUrl) break;

      if (attempt < 3) {
        const waitSec = attempt * 10;
        console.log(`   ⏳ Deploy failed, waiting ${waitSec}s before retry...`);
        await new Promise(r => setTimeout(r, waitSec * 1000));
      }
    }

    if (!deployUrl) {
      console.error('\n❌ In-place deploy failed after 3 attempts.');
      console.error('   Options to fix:');
      console.error('   1. Provide preview URL:  npx ts-node scripts/verify-rn-mappings.ts --preview-url https://...');
      console.error('   2. Use cached styles:    npx ts-node scripts/verify-rn-mappings.ts --use-cached');
      process.exit(1);
    }
  }

  // Cache the deploy URL so other tools / test runs can reuse it
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(CACHE_DIR, 'preview-url.json'),
    JSON.stringify({ previewUrl: deployUrl, timestamp: new Date().toISOString() }),
  );

  console.log(`✅ Deploy URL: ${deployUrl}  (cached to .test-cache/preview-url.json)\n`);

  // --- Browser (matching test pattern: auth cookies injected per-page) ---
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });

  // Load storageState from cache if available (matching global-setup)
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

  // Inject auth cookies for remote deployments only (localhost needs no auth)
  if (!isLocal && cookie) {
    const deployDomain = new URL(deployUrl).hostname;
    const cookiePairs = cookie.split(';').map(c => c.trim()).filter(Boolean);
    const injectedCookies = cookiePairs.map(pair => {
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
    await context.addCookies(injectedCookies);
  }

  const results: MappingResult[] = [];

  for (const widget of widgetList) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  Widget: ${widget}`);
    console.log(`${'═'.repeat(60)}`);

    const result: MappingResult = {
      widget,
      verified: [],
      unverified: [],
      invalid: [],
      unmapped: [],
      missingFromSlots: [],
      stylesFetched: false,
    };

    // 1. Get studio widget name from CSV
    const studioName = loadFirstStudioWidgetName(widget);
    if (!studioName) {
      console.log(`  ⚠️  No CSV mapping found for ${widget}, skipping styles fetch`);
      result.error = 'No CSV variant mapping';
    }

    // 2. Navigate to RN preview and fetch styles
    let stylesObj: any = null;

    if (studioName) {
      const pageName = resolvePageName(widget);
      console.log(`  📄 Page: ${pageName} | Instance: ${studioName}`);

      const page = await context.newPage();

      try {
        await navigateToPreview(page, widget, deployUrl, cookie);
        console.log(`  🌐 URL: ${page.url()}`);

        const cmd = getStyleCommand(widget, studioName);
        console.log(`  🧾 Console command: ${cmd}`);

        stylesObj = await fetchStylesObject(page, cmd);

        if (!stylesObj) {
          result.error = 'Failed to fetch styles object from browser console';
        } else {
          result.stylesFetched = true;
          const keyCount = collectKeys(stylesObj).length;
          console.log(`  ✅ Styles fetched (${keyCount} leaf keys)`);

          const outPath = path.join(ARTIFACTS_DIR, `${widget}.styles.json`);
          fs.writeFileSync(outPath, JSON.stringify(stylesObj, null, 2));
          console.log(`  💾 Saved: ${outPath}`);
        }
      } catch (err: any) {
        console.log(`  ❌ Navigation/fetch error: ${err.message}`);
        result.error = err.message;
      } finally {
        await page.close();
      }
    }

    // 3. Verify + push
    const widgetSlots = tokenSlots[widget];
    if (!widgetSlots?.tokenSlots) {
      console.log(`  ⚠️  No token slots defined for ${widget}`);
      results.push(result);
      continue;
    }

    const traceBindings = stylesObj ? collectTraceBindings(stylesObj) : [];
    if (traceBindings.length > 0) {
      console.log(`  🔍 Found ${traceBindings.length} --wm- trace bindings`);
    }

    verifyMappings(widget as Widget, widgetSlots, stylesObj, traceBindings, result);
    results.push(result);
  }

  await writeReports(results);
  await browser.close();
  console.log('\n✅ Done.');
}

// ---------------------------------------------------------------------------
// Shared: per-widget mapping verification
// ---------------------------------------------------------------------------

function verifyMappings(
  widget: Widget,
  widgetSlots: { tokenSlots: Array<{ tokenType: string; properties: string[] }> },
  stylesObj: any,
  traceBindings: ReturnType<typeof collectTraceBindings>,
  result: MappingResult,
) {
  for (const slot of widgetSlots.tokenSlots) {
    for (const property of slot.properties) {
      const propertyPath = property.split('.');
      const mappedPath = MobileMapper.mapToRnStylePath(propertyPath, widget, 'android');

      const isGenericFallback =
        mappedPath.startsWith('root.') &&
        mappedPath === `root.${propertyPath[propertyPath.length - 1]}`;

      if (stylesObj) {
        const value = resolvePath(stylesObj, mappedPath);
        const traceMatches = findTraceMatches(traceBindings, property);
        const traceConfirmed = traceMatches.find(t => isTraceEquivalentPath(t.fullPath, mappedPath));

        if (traceConfirmed) {
          result.verified.push({ property, tokenType: slot.tokenType, mappedPath, cssVar: traceConfirmed.cssVar });
        } else if (value !== undefined && traceMatches.length === 0) {
          result.unverified.push({ property, tokenType: slot.tokenType, mappedPath, resolvedValue: value });
        } else {
          const styleMatches = findPropertyInStyles(stylesObj, property);
          const firstSeg = mappedPath.split('.')[0];
          const firstSegExists = stylesObj[firstSeg] !== undefined;

          if (isGenericFallback || !firstSegExists) {
            result.unmapped.push({
              property, tokenType: slot.tokenType, mappedPath,
              reason: isGenericFallback
                ? 'Generic fallback mapping (likely needs widget-specific mapping)'
                : `Namespace "${firstSeg}" not found in styles object`,
              traceMatches, styleMatches,
            });
          } else {
            result.invalid.push({
              property, tokenType: slot.tokenType, mappedPath,
              reason: traceMatches.length > 0
                ? `Mapped to "${mappedPath}" but trace says "${traceMatches[0].fullPath}"`
                : `Path "${mappedPath}" not found in styles; expected --wm-*-${property.replace(/\./g, '-')}`,
              traceMatches, styleMatches,
            });
          }
        }
      } else {
        if (isGenericFallback) {
          result.unmapped.push({
            property, tokenType: slot.tokenType, mappedPath,
            reason: 'Generic fallback (no styles object to verify)',
            traceMatches: [], styleMatches: [],
          });
        }
      }
    }
  }

  // Find --wm- trace vars not covered by any token slot property
  if (traceBindings.length > 0) {
    const coveredVars = new Set<string>();
    for (const slot of widgetSlots.tokenSlots) {
      for (const prop of slot.properties) {
        for (const m of findTraceMatches(traceBindings, prop)) coveredVars.add(m.cssVar);
      }
    }
    for (const binding of traceBindings) {
      if (!coveredVars.has(binding.cssVar)) result.missingFromSlots.push(binding);
    }
  }

  const total = result.verified.length + result.unverified.length + result.invalid.length + result.unmapped.length;
  console.log(`  📊 Results: ${result.verified.length} verified | ${result.unverified.length} unverified | ${result.invalid.length} invalid | ${result.unmapped.length} unmapped | ${result.missingFromSlots.length} missing from slots (of ${total} mapped)`);
}

// ---------------------------------------------------------------------------
// Shared: write mapping-report.json + mapping-report.txt
// ---------------------------------------------------------------------------

async function writeReports(results: MappingResult[]) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log('  GENERATING REPORTS');
  console.log(`${'═'.repeat(60)}\n`);

  const jsonPath = path.join(ARTIFACTS_DIR, 'mapping-report.json');
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  console.log(`📄 JSON report: ${jsonPath}`);

  function appendSuggestions(lines: string[], entry: MappingEntry) {
    if (entry.traceMatches.length > 0) {
      lines.push(`       Suggested (from --wm- trace → exact match on --wm-*-${entry.property.replace(/\./g, '-')}):`);
      for (const t of entry.traceMatches) {
        const valStr = t.resolvedValue !== undefined ? ` = ${JSON.stringify(t.resolvedValue)}` : '';
        lines.push(`         → ${t.fullPath}  (${t.cssVar}: ${t.rnProperty})${valStr}`);
      }
    } else if (entry.styleMatches.length > 0) {
      const camel = entry.property.split('.').length === 1
        ? entry.property
        : entry.property.split('.')[0] + entry.property.split('.').slice(1).map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
      lines.push(`       Suggested (from styles object scan for "${camel}"):`);
      for (const s of entry.styleMatches) {
        lines.push(`         → ${s.fullPath} = ${JSON.stringify(s.resolvedValue)}`);
      }
    } else {
      lines.push(`       No suggestion found (no --wm-*-${entry.property.replace(/\./g, '-')} in trace, no matching property in styles)`);
    }
  }

  const txtPath = path.join(ARTIFACTS_DIR, 'mapping-report.txt');
  const lines: string[] = [
    '════════════════════════════════════════════════════════════════',
    '  RN STYLE MAPPING VERIFICATION REPORT',
    '════════════════════════════════════════════════════════════════',
    `  Generated: ${new Date().toLocaleString()}`,
    `  Widgets:   ${results.length}`,
    '',
  ];

  let totalVerified = 0, totalUnverified = 0, totalInvalid = 0, totalUnmapped = 0, totalMissing = 0;

  for (const r of results) {
    totalVerified   += r.verified.length;
    totalUnverified += r.unverified.length;
    totalInvalid    += r.invalid.length;
    totalUnmapped   += r.unmapped.length;
    totalMissing    += r.missingFromSlots.length;

    const hasIssues = r.unverified.length > 0 || r.invalid.length > 0 || r.unmapped.length > 0 || r.missingFromSlots.length > 0 || r.error;
    if (!hasIssues) continue;

    lines.push('────────────────────────────────────────────────────────────────');
    lines.push(`  ${r.widget}${r.error ? ` (ERROR: ${r.error})` : ''}`);
    lines.push(`  Verified: ${r.verified.length} | Unverified: ${r.unverified.length} | Invalid: ${r.invalid.length} | Unmapped: ${r.unmapped.length}`);
    lines.push('────────────────────────────────────────────────────────────────');

    if (r.unverified.length > 0) {
      lines.push('  UNVERIFIED MAPPINGS (path exists but no --wm- trace confirmation):');
      for (const uv of r.unverified) {
        lines.push(`    ❓ ${uv.tokenType} > ${uv.property} → ${uv.mappedPath}`);
        lines.push(`       Resolved value: ${JSON.stringify(uv.resolvedValue)}`);
      }
      lines.push('');
    }

    if (r.invalid.length > 0) {
      lines.push('  INVALID MAPPINGS:');
      for (const inv of r.invalid) {
        lines.push(`    ❌ ${inv.tokenType} > ${inv.property} → ${inv.mappedPath}`);
        lines.push(`       Reason: ${inv.reason}`);
        appendSuggestions(lines, inv);
      }
      lines.push('');
    }

    if (r.unmapped.length > 0) {
      lines.push('  UNMAPPED / NEEDS MAPPING:');
      for (const un of r.unmapped) {
        lines.push(`    ⚠️  ${un.tokenType} > ${un.property} → ${un.mappedPath}`);
        lines.push(`       Reason: ${un.reason}`);
        appendSuggestions(lines, un);
      }
      lines.push('');
    }

    if (r.missingFromSlots.length > 0) {
      lines.push('  MISSING FROM TOKEN SLOTS (found in --wm- trace but not in widget-token-slots.json):');
      for (const m of r.missingFromSlots) {
        const valStr = m.resolvedValue !== undefined ? ` = ${JSON.stringify(m.resolvedValue)}` : '';
        lines.push(`    🆕 ${m.cssVar} → ${m.fullPath} (${m.rnProperty})${valStr}`);
      }
      lines.push('');
    }
  }

  lines.push('════════════════════════════════════════════════════════════════');
  lines.push('  SUMMARY');
  lines.push('════════════════════════════════════════════════════════════════');
  lines.push(`  Verified (trace-confirmed):  ${totalVerified}`);
  lines.push(`  Unverified (path exists):    ${totalUnverified}`);
  lines.push(`  Invalid mappings:            ${totalInvalid}`);
  lines.push(`  Unmapped:                    ${totalUnmapped}`);
  lines.push(`  Missing from slots:          ${totalMissing}`);
  lines.push(`  Total properties:            ${totalVerified + totalUnverified + totalInvalid + totalUnmapped}`);
  lines.push('');

  const widgetsWithUnmapped = results.filter(r => r.unmapped.length > 0);
  if (widgetsWithUnmapped.length > 0) {
    lines.push('────────────────────────────────────────────────────────────────');
    lines.push('  UNMAPPED TOKENS PER WIDGET (for review)');
    lines.push('────────────────────────────────────────────────────────────────');
    for (const r of widgetsWithUnmapped) {
      lines.push(`\n  ${r.widget} (${r.unmapped.length} unmapped):`);
      for (const un of r.unmapped) lines.push(`    - ${un.tokenType} > ${un.property}`);
    }
    lines.push('');
  }

  const needsAttention = results.filter(r => r.invalid.length > 0 || r.unmapped.length > 0);
  if (needsAttention.length > 0) {
    lines.push('────────────────────────────────────────────────────────────────');
    lines.push('  AVAILABLE STYLE NAMESPACES (top-level keys in styles object)');
    lines.push('────────────────────────────────────────────────────────────────');
    for (const r of needsAttention) {
      const stylesPath = path.join(ARTIFACTS_DIR, `${r.widget}.styles.json`);
      if (fs.existsSync(stylesPath)) {
        const styles = JSON.parse(fs.readFileSync(stylesPath, 'utf-8'));
        lines.push(`  ${r.widget}: ${Object.keys(styles).join(', ')}`);
      }
    }
  }

  fs.writeFileSync(txtPath, lines.join('\n'));
  console.log(`📄 Text report: ${txtPath}`);

  console.log('\n📊 SUMMARY:');
  console.log(`   ✅ Verified:         ${totalVerified}`);
  console.log(`   ❓ Unverified:       ${totalUnverified}`);
  console.log(`   ❌ Invalid:          ${totalInvalid}`);
  console.log(`   ⚠️  Unmapped:        ${totalUnmapped}`);
  console.log(`   🆕 Missing slots:   ${totalMissing}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
