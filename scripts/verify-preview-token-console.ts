/**
 * verify-preview-token-console.ts
 *
 * Opens RN preview per widget, evaluates wm.App console commands for every
 * generated token-slot test case, and fails when output is empty, {}, or an error.
 *
 * Usage:
 *   npx ts-node scripts/verify-preview-token-console.ts
 *   npx ts-node scripts/verify-preview-token-console.ts --widget accordion
 *   AUTH_METHOD=platformdb npx ts-node scripts/verify-preview-token-console.ts --widget accordion
 *   npx ts-node scripts/verify-preview-token-console.ts --preview-url https://stage-platform.wavemaker.ai/run-xxx/Project_master
 *   npx ts-node scripts/verify-preview-token-console.ts --local-url http://localhost:19009
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { chromium, Page } from '@playwright/test';
import { ENV } from '../src/utils/env';
import { googleBrowserLogin } from '../src/auth/googleAuth';
import { StudioClient } from '../src/api/studioClient';
import { ensureAuthCookies, evaluatePreviewConsoleCommand } from '../src/playwright/helpers';
import { TokenSlotGenerator, TokenSlotTestCase } from '../src/playwright/tokenSlotGenerator';
import { MobileMapper } from '../wdio/utils/mobileMapper';
import { getStudioWidgetNameForVariant } from '../wdio/utils/mobileWidgetVariantCsv';
import { studioWidgetsPropertyAccess } from '../wdio/utils/studioWidgetAccess';
import type { Widget } from '../src/matrix/widgets';

const ARTIFACTS_DIR = path.join(process.cwd(), 'artifacts', 'preview-console-validation');
const CACHE_DIR = path.join(process.cwd(), '.test-cache');
const SLOT_CASES_PATH = path.join(CACHE_DIR, 'slot-test-cases.json');

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

const STATE_AWARE_WIDGETS = [
  'tabbar', 'tabs', 'button', 'checkbox', 'checkboxset', 'wizard', 'carousel',
  'chips', 'formcontrols', 'radioset', 'toggle', 'switch',
];

interface TokenCheckResult {
  variantName: string;
  tokenType: string;
  propertyPath: string;
  tokenRef: string;
  mappedPath: string;
  command: string;
  output: string;
  reason: string;
  /** 'pass-value' = path exists AND value matches token; 'pass-path' = path exists but value unresolvable or mismatched; 'fail' = no output/error */
  status: 'pass-value' | 'pass-path' | 'fail';
  expectedValue: string | null;
}

interface WidgetReport {
  widget: string;
  pageUrl: string;
  total: number;
  passValue: number;
  passPath: number;
  fail: number;
  error?: string;
  failures: TokenCheckResult[];
  valueMismatches: TokenCheckResult[];
}

interface ReportPayload {
  generatedAt: string;
  previewUrl: string;
  summary: {
    widgets: number;
    tokens: number;
    passValue: number;
    passPath: number;
    fail: number;
  };
  widgets: WidgetReport[];
}

// ---------------------------------------------------------------------------
// Token value resolution
// ---------------------------------------------------------------------------

let _tokenMap: Record<string, string> | null = null;

function getTokenMap(): Record<string, string> {
  if (_tokenMap) return _tokenMap;
  try {
    const { loadGlobalTokenMap } = require('../src/playwright/globalTokenLoader');
    _tokenMap = loadGlobalTokenMap();
  } catch {
    _tokenMap = {};
  }
  return _tokenMap!;
}

/**
 * Walks the batch payload tree and builds a map:
 *   `${state}:${propertyPath}` → tokenRef
 *
 * Structure expected:
 *   payload["form-controls"].mapping.<prop>.value         → default state
 *   payload["form-controls"].mapping.states.<state>.<prop>.value → named state
 */
