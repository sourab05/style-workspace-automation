import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { TokenSlotTestCase, TokenSlotGenerator } from '../src/playwright/tokenSlotGenerator';
import { getComputedCss, toHaveSnapshot, gotoCanvas, gotoPreview, waitForSelectorWithRetry } from '../src/playwright/helpers';
import { widgetXPaths } from '../src/matrix/widget-xpaths';
import { StudioClient } from '../src/api/studioClient';
import { Widget } from '../src/matrix/widgets';
import { TokenMappingService } from '../src/tokens/mappingService';
import { MobileMapper } from '../wdio/utils/mobileMapper';
import { getStudioWidgetNameForVariant } from '../wdio/utils/mobileWidgetVariantCsv';
import data from './testdata/data.json';

/**
 * Token Slot Validation Tests
 * 
 * Follows the Studio & Web Preview Automation Flow:
 * 1. Load test cases from widget-token-slots.json (generated in global setup)
 * 2. For each test case:
 *    a. Apply token (one at a time)
 *    b. Validate in Canvas (screenshot + CSS)  -- OR --
 *    c. Validate in Preview (screenshot + RN style command)
 *    d. Record result
 * 3. Generate reports
 * 
 * Canvas and Preview run as SEPARATE test suites with independent assertions.
 */

// Check required environment variables
const requiredEnv = ['STUDIO_BASE_URL', 'PROJECT_ID', 'STUDIO_USERNAME', 'STUDIO_PASSWORD'];
const hasEnv = requiredEnv.every(v => !!process.env[v]);

const cacheDir = path.join(process.cwd(), '.test-cache');

/**
 * SLOT_VERIFY_TARGET: which suite(s) to run.
 * - "both" | unset: run Canvas + Preview (default)
 * - "canvas": run Canvas only
 * - "preview": run Preview only
 */
const slotVerifyTarget = (process.env.SLOT_VERIFY_TARGET || 'both').toLowerCase();
const runCanvasSuite = slotVerifyTarget === 'both' || slotVerifyTarget === 'canvas';
const runPreviewSuite = slotVerifyTarget === 'both' || slotVerifyTarget === 'preview';

// Pre-load auth cookie
const authFile = path.join(cacheDir, 'auth-cookie.txt');
if (fs.existsSync(authFile)) {
  const authCookie = fs.readFileSync(authFile, 'utf-8').trim();
  process.env.STUDIO_COOKIE = authCookie;
}

// ========== LOAD AND FILTER TEST CASES ==========
const testCasesPath = path.join(cacheDir, 'slot-test-cases.json');

if (!fs.existsSync(testCasesPath)) {
  // Don't throw at module level; tests will be skipped via hasEnv check
  console.warn(`Test cases not found: ${testCasesPath}. Ensure global setup has run.`);
}

const allTestCasesRaw: TokenSlotTestCase[] = fs.existsSync(testCasesPath)
  ? JSON.parse(fs.readFileSync(testCasesPath, 'utf-8'))
  : [];

// Filter test cases by TEST_WIDGETS env var (same as global setup uses)
// e.g. TEST_WIDGETS=button or TEST_WIDGETS=button,accordion
const widgetFilter = process.env.TEST_WIDGETS?.split(',').map(w => w.trim()).filter(Boolean);
const allTestCases = widgetFilter
  ? allTestCasesRaw.filter(tc => widgetFilter.includes(tc.widget))
  : allTestCasesRaw;

if (widgetFilter) {
  console.log(`\n📋 Filtered to ${allTestCases.length} test cases for widgets: ${widgetFilter.join(', ')}`);
} else {
  console.log(`\n📋 Loaded ${allTestCases.length} test cases (all widgets)`);
}

console.log(`📌 SLOT_VERIFY_TARGET=${slotVerifyTarget} → Canvas: ${runCanvasSuite ? 'ON' : 'OFF'}, Preview: ${runPreviewSuite ? 'ON' : 'OFF'}`);

// Load GLOBAL token values map (hardcoded path: tokens/mobile/global/)
const { loadGlobalTokenMap } = require('../src/playwright/globalTokenLoader');
const tokenMap = loadGlobalTokenMap();
console.log(`✅ Loaded ${Object.keys(tokenMap).length} GLOBAL tokens from tokens/mobile/global/`);

// Load preview URL from cache
const previewUrlFile = path.join(cacheDir, 'preview-url.json');
let cachedPreviewUrl: string = '';
if (fs.existsSync(previewUrlFile)) {
  const cached = JSON.parse(fs.readFileSync(previewUrlFile, 'utf-8'));
  cachedPreviewUrl = cached.previewUrl || '';
}

