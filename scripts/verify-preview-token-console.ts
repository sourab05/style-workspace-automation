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
  status: 'pass' | 'fail';
}

interface WidgetReport {
  widget: string;
  pageUrl: string;
  total: number;
  pass: number;
  fail: number;
  error?: string;
  failures: TokenCheckResult[];
}

interface ReportPayload {
  generatedAt: string;
  previewUrl: string;
  summary: {
    widgets: number;
    tokens: number;
    pass: number;
    fail: number;
  };
  widgets: WidgetReport[];
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
  const stylesKey = (widget === 'cards' || widget === 'formcontrols') ? 'calcStyles' : 'styles';
  const effectivePropertyPath = (state !== 'default' && STATE_AWARE_WIDGETS.includes(widget))
    ? ['states', state, ...propertyPath]
    : propertyPath;
  const mappedPath = MobileMapper.mapToRnStylePath(effectivePropertyPath, widget, 'android');
  const formFieldKey = variantName.endsWith('-disabled') ? 'custom' : 'entestkey';

  let command: string;
  if (widget === 'cards') {
    command = `wm.App.appConfig.currentPage.Widgets.supportedLocaleList1.itemWidgets[0].card1._INSTANCE.${stylesKey}.${mappedPath}`;
  } else if (widget === 'formcontrols') {
    command = `wm.App.appConfig.currentPage.Widgets.supportedLocaleForm1.formWidgets.${formFieldKey}.${stylesKey}.${mappedPath}`;
  } else {
    command = `wm.App.appConfig.currentPage.Widgets${studioWidgetsPropertyAccess(studioWidgetName)}._INSTANCE.${stylesKey}.${mappedPath}`;
  }

  return { command, mappedPath };
}

function classifyOutput(raw: string | null): { status: 'pass' | 'fail'; reason: string; output: string } {
  if (raw == null) {
    return { status: 'fail', reason: 'No console output', output: '' };
  }

  const output = raw.trim();
  if (!output) {
    return { status: 'fail', reason: 'Empty console output', output: raw };
  }
  if (output.startsWith('CONSOLE_ERROR:')) {
    return { status: 'fail', reason: output.replace(/^CONSOLE_ERROR:\s*/, ''), output };
  }
  if (output === '{}' || output === '[]') {
    return { status: 'fail', reason: 'Empty object/array output', output };
  }

  try {
    const parsed = JSON.parse(output);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).length === 0) {
      return { status: 'fail', reason: 'Empty object output', output };
    }
    if (Array.isArray(parsed) && parsed.length === 0) {
      return { status: 'fail', reason: 'Empty array output', output };
    }
  } catch {
    // Primitive values are valid.
  }

  return { status: 'pass', reason: '', output };
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
    `  Generated: ${payload.generatedAt}`,
    `  Preview:   ${payload.previewUrl}`,
    `  Widgets:   ${payload.summary.widgets}`,
    `  Tokens:    ${payload.summary.tokens}`,
    `  Pass:      ${payload.summary.pass}`,
    `  Fail:      ${payload.summary.fail}`,
    '',
  ];

  for (const widgetReport of payload.widgets) {
    lines.push('────────────────────────────────────────────────────────────────');
    lines.push(`  ${widgetReport.widget.toUpperCase()}  (${widgetReport.fail} failures / ${widgetReport.total} tokens)`);
    lines.push(`  Page: ${widgetReport.pageUrl}`);
    if (widgetReport.error) {
      lines.push(`  Error: ${widgetReport.error}`);
    }
    lines.push('────────────────────────────────────────────────────────────────');

    if (widgetReport.failures.length === 0) {
      lines.push('  ✅ All token console commands returned values');
      lines.push('');
      continue;
    }

    for (const failure of widgetReport.failures) {
      lines.push(`  ❌ ${failure.propertyPath} @ ${failure.variantName}`);
      lines.push(`     token:   ${failure.tokenRef}`);
      lines.push(`     mapped:  ${failure.mappedPath}`);
      lines.push(`     reason:  ${failure.reason}`);
      lines.push(`     output:  ${failure.output || '(empty)'}`);
      lines.push(`     command: ${failure.command}`);
      lines.push('');
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

async function main() {
  const args = process.argv.slice(2);
  const widgetFilterArg = args.includes('--widget') ? args[args.indexOf('--widget') + 1] : null;
  const widgetFilters = parseWidgetFilters(widgetFilterArg);
  const headless = args.includes('--headless');
  const previewUrlArg = args.includes('--preview-url') ? args[args.indexOf('--preview-url') + 1] : null;
  const localUrlArg = args.includes('--local-url') ? args[args.indexOf('--local-url') + 1] : null;
  const isLocal = !!(localUrlArg || (previewUrlArg && isLocalUrl(previewUrlArg)));

  if (!isLocal) {
    ENV.validate();
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
    let pass = 0;
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
        const verdict = classifyOutput(raw);
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
        };

        if (verdict.status === 'pass') {
          pass += 1;
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
        pass,
        fail: widgetCases.length - pass,
        error: message,
        failures,
      });
      await page.close();
      continue;
    }

    widgetReports.push({
      widget,
      pageUrl,
      total: widgetCases.length,
      pass,
      fail: failures.length,
      failures,
    });

    console.log(`  📊 ${pass}/${widgetCases.length} passed, ${failures.length} failed`);
    await page.close();
  }

  await browser.close();

  const payload: ReportPayload = {
    generatedAt: new Date().toLocaleString(),
    previewUrl,
    summary: {
      widgets: widgetReports.length,
      tokens: testCases.length,
      pass: widgetReports.reduce((sum, w) => sum + w.pass, 0),
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
  console.log(`\n📊 SUMMARY: ${payload.summary.pass} passed, ${payload.summary.fail} failed`);

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