function buildBatchPayloadMap(widget: string): Map<string, string> {
  const map = new Map<string, string>();
  const cacheDir = path.join(process.cwd(), '.test-cache');
  const candidates = [
    path.join(cacheDir, `batch-payload-${widget}.json`),
    path.join(cacheDir, `batch-payload-${widget.replace('formcontrols', 'form-controls')}.json`),
  ];

  let payload: any = null;
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      payload = JSON.parse(fs.readFileSync(p, 'utf-8'));
      break;
    }
  }
  if (!payload) return map;

  // Normalise widget key: formcontrols → form-controls
  const widgetKey = widget === 'formcontrols' ? 'form-controls' : widget;
  const mapping = payload[widgetKey]?.mapping;
  if (!mapping) return map;

  function walk(obj: any, propPath: string[], state: string) {
    if (!obj || typeof obj !== 'object') return;
    if ('value' in obj && typeof obj.value === 'string') {
      map.set(`${state}:${propPath.join('.')}`, obj.value);
      return;
    }
    for (const [key, val] of Object.entries(obj)) {
      if (key === 'states') {
        // Recurse into each named state
        for (const [stateName, stateObj] of Object.entries(val as any)) {
          walk(stateObj, [], stateName);
        }
      } else {
        walk(val, [...propPath, key], state);
      }
    }
  }

  walk(mapping, [], 'default');
  return map;
}

// Module-level batch payload maps (populated per widget in main())
const _batchPayloadMaps = new Map<string, Map<string, string>>();

function getBatchPayloadTokenRef(widget: string, state: string, propertyPath: string): string | null {
  if (!_batchPayloadMaps.has(widget)) {
    _batchPayloadMaps.set(widget, buildBatchPayloadMap(widget));
  }
  return _batchPayloadMaps.get(widget)!.get(`${state}:${propertyPath}`) ?? null;
}

/**
 * Resolves a token reference like "{border.width.1.value}" to its CSS value "1px",
 * then normalises it to the RN primitive that the console would return.
 *
 * RN normalisation rules:
 *   "16px"  → 16          (numeric dimensions — strip 'px')
 *   "1px"   → 1
 *   "#fff"  → "#fff"      (colours — kept as-is, lowercased)
 *   "Roboto"→ "Roboto"    (font families — kept as-is)
 *   "500"   → 500         (numeric font-weights)
 *   "bold"  → "bold"      (string font-weights — kept as-is)
 */
function resolveTokenValue(tokenRef: string): string | null {
  const map = getTokenMap();
  const raw = map[tokenRef];
  if (raw == null) return null;

  // Strip 'px' suffix → number
  const pxMatch = raw.match(/^([\d.]+)px$/);
  if (pxMatch) return String(parseFloat(pxMatch[1]));

  // Pure number string → keep as number string
  if (/^[\d.]+$/.test(raw)) return raw;

  // Hex colours — lowercase for comparison
  if (/^#[0-9a-fA-F]{3,8}$/.test(raw)) return raw.toLowerCase();

  // Everything else (named colour, font string, etc.) — return as-is
  return raw;
}

/**
 * Normalise a console output value for comparison against a resolved token.
 * RN returns numbers as bare numbers (e.g. 16), colours as lowercase hex.
 */
function normaliseActual(output: string): string {
  const trimmed = output.trim();
  // Hex colour — lowercase
  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) return trimmed.toLowerCase();
  return trimmed;
}

function valuesMatch(actual: string, expected: string): boolean {
  const a = normaliseActual(actual);
  const e = expected.trim();
  if (a === e) return true;

  // Numeric comparison (e.g. "16" vs 16)
  const na = parseFloat(a);
  const ne = parseFloat(e);
  if (!isNaN(na) && !isNaN(ne) && na === ne) return true;

  // Short hex expansion: #fff → #ffffff
  const expandHex = (h: string) => {
    const m = h.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
    return m ? `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`.toLowerCase() : h.toLowerCase();
  };
  if (expandHex(a) === expandHex(e)) return true;

  return false;
}

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