// Group test cases by widget
const testCasesByWidget = new Map<Widget, TokenSlotTestCase[]>();
for (const testCase of allTestCases) {
  if (!testCasesByWidget.has(testCase.widget)) {
    testCasesByWidget.set(testCase.widget, []);
  }
  testCasesByWidget.get(testCase.widget)!.push(testCase);
}

// ========== HELPER: element suffix from property path ==========
function getElementSuffixFromPropertyPath(propertyPath: string[]): string | null {
  if (propertyPath.length === 0) return null;

  const first = propertyPath[0].toLowerCase();
  const second = propertyPath.length > 1 ? propertyPath[1].toLowerCase() : '';

  // header.subtitle / heading.subtitle → description div in DOM; use 'subtitle' suffix
  if ((first === 'header' || first === 'heading') && second === 'subtitle') {
    return 'subtitle';
  }

  const elementTypes = [
    // Original element types
    'header', 'body', 'footer', 'title', 'subtitle', 'description',
    'icon', 'badge', 'text', 'container', 'content', 'item', 'label',
    'button', 'input', 'placeholder', 'list', 'menu', 'step', 'indicator',
    // Common element types added for full widget coverage
    'heading', 'handle', 'anchor', 'image', 'link', 'set', 'form',
    'error', 'btn', 'dropdown', 'invalid', 'thumb', 'tooltip', 'track',
    'lottie', 'stroke', 'backdrop', 'view', 'slide', 'dots', 'skeleton',
    // Hyphenated element types (widget-specific sub-elements)
    'back-icon', 'left-icon', 'menu-icon', 'popover-icon',
    'navigation-arrows', 'more-menu', 'more-menu-row',
    'close-btn', 'text-wrapper', 'data-complete',
    'max-track', 'min-track', 'sub-title',
    'header-skeleton', 'event-day1', 'not-day-of-month',
    'weekday', 'asterisk', 'day', 'daywrapper',
    'month-text', 'selected-day', 'today', 'wrapper', 'year-text',
  ];

  if (elementTypes.includes(first)) {
    return first;
  }

  return null;
}

// ========== SHARED: apply token + rollback helpers ==========

/**
 * Maps WIDGET_CONFIG keys to their Studio server file names.
 * Only widgets whose server file name differs from their config key need an entry.
 * Note: this is NOT the same as getWidgetKey() which maps to the JSON payload key
 * (e.g. button -> btn). The server file for button is still button/button.json.
 */
const STUDIO_FILE_NAME_MAP: Record<string, string> = {
  'formcontrols': 'form-controls',
};

function getStudioFileName(widget: string): string {
  return STUDIO_FILE_NAME_MAP[widget] || widget;
}

/**
 * Deep merge source into target (mutates target). Same logic as StyleScreen.
 * Ensures previous tokens are preserved when applying new ones (Studio overwrites otherwise).
 */
function deepMergePayload(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
  for (const key of Object.keys(source)) {
    const srcVal = source[key];
    const tgtVal = target[key];

    if (Array.isArray(srcVal)) {
      target[key] = [...srcVal];
      continue;
    }
    if (srcVal === null) {
      target[key] = null;
      continue;
    }
    if (typeof srcVal === 'object') {
      if (typeof tgtVal !== 'object' || tgtVal === null || Array.isArray(tgtVal)) {
        target[key] = {};
      }
      deepMergePayload(target[key], srcVal);
      continue;
    }
    target[key] = srcVal;
  }
  return target;
}

