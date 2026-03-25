import { chromium, FullConfig } from '@playwright/test';
import StudioScreen from './screens/studio.screen';
import StyleScreen from './screens/style.screen';
import { loadAllTokensForPlatform } from '../src/tokens';
import { TokenHelper } from './pages/TokenHelper.page';
import { ENV } from '../src/utils/env';
import { gotoCanvas, gotoPreview } from '../src/playwright/helpers';
import { WIDGET_CONFIG, Widget } from '../src/matrix/widgets';
import { getWidgetKey } from '../src/matrix/generator';
import data from './testdata/data.json';
import fs from 'fs';
import path from 'path';

/**
 * Global setup runs once before all test workers start.
 * This performs authentication, fetches preview URL, and takes base screenshots.
 * The results are cached and shared with all workers.
 */
async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting Global Setup...');

  // Clean up old test artifacts
  console.log('🧹 Cleaning up old test artifacts...');

  // Clear debug logs folder
  const debugLogsDir = path.join(process.cwd(), 'debug', 'logs');
  if (fs.existsSync(debugLogsDir)) {
    const files = fs.readdirSync(debugLogsDir);
    files.forEach(file => fs.unlinkSync(path.join(debugLogsDir, file)));
    console.log('✅ Cleared debug/logs folder');
  }

  // Clear base screenshots folder
  const baseImageDir = path.join(process.cwd(), 'screenshots', 'base-image');
  if (fs.existsSync(baseImageDir)) {
    const files = fs.readdirSync(baseImageDir);
    files.forEach(file => {
      const filePath = path.join(baseImageDir, file);
      if (fs.statSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
      }
    });
    console.log('✅ Cleared screenshots/base-image folder');
  }

  // Clear actual screenshots folder
  const actualImageDir = path.join(process.cwd(), 'screenshots', 'actual-image');
  if (fs.existsSync(actualImageDir)) {
    const files = fs.readdirSync(actualImageDir);
    files.forEach(file => {
      const filePath = path.join(actualImageDir, file);
      if (fs.statSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
      }
    });
    console.log('✅ Cleared screenshots/actual-image folder');
  }

  // Clear merged-payloads directory
  const artifactsDir = path.join(process.cwd(), 'artifacts', 'merged-payloads');
  if (fs.existsSync(artifactsDir)) {
    const files = fs.readdirSync(artifactsDir);
    files.forEach(file => fs.unlinkSync(path.join(artifactsDir, file)));
    console.log('✅ Cleared artifacts/merged-payloads folder');
  }

  // Create cache directory for storing shared data
  const cacheDir = path.join(process.cwd(), '.test-cache');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  // Parse TEST_WIDGETS filter early so it applies to generation, payloads, and revert
  const widgetFilter = process.env.TEST_WIDGETS?.split(',').map(w => w.trim()).filter(Boolean);
  if (widgetFilter?.length) {
    console.log(`\n🎯 TEST_WIDGETS filter active: ${widgetFilter.join(', ')}`);
  }

  // ========== SLOT-BASED TEST CASE GENERATION ==========
  // Generate test cases from widget-token-slots.json for 100% coverage
  console.log('\n📋 Generating Slot-Based Test Cases...');
  
  // Hardcoded path: tokens/mobile/global/ only
  const { loadGlobalTokenMap } = require('../src/playwright/globalTokenLoader');
  const tokenMap = loadGlobalTokenMap();
  
  console.log(`   ✅ Loaded ${Object.keys(tokenMap).length} GLOBAL tokens from: tokens/mobile/global/`);
  
  const { TokenSlotGenerator } = require('../src/playwright/tokenSlotGenerator');
  const generator = new TokenSlotGenerator();
  const allTestCases = generator.generateAllTestCases(tokenMap, widgetFilter);
  
  // Save test cases
  const testCasesPath = path.join(cacheDir, 'slot-test-cases.json');
  generator.saveTestCases(allTestCases, testCasesPath);
  
  // Generate and display coverage report
  const coverageReport = generator.generateCoverageReport(allTestCases);
  console.log(coverageReport);
  
  console.log(`✅ Generated ${allTestCases.length} slot-based test cases using GLOBAL tokens only`);

  // ========== GENERATE MERGED PAYLOADS PER WIDGET ==========
  console.log('\n📦 Generating merged payloads per widget...');
  const payloadsDir = path.join(cacheDir, 'payloads');
  if (!fs.existsSync(payloadsDir)) {
    fs.mkdirSync(payloadsDir, { recursive: true });
  } else {
    // Clear existing payload files
    const existingFiles = fs.readdirSync(payloadsDir);
    existingFiles.forEach(file => fs.unlinkSync(path.join(payloadsDir, file)));
  }

  // Group test cases by widget
  const tcByWidget = new Map<string, any[]>();
  for (const tc of allTestCases) {
    if (!tcByWidget.has(tc.widget)) tcByWidget.set(tc.widget, []);
    tcByWidget.get(tc.widget)!.push(tc);
  }

  // Deep merge utility
  function deepMerge(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      if (
        result[key] && typeof result[key] === 'object' && !Array.isArray(result[key]) &&
        source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])
      ) {
        result[key] = deepMerge(result[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  for (const [widgetName, cases] of tcByWidget.entries()) {
    let mergedPayload: Record<string, any> = {};
    for (const tc of cases) {
      const individualPayload = generator.generatePayloadForTestCase(tc);
      mergedPayload = deepMerge(mergedPayload, individualPayload);
    }
    const outputFile = path.join(payloadsDir, `${widgetName}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(mergedPayload, null, 2));
    console.log(`   ✅ Merged payload for ${widgetName}: ${cases.length} slots → ${path.relative(process.cwd(), outputFile)}`);
  }
  console.log(`✅ Merged payloads saved to: ${path.relative(process.cwd(), payloadsDir)}`);

  // Select random tokens from each file
  console.log('\n📋 Selecting Random Tokens...');
  // For web Playwright flows, load tokens from tokens/web/**
  const allTokenFiles = loadAllTokensForPlatform('mobile');
  const tokenHelper = new TokenHelper(path.join(process.cwd(), 'tokens/mobile'));
  const selectedTokens: Array<{
    file: string;
    tokenRef: string;
    tokenType: string;
    selectedAt: string;
  }> = [];

  // Validate environment at the very start
  ENV.validate();

  const { TokenMappingService } = require('../src/tokens/mappingService');

  // helper removed in favor of TokenMappingService.normalizeTokenType

  const inferTokenType = (selectedToken: string, tokenFile: { file: string; data: any }): string => {
    const normalizedPath = tokenFile.file.replace(/\\/g, '/');

    // Global font tokens: treat all as logical "font" regardless of path prefix (e.g. h1/h2/...)
    if (normalizedPath.includes('/tokens/mobile/global/font/font.json')) {
      return 'font';
    }

    const tokenMatch = selectedToken.match(/^\{([^}]+)\}/);
    if (!tokenMatch) return 'color';

    const parts = tokenMatch[1].split('.');

    // Component tokens under tokens/web/components should use their JSON "type"/"attributes.subtype"
    const isComponent = normalizedPath.includes('/tokens/mobile/components/');
    if (isComponent && parts.length >= 2) {
      // Walk JSON to the node that owns this value (exclude trailing "value")
      let node: any = tokenFile.data;
      for (let i = 0; i < parts.length - 1; i++) {
        const key = parts[i];
        if (!node || typeof node !== 'object') break;
        node = node[key];
      }
      if (node && typeof node === 'object' && typeof node.type === 'string') {
        const mainType = node.type as string;
        const subtype = typeof node.attributes?.subtype === 'string' ? (node.attributes.subtype as string) : undefined;
        return TokenMappingService.normalizeTokenType(mainType, subtype);
      }
      // Fallback to path-based heuristics if JSON type not available
    }

    // Default heuristics delegated to mapping service
    return TokenMappingService.getMetadata(selectedToken).tokenType;
  };

  for (const tokenFile of allTokenFiles) {
    const normalizedPath = tokenFile.file.replace(/\\/g, '/');
    // Revert to simple behavior: only use global web tokens
    // tokens/web/global/** JSON files
    if (!normalizedPath.includes('/tokens/mobile/global/')) {
      continue;
    }

    const tokenReferences = tokenHelper.buildTokenReferences(tokenFile.data);

    if (tokenReferences.length === 0) {
      console.warn(`⚠️  ${path.basename(tokenFile.file)} - No tokens found, skipping`);
      continue;
    }

    // Pick 1-2 random tokens from this file
    // This provides better coverage than a single token while keeping test count manageable
    const tokensToSelectCount = Math.min(tokenReferences.length, Math.floor(Math.random() * 2) + 1);

    // Shuffle and slice to pick random tokens
    const shuffledTokens = tokenReferences.sort(() => 0.5 - Math.random());
    const pickedTokens = shuffledTokens.slice(0, tokensToSelectCount);

    for (const selectedToken of pickedTokens) {
      const tokenType = inferTokenType(selectedToken, tokenFile);

      selectedTokens.push({
        file: tokenFile.file,
        tokenRef: selectedToken,
        tokenType,
        selectedAt: new Date().toISOString()
      });

      const fileName = path.basename(tokenFile.file);
      console.log(`   ✓ ${fileName.padEnd(25)} → ${selectedToken}`);
    }
  }

  // Calculate test counts
  const totalFiles = selectedTokens.length;
  const totalTokens = selectedTokens.length;
  const totalTestCases = selectedTokens.length * 2; // canvas + preview

  console.log('\n📊 Test Execution Plan:');
  console.log(`   - Token files found: ${totalFiles}`);
  console.log(`   - Random tokens selected: ${totalTokens}`);
  console.log(`   - Test cases to execute: ${totalTestCases} (${totalTokens} canvas + ${totalTokens} preview)`);

  // Save selected tokens to cache
  const selectedTokensFile = path.join(cacheDir, 'selected-tokens.json');
  fs.writeFileSync(selectedTokensFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    totalFiles,
    totalTokens,
    totalTestCases,
    tokens: selectedTokens
  }, null, 2));
  console.log(`\n✅ Selected tokens saved to: ${path.relative(process.cwd(), selectedTokensFile)}\n`);

  const useGoogle = ENV.isGoogleAuth;
  const browser = await chromium.launch({
    headless: !useGoogle,
    ...(useGoogle ? {
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-first-run',
        '--no-default-browser-check',
      ],
    } : {}),
  });
  const context = await browser.newContext({
    ...(useGoogle ? {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    } : {}),
  });
  const page = await context.newPage();

  const studioScreen = new StudioScreen(page);

  try {
    // Step 1: Login and save authentication state
    console.log('Step 1/3: Logging into Studio...');
    const authCookie = await studioScreen.login();
    console.log('✅ Logged into Studio successfully');

    // Save authentication state
    fs.writeFileSync(path.join(cacheDir, 'auth-cookie.txt'), authCookie);
    process.env.STUDIO_COOKIE = authCookie;
    console.log('✅ Authentication cookie saved');

    // Create StyleScreen AFTER login so it picks up the auth cookie
    const styleScreen = new StyleScreen();

    await context.storageState({ path: path.join(cacheDir, 'auth.json') });
    console.log('✅ Authentication state saved');

    // Step 1.5: Global Rollback (Reset all widgets to valid Clean State)
    console.log('\n🔄 Performing Styles Reset..');
    const { StudioClient } = require('../src/api/studioClient');
    const client = new StudioClient({
      baseUrl: process.env.STUDIO_BASE_URL || '',
      projectId: process.env.PROJECT_ID || '',
      cookie: authCookie,
    });

    const allWidgetsToReset = Object.keys(WIDGET_CONFIG);
    const widgetsToReset = widgetFilter?.length
      ? allWidgetsToReset.filter(w => widgetFilter.includes(w))
      : allWidgetsToReset;
    console.log(`   Resetting overrides for ${widgetsToReset.length} widgets: ${widgetsToReset.join(', ')}`);

    // Map WIDGET_CONFIG keys to their Studio server file names.
    // Only formcontrols differs (file is form-controls/form-controls.json).
    const studioFileNameMap: Record<string, string> = {
      'formcontrols': 'form-controls',
    };
    const toStudioFileName = (w: string) => studioFileNameMap[w] || w;

    for (const widget of widgetsToReset) {
      try {
        const studioFileName = toStudioFileName(widget);
        await client.updateComponentOverride(studioFileName, {});
        console.log(`   ✓ Reverted styles for ${widget} (file: ${studioFileName})`);
      } catch (err: any) {
        console.warn(`   ⚠️ Failed to revert styles for ${widget}:`, err.message);
      }
    }

    try {
      await client.publishAndBuild();
      console.log('✅ Reverted Styles successfully');
    } catch (err: any) {
      console.warn('⚠️ Failed to revert Styles:', err.message);
    }
    console.log('✅ Reverting Styles completed\n');

    // Step 2: Get Preview URL and save to cache
    console.log('Step 2/3: Obtaining Preview URL...');
    const previewUrl = await styleScreen.getPreviewUrl();
    console.log('✅ Obtained Preview URL successfully:', previewUrl);
    fs.writeFileSync(
      path.join(cacheDir, 'preview-url.json'),
      JSON.stringify({ previewUrl, timestamp: new Date().toISOString() })
    );
    console.log('✅ Preview URL cached');

    // Step 3: Take Base Screenshots
    console.log('Step 3/3: Taking base screenshots...');

    // For global setup, we'll take screenshots directly without comparison
    // since test.info() is not available outside test context
    const screenshotsDir = path.join(process.cwd(), 'screenshots', 'base-image');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    const allWidgets = Object.keys(WIDGET_CONFIG) as Widget[];
    const widgets = widgetFilter?.length
      ? allWidgets.filter(w => widgetFilter.includes(w))
      : allWidgets;
    
    console.log('📸 Generating baseline screenshots for widgets:', widgets.join(', '));

    const PARALLEL_WORKERS = Math.min(4, widgets.length);
    console.log(`🔧 Using ${PARALLEL_WORKERS} parallel workers for baseline capture`);

    const HIDDEN_BY_DEFAULT_WIDGETS = new Set(['bottomsheet', 'modal-dialog']);

    async function captureCanvasBaseline(widget: string) {
      const canvasSelector = (data.style.canvasSelectors as Record<string, string>)[widget];
      if (!canvasSelector) {
        console.log(`⏭️  Skipping canvas baseline for ${widget} (no selector in data.json)`);
        return;
      }

      const MAX_ATTEMPTS = 3;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const workerContext = await browser.newContext({ storageState: path.join(cacheDir, 'auth.json') });
        const workerPage = await workerContext.newPage();
        try {
          await gotoCanvas(workerPage, widget);
          console.log(`⏳ [canvas] Waiting for ${widget}: ${canvasSelector}${attempt > 1 ? ` (attempt ${attempt}/${MAX_ATTEMPTS})` : ''}`);
          const waitState = HIDDEN_BY_DEFAULT_WIDGETS.has(widget) ? 'attached' : 'visible';
          await workerPage.waitForSelector(canvasSelector, { state: waitState as any, timeout: 30000 });

          const canvasScreenshot = path.join(screenshotsDir, `canvas-${widget}.png`);
          await workerPage.screenshot({ path: canvasScreenshot, fullPage: false });
          console.log(`✅ Saved canvas baseline for ${widget}`);
          return;
        } catch (err: any) {
          if (attempt < MAX_ATTEMPTS) {
            console.warn(`⚠️  Canvas baseline attempt ${attempt}/${MAX_ATTEMPTS} failed for ${widget}, retrying...`);
          } else {
            console.warn(`⚠️  Canvas baseline failed for ${widget} after ${MAX_ATTEMPTS} attempts: ${err.message}`);
          }
        } finally {
          await workerPage.close();
          await workerContext.close();
        }
      }
    }

    async function capturePreviewBaseline(widget: string) {
      const previewSelector = (data.style.previewSelectors as Record<string, string>)[widget];
      if (!previewSelector) {
        console.log(`⏭️  Skipping preview baseline for ${widget} (no selector in data.json)`);
        return;
      }

      const MAX_ATTEMPTS = 3;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const workerContext = await browser.newContext({ storageState: path.join(cacheDir, 'auth.json') });
        const workerPage = await workerContext.newPage();
        try {
          await gotoPreview(workerPage, widget, previewUrl);
          try {
            await workerPage.waitForSelector(previewSelector, { state: 'visible', timeout: 30000 });
          } catch {
            console.warn(`⚠️  [preview] Selector not visible for ${widget}, capturing page as-is`);
          }

          const previewScreenshot = path.join(screenshotsDir, `preview-${widget}.png`);
          await workerPage.screenshot({ path: previewScreenshot, fullPage: false });
          console.log(`✅ Saved preview baseline for ${widget}`);
          return;
        } catch (err: any) {
          if (attempt < MAX_ATTEMPTS) {
            console.warn(`⚠️  Preview baseline attempt ${attempt}/${MAX_ATTEMPTS} failed for ${widget}, retrying...`);
          } else {
            console.warn(`⚠️  Preview baseline failed for ${widget} after ${MAX_ATTEMPTS} attempts: ${err.message}`);
          }
        } finally {
          await workerPage.close();
          await workerContext.close();
        }
      }
    }

    async function runInBatches<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>) {
      for (let i = 0; i < items.length; i += concurrency) {
        const batch = items.slice(i, i + concurrency);
        await Promise.all(batch.map(fn));
      }
    }

    // Capture canvas baselines in parallel batches
    console.log('\n--- CANVAS BASELINES ---');
    await runInBatches(widgets, PARALLEL_WORKERS, captureCanvasBaseline);

    // Capture preview baselines in parallel batches
    console.log('\n--- PREVIEW BASELINES ---');
    await runInBatches(widgets, PARALLEL_WORKERS, capturePreviewBaseline);

    console.log('✅ Base screenshots captured successfully');

    console.log('🎉 Global Setup complete - Workers can now run in parallel!');
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }
}

export default globalSetup;

