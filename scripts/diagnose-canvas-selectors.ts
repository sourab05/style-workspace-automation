/**
 * Canvas Selector Diagnostic Script
 *
 * Uses the same login flow as global-setup.ts (StudioScreen.login()),
 * navigates to each widget's canvas page, and evaluates every XPath
 * from widget-xpaths.ts against the live DOM. For failing selectors,
 * it captures surrounding DOM context to identify the correct XPath.
 *
 * Usage:
 *   npx ts-node scripts/diagnose-canvas-selectors.ts
 *
 * Filter to specific widgets:
 *   TEST_WIDGETS=chips,progress-bar npx ts-node scripts/diagnose-canvas-selectors.ts
 */

import 'dotenv/config';
import { chromium, Page, Browser, BrowserContext } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { widgetXPaths } from '../src/matrix/widget-xpaths';
import { ENV } from '../src/utils/env';
import StudioScreen from '../tests/screens/studio.screen';
import { gotoCanvas } from '../src/playwright/helpers';

// ─── Configuration ───────────────────────────────────────────────────────────

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

function resolvePageName(widget: string): string {
  return WIDGET_PAGE_NAME_MAP[widget] || widget;
}

const cacheDir = path.join(process.cwd(), '.test-cache');

// ─── Types ───────────────────────────────────────────────────────────────────

interface XPathResult {
  key: string;
  xpath: string;
  found: boolean;
  tagName?: string;
  classes?: string;
  attributes?: Record<string, string>;
  visible?: boolean;
  boundingBox?: { x: number; y: number; width: number; height: number } | null;
  error?: string;
}

interface WidgetDiagnostic {
  widget: string;
  page: string;
  pageUrl: string;
  pageLoaded: boolean;
  pageError?: string;
  totalSelectors: number;
  found: number;
  missing: number;
  results: XPathResult[];
  domSnapshot?: string;
}

interface DiagnosticReport {
  timestamp: string;
  studioBaseUrl: string;
  projectId: string;
  totalWidgets: number;
  totalSelectors: number;
  totalFound: number;
  totalMissing: number;
  widgets: WidgetDiagnostic[];
}

// ─── Helper: group canvas XPaths by widget ───────────────────────────────────

function groupXPathsByWidget(): Map<string, Record<string, string>> {
  const grouped = new Map<string, Record<string, string>>();

  for (const [key, xpath] of Object.entries(widgetXPaths.canvas)) {
    if (!xpath) continue;
    const widget = resolveWidgetFromKey(key);
    if (!widget) continue;

    if (!grouped.has(widget)) {
      grouped.set(widget, {});
    }
    grouped.get(widget)![key] = xpath as string;
  }

  return grouped;
}

const KNOWN_WIDGETS = [
  'button-group', 'progress-bar', 'progress-circle', 'dropdown-menu',
  'modal-dialog', 'form-wrapper', 'panel-footer', 'formcontrols',
  'button', 'accordion', 'label', 'panel', 'cards', 'navbar',
  'picture', 'carousel', 'tabbar', 'bottomsheet', 'barcodescanner',
  'tabs', 'list', 'chips', 'radioset', 'checkbox', 'checkboxset',
  'toggle', 'switch', 'wizard', 'container', 'tile', 'anchor',
  'icon', 'lottie', 'audio', 'webview', 'message', 'spinner',
  'search', 'popover', 'login', 'calendar', 'slider', 'rating',
  'fileupload', 'currency', 'select', 'camera', 'datetime', 'video',
].sort((a, b) => b.length - a.length);

function resolveWidgetFromKey(key: string): string | null {
  for (const w of KNOWN_WIDGETS) {
    if (key.startsWith(w + '-')) return w;
  }
  return null;
}

// ─── Helper: evaluate a single XPath in the page ─────────────────────────────