async function acquireStudioLock(): Promise<boolean> {
  const lockFile = path.join(cacheDir, 'studio.lock');
  const isProcessRunning = (pid: number) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  };
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      let isStale = false;
      if (fs.existsSync(lockFile)) {
        const pid = parseInt(fs.readFileSync(lockFile, 'utf-8'), 10);
        if (!isProcessRunning(pid)) {
          fs.unlinkSync(lockFile);
          isStale = true;
        }
      }
      if (!fs.existsSync(lockFile) || isStale) {
        fs.writeFileSync(lockFile, process.pid.toString());
        return true;
      }
    } catch {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

function releaseStudioLock(): void {
  const lockFile = path.join(cacheDir, 'studio.lock');
  if (fs.existsSync(lockFile)) {
    try {
      fs.unlinkSync(lockFile);
    } catch {
      /* ignore */
    }
  }
}

function isRetryableServerError(err: any): boolean {
  const msg = String(err?.message || '');
  const status = err?.response?.status ?? err?.status;
  return status === 502 || status === 503 || status === 504 || msg.includes('502') || msg.includes('503') || msg.includes('504');
}

async function applyToken(
  studioClient: StudioClient,
  testCase: TokenSlotTestCase
): Promise<{ studioFileName: string; payload: Record<string, any>; mergedPayload: Record<string, any> }> {
  const generator = new TokenSlotGenerator();
  const payload = generator.generatePayloadForTestCase(testCase);
  const studioFileName = getStudioFileName(testCase.widget);

  const acquired = await acquireStudioLock();
  if (!acquired) {
    console.warn('   ⚠️  Could not acquire Studio lock. Proceeding anyway.');
  }

  const maxRetries = 3;
  const retryDelayMs = 5000;

  try {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Fetch existing payload from Studio (like StyleScreen) and merge
        const existing = await studioClient.getComponentOverride(studioFileName).catch(() => ({}));
        const mergedPayload = deepMergePayload(
          typeof existing === 'object' && existing !== null ? { ...existing } : {},
          payload
        );

        console.log(`   📦 Merging: existing keys=${Object.keys(existing || {}).length}, +new → merged keys=${Object.keys(mergedPayload).length}`);

        await studioClient.updateComponentOverride(studioFileName, mergedPayload);
        await studioClient.publishAndBuild();
        await studioClient.waitForBuildPropagation();
        console.log('   ✅ Token applied and propagated (merged with previous)');

        return { studioFileName, payload, mergedPayload };
      } catch (err: any) {
        if (attempt < maxRetries && isRetryableServerError(err)) {
          console.warn(`   ⚠️  Server error (${err?.message || err}), retrying in ${retryDelayMs}ms (attempt ${attempt + 1}/${maxRetries})...`);
          await new Promise((r) => setTimeout(r, retryDelayMs));
        } else {
          throw err;
        }
      }
    }
    throw new Error('applyToken failed after retries');
  } finally {
    if (acquired) releaseStudioLock();
  }
}

async function rollbackToken(
  studioClient: StudioClient,
  studioFileName: string
): Promise<void> {
  try {
    await studioClient.updateComponentOverride(studioFileName, {});
    await studioClient.publishAndBuild();
    await studioClient.waitForBuildPropagation(3000);
    console.log('   🔄 Widget reset to clean state');
  } catch (err: any) {
    console.warn(`   ⚠️  Failed to reset widget: ${err.message}`);
  }
}

// ========================================================================
//  CANVAS TOKEN VALIDATION
// ========================================================================