function parseWidgetFilters(raw?: string | null): string[] | undefined {
  if (!raw) return undefined;
  const widgets = raw.split(',').map(widget => widget.trim()).filter(Boolean);
  return widgets.length > 0 ? widgets : undefined;
}

function loadTestCases(widgetFilters?: string[]): TokenSlotTestCase[] {
  if (fs.existsSync(SLOT_CASES_PATH)) {
    const all = JSON.parse(fs.readFileSync(SLOT_CASES_PATH, 'utf-8')) as TokenSlotTestCase[];
    return widgetFilters ? all.filter(tc => widgetFilters.includes(tc.widget)) : all;
  }

  const { loadGlobalTokenMap } = require('../src/playwright/globalTokenLoader');
  const tokenMap = loadGlobalTokenMap();
  const generator = new TokenSlotGenerator();
  return generator.generateAllTestCases(tokenMap, widgetFilters);
}

function buildPreviewConsoleCommand(testCase: TokenSlotTestCase): { command: string; mappedPath: string } {
  const { widget, appearance, variant, state, propertyPath } = testCase;
  const variantName = `${widget}-${appearance}-${variant}-${state}`;
  const studioWidgetName = getStudioWidgetNameForVariant(widget, variantName) || `${widget}1`;
  const stylesKey = widget === 'cards' ? 'calcStyles' : 'styles';
  const effectivePropertyPath = (state !== 'default' && STATE_AWARE_WIDGETS.includes(widget))
    ? ['states', state, ...propertyPath]
    : propertyPath;
  const mappedPath = MobileMapper.mapToRnStylePath(effectivePropertyPath, widget, 'android');
  const formFieldKey = variantName.endsWith('-disabled') ? 'custom' : 'entestkey';

  let command: string;
  if (widget === 'cards') {
    command = `wm.App.appConfig.currentPage.Widgets.supportedLocaleList1.itemWidgets[0].card1._INSTANCE.${stylesKey}.${mappedPath}`;
  } else if (widget === 'formcontrols') {
    command = `wm.App.appConfig.currentPage.Widgets.supportedLocaleForm1.formWidgets.${formFieldKey}._INSTANCE.styles.${mappedPath}`;
  } else {
    command = `wm.App.appConfig.currentPage.Widgets${studioWidgetsPropertyAccess(studioWidgetName)}._INSTANCE.${stylesKey}.${mappedPath}`;
  }

  return { command, mappedPath };
}

function classifyOutput(
  raw: string | null,
  tokenRef: string,
  widget: string,
  state: string,
  propertyPath: string,
): { status: 'pass-value' | 'pass-path' | 'fail'; reason: string; output: string; expectedValue: string | null } {
  // Use the batch-payload applied token as expected — only if that slot was actually applied.
  // If not in the batch payload, we can only verify the path exists, not the value.
  const appliedTokenRef = getBatchPayloadTokenRef(widget, state, propertyPath);
  const expectedValue = appliedTokenRef ? resolveTokenValue(appliedTokenRef) : null;

  if (raw == null) {
    return { status: 'fail', reason: 'No console output', output: '', expectedValue };
  }

  const output = raw.trim();
  if (!output) {
    return { status: 'fail', reason: 'Empty console output', output: raw, expectedValue };
  }
  if (output.startsWith('CONSOLE_ERROR:')) {
    return { status: 'fail', reason: output.replace(/^CONSOLE_ERROR:\s*/, ''), output, expectedValue };
  }
  if (output === '{}' || output === '[]') {
    return { status: 'fail', reason: 'Empty object/array output', output, expectedValue };
  }

  try {
    const parsed = JSON.parse(output);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).length === 0) {
      return { status: 'fail', reason: 'Empty object output', output, expectedValue };
    }
    if (Array.isArray(parsed) && parsed.length === 0) {
      return { status: 'fail', reason: 'Empty array output', output, expectedValue };
    }
  } catch {
    // Primitive values are valid.
  }

  // Path exists — now check value
  if (expectedValue !== null && valuesMatch(output, expectedValue)) {
    return { status: 'pass-value', reason: '', output, expectedValue };
  }

  const reason = appliedTokenRef === null
    ? 'Not in batch payload — path exists, value not verified'
    : expectedValue === null
      ? `Applied token ${appliedTokenRef} not in token map — path exists`
      : `Value mismatch — expected: ${expectedValue} (from ${appliedTokenRef})`;
  return { status: 'pass-path', reason, output, expectedValue };
}