async function evaluateXPath(page: Page, xpath: string): Promise<{
  found: boolean;
  tagName?: string;
  classes?: string;
  attributes?: Record<string, string>;
  visible?: boolean;
  boundingBox?: { x: number; y: number; width: number; height: number } | null;
}> {
  const prefixed = xpath.startsWith('xpath=') ? xpath : `xpath=${xpath}`;

  try {
    const locator = page.locator(prefixed);
    const count = await locator.count();

    if (count === 0) {
      return { found: false };
    }

    const first = locator.first();
    const isVisible = await first.isVisible().catch(() => false);

    const info = await first.evaluate((el) => {
      const attrs: Record<string, string> = {};
      for (const attr of el.attributes) {
        if (['name', 'widgettype', 'variant', 'disabled', 'type',
             'aria-checked', 'aria-label', 'role'].includes(attr.name)) {
          attrs[attr.name] = attr.value;
        }
      }
      return {
        tagName: el.tagName.toLowerCase(),
        classes: el.className?.toString() || '',
        attributes: attrs,
      };
    }).catch(() => ({ tagName: 'unknown', classes: '', attributes: {} }));

    const bbox = await first.boundingBox().catch(() => null);

    return {
      found: true,
      tagName: info.tagName,
      classes: info.classes,
      attributes: info.attributes,
      visible: isVisible,
      boundingBox: bbox,
    };
  } catch {
    return { found: false };
  }
}

// ─── Helper: capture DOM context for a widget root ───────────────────────────

async function captureDomSnapshot(page: Page, widget: string): Promise<string> {
  const testdataPath = path.join(__dirname, '..', 'tests', 'testdata', 'data.json');
  const data = JSON.parse(fs.readFileSync(testdataPath, 'utf-8'));
  const rootSelector = data.style.canvasSelectors[widget];

  if (!rootSelector) return `[No root selector in data.json for '${widget}']`;

  try {
    const prefixed = rootSelector.startsWith('xpath=') ? rootSelector : `xpath=${rootSelector}`;
    const locator = page.locator(prefixed).first();
    const count = await page.locator(prefixed).count();

    if (count === 0) {
      return await page.evaluate(() => {
        function summarize(el: Element, depth: number, maxDepth: number): string {
          if (depth > maxDepth) return '';
          const tag = el.tagName.toLowerCase();
          const attrs: string[] = [];
          for (const a of ['name', 'widgettype', 'class', 'id', 'variant']) {
            const v = el.getAttribute(a);
            if (v) attrs.push(`${a}="${v.substring(0, 80)}"`);
          }
          const attrStr = attrs.length ? ' ' + attrs.join(' ') : '';
          const children = Array.from(el.children)
            .map(c => summarize(c, depth + 1, maxDepth))
            .filter(Boolean)
            .join('\n');
          const indent = '  '.repeat(depth);
          if (children) {
            return `${indent}<${tag}${attrStr}>\n${children}\n${indent}</${tag}>`;
          }
          return `${indent}<${tag}${attrStr} />`;
        }

        const widgets = document.body.querySelectorAll(
          '[widgettype], [name], [wmdialog], [wmlogin], [wmprogressbar], [wmprogresscircle], [wmpopover], [wmmenu], [wmfileupload]'
        );
        if (widgets.length === 0) return '[No widget elements found in body]';

        return Array.from(widgets).slice(0, 30).map(w => summarize(w, 0, 3)).join('\n---\n');
      });
    }

    return await locator.evaluate((el) => {
      function summarize(node: Element, depth: number, maxDepth: number): string {
        if (depth > maxDepth) return '  '.repeat(depth) + '...';
        const tag = node.tagName.toLowerCase();
        const attrs: string[] = [];
        for (const a of ['name', 'widgettype', 'class', 'id', 'variant', 'type',
          'disabled', 'aria-checked', 'aria-label', 'role', 'href']) {
          const v = node.getAttribute(a);
          if (v) attrs.push(`${a}="${v.substring(0, 100)}"`);
        }
        const attrStr = attrs.length ? ' ' + attrs.join(' ') : '';
        const children = Array.from(node.children)
          .map(c => summarize(c, depth + 1, maxDepth))
          .filter(Boolean)
          .join('\n');
        const indent = '  '.repeat(depth);
        if (children) {
          return `${indent}<${tag}${attrStr}>\n${children}\n${indent}</${tag}>`;
        }
        return `${indent}<${tag}${attrStr} />`;
      }
      return summarize(el, 0, 5);
    });
  } catch (err: any) {
    return `[Error capturing DOM: ${err.message}]`;
  }
}

// ─── Main Diagnostic Runner ──────────────────────────────────────────────────