(hasEnv && allTestCases.length > 0 && runCanvasSuite ? test.describe : test.describe.skip)('Canvas Token Validation', () => {
  let studioClient: StudioClient;

  // Initialize reporter with only the filtered test cases
  const { PlaywrightTokenTestReporter } = require('../src/playwright/tokenTestReporter');
  const canvasReporter = new PlaywrightTokenTestReporter(allTestCases);

  test.beforeAll(async () => {
    const authCookie = fs.readFileSync(authFile, 'utf-8').trim();
    studioClient = new StudioClient({
      baseUrl: process.env.STUDIO_BASE_URL || '',
      projectId: process.env.PROJECT_ID || '',
      cookie: authCookie,
    });
    console.log('✅ Studio client initialized (Canvas)');
  });

  const canvasWidgetEntries = Array.from(testCasesByWidget.entries());
  const canvasTotalTests = allTestCases.length;
  let canvasGlobalIndex = 0;

  for (let widgetIdx = 0; widgetIdx < canvasWidgetEntries.length; widgetIdx++) {
    const [widget, testCases] = canvasWidgetEntries[widgetIdx];
    const widgetLabel = `[Widget ${widgetIdx + 1}/${canvasWidgetEntries.length}]`;

    test.describe(`${widgetLabel} Canvas Token Validation - ${widget.charAt(0).toUpperCase() + widget.slice(1)} (${testCases.length} tests)`, () => {
      // Default mode: tests run sequentially (one after another) but a failure
      // in one test does NOT skip/abandon the remaining tests in the group.
      // Previously 'serial' mode caused cascade skips — ~43 failures would
      // abandon the remaining ~1531 tests.  Each test is self-contained:
      // applyToken() fetches existing state, deep-merges, publishes, and
      // validates independently, so there is no true ordering dependency.

      for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        canvasGlobalIndex++;
        const globalNum = canvasGlobalIndex;
        const {
          widget,
          appearance,
          variant,
          state,
          tokenType,
          propertyPath,
          tokenRef,
          testId,
        } = testCase;

        const variantName = `${widget}-${appearance}-${variant}-${state}`;

        test(`[${globalNum}/${canvasTotalTests}] Token Validate: ${tokenRef} Property: ${propertyPath.join('.')} @ ${variantName}`, async ({ page }) => {
          const TEST_TIMEOUT = 360_000;
          test.setTimeout(TEST_TIMEOUT);
          const testStartMs = Date.now();
          const remainingMs = () => TEST_TIMEOUT - (Date.now() - testStartMs);
          const SAFETY_MARGIN_MS = 15_000;

          // ========== STEP 1: APPLY TOKEN ==========
          console.log(`\n🎯 [Canvas] Testing: ${tokenRef} → ${widget}.${appearance}.${variant}.${state}.${propertyPath.join('.')}`);

          let studioFileName: string;
          try {
            const result = await applyToken(studioClient, testCase);
            studioFileName = result.studioFileName;
          } catch (err: any) {
            throw new Error(`Failed to apply token: ${err.message}`);
          }

          // Extra wait for canvas to pick up the applied token (build propagation may need more time)
          const canvasBuildWaitMs = 6000;
          console.log(`   ⏳ Waiting ${canvasBuildWaitMs}ms for canvas to reflect applied token...`);
          await new Promise((r) => setTimeout(r, canvasBuildWaitMs));

          // Get expected value
          const expectedValue = tokenMap[tokenRef];
          if (!expectedValue) {
            console.warn(`   ⚠️  No expected value found for ${tokenRef}`);
          }

          const cssProperty = TokenMappingService.mapToComputedProperty(
            propertyPath[propertyPath.length - 1],
            propertyPath
          );

          console.log(`   🔑 Token: ${tokenRef} → Expected value: ${expectedValue}`);
          console.log(`   🔑 Property path: ${propertyPath.join('.')} → CSS property: ${cssProperty}`);

          // ========== STEP 2: VALIDATE IN CANVAS ==========
          let canvasStatus: string = 'PENDING';
          let canvasError: string | null = null;
          let canvasActual: string | null = null;
          let canvasVisualResult: { imagesAreEqual: boolean; diffPixels?: number } = {
            imagesAreEqual: true,
          };

          let canvasSelector = (data.style.canvasSelectors as Record<string, string>)[widget];
          const xpathKey = `${widget}-${appearance}-${variant}-${state}`;
          const elementSuffix = getElementSuffixFromPropertyPath(propertyPath);
          let effectiveSuffix = elementSuffix;
          if (widget === 'button') {
            if (elementSuffix === 'icon' && tokenType !== 'icon') effectiveSuffix = null;
            else if (tokenType === 'font') effectiveSuffix = 'font';
            else if (tokenType === 'icon') effectiveSuffix = 'icon';
          }
          const propertySpecificXPath = effectiveSuffix
            ? widgetXPaths.canvas[`${xpathKey}-${effectiveSuffix}` as keyof typeof widgetXPaths.canvas]
            : widgetXPaths.canvas[xpathKey as keyof typeof widgetXPaths.canvas];
          if (propertySpecificXPath) {
            canvasSelector = propertySpecificXPath as string;
          }

          try {
            console.log('   📊 Validating in Canvas...');

            await gotoCanvas(page, widget);

            console.log(`   📍 XPath for styles: ${canvasSelector}`);

            await waitForSelectorWithRetry(page, canvasSelector, { timeout: 15000, retries: 3 });

            // Screenshot comparison
            const snapshotName = `canvas-${widget}`;
            canvasVisualResult = await toHaveSnapshot(page, `${testId}-canvas`, snapshotName);

            // CSS validation with time-budget awareness — bail before the hard timeout hits
            const maxRetries = 3;
            const retryDelayMs = 3000;
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
              if (remainingMs() < SAFETY_MARGIN_MS) {
                canvasStatus = 'FAIL';
                canvasError = `Time budget exhausted (${Math.round(remainingMs() / 1000)}s left) before CSS validation attempt ${attempt}`;
                console.log(`   ⏱️ ${canvasError}`);
                break;
              }
              console.log(`   🔍 Canvas: Reading CSS property '${cssProperty}' from element...${attempt > 1 ? ` (retry ${attempt}/${maxRetries})` : ''} [${Math.round(remainingMs() / 1000)}s remaining]`);
              canvasActual = await getComputedCss(page, canvasSelector, cssProperty);
              const canvasNormalized = TokenMappingService.normalizeValue(canvasActual, cssProperty);
              const expectedNormalized = TokenMappingService.normalizeValue(expectedValue, cssProperty);

              console.log(`   📋 Canvas: CSS '${cssProperty}' → actual: ${canvasActual} (normalized: ${canvasNormalized}), expected: ${expectedValue} (normalized: ${expectedNormalized})`);

              if (canvasNormalized === expectedNormalized) {
                canvasStatus = 'PASS';
                console.log(`   ✅ Canvas PASS: '${cssProperty}' = ${canvasNormalized}`);
                break;
              }
              if (attempt < maxRetries && remainingMs() > SAFETY_MARGIN_MS + 25_000) {
                console.log(`   ⏳ Style mismatch, refreshing page and retrying in ${retryDelayMs}ms...`);
                console.log(`   🔄 Retry ${attempt + 1}/${maxRetries}: Reloading page... [${Math.round(remainingMs() / 1000)}s remaining]`);
                await page.reload({ waitUntil: 'domcontentloaded' });
                await page.waitForTimeout(retryDelayMs);
                await waitForSelectorWithRetry(page, canvasSelector, { timeout: 10000, retries: 2 });
              } else {
                canvasStatus = 'FAIL';
                canvasError = `CSS '${cssProperty}' Expected: ${expectedNormalized}, Got: ${canvasNormalized}`;
                console.log(`   ❌ Canvas FAIL: ${canvasError}`);
              }
            }

            if (canvasVisualResult.imagesAreEqual) {
              console.log(`   ⚠️  Canvas: No visual difference detected`);
            } else {
              console.log(`   ✅ Canvas: Visual change confirmed (${canvasVisualResult.diffPixels || 0} pixels)`);
            }

          } catch (err: any) {
            canvasStatus = 'ERROR';
            canvasError = err.message;
            console.log(`   ❌ Canvas: ${canvasError}`);
          }

          // ========== STEP 3: RECORD RESULT ==========
          const testResult = {
            testId: `${testId}-canvas`,
            widget,
            appearance,
            variant,
            state,
            tokenType,
            propertyPath: propertyPath.join('.'),
            tokenRef,
            expectedValue,
            canvas: {
              status: canvasStatus as 'PASS' | 'FAIL' | 'ERROR' | 'SKIPPED',
              actualValue: canvasActual,
              error: canvasError,
              visualChange: !canvasVisualResult.imagesAreEqual,
              diffPixels: canvasVisualResult.diffPixels,
            },
            preview: {
              status: 'SKIPPED' as const,
              actualValue: null,
              error: null,
              visualChange: false,
            },
            overallStatus: canvasStatus as 'PASS' | 'FAIL' | 'ERROR',
            timestamp: new Date().toISOString(),
          };

          canvasReporter.recordResult(testResult);

          // Attach style verdict to Playwright report
          const dashedCssProp = cssProperty.replace(/([A-Z])/g, '-$1').toLowerCase();
          const canvasStyleCommand = `element = document.evaluate("${canvasSelector.replace(/"/g, '\\"')}", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;\ngetComputedStyle(element).getPropertyValue('${dashedCssProp}')`;
          const canvasVerdictReport = `Style Validation Verdict: Canvas
=========================================
🔑 Token: ${tokenRef} → Expected value: ${expectedValue}
🔑 Property path: ${propertyPath.join('.')} → CSS property: ${cssProperty}
📍 XPath for styles: ${canvasSelector}
📋 Command:
${canvasStyleCommand}

🎨 CANVAS: ${canvasStatus === 'PASS' ? '✅ PASS' : canvasStatus === 'FAIL' ? '❌ FAIL' : '⚠️ ERROR'}
   Actual: ${canvasActual ?? 'N/A'}
   Error: ${canvasError ?? 'None'}
   Visual Change: ${canvasVisualResult.imagesAreEqual ? 'No' : 'Yes'}${canvasVisualResult.diffPixels != null ? ` (${canvasVisualResult.diffPixels} pixels)` : ''}

🌐 PREVIEW: ⚪ SKIPPED (Canvas-only suite)
=========================================`;
          await test.info().attach('style-verdict.txt', {
            body: canvasVerdictReport,
            contentType: 'text/plain',
          });

          const resultsDir = path.join(process.cwd(), 'artifacts', 'slot-test-results');
          if (!fs.existsSync(resultsDir)) {
            fs.mkdirSync(resultsDir, { recursive: true });
          }
          fs.writeFileSync(
            path.join(resultsDir, `${testId}-canvas.json`),
            JSON.stringify(testResult, null, 2)
          );

          // ========== STEP 4: ROLLBACK (commented out for now) ==========
          // await rollbackToken(studioClient, studioFileName!);

          // Assert
          expect(canvasStatus, `Canvas failed: ${canvasError || 'unknown error'}`).toBe('PASS');
        });
      }
    });
  }

  // Generate Canvas reports after all Canvas tests
  test.afterAll(async () => {
    console.log('\n📊 Generating Canvas Token Validation Reports...');
    const reportsDir = path.join(process.cwd(), 'artifacts', 'playwright-token-reports', 'canvas');

    const resultsDir = path.join(process.cwd(), 'artifacts', 'slot-test-results');
    if (fs.existsSync(resultsDir)) {
      canvasReporter.loadResultsFromArtifacts(resultsDir);
    }

    const widgets = Array.from(testCasesByWidget.keys());
    for (const widget of widgets) {
      const widgetResults = canvasReporter.getResultsForWidget(widget);
      if (widgetResults && widgetResults.length > 0) {
        canvasReporter.saveComparisonTable(widget, reportsDir);
      }
    }

    canvasReporter.saveOverallSummary(reportsDir, widgets);
    canvasReporter.exportToJson(reportsDir, widgets);

    console.log('\n✅ Canvas token validation reports generated!');
    console.log(`📁 Reports location: ${reportsDir}`);
  });
});

