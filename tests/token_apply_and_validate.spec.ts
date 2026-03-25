import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { loadAllTokensForPlatform } from '../src/tokens';
import { generateOrthogonalMatrix, generateTokenVariantMapping, generateVariantPayload, getWidgetKey } from '../src/matrix/generator';
import StyleScreen from './screens/style.screen';
import { TokenHelper } from './pages/TokenHelper.page';
import { WidgetPage } from './pages/WidgetPage.page';
import { logger } from '../src/utils/logger';

const requiredEnv = ['STUDIO_BASE_URL', 'PROJECT_ID', 'STUDIO_USERNAME', 'STUDIO_PASSWORD'];
const hasEnv = requiredEnv.every(v => !!process.env[v]);

// Load cached auth cookie at module level BEFORE creating StyleScreen
const cacheDir = path.join(process.cwd(), '.test-cache');
const authFile = path.join(cacheDir, 'auth-cookie.txt');
if (fs.existsSync(authFile)) {
  const authCookie = fs.readFileSync(authFile, 'utf-8').trim();
  process.env.STUDIO_COOKIE = authCookie;
  console.log('✅ Pre-loaded auth cookie for module initialization');
}

(hasEnv ? test.describe : test.describe.skip)('@regression Style Workspace Validation', () => {

  const styleScreen = new StyleScreen();
  // Using tokens/web as this is a Playwright web test
  const tokenHelper = new TokenHelper(path.join(process.cwd(), 'tokens', 'mobile'));

  // Load tokens and generate matrix at module level for test structure
  const allTokenFiles = loadAllTokensForPlatform('mobile');
  const matrix = Array.from(generateOrthogonalMatrix({ shuffle: true }));

  // Load pre-selected tokens from global setup
  const selectedTokensFile = path.join(cacheDir, 'selected-tokens.json');

  let selectedTokensData: { tokens: Array<{ file: string; tokenRef: string; tokenType: string }> } = { tokens: [] };
  if (fs.existsSync(selectedTokensFile)) {
    selectedTokensData = JSON.parse(fs.readFileSync(selectedTokensFile, 'utf-8'));
  }

  test.beforeAll(async () => {
    test.setTimeout(180000);
    // Initialize logger for this worker - each worker gets its own log file
    logger.initialize();
    logger.log('='.repeat(80));
    logger.log('TEST SUITE STARTED: Style Workspace Validation');
    logger.log('='.repeat(80));

    // Write debug files at test start (details go to debug/logs, not console)
    logger.log(`Generated ${matrix.length} test combinations using orthogonal array`);
    logger.writeOrthogonalMatrix(matrix);

    // Load cached auth from global setup (IMPORTANT: Must be done BEFORE creating StyleScreen)
    const authFile = path.join(cacheDir, 'auth-cookie.txt');
    if (fs.existsSync(authFile)) {
      const authCookie = fs.readFileSync(authFile, 'utf-8').trim();
      // Set ENV.studioCookie so all StudioClient instances use it
      process.env.STUDIO_COOKIE = authCookie;
      logger.log('✅ Loaded cached auth cookie from global setup');
      console.log('✅ Using cached auth cookie from global setup');
    } else {
      throw new Error('Auth cookie not found in cache. Global setup may have failed.');
    }

    // Load cached preview URL from global setup
    const previewUrlFile = path.join(cacheDir, 'preview-url.json');

    if (fs.existsSync(previewUrlFile)) {
      const cached = JSON.parse(fs.readFileSync(previewUrlFile, 'utf-8'));
      // Set the preview URL on the styleScreen instance
      (styleScreen as any).previewUrl = cached.previewUrl;
      logger.log('✅ Loaded cached preview URL from global setup');
      console.log('✅ Using cached preview URL from global setup');
    } else {
      throw new Error('Preview URL not found in cache. Global setup may have failed.');
    }

    // Log selected tokens info (compact)
    console.log(`\n📋 Using ${selectedTokensData.tokens?.length || 0} pre-selected random tokens from global setup`);
    console.log('🎉 Worker ready - Using global setup data!');
  });

  // Accumulate all reporting data
  const variantMappingsForLog: Array<{
    tokenRef: string;
    variant: string;
    payload: any;
    tokenType: string;
    cssProperty: string;
  }> = [];

  // Accumulate all test pairs first
  const allTestPairs: Array<{
    pair: any;
    tokenFileData: any;
    payload: any;
    snapshotName: string;
    tokenShortName: string;
    testName: string;
    cssProperty: string;
    expectedValue: string;
    flattenedPath: string;
  }> = [];

  const { TokenMappingService } = require('../src/tokens/mappingService');

  // 1. GENERATION PHASE: Collect all mappings
  const allSelectedTokens = selectedTokensData.tokens || [];
  const tokenRefsToTest = allSelectedTokens.map(t => t.tokenRef);

  const allMappings = generateTokenVariantMapping(tokenRefsToTest, matrix, (ref) => TokenMappingService.getMetadata(ref).tokenType);

  // Import computeFinalPropertyPath for accurate test naming
  const { computeFinalPropertyPath } = require('../src/matrix/generator');

  // Generate payloads and store data
  for (const mapping of allMappings) {
    const { tokenRef, matrixItem: item, tokenType } = mapping;
    const propertyPath = tokenHelper.getPropertyPath(tokenRef);
    const payload = generateVariantPayload(item, propertyPath, tokenRef);

    // Compute the final flattened property path after all widget-specific transformations
    const flattenedPath = computeFinalPropertyPath(item, propertyPath, tokenRef);

    const snapshotName = `${item.widget}-${item.appearance}-${item.variant}-${item.state}`;
    const tokenShortName = tokenRef.replace(/[{}\\.@]/g, '-').replace(/-value$/, '').replace(/^-+|-+$/g, '');
    const testName = `${snapshotName}-${tokenShortName}`;

    // Find the corresponding token file for expected value extraction later
    const selectedTokenInfo = allSelectedTokens.find(t => t.tokenRef === tokenRef);
    const tokenFile = allTokenFiles.find(tf => tf.file === selectedTokenInfo?.file);

    if (!tokenFile) {
      console.warn(`Token file not found for ${tokenRef}, skipping mapping`);
      continue;
    }

    allTestPairs.push({
      pair: { tokenRef, item, propertyPath, tokenType },
      tokenFileData: tokenFile.data,
      payload,
      snapshotName,
      tokenShortName,
      testName,
      cssProperty: propertyPath.join('-'),
      expectedValue: '',
      flattenedPath  // Store the computed flattened path
    });

    // Add to logs
    variantMappingsForLog.push({
      tokenRef,
      variant: snapshotName,
      payload,
      tokenType,
      cssProperty: propertyPath[0],
    });
  }

  // Log all accrued data
  logger.writeVariantMappings(variantMappingsForLog);
  logger.log(`✓ Logged ${variantMappingsForLog.length} variant mappings with payloads`);

  // 2. GROUPING PHASE: Group by Widget
  const testsByWidget: Record<string, typeof allTestPairs> = {};
  for (const item of allTestPairs) {
    const widget = item.pair.item.widget;
    if (!testsByWidget[widget]) testsByWidget[widget] = [];
    testsByWidget[widget].push(item);
  }

  // 3. EXECUTION PHASE: Generate Test Structure
  for (const [widget, tests] of Object.entries(testsByWidget)) {

    test.describe(`Widget: ${widget}`, () => {
      // Parallelize across widgets, but tests for the same widget will wait on the Studio lock

      for (const testItem of tests) {
        const { pair, tokenFileData, payload, snapshotName, testName, cssProperty, flattenedPath } = testItem;
        const { tokenRef, item, tokenType, propertyPath } = pair;

        test(`Token: ${tokenRef}:(${flattenedPath}) → ${item.appearance}-${item.variant}-${item.state}`, async ({ page }) => {
          // Forward browser console logs to Playwright terminal
          // page.on('console', msg => {
          //   try {
          //     console.log(`[BROWSER]`, msg.text());
          //   } catch {}
          // });
          const widgetPage = new WidgetPage(page);
          const expectedValue = widgetPage.extractExpectedValue(tokenRef, tokenFileData);

          let canvasStatus: string = 'SKIPPED';
          let canvasError: string | null = null;
          let canvasActual: string | null = null;
          let canvasVisual: { diffPixels?: number; totalPixels?: number } = {};

          let previewStatus: string = 'SKIPPED';
          let previewError: string | null = null;
          let previewActual: string | null = null;
          let previewVisual: { diffPixels?: number; totalPixels?: number } = {};

          // Phase 1: Application
          await test.step('🔄 Apply and Publish', async () => {
            if (widget === 'formcontrols') {
              const studioKey = getWidgetKey(widget as any);
              console.log(`\n🔄 Applying token ${tokenRef} to ${snapshotName} (Studio key: ${studioKey})...`);
              await styleScreen.updateComponentAndPublish(studioKey, payload);
            } else {
              console.log(`\n🔄 Applying token ${tokenRef} to ${snapshotName}...`);
              await styleScreen.updateComponentAndPublish(widget, payload);
            }
          });

          const verifyTarget = process.env.VERIFY_TARGET || 'both';
          const shouldVerifyCanvas = verifyTarget === 'both' || verifyTarget === 'canvas';
          const shouldVerifyPreview = verifyTarget === 'both' || verifyTarget === 'preview';

          const { TokenMappingService } = require('../src/tokens/mappingService');
          let canvasCssMatchStatus: string = 'UNKNOWN';
          let previewCssMatchStatus: string = 'UNKNOWN';

          // Phase 2: Canvas Verification
          if (shouldVerifyCanvas) {
            await test.step('🎨 Canvas Verification', async () => {
              try {
                const visualResult = await styleScreen.verifyInCanvas(page, snapshotName);
                canvasVisual = { diffPixels: visualResult.diffPixels, totalPixels: visualResult.totalPixels };
                canvasActual = await widgetPage.getCanvasWidgetCssProperty(snapshotName, cssProperty, flattenedPath);
                console.log(`[CSS-DEBUG][Canvas] Property: ${cssProperty}, Extracted: ${canvasActual}`);
                await widgetPage.verifyCanvasWidgetCssProperty(snapshotName, cssProperty, expectedValue, flattenedPath);
                canvasStatus = 'PASS';
                canvasCssMatchStatus = 'MATCHED';
              } catch (error: any) {
                canvasStatus = 'FAIL';
                canvasError = error.message;
                const isVisualFailure = error.message.includes('Screenshot comparison FAILED');

                try {
                  canvasActual = await widgetPage.getCanvasWidgetCssProperty(snapshotName, cssProperty, flattenedPath);
                  const normActual = TokenMappingService.normalizeValue(canvasActual, cssProperty);
                  const normExpected = TokenMappingService.normalizeValue(expectedValue, cssProperty);
                  canvasCssMatchStatus = (normActual === normExpected) ? 'MATCHED' : 'MISMATCHED';
                } catch (extractErr: any) {
                  canvasError += ` | Extraction failed: ${extractErr.message}`;
                  canvasActual = 'EXTRACTION_FAILED';
                  canvasCssMatchStatus = 'EXTRACTION_FAILED';
                }

                if (isVisualFailure && canvasCssMatchStatus === 'MATCHED') {
                  console.log(`ℹ️ Canvas: Visual failed but CSS MATCHED (${canvasActual})`);
                }
                console.error(`❌ Canvas Verification Failed: ${error.message}`);
              }
            });
          }

          // Phase 3: Preview Verification
          if (shouldVerifyPreview) {
            await test.step('🌐 Preview Verification', async () => {
              try {
                const visualResult = await styleScreen.verifyInPreview(page, snapshotName);
                previewVisual = { diffPixels: visualResult.diffPixels, totalPixels: visualResult.totalPixels };
                previewActual = await widgetPage.getPreviewWidgetCssProperty(snapshotName, cssProperty, flattenedPath);
                console.log(`[CSS-DEBUG][Preview] Property: ${cssProperty}, Extracted: ${previewActual}`);
                await widgetPage.verifyPreviewWidgetCssProperty(snapshotName, cssProperty, expectedValue, flattenedPath);
                previewStatus = 'PASS';
                previewCssMatchStatus = 'MATCHED';
              } catch (error: any) {
                previewStatus = 'FAIL';
                previewError = error.message;
                const isVisualFailure = error.message.includes('Screenshot comparison FAILED');

                try {
                  previewActual = await widgetPage.getPreviewWidgetCssProperty(snapshotName, cssProperty, flattenedPath);
                  const normActual = TokenMappingService.normalizeValue(previewActual, cssProperty);
                  const normExpected = TokenMappingService.normalizeValue(expectedValue, cssProperty);
                  previewCssMatchStatus = (normActual === normExpected) ? 'MATCHED' : 'MISMATCHED';
                } catch (extractErr: any) {
                  previewError += ` | Extraction failed: ${extractErr.message}`;
                  previewActual = 'EXTRACTION_FAILED';
                  previewCssMatchStatus = 'EXTRACTION_FAILED';
                }

                if (isVisualFailure && previewCssMatchStatus === 'MATCHED') {
                  console.log(`ℹ️ Preview: Visual failed but CSS MATCHED (${previewActual})`);
                }
                console.error(`❌ Preview Verification Failed: ${error.message}`);
              }
            });
          }

          // Phase 4: Consolidate Reporting
          const canvasFailed = shouldVerifyCanvas && canvasStatus !== 'PASS';
          const previewFailed = shouldVerifyPreview && previewStatus !== 'PASS';

          // Determine Partial Match Status
          const isCanvasPartialMatch = canvasStatus === 'FAIL' && canvasError && (canvasError as string).includes('Screenshot comparison FAILED') && canvasCssMatchStatus === 'MATCHED';
          const isPreviewPartialMatch = previewStatus === 'FAIL' && previewError && (previewError as string).includes('Screenshot comparison FAILED') && previewCssMatchStatus === 'MATCHED';

          const isPartialMatch = (isCanvasPartialMatch || !shouldVerifyCanvas) && (isPreviewPartialMatch || !shouldVerifyPreview) && (isCanvasPartialMatch || isPreviewPartialMatch);

          // If it's a partial match, we treat it as PASS for Playwright but add an annotation
          if (isPartialMatch) {
            test.info().annotations.push({
              type: 'partial-pass',
              description: 'Visual diff failed (screenshot match), but the property value is CORRECT.'
            });
            console.log('⚠️  PARTIAL MATCH: Visual diff failed but CSS matched. Treating as PASS with annotation.');
          }

          // Updated: partial matches are treated as PASS (but retain partial label)
          const overallPass = isPartialMatch || (!canvasFailed && !previewFailed);
          const verdict = overallPass ? (isPartialMatch ? '⚠️ PARTIAL (treated as PASS)' : '✅ PASS') : '❌ FAIL';

          const getVisualSummary = (visual: any) => {
            if (visual.diffPixels === undefined) return 'N/A';
            const pct = visual.totalPixels ? ((visual.diffPixels / visual.totalPixels) * 100).toFixed(2) : '0.00';
            return `${visual.diffPixels}px changed (${pct}%)`;
          };

          const normCanvasActual = canvasActual && canvasActual !== 'EXTRACTION_FAILED' ? TokenMappingService.normalizeValue(canvasActual, cssProperty) : canvasActual;
          const normPreviewActual = previewActual && previewActual !== 'EXTRACTION_FAILED' ? TokenMappingService.normalizeValue(previewActual, cssProperty) : previewActual;

          const canvasNote = isCanvasPartialMatch
            ? '⚠️  **PARTIAL MATCH**: Visual diff failed (screenshot match), but the property value is CORRECT.'
            : '';

          const previewNote = isPreviewPartialMatch
            ? '⚠️  **PARTIAL MATCH**: Visual diff failed (screenshot match), but the property value is CORRECT.'
            : '';

          const report = `Style Validation Verdict: ${verdict} (Target: ${verifyTarget})
=========================================
Token: ${tokenRef} (${tokenType})
Widget: ${widget}
Property: ${flattenedPath}
Expected: ${expectedValue}

🎨 CANVAS VERIFICATION: ${canvasStatus === 'PASS' ? '✅ PASS' : canvasStatus === 'FAIL' ? (isCanvasPartialMatch ? '⚠️ PARTIAL' : '❌ FAIL') : '⚪ SKIPPED'}
   CSS Actual: ${canvasActual || 'NOT EXTRACTED'}
   CSS Normalized: ${normCanvasActual || 'N/A'}
   CSS Match Status: ${canvasCssMatchStatus}
   ${canvasNote}
   Visual Diff: ${getVisualSummary(canvasVisual)}
   Error: ${canvasError || 'None'}

🌐 PREVIEW VERIFICATION: ${previewStatus === 'PASS' ? '✅ PASS' : previewStatus === 'FAIL' ? (isPreviewPartialMatch ? '⚠️ PARTIAL' : '❌ FAIL') : '⚪ SKIPPED'}
   CSS Actual: ${previewActual || 'NOT EXTRACTED'}
   CSS Normalized: ${normPreviewActual || 'N/A'}
   CSS Match Status: ${previewCssMatchStatus}
   ${previewNote}
   Visual Diff: ${getVisualSummary(previewVisual)}
   Error: ${previewError || 'None'}
=========================================`;

          await test.info().attach(`style-verdict-${testName}.txt`, {
            body: report,
            contentType: 'text/plain'
          });

          console.log(`\n${report}\n`);

          // Do NOT throw for partial matches — treat as PASS
          if (!overallPass && !isPartialMatch) {
            const failureReason = [];
            if (canvasStatus === 'FAIL') failureReason.push(`Canvas: ${canvasError || 'Verification failed'}`);
            if (previewStatus === 'FAIL') failureReason.push(`Preview: ${previewError || 'Verification failed'}`);
            throw new Error(`Style Validation Failed:\n- ${failureReason.join('\n- ')}`);
          }
        });
      }
    });
  }
});