async function run() {
  console.log('='.repeat(80));
  console.log('  CANVAS SELECTOR DIAGNOSTIC');
  console.log('='.repeat(80));

  ENV.validate();

  console.log(`  Studio:     ${ENV.studioBaseUrl}`);
  console.log(`  Project ID: ${ENV.projectId}`);
  console.log(`  Timestamp:  ${new Date().toISOString()}`);
  console.log('='.repeat(80));

  const widgetFilter = process.env.TEST_WIDGETS?.split(',').map(w => w.trim()).filter(Boolean);
  const xpathsByWidget = groupXPathsByWidget();

  let widgetsToCheck = Array.from(xpathsByWidget.keys());
  if (widgetFilter) {
    widgetsToCheck = widgetsToCheck.filter(w => widgetFilter.includes(w));
    console.log(`\n  Filtering to widgets: ${widgetsToCheck.join(', ')}`);
  }
  console.log(`\n  Widgets to diagnose: ${widgetsToCheck.length}`);

  // ─── Launch browser exactly like global-setup ──────────────────────────────

  const useGoogle = ENV.isGoogleAuth;
  const browser: Browser = await chromium.launch({
    headless: !useGoogle,
    ...(useGoogle ? {
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-first-run',
        '--no-default-browser-check',
      ],
    } : {}),
  });

  const context: BrowserContext = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    ...(useGoogle ? {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    } : {}),
  });

  const page: Page = await context.newPage();

  // ─── Login using StudioScreen (same as global-setup) ───────────────────────

  console.log('\n  Step 1: Logging into Studio via StudioScreen...');
  const studioScreen = new StudioScreen(page);
  const authCookie = await studioScreen.login();
  console.log('  Logged in successfully');

  // Save auth cookie (same as global-setup)
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  fs.writeFileSync(path.join(cacheDir, 'auth-cookie.txt'), authCookie);
  process.env.STUDIO_COOKIE = authCookie;
  await context.storageState({ path: path.join(cacheDir, 'auth.json') });
  console.log('  Auth cookie cached\n');

  // ─── Run Diagnostics ──────────────────────────────────────────────────────

  const report: DiagnosticReport = {
    timestamp: new Date().toISOString(),
    studioBaseUrl: ENV.studioBaseUrl,
    projectId: ENV.projectId,
    totalWidgets: widgetsToCheck.length,
    totalSelectors: 0,
    totalFound: 0,
    totalMissing: 0,
    widgets: [],
  };

  // Group widgets by page to minimize navigations
  const widgetsByPage = new Map<string, string[]>();
  for (const widget of widgetsToCheck) {
    const pageName = resolvePageName(widget);
    if (!widgetsByPage.has(pageName)) {
      widgetsByPage.set(pageName, []);
    }
    widgetsByPage.get(pageName)!.push(widget);
  }

  for (const [pageName, widgets] of widgetsByPage) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`  Navigating to page: ${pageName} (widgets: ${widgets.join(', ')})`);

    let pageLoaded = false;
    let pageError: string | undefined;
    let pageUrl = '';

    try {
      // Use the same gotoCanvas helper the real tests use
      await gotoCanvas(page, widgets[0]);
      pageUrl = page.url();

      const currentUrl = page.url();
      if (currentUrl.includes('/login') || currentUrl.includes('auth')) {
        pageError = `Redirected to login page: ${currentUrl}`;
        console.log(`  ERROR: ${pageError}`);
      } else {
        pageLoaded = true;
        // Extra settle time for canvas widgets to render
        await page.waitForTimeout(3000);
        console.log(`  Page loaded: ${currentUrl}`);
      }
    } catch (err: any) {
      pageError = err.message;
      pageUrl = page.url();
      console.log(`  ERROR loading page: ${pageError}`);
    }

    for (const widget of widgets) {
      const xpaths = xpathsByWidget.get(widget) || {};
      const xpathEntries = Object.entries(xpaths);

      const diagnostic: WidgetDiagnostic = {
        widget,
        page: pageName,
        pageUrl,
        pageLoaded,
        pageError,
        totalSelectors: xpathEntries.length,
        found: 0,
        missing: 0,
        results: [],
      };

      if (!pageLoaded) {
        for (const [key, xpath] of xpathEntries) {
          diagnostic.results.push({ key, xpath, found: false, error: 'Page did not load' });
          diagnostic.missing++;
        }
      } else {
        console.log(`\n  Checking widget: ${widget} (${xpathEntries.length} selectors)`);

        for (const [key, xpath] of xpathEntries) {
          const result = await evaluateXPath(page, xpath);

          const xpathResult: XPathResult = {
            key,
            xpath,
            found: result.found,
            tagName: result.tagName,
            classes: result.classes,
            attributes: result.attributes,
            visible: result.visible,
            boundingBox: result.boundingBox,
          };

          if (result.found) {
            diagnostic.found++;
            const visTag = result.visible ? 'visible' : 'hidden';
            console.log(`    FOUND  ${key} -> <${result.tagName}> [${visTag}]`);
          } else {
            diagnostic.missing++;
            console.log(`    MISS   ${key} -> ${xpath}`);
          }

          diagnostic.results.push(xpathResult);
        }

        if (diagnostic.missing > 0) {
          console.log(`  Capturing DOM snapshot for ${widget}...`);
          diagnostic.domSnapshot = await captureDomSnapshot(page, widget);
        }
      }

      report.totalSelectors += diagnostic.totalSelectors;
      report.totalFound += diagnostic.found;
      report.totalMissing += diagnostic.missing;
      report.widgets.push(diagnostic);
    }
  }

  await browser.close();

  // ─── Write Reports ─────────────────────────────────────────────────────────

  const reportsDir = path.join(process.cwd(), 'artifacts', 'selector-diagnostics');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const jsonPath = path.join(reportsDir, 'diagnostic-report.json');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const textPath = path.join(reportsDir, 'diagnostic-report.txt');
  fs.writeFileSync(textPath, generateTextReport(report));

  const missingPath = path.join(reportsDir, 'missing-selectors.txt');
  fs.writeFileSync(missingPath, generateMissingSummary(report));

  const snapshotsDir = path.join(reportsDir, 'dom-snapshots');
  if (!fs.existsSync(snapshotsDir)) {
    fs.mkdirSync(snapshotsDir, { recursive: true });
  }
  for (const wd of report.widgets) {
    if (wd.domSnapshot) {
      fs.writeFileSync(path.join(snapshotsDir, `${wd.widget}.html`), wd.domSnapshot);
    }
  }

  // ─── Print Summary ─────────────────────────────────────────────────────────

  console.log('\n' + '='.repeat(80));
  console.log('  DIAGNOSTIC SUMMARY');
  console.log('='.repeat(80));
  console.log(`  Total Widgets:    ${report.totalWidgets}`);
  console.log(`  Total Selectors:  ${report.totalSelectors}`);
  console.log(`  Found:            ${report.totalFound} (${pct(report.totalFound, report.totalSelectors)})`);
  console.log(`  Missing:          ${report.totalMissing} (${pct(report.totalMissing, report.totalSelectors)})`);
  console.log('='.repeat(80));

  console.log(`\n  Per-widget breakdown (failures only):`);
  for (const wd of report.widgets.sort((a, b) => b.missing - a.missing)) {
    if (wd.missing === 0) continue;
    console.log(`    ${wd.widget.padEnd(20)} ${wd.missing}/${wd.totalSelectors} missing (${pct(wd.missing, wd.totalSelectors)})`);
  }

  console.log(`\n  Reports saved to: ${reportsDir}`);
  console.log(`    diagnostic-report.json  - Full machine-readable report`);
  console.log(`    diagnostic-report.txt   - Human-readable summary`);
  console.log(`    missing-selectors.txt   - Actionable list grouped by failure category`);
  console.log(`    dom-snapshots/          - Actual DOM tree for each failing widget`);
}