// ========================================================================
//  PREVIEW TOKEN VALIDATION
// ========================================================================

(hasEnv && allTestCases.length > 0 && runPreviewSuite ? test.describe : test.describe.skip)('Preview Token Validation', () => {
  let studioClient: StudioClient;
  let deployUrl: string = cachedPreviewUrl;

  // Initialize reporter with only the filtered test cases
  const { PlaywrightTokenTestReporter } = require('../src/playwright/tokenTestReporter');
  const previewReporter = new PlaywrightTokenTestReporter(allTestCases);

  test.beforeAll(async () => {
    const authCookie = fs.readFileSync(authFile, 'utf-8').trim();
    studioClient = new StudioClient({
      baseUrl: process.env.STUDIO_BASE_URL || '',
      projectId: process.env.PROJECT_ID || '',
      cookie: authCookie,
    });
    console.log('✅ Studio client initialized (Preview)');

    // Obtain deploy URL once for all preview tests
    if (!deployUrl) {
      const freshUrl = await studioClient.inplaceDeploy();
      if (freshUrl) {
        deployUrl = freshUrl;
        console.log(`✅ Deploy URL obtained: ${deployUrl}`);
      } else {
        console.warn('⚠️  Could not obtain deploy URL. Preview tests may fail.');
      }
    } else {
      console.log(`✅ Using cached deploy URL: ${deployUrl}`);
    }
  });

  const previewWidgetEntries = Array.from(testCasesByWidget.entries());
  const previewTotalTests = allTestCases.length;
  let previewGlobalIndex = 0;

  for (let widgetIdx = 0; widgetIdx < previewWidgetEntries.length; widgetIdx++) {
    const [widget, testCases] = previewWidgetEntries[widgetIdx];
    const widgetLabel = `[Widget ${widgetIdx + 1}/${previewWidgetEntries.length}]`;

    test.describe(`${widgetLabel} Preview Token Validation - ${widget.charAt(0).toUpperCase() + widget.slice(1)} (${testCases.length} tests)`, () => {
      // Default mode: sequential execution without cascade failures.
      // See Canvas suite comment for rationale.

      for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        previewGlobalIndex++;
        const globalNum = previewGlobalIndex;
        const {
          widget,
          appearance,
          variant,
          state,
          tokenType,
          propertyPath,
          tokenRef,
          testId,
        } = testCase;

        const variantName = `${widget}-${appearance}-${variant}-${state}`;

        test(`[${globalNum}/${previewTotalTests}] Token Validate: ${tokenRef} Property: ${propertyPath.join('.')} @ ${variantName}`, async ({ page }) => {
          const TEST_TIMEOUT = 360_000;
          test.setTimeout(TEST_TIMEOUT);
          const testStartMs = Date.now();
          const remainingMs = () => TEST_TIMEOUT - (Date.now() - testStartMs);
          const SAFETY_MARGIN_MS = 15_000;

          // ========== STEP 1: APPLY TOKEN ==========
          console.log(`\n🎯 [Preview] Testing: ${tokenRef} → ${widget}.${appearance}.${variant}.${state}.${propertyPath.join('.')}`);

          let studioFileName: string;
          try {
            const result = await applyToken(studioClient, testCase);
            studioFileName = result.studioFileName;
          } catch (err: any) {
            throw new Error(`Failed to apply token: ${err.message}`);
          }

          // Extra wait for mobile preview build to be ready (preview deploys separately from canvas)
          const previewBuildWaitMs = 8000;
          console.log(`   ⏳ Waiting ${previewBuildWaitMs}ms for preview build to be ready...`);
          await new Promise((r) => setTimeout(r, previewBuildWaitMs));

          // Get expected value
          const expectedValue = tokenMap[tokenRef];
          if (!expectedValue) {
            console.warn(`   ⚠️  No expected value found for ${tokenRef}`);
          }

          const cssProperty = TokenMappingService.mapToComputedProperty(
            propertyPath[propertyPath.length - 1],
            propertyPath
          );

          console.log(`   🔑 Token: ${tokenRef} → Expected value: ${expectedValue}`);
          console.log(`   🔑 Property path: ${propertyPath.join('.')} → CSS property: ${cssProperty}`);

          // ========== STEP 2: VALIDATE IN PREVIEW (RN STYLE COMMAND) ==========
          let previewStatus: string = 'PENDING';
          let previewError: string | null = null;
          let previewActual: string | null = null;
          let previewVisualResult: { imagesAreEqual: boolean; diffPixels?: number } = {
            imagesAreEqual: true,
          };

          const studioWidgetName = getStudioWidgetNameForVariant(widget, variantName) || `${widget}1`;
          const stylesKey = (widget === 'cards' || widget === 'formcontrols') ? 'calcStyles' : 'styles';
          const stateAwareWidgets = ['tabbar', 'tabs', 'button', 'checkbox', 'checkboxset', 'wizard', 'carousel', 'chips', 'formcontrols', 'radioset', 'toggle', 'switch'];
          const effectivePropertyPath = (state !== 'default' && stateAwareWidgets.includes(widget)) ? ['states', state, ...propertyPath] : propertyPath;
          const mappedPath = MobileMapper.mapToRnStylePath(effectivePropertyPath, widget, 'android');
          const formFieldKey = variantName.endsWith('-disabled') ? 'custom' : 'entestkey';
          let rnCommand: string;
          if (widget === 'cards') {
            rnCommand = `App.appConfig.currentPage.Widgets.supportedLocaleList1.itemWidgets[0].card1._INSTANCE.${stylesKey}.${mappedPath}`;
          } else if (widget === 'formcontrols') {
            rnCommand = `App.appConfig.currentPage.Widgets.supportedLocaleForm1.formWidgets.${formFieldKey}.${stylesKey}.${mappedPath}`;
          } else {
            rnCommand = `App.appConfig.currentPage.Widgets.${studioWidgetName}._INSTANCE.${stylesKey}.${mappedPath}`;
          }
          const previewSelector = (data.style.previewSelectors as Record<string, string>)[widget];

          try {
            console.log('   📊 Validating in Preview (RN style command)...');

            const inspectorOverride = widgetXPaths.previewInspector.widgetOverrides?.[widget];
            const inputSelector = inspectorOverride?.styleCommandInput || widgetXPaths.previewInspector.styleCommandInput;
            const outputSelector = inspectorOverride?.styleOutputLabel || widgetXPaths.previewInspector.styleOutputLabel;
            const styleInput = page.locator(inputSelector).first();
            const maxRetries = 2;
            let currentDeployUrl = deployUrl;

            for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
              if (remainingMs() < SAFETY_MARGIN_MS) {
                previewStatus = 'FAIL';
                previewError = `Time budget exhausted (${Math.round(remainingMs() / 1000)}s left) before preview attempt ${attempt}`;
                console.log(`   ⏱️ ${previewError}`);
                break;
              }
              const freshUrl = await studioClient.inplaceDeploy();
              if (freshUrl) currentDeployUrl = freshUrl;
              if (attempt > 1) {
                console.log(`   ⏳ Preview failed, retrying (attempt ${attempt}/${maxRetries + 1}): Re-running in-place deploy for fresh preview... [${Math.round(remainingMs() / 1000)}s remaining]`);
              } else {
                console.log(`   🔄 Fetching fresh preview URL (includes applied token)...`);
              }
              const deployReadyWaitMs = 6000;
              console.log(`   ⏳ Waiting ${deployReadyWaitMs}ms for deploy to be ready...`);
              await new Promise((r) => setTimeout(r, deployReadyWaitMs));
              await gotoPreview(page, widget, currentDeployUrl);
              await waitForSelectorWithRetry(page, previewSelector, { timeout: 45000, retries: 2 });
              await styleInput.waitFor({ state: 'visible', timeout: 45000 });

              if (attempt === 1) {
                const snapshotName = `preview-${widget}`;
                previewVisualResult = await toHaveSnapshot(page, `${testId}-preview`, snapshotName);
              }

              console.log(`   🧾 RN command: ${rnCommand}${attempt > 1 ? ` (retry ${attempt}/${maxRetries + 1})` : ''}`);

              await styleInput.clear();
              await styleInput.fill(rnCommand);
              await styleInput.press('Enter');
              await page.waitForTimeout(2000);

              const styleOutput = page.locator(outputSelector).first();
              await styleOutput.waitFor({ state: 'visible', timeout: 45000 });
              previewActual = await styleOutput.textContent();
              previewActual = previewActual?.trim() || '';

              console.log(`   📥 RN style value: ${previewActual}`);
              console.log(`   📋 Preview: RN style '${cssProperty}' → actual: ${previewActual}, expected: ${expectedValue}`);

              const previewNormalized = TokenMappingService.normalizeValue(previewActual, cssProperty);
              const expectedNormalized = TokenMappingService.normalizeValue(expectedValue, cssProperty);

              if (previewNormalized === expectedNormalized) {
                previewStatus = 'PASS';
                console.log(`   ✅ Preview PASS: '${cssProperty}' = ${previewNormalized}`);
                break;
              }
              if (attempt <= maxRetries && remainingMs() > SAFETY_MARGIN_MS + 30_000) {
                console.log(`   ⏳ Style mismatch. Will re-run in-place deploy and retry.`);
              } else {
                previewStatus = 'FAIL';
                previewError = `CSS '${cssProperty}' Expected: ${expectedNormalized}, Got: ${previewNormalized}`;
                console.log(`   ❌ Preview FAIL: ${previewError}`);
              }
            }

            await styleInput.clear();
            await styleInput.press('Enter');

            if (previewVisualResult.imagesAreEqual) {
              console.log(`   ⚠️  Preview: No visual difference detected`);
            } else {
              console.log(`   ✅ Preview: Visual change confirmed (${previewVisualResult.diffPixels || 0} pixels)`);
            }

          } catch (err: any) {
            previewStatus = 'ERROR';
            previewError = err.message;
            console.log(`   ❌ Preview: ${previewError}`);
          }

          // ========== STEP 3: RECORD RESULT ==========
          const testResult = {
            testId: `${testId}-preview`,
            widget,
            appearance,
            variant,
            state,
            tokenType,
            propertyPath: propertyPath.join('.'),
            tokenRef,
            expectedValue,
            canvas: {
              status: 'SKIPPED' as const,
              actualValue: null,
              error: null,
              visualChange: false,
            },
            preview: {
              status: previewStatus as 'PASS' | 'FAIL' | 'ERROR' | 'SKIPPED',
              actualValue: previewActual,
              error: previewError,
              visualChange: !previewVisualResult.imagesAreEqual,
              diffPixels: previewVisualResult.diffPixels,
            },
            overallStatus: previewStatus as 'PASS' | 'FAIL' | 'ERROR',
            timestamp: new Date().toISOString(),
          };

          previewReporter.recordResult(testResult);

          // Attach style verdict to Playwright report
          const previewVerdictReport = `Style Validation Verdict: Preview
=========================================
🔑 Token: ${tokenRef} → Expected value: ${expectedValue}
🔑 Property path: ${propertyPath.join('.')} → CSS property: ${cssProperty}
📍 XPath for styles: ${previewSelector}
📋 Command: ${rnCommand}

🎨 CANVAS: ⚪ SKIPPED (Preview-only suite)

🌐 PREVIEW: ${previewStatus === 'PASS' ? '✅ PASS' : previewStatus === 'FAIL' ? '❌ FAIL' : '⚠️ ERROR'}
   Actual: ${previewActual ?? 'N/A'}
   Error: ${previewError ?? 'None'}
   Visual Change: ${previewVisualResult.imagesAreEqual ? 'No' : 'Yes'}${previewVisualResult.diffPixels != null ? ` (${previewVisualResult.diffPixels} pixels)` : ''}
=========================================`;
          await test.info().attach('style-verdict.txt', {
            body: previewVerdictReport,
            contentType: 'text/plain',
          });

          const resultsDir = path.join(process.cwd(), 'artifacts', 'slot-test-results');
          if (!fs.existsSync(resultsDir)) {
            fs.mkdirSync(resultsDir, { recursive: true });
          }
          fs.writeFileSync(
            path.join(resultsDir, `${testId}-preview.json`),
            JSON.stringify(testResult, null, 2)
          );

          // ========== STEP 4: ROLLBACK (commented out for now) ==========
          // await rollbackToken(studioClient, studioFileName!);

          // Assert
          expect(previewStatus, `Preview failed: ${previewError || 'unknown error'}`).toBe('PASS');
        });
      }
    });
  }

  // Generate Preview reports after all Preview tests
  test.afterAll(async () => {
    console.log('\n📊 Generating Preview Token Validation Reports...');
    const reportsDir = path.join(process.cwd(), 'artifacts', 'playwright-token-reports', 'preview');

    const resultsDir = path.join(process.cwd(), 'artifacts', 'slot-test-results');
    if (fs.existsSync(resultsDir)) {
      previewReporter.loadResultsFromArtifacts(resultsDir);
    }

    const widgets = Array.from(testCasesByWidget.keys());
    for (const widget of widgets) {
      const widgetResults = previewReporter.getResultsForWidget(widget);
      if (widgetResults && widgetResults.length > 0) {
        previewReporter.saveComparisonTable(widget, reportsDir);
      }
    }

    previewReporter.saveOverallSummary(reportsDir, widgets);
    previewReporter.exportToJson(reportsDir, widgets);

    console.log('\n✅ Preview token validation reports generated!');
    console.log(`📁 Reports location: ${reportsDir}`);
  });
});