async function navigateToPreview(
  page: Page,
  widget: string,
  basePreviewUrl: string,
  cookie: string,
  isLocal: boolean,
): Promise<string> {
  const pageName = resolvePageName(widget);
  const trimmed = basePreviewUrl.replace(/\/$/, '');
  const finalUrl = isLocal
    ? `${trimmed}/rn-bundle/index.html#/${pageName}`
    : `${trimmed}/rn-bundle/#/${pageName}`;

  if (!isLocal && cookie) {
    await ensureAuthCookies(page, finalUrl, cookie);
  }

  await page.goto(finalUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

  try {
    await page.waitForLoadState('networkidle', { timeout: 20000 });
  } catch {
    // Best effort.
  }

  const mainPageWidgets = ['navbar', 'tabbar'];
  const isMainPage = mainPageWidgets.includes(widget);
  const loadedSelector = isMainPage
    ? "//h1[normalize-space()='MainPage']"
    : "//div[@aria-label='mobile_navbar1_backbtn_icon']";

  try {
    await page.waitForSelector(loadedSelector, { state: 'visible', timeout: 60000 });
  } catch {
    console.log(`  ⚠️  Preview load marker not visible for ${widget}, continuing`);
  }

  return finalUrl;
}

async function login(cookieRequired: boolean, headless: boolean): Promise<string> {
  if (!cookieRequired) return '';

  if (ENV.authMethod === 'platformdb') {
    console.log('🔐 Performing Platform DB login...');
    const client = new StudioClient({ baseUrl: ENV.studioBaseUrl, projectId: ENV.projectId });
    const cookie = await client.loginWithPlatformDB(ENV.studioUsername, ENV.studioPassword);
    console.log(`🔐 Login successful (cookie length: ${cookie.length})`);
    return cookie;
  }

  if (ENV.authMethod === 'wavemaker') {
    console.log('🔐 Performing WaveMaker form login...');
    const client = new StudioClient({ baseUrl: ENV.studioBaseUrl, projectId: ENV.projectId });
    const cookie = await client.login(ENV.studioUsername, ENV.studioPassword);
    console.log(`🔐 Login successful (cookie length: ${cookie.length})`);
    return cookie;
  }

  console.log('🔐 Performing Google login...');
  const authResult = await googleBrowserLogin({ headless });
  const cookie = authResult.cookieHeader;
  console.log(`🔐 Login successful (cookie length: ${cookie.length})`);
  return cookie;
}

function groupByWidget(testCases: TokenSlotTestCase[]): Map<string, TokenSlotTestCase[]> {
  const grouped = new Map<string, TokenSlotTestCase[]>();
  for (const testCase of testCases) {
    const list = grouped.get(testCase.widget) || [];
    list.push(testCase);
    grouped.set(testCase.widget, list);
  }
  return grouped;
}

function generateTextReport(payload: ReportPayload): string {
  const lines: string[] = [
    '════════════════════════════════════════════════════════════════',
    '  PREVIEW TOKEN CONSOLE VALIDATION REPORT',
    '════════════════════════════════════════════════════════════════',
    `  Generated:    ${payload.generatedAt}`,
    `  Preview:      ${payload.previewUrl}`,
    `  Widgets:      ${payload.summary.widgets}`,
    `  Tokens:       ${payload.summary.tokens}`,
    `  ✅ Value match: ${payload.summary.passValue}`,
    `  ⚠️  Path only:   ${payload.summary.passPath}  (path exists but value differs from token)`,
    `  ❌ No output:   ${payload.summary.fail}  (mapped path not found in RN styles)`,
    '',
  ];

  for (const widgetReport of payload.widgets) {
    lines.push('────────────────────────────────────────────────────────────────');
    lines.push(`  ${widgetReport.widget.toUpperCase()}`);
    lines.push(`  ✅ ${widgetReport.passValue} value match  ⚠️  ${widgetReport.passPath} path-only  ❌ ${widgetReport.fail} no output  (${widgetReport.total} total)`);
    lines.push(`  Page: ${widgetReport.pageUrl}`);
    if (widgetReport.error) {
      lines.push(`  Error: ${widgetReport.error}`);
    }
    lines.push('────────────────────────────────────────────────────────────────');

    if (widgetReport.failures.length === 0 && widgetReport.valueMismatches.length === 0) {
      lines.push('  ✅ All token paths exist and values match applied tokens');
      lines.push('');
      continue;
    }

    if (widgetReport.failures.length > 0) {
      lines.push('  ── NO OUTPUT (path not found in RN styles) ──');
      for (const r of widgetReport.failures) {
        lines.push(`  ❌ ${r.propertyPath} @ ${r.variantName}`);
        lines.push(`     token:    ${r.tokenRef}`);
        lines.push(`     mapped:   ${r.mappedPath}`);
        lines.push(`     reason:   ${r.reason}`);
        lines.push(`     command:  ${r.command}`);
        lines.push('');
      }
    }

    if (widgetReport.valueMismatches.length > 0) {
      lines.push('  ── VALUE MISMATCH (path exists, but value differs) ──');
      for (const r of widgetReport.valueMismatches) {
        lines.push(`  ⚠️  ${r.propertyPath} @ ${r.variantName}`);
        lines.push(`     token:    ${r.tokenRef}`);
        lines.push(`     expected: ${r.expectedValue ?? '(unresolvable)'}`);
        lines.push(`     actual:   ${r.output}`);
        lines.push(`     mapped:   ${r.mappedPath}`);
        lines.push(`     reason:   ${r.reason}`);
        lines.push(`     command:  ${r.command}`);
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

function generateHtmlReport(payload: ReportPayload): string {
  const templatePath = path.join(__dirname, 'preview-console-report.template.html');
  let template = fs.readFileSync(templatePath, 'utf-8');
  template = template.replace('__REPORT_DATA__', JSON.stringify(payload));
  template = template.replace('__PREVIEW_URL__', payload.previewUrl);
  template = template.replace('__GENERATED_AT__', payload.generatedAt);
  return template;
}

async function applyBatchPayload(widgetFilters: string[] | null | undefined): Promise<void> {
  const CACHE_DIR_APPLY = path.join(process.cwd(), '.test-cache');
  const candidates = widgetFilters ?? ['formcontrols'];

  for (const widget of candidates) {
    const keyVariants = [widget, widget.replace('formcontrols', 'form-controls')];
    let payload: any = null;
    let payloadPath = '';

    for (const key of keyVariants) {
      const p = path.join(CACHE_DIR_APPLY, `batch-payload-${key}.json`);
      if (fs.existsSync(p)) {
        payload = JSON.parse(fs.readFileSync(p, 'utf-8'));
        payloadPath = p;
        break;
      }
    }

    if (!payload) {
      console.warn(`  ⚠️  No batch payload found for "${widget}" — skipping (run mobile global setup first)`);
      continue;
    }

    console.log(`\n📤 Applying batch payload for "${widget}" from ${path.relative(process.cwd(), payloadPath)}`);
    const componentKey = widget === 'formcontrols' ? 'form-controls' : widget;
    const client = new StudioClient({ baseUrl: ENV.studioBaseUrl, projectId: ENV.projectId });
    const cookie = await client.loginWithPlatformDB(ENV.studioUsername, ENV.studioPassword);
    const authedClient = new StudioClient({ baseUrl: ENV.studioBaseUrl, projectId: ENV.projectId, cookie });
    await authedClient.updateComponentOverride(componentKey, payload);
    console.log(`  ✅ Payload applied → component: ${componentKey}`);
    console.log('  ⏳ Waiting 8s for propagation...');
    await new Promise(r => setTimeout(r, 8000));
  }
}

async function main() {
  const args = process.argv.slice(2);
  const widgetFilterArg = args.includes('--widget') ? args[args.indexOf('--widget') + 1] : null;
  const widgetFilters = parseWidgetFilters(widgetFilterArg);
  const headless = args.includes('--headless');
  const previewUrlArg = args.includes('--preview-url') ? args[args.indexOf('--preview-url') + 1] : null;
  const localUrlArg = args.includes('--local-url') ? args[args.indexOf('--local-url') + 1] : null;
  const isLocal = !!(localUrlArg || (previewUrlArg && isLocalUrl(previewUrlArg)));
  const applyTokens = args.includes('--apply');

  if (!isLocal) {
    ENV.validate();
  }

  // ── Optional: Apply batch payload before verifying ────────────────────
  if (applyTokens) {
    console.log('\n🔐 --apply flag detected: applying batch payload to studio...');
    await applyBatchPayload(widgetFilters);
    console.log('  ✅ Token apply complete\n');
  }

  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }

  const testCases = loadTestCases(widgetFilters);
  if (testCases.length === 0) {
    if (widgetFilters?.length) {
      console.error(`❌ No token slot test cases found for: ${widgetFilters.join(', ')}`);
    } else {
      console.error('❌ No token slot test cases found.');
    }
    console.error('   Run `npm run generate:slot-tests` first, or check widget names.');
    process.exit(1);
  }

  const grouped = groupByWidget(testCases);
  console.log(`\n📋 Token console checks: ${testCases.length} across ${grouped.size} widget(s)`);

  const cookie = await login(!isLocal, headless);
  if (!isLocal && cookie) {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(path.join(CACHE_DIR, 'auth-cookie.txt'), cookie);
    process.env.STUDIO_COOKIE = cookie;
  }

  let previewUrl = localUrlArg || previewUrlArg;
  if (!previewUrl) {
    const client = new StudioClient({
      baseUrl: ENV.studioBaseUrl,
      projectId: ENV.projectId,
      cookie,
    });

    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log(`🚀 Triggering in-place deploy (attempt ${attempt}/3)...`);
      previewUrl = (await client.inplaceDeploy()) ?? null;
      if (previewUrl) break;
      await new Promise(r => setTimeout(r, attempt * 10_000));
    }

    if (!previewUrl) {
      console.error('❌ Could not obtain preview deploy URL. Pass --preview-url or --local-url.');
      process.exit(1);
    }
  }

  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(CACHE_DIR, 'preview-url.json'),
    JSON.stringify({ previewUrl, timestamp: new Date().toISOString() }),
  );

  console.log(`✅ Preview base URL: ${previewUrl}`);

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });

  const widgetReports: WidgetReport[] = [];

  for (const [widget, widgetCases] of grouped.entries()) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  Widget: ${widget} (${widgetCases.length} tokens)`);
    console.log(`${'═'.repeat(60)}`);

    const page = await context.newPage();
    const failures: TokenCheckResult[] = [];
    const valueMismatches: TokenCheckResult[] = [];
    let passValue = 0;
    let passPath = 0;
    let pageUrl = '';

    try {
      pageUrl = await navigateToPreview(page, widget, previewUrl, cookie, isLocal);
      console.log(`  🌐 ${pageUrl}`);

      for (const testCase of widgetCases) {
        const variantName = `${testCase.widget}-${testCase.appearance}-${testCase.variant}-${testCase.state}`;
        const { command, mappedPath } = buildPreviewConsoleCommand(testCase);
        const raw = await evaluatePreviewConsoleCommand(page, command, {
          maxWaitMs: 8000,
          pollIntervalMs: 500,
        });
        const verdict = classifyOutput(raw, testCase.tokenRef, testCase.widget, testCase.state, testCase.propertyPath.join('.'));
        const result: TokenCheckResult = {
          variantName,
          tokenType: testCase.tokenType,
          propertyPath: testCase.propertyPath.join('.'),
          tokenRef: testCase.tokenRef,
          mappedPath,
          command,
          output: verdict.output,
          reason: verdict.reason,
          status: verdict.status,
          expectedValue: verdict.expectedValue,
        };

        if (verdict.status === 'pass-value') {
          passValue += 1;
          console.log(`  ✅ ${result.propertyPath} @ ${variantName} → ${verdict.output} (expected: ${verdict.expectedValue})`);
        } else if (verdict.status === 'pass-path') {
          passPath += 1;
          valueMismatches.push(result);
          console.log(`  ⚠️  ${result.propertyPath} @ ${variantName} → ${verdict.output} (expected: ${verdict.expectedValue ?? 'unresolvable'})`);
        } else {
          failures.push(result);
          console.log(`  ❌ ${result.propertyPath} @ ${variantName} → ${result.reason}`);
        }
      }
    } catch (err: any) {
      const message = err?.message || String(err);
      console.log(`  ❌ Widget run failed: ${message}`);
      widgetReports.push({
        widget,
        pageUrl,
        total: widgetCases.length,
        passValue,
        passPath,
        fail: widgetCases.length - passValue - passPath,
        error: message,
        failures,
        valueMismatches,
      });
      await page.close();
      continue;
    }

    widgetReports.push({
      widget,
      pageUrl,
      total: widgetCases.length,
      passValue,
      passPath,
      fail: failures.length,
      failures,
      valueMismatches,
    });

    console.log(`  📊 ✅ Value match: ${passValue}  ⚠️  Path only: ${passPath}  ❌ No output: ${failures.length}  (of ${widgetCases.length})`);
    await page.close();
  }

  await browser.close();

  const payload: ReportPayload = {
    generatedAt: new Date().toLocaleString(),
    previewUrl,
    summary: {
      widgets: widgetReports.length,
      tokens: testCases.length,
      passValue: widgetReports.reduce((sum, w) => sum + w.passValue, 0),
      passPath: widgetReports.reduce((sum, w) => sum + w.passPath, 0),
      fail: widgetReports.reduce((sum, w) => sum + w.fail, 0),
    },
    widgets: widgetReports.sort((a, b) => a.widget.localeCompare(b.widget)),
  };

  const jsonPath = path.join(ARTIFACTS_DIR, 'preview-console-report.json');
  const txtPath = path.join(ARTIFACTS_DIR, 'preview-console-report.txt');
  const htmlPath = path.join(ARTIFACTS_DIR, 'preview-console-report.html');

  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2));
  fs.writeFileSync(txtPath, generateTextReport(payload));
  fs.writeFileSync(htmlPath, generateHtmlReport(payload));

  console.log('\n📄 Reports:');
  console.log(`   ${path.relative(process.cwd(), jsonPath)}`);
  console.log(`   ${path.relative(process.cwd(), txtPath)}`);
  console.log(`   ${path.relative(process.cwd(), htmlPath)}`);
  console.log(`\n📊 SUMMARY: ✅ Value match: ${payload.summary.passValue}  ⚠️  Path only: ${payload.summary.passPath}  ❌ No output: ${payload.summary.fail}`);

  if (payload.summary.fail > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('\n❌ Preview token console verification failed:', error);
    process.exit(1);
  });
}