function pct(part: number, total: number): string {
  if (total === 0) return '0%';
  return `${((part / total) * 100).toFixed(1)}%`;
}

// ─── Report Generators ───────────────────────────────────────────────────────

function generateTextReport(report: DiagnosticReport): string {
  const lines: string[] = [];

  lines.push('='.repeat(100));
  lines.push('CANVAS SELECTOR DIAGNOSTIC REPORT');
  lines.push('='.repeat(100));
  lines.push(`Timestamp:  ${report.timestamp}`);
  lines.push(`Studio:     ${report.studioBaseUrl}`);
  lines.push(`Project:    ${report.projectId}`);
  lines.push(`Selectors:  ${report.totalFound}/${report.totalSelectors} found, ${report.totalMissing} missing`);
  lines.push('');

  for (const wd of report.widgets) {
    lines.push('-'.repeat(100));
    lines.push(`WIDGET: ${wd.widget}  |  Page: ${wd.page}  |  Found: ${wd.found}/${wd.totalSelectors}  |  Missing: ${wd.missing}`);
    lines.push('-'.repeat(100));

    if (wd.pageError) {
      lines.push(`  PAGE ERROR: ${wd.pageError}`);
    }

    const foundResults = wd.results.filter(r => r.found);
    if (foundResults.length > 0) {
      lines.push('');
      lines.push('  FOUND SELECTORS:');
      for (const r of foundResults) {
        const vis = r.visible ? 'visible' : 'hidden';
        const size = r.boundingBox ? `${r.boundingBox.width}x${r.boundingBox.height}` : 'no-bbox';
        lines.push(`    [OK]  ${r.key}`);
        lines.push(`          <${r.tagName}> class="${(r.classes || '').substring(0, 80)}" [${vis}, ${size}]`);
      }
    }

    const missingResults = wd.results.filter(r => !r.found);
    if (missingResults.length > 0) {
      lines.push('');
      lines.push('  MISSING SELECTORS:');
      for (const r of missingResults) {
        lines.push(`    [MISS] ${r.key}`);
        lines.push(`           XPath: ${r.xpath}`);
        if (r.error) lines.push(`           Error: ${r.error}`);
      }
    }

    if (wd.domSnapshot) {
      lines.push('');
      lines.push('  DOM SNAPSHOT (actual structure):');
      const snapshotLines = wd.domSnapshot.split('\n');
      for (const line of snapshotLines.slice(0, 60)) {
        lines.push(`    ${line}`);
      }
      if (snapshotLines.length > 60) {
        lines.push('    ... (truncated, see dom-snapshots/ for full output)');
      }
    }

    lines.push('');
  }

  return lines.join('\n');
}

