import * as path from 'path';
import * as fs from 'fs';
import { remote } from 'webdriverio';
import allure from '@wdio/allure-reporter';
import { MobileWidgetPage } from '../pages/MobileWidget.page';
import { ScreenshotHelpers } from '../helpers/screenshot.helpers';
import { MobileVerificationHelper } from '../helpers/mobileVerification.helper';
import { loadMobileTestData } from '../utils/mobileTestData';
import { isLocalEnv } from '../utils/envFlags';
import { createAndroidSession, createIOSSession } from '../utils/sessionFactory';
import type { Widget } from '../../src/matrix/widgets';
import { WIDGET_CONFIG } from '../../src/matrix/widgets';

const widgetKey: Widget = 'lottie';
type Browser = WebdriverIO.Browser;

describe('Mobile Token Validation - Lottie Widget', function () {
  this.timeout(300000);

  let passedTests = 0;
  let failedTests = 0;

  const { baselineApps, actualApps } = loadMobileTestData();
  const runLocal = isLocalEnv();
  const platformMode = (process.env.MOBILE_PLATFORM || 'both').toLowerCase();
  const shouldRunAndroid = platformMode === 'android' || platformMode === 'both';
  const shouldRunIOS = platformMode === 'ios' || platformMode === 'both';

  console.log(`\n📦 [Test Data] Baseline App: ${baselineApps.android}`);
  console.log(`📦 [Test Data] Actual App:   ${actualApps.android}`);

  const batchPayloadPath = path.join(process.cwd(), '.test-cache/batch-payload-lottie.json');
  if (!fs.existsSync(batchPayloadPath)) {
    throw new Error(`Missing batch payload file: ${batchPayloadPath}`);
  }
  const appliedPayload = JSON.parse(fs.readFileSync(batchPayloadPath, 'utf-8'));

  const csvPath = path.join(process.cwd(), 'tests/testdata/mobile/lottie-widget-variants.csv');
  if (!fs.existsSync(csvPath)) {
    throw new Error(`Missing variant mapping CSV: ${csvPath}`);
  }
  const csv = fs.readFileSync(csvPath, 'utf8').trim().split(/\r?\n/);
  const variantMap: Record<string, string> = {};
  for (let i = 1; i < csv.length; i++) {
    const [variant, inst] = csv[i].split(',').map(s => s.trim());
    if (variant && inst) variantMap[variant] = inst;
  }

  const appliedPairs: Array<{
    tokenRef: string;
    variantName: string;
    studioWidgetName: string;
    propertyPath: string[];
  }> = [];

  const widgetConfig = WIDGET_CONFIG[widgetKey];
  if (!widgetConfig) {
    throw new Error(`No configuration found for widget: ${widgetKey}`);
  }

  console.log(`📋 [Widget Config] Appearances: ${widgetConfig.appearances.join(', ')}`);

  function extractTokens(
    obj: any,
    appearance: string,
    variant: string,
    propertyPath: string[] = []
  ): void {
    if (!obj || typeof obj !== 'object') return;

    if ('value' in obj && typeof obj.value === 'string') {
      let stateSuffix = 'default';
      if (propertyPath[0] === 'states' && propertyPath[1]) {
        stateSuffix = propertyPath[1];
      }

      const variantName = `${widgetKey}-${appearance}-${variant}-${stateSuffix}`;
      appliedPairs.push({
        tokenRef: obj.value,
        variantName,
        studioWidgetName: variantMap[variantName] || variantName,
        propertyPath: [...propertyPath]
      });
      return;
    }

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null) {
        extractTokens(value, appearance, variant, [...propertyPath, key]);
      }
    }
  }

  if (appliedPayload.lottie?.mapping) {
    const appearance = widgetConfig.appearances[0];
    const variant = widgetConfig.variants[appearance]?.[0] || 'standard';
    extractTokens(appliedPayload.lottie.mapping, appearance, variant, []);
  }

  console.log(`📦 [Test Data] Total Applied Token Pairs: ${appliedPairs.length}`);

  let androidBrowser: Browser | undefined;
  let iosBrowser: Browser | undefined;

  async function createAndroid(sessionName: string, type: 'baseline' | 'actual'): Promise<Browser> {
    return createAndroidSession({
      sessionName,
      type,
      runLocal,
      widgetKey,
      baselineApps,
      actualApps
    });
  }

  async function createIOS(sessionName: string, type: 'baseline' | 'actual'): Promise<Browser> {
    return createIOSSession({
      sessionName,
      type,
      runLocal,
      widgetKey,
      baselineApps,
      actualApps
    });
  }

  afterEach(function () {
    if (this.currentTest?.title?.includes('baseline vs actual screenshot')) {
      return;
    }

    if (this.currentTest?.state === 'passed') {
      passedTests++;
    } else if (this.currentTest?.state === 'failed') {
      failedTests++;
    }
  });

  it('Android baseline vs actual screenshot (lottie page)', async function () {
    if (!shouldRunAndroid) {
      console.log('⏭ Skipping Android baseline screenshot');
      this.skip();
    }

    const screenshotName = 'lottie-page';
    const screenshotHelpers = new ScreenshotHelpers();
    const widgetPage = new MobileWidgetPage();

    let baselineBrowser: Browser | undefined;
    try {
      baselineBrowser = await createAndroid(`Android Baseline - ${screenshotName}`, 'baseline');
      console.log('✅ Android baseline app launched');

      await widgetPage.navigateToWidget(baselineBrowser, widgetKey);
      await widgetPage.waitForWidget(baselineBrowser, widgetKey);

      console.log('📸 Capturing Android BASELINE screenshot...');
      const baselineBuffer = Buffer.from(await baselineBrowser.takeScreenshot(), 'base64');
      await screenshotHelpers.saveBaseline(baselineBuffer, 'android', screenshotName);
      console.log('✅ Android baseline screenshot saved');
    } catch (err: any) {
      console.error(`❌ Android baseline capture failed: ${err?.message || err}`);
      throw err;
    } finally {
      if (baselineBrowser) {
        await baselineBrowser.deleteSession();
        console.log('🧹 Closed Android baseline session');
      }
    }

    try {
      androidBrowser = await createAndroid(`Android Actual - ${screenshotName}`, 'actual');
      console.log('✅ Android ACTUAL app launched');

      await widgetPage.navigateToWidget(androidBrowser, widgetKey);
      await widgetPage.waitForWidget(androidBrowser, widgetKey);

      console.log('📸 Capturing Android ACTUAL screenshot...');
      const actualBuffer = Buffer.from(await androidBrowser.takeScreenshot(), 'base64');
      const actualPath = await screenshotHelpers.saveActual(actualBuffer, 'android', screenshotName);

      const result = await screenshotHelpers.compareWithBaseline(actualPath, 'android', screenshotName);
      console.log(
        `   📊 Android screenshot match=${result.match}, ` +
        `diffPixels=${result.diffPixels}, diff%=${result.diffPercentage.toFixed(2)}%`
      );
    } catch (err: any) {
      console.error(`Android actual screenshot failed: ${err?.message || err}`);
      throw err;
    }
  });

  it('iOS baseline vs actual screenshot (lottie page)', async function () {
    if (!shouldRunIOS) {
      console.log('⏭ Skipping iOS baseline screenshot');
      this.skip();
    }

    const screenshotName = 'lottie-page';
    const screenshotHelpers = new ScreenshotHelpers();
    const widgetPage = new MobileWidgetPage();

    let baselineBrowser: Browser | undefined;
    try {
      baselineBrowser = await createIOS(`iOS Baseline - ${screenshotName}`, 'baseline');
      console.log('✅ iOS baseline app launched');

      await widgetPage.navigateToWidget(baselineBrowser, widgetKey);
      await widgetPage.waitForWidget(baselineBrowser, widgetKey);

      console.log('📸 Capturing iOS BASELINE screenshot...');
      const baselineBuffer = Buffer.from(await baselineBrowser.takeScreenshot(), 'base64');
      await screenshotHelpers.saveBaseline(baselineBuffer, 'ios', screenshotName);
      console.log('✅ iOS baseline screenshot saved');
    } catch (err: any) {
      console.error(`❌ iOS baseline capture failed: ${err?.message || err}`);
      throw err;
    } finally {
      if (baselineBrowser) {
        await baselineBrowser.deleteSession();
        console.log('🧹 Closed iOS baseline session');
      }
    }

    try {
      iosBrowser = await createIOS(`iOS Actual - ${screenshotName}`, 'actual');
      console.log('✅ iOS ACTUAL app launched');

      await widgetPage.navigateToWidget(iosBrowser, widgetKey);
      await widgetPage.waitForWidget(iosBrowser, widgetKey);

      console.log('📸 Capturing iOS ACTUAL screenshot...');
      const actualBuffer = Buffer.from(await iosBrowser.takeScreenshot(), 'base64');
      const actualPath = await screenshotHelpers.saveActual(actualBuffer, 'ios', screenshotName);

      const result = await screenshotHelpers.compareWithBaseline(actualPath, 'ios', screenshotName);
      console.log(
        `   📊 iOS screenshot match=${result.match}, ` +
        `diffPixels=${result.diffPixels}, diff%=${result.diffPercentage.toFixed(2)}%`
      );
    } catch (err: any) {
      console.error(`iOS actual screenshot failed: ${err?.message || err}`);
      throw err;
    }
  });

  appliedPairs.forEach((pair) => {
    const { tokenRef, variantName, studioWidgetName, propertyPath } = pair;

    describe(`Token Validate: ${tokenRef} Property: ${propertyPath.join('.')}`, function () {
      it(`Android: validate ${tokenRef} @ ${variantName} [${propertyPath.join('.')}]`, async function () {
        if (!shouldRunAndroid) this.skip();

        if (!androidBrowser) {
          androidBrowser = await createAndroid(`Android Token Tests - ${widgetKey}`, 'actual');
          const widgetPageWarmup = new MobileWidgetPage();
          await widgetPageWarmup.navigateToWidget(androidBrowser, widgetKey);
          await widgetPageWarmup.waitForWidget(androidBrowser, widgetKey);
        }

        const browser = androidBrowser!;
        const widgetPage = new MobileWidgetPage();
        const screenshotHelpers = new ScreenshotHelpers();
        const verifier = new MobileVerificationHelper(widgetPage, screenshotHelpers);

        console.log(`\n🤖 [Android] Testing ${variantName} | Token=${tokenRef} | Property=${propertyPath.join('.')}`);
        await widgetPage.waitForWidget(browser, widgetKey);

        await verifier.verifyTokenApplication(
          browser,
          'android',
          widgetKey,
          variantName,
          tokenRef,
          {},
          'lottie-page',
          propertyPath
        );
      });

      afterEach(function () {
        try {
          const tokenShortName = tokenRef
            .replace(/[{}\.@]/g, '-')
            .replace(/-value$/, '')
            .replace(/^-+|-+$/g, '');
          const safeVariantName = variantName.replace(/[^a-zA-Z0-9-_]/g, '-');
          const snapshotName = `${tokenShortName}-${safeVariantName}`;
          const platform = this.currentTest?.title?.toLowerCase().includes('ios') ? 'ios' : 'android';

          const baseDir = path.join(process.cwd(), 'screenshots', 'mobile-base', platform);
          const actualDir = path.join(process.cwd(), 'screenshots', 'mobile-actual', platform);
          const diffDir = path.join(process.cwd(), 'screenshots', 'mobile-diff', platform);

          const baseFile = path.join(baseDir, `${snapshotName}.png`);
          const actualFile = path.join(actualDir, `${snapshotName}.png`);
          const diffFile = path.join(diffDir, `${snapshotName}.png`);

          if (fs.existsSync(baseFile)) {
            allure.addAttachment('Base Screenshot', fs.readFileSync(baseFile), 'image/png');
          }

          if (fs.existsSync(actualFile)) {
            allure.addAttachment('Actual Screenshot', fs.readFileSync(actualFile), 'image/png');
          }

          if (fs.existsSync(diffFile)) {
            allure.addAttachment('Diff Screenshot', fs.readFileSync(diffFile), 'image/png');
          }

          const verdictPath = path.join(
            process.cwd(),
            'artifacts',
            'mobile-styles',
            widgetKey,
            `${studioWidgetName || variantName}.styles.json`
          );
          if (fs.existsSync(verdictPath)) {
            allure.addAttachment(`Style Verdict (${variantName})`, fs.readFileSync(verdictPath), 'application/json');
          }
        } catch (err) {
          console.error(err);
        }
      });

      it(`iOS: validate ${tokenRef} @ ${variantName} [${propertyPath.join('.')}]`, async function () {
        if (!shouldRunIOS) this.skip();

        if (!iosBrowser) {
          iosBrowser = await createIOS(`iOS Token Tests - ${widgetKey}`, 'actual');
          const widgetPageWarmup = new MobileWidgetPage();
          await widgetPageWarmup.navigateToWidget(iosBrowser, widgetKey);
          await widgetPageWarmup.waitForWidget(iosBrowser, widgetKey);
        }

        const browser = iosBrowser!;
        const widgetPage = new MobileWidgetPage();
        const screenshotHelpers = new ScreenshotHelpers();
        const verifier = new MobileVerificationHelper(widgetPage, screenshotHelpers);

        console.log(`\n🍎 [iOS] Testing ${variantName} | Token=${tokenRef} | Property=${propertyPath.join('.')}`);
        await widgetPage.waitForWidget(browser, widgetKey);

        await verifier.verifyTokenApplication(
          browser,
          'ios',
          widgetKey,
          variantName,
          tokenRef,
          {},
          studioWidgetName,
          propertyPath
        );
      });
    });
  });

  after(async function () {
    if (androidBrowser) {
      await androidBrowser.deleteSession();
      console.log('🧹 Closed Android token validation session');
    }
    if (iosBrowser) {
      await iosBrowser.deleteSession();
      console.log('🧹 Closed iOS token validation session');
    }

    const outputDir = path.join(process.cwd(), 'artifacts', 'token-validation-reports');
    const { MobileWidgetPage } = require('../pages/MobileWidget.page');
    const { PayloadConfigComparator } = require('../utils/payloadConfigComparator');

    console.log('\n🔍 Comparing payload against configuration...');
    const payloadComparison = PayloadConfigComparator.compare(widgetKey, appliedPayload);
    const payloadReport = PayloadConfigComparator.generateReport(payloadComparison);

    const payloadReportPath = path.join(outputDir, "android", `${widgetKey}-android-payload-comparison.txt`);
    const platformDir = path.join(outputDir, "android"); if (!fs.existsSync(platformDir)) fs.mkdirSync(platformDir, { recursive: true });
    fs.writeFileSync(payloadReportPath, payloadReport);

    console.log(`✅ Payload comparison saved to: ${payloadReportPath}`);
    console.log(payloadReport);

    console.log('\n📊 Generating test results comparison table...');
    MobileWidgetPage.resultTracker.saveComparisonTable(widgetKey, 'android', outputDir);
    MobileWidgetPage.resultTracker.exportToJson(outputDir);

    console.log('\n' + '='.repeat(80));
    console.log(`📱 Mobile ${widgetKey} Token Validation Tests Complete`);
    console.log('='.repeat(80));

    const platforms = [
      shouldRunAndroid ? 'Android' : null,
      shouldRunIOS ? 'iOS' : null,
    ].filter(Boolean).join(' + ');

    const platformCount = (shouldRunAndroid ? 1 : 0) + (shouldRunIOS ? 1 : 0);

    console.log(`✅ Tested ${appliedPairs.length} applied token pairs for widget: ${widgetKey}`);
    console.log(`✅ Platforms: ${platforms}`);
    console.log(`✅ Total tests: ${appliedPairs.length * platformCount}`);
    console.log(`✅ Passed tests: ${passedTests}`);
    console.log(`❌ Failed tests: ${failedTests}`);
    console.log('='.repeat(80) + '\n');
  });
});