function generateMissingSummary(report: DiagnosticReport): string {
  const lines: string[] = [];

  lines.push('MISSING CANVAS SELECTORS - ACTIONABLE SUMMARY');
  lines.push('='.repeat(80));
  lines.push(`Generated: ${report.timestamp}`);
  lines.push(`Total missing: ${report.totalMissing}`);
  lines.push('');

  const interactionRequired: XPathResult[] = [];
  const stateDependent: XPathResult[] = [];
  const structureMismatch: XPathResult[] = [];

  for (const wd of report.widgets) {
    for (const r of wd.results.filter(r => !r.found)) {
      const x = r.xpath.toLowerCase();
      if (x.includes('dialog') || x.includes('bottomsheet-container') ||
          x.includes('bottomsheet-backdrop') || x.includes('bottomsheet-content') ||
          x.includes('dropdown-menu')) {
        interactionRequired.push(r);
      } else if (x.includes('aria-checked') || x.includes('@disabled') ||
                 x.includes("contains(@class,'active')") || x.includes("contains(@class,'selected')")) {
        stateDependent.push(r);
      } else {
        structureMismatch.push(r);
      }
    }
  }

  if (interactionRequired.length > 0) {
    lines.push('-'.repeat(80));
    lines.push(`CATEGORY 1: REQUIRES INTERACTION (${interactionRequired.length} selectors)`);
    lines.push('These elements need a click/tap to become visible before selector lookup.');
    lines.push('-'.repeat(80));
    for (const r of interactionRequired) {
      lines.push(`  ${r.key}`);
      lines.push(`    ${r.xpath}`);
    }
    lines.push('');
  }

  if (stateDependent.length > 0) {
    lines.push('-'.repeat(80));
    lines.push(`CATEGORY 2: STATE-DEPENDENT (${stateDependent.length} selectors)`);
    lines.push('Widget must be put into a specific state (checked, disabled, active) first.');
    lines.push('-'.repeat(80));
    for (const r of stateDependent) {
      lines.push(`  ${r.key}`);
      lines.push(`    ${r.xpath}`);
    }
    lines.push('');
  }

  if (structureMismatch.length > 0) {
    lines.push('-'.repeat(80));
    lines.push(`CATEGORY 3: DOM STRUCTURE MISMATCH (${structureMismatch.length} selectors)`);
    lines.push('XPath does not match actual DOM. Check dom-snapshots/ for correct structure.');
    lines.push('-'.repeat(80));
    for (const r of structureMismatch) {
      lines.push(`  ${r.key}`);
      lines.push(`    ${r.xpath}`);
    }
    lines.push('');
  }

  lines.push('='.repeat(80));
  lines.push('NEXT STEPS:');
  lines.push('  1. Category 1: Add pre-action steps in the test (click to open dialog, etc.)');
  lines.push('  2. Category 2: Add state-change steps (check a checkbox, toggle a switch, etc.)');
  lines.push('  3. Category 3: Compare dom-snapshots/*.html with the XPath and update widget-xpaths.ts');
  lines.push('');
  lines.push('DOM snapshots:       artifacts/selector-diagnostics/dom-snapshots/');
  lines.push('Update selectors in: src/matrix/widget-xpaths.ts');

  return lines.join('\n');
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

run().catch((err) => {
  console.error('Diagnostic script failed:', err);
  process.exit(1);
});
