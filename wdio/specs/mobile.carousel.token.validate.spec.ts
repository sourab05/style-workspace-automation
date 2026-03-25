import * as path from 'path';
import * as fs from 'fs';
import { createAndroidSession, createIOSSession } from '../utils/sessionFactory';
import allure from '@wdio/allure-reporter';
import { MobileWidgetPage } from '../pages/MobileWidget.page';
import { ScreenshotHelpers } from '../helpers/screenshot.helpers';
import { MobileVerificationHelper } from '../helpers/mobileVerification.helper';
import { loadMobileTestData } from '../utils/mobileTestData';
import { isLocalEnv } from '../utils/envFlags';
import type { Widget, Appearance } from '../../src/matrix/widgets';
import { WIDGET_CONFIG } from '../../src/matrix/widgets';

const widgetKey: Widget = 'carousel';
type Browser = WebdriverIO.Browser;

describe('Mobile Token Validation - Carousel Widget', function () {
    this.timeout(300000); // 5 minutes per test

    // Test counters
    let passedTests = 0;
    let failedTests = 0;

    const { baselineApps, actualApps } = loadMobileTestData();
    const runLocal = isLocalEnv();
    const platformMode = (process.env.MOBILE_PLATFORM || 'both').toLowerCase();
    const shouldRunAndroid = platformMode === 'android' || platformMode === 'both';
    const shouldRunIOS = platformMode === 'ios' || platformMode === 'both';

    console.log(`\n📦 [Test Data] Baseline App: ${baselineApps.android}`);
    console.log(`📦 [Test Data] Actual App:   ${actualApps.android}`);

    // LOAD applied tokens from batch payload
    const batchPayloadPath = path.join(process.cwd(), `.test-cache/batch-payload-${widgetKey}.json`);
    if (!fs.existsSync(batchPayloadPath)) {
        throw new Error(`Missing batch payload file: ${batchPayloadPath}`);
    }
    const appliedPayload = JSON.parse(fs.readFileSync(batchPayloadPath, 'utf-8'));

    // LOAD preview→widget mapping from CSV
    const csvPath = path.join(process.cwd(), `tests/testdata/mobile/${widgetKey}-widget-variants.csv`);
    if (!fs.existsSync(csvPath)) {
        throw new Error(`Missing variant mapping CSV: ${csvPath}`);
    }
    const csv = fs.readFileSync(csvPath, 'utf8').trim().split(/\r?\n/);
    const variantMap: Record<string, string> = {};
    for (let i = 1; i < csv.length; i++) {
        const [variant, inst] = csv[i].split(',').map(s => s.trim());
        if (variant && inst) variantMap[variant] = inst;
    }

    // BUILD appliedPairs from the payload structure
    const appliedPairs: Array<{
        tokenRef: string;
        variantName: string;
        studioWidgetName: string;
        propertyPath: string[];
    }> = [];

    // Get widget configuration
    const widgetConfig = WIDGET_CONFIG[widgetKey];
    if (!widgetConfig) {
        throw new Error(`No configuration found for widget: ${widgetKey}`);
    }

    // Helper function to recursively extract tokens from nested objects
    function extractTokens(
        obj: any,
        appearance: string,
        variant: string,
        propertyPath: string[] = []
    ): void {
        if (!obj || typeof obj !== 'object') return;

        // If this object has a 'value' property, it's a token
        if ('value' in obj && typeof obj.value === 'string') {
            // Determine state suffix (default to 'default')
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

        // Otherwise, recurse into nested objects
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'object' && value !== null) {
                extractTokens(value, appearance, variant, [...propertyPath, key]);
            }
        }
    }

    // Extract tokens based on parsed payload
    if (appliedPayload[widgetKey]?.mapping) {
        console.log(`📂 [${widgetKey}] Extracting tokens from direct mapping`);
        // Carousel in current setup uses direct-mapping which puts 'mapping' at root of widget node
        // But generator.ts produces { carousel: { mapping: ... } } IF structureType is direct-mapping.
        // Wait, WIDGET_STRUCTURE_MAP is used.
        extractTokens(appliedPayload[widgetKey].mapping, 'standard', 'standard', []);
    } else if (appliedPayload[widgetKey]?.appearances) {
        // Fallback or if structure was different
        const apps = appliedPayload[widgetKey].appearances;
        for (const [appName, appData] of Object.entries(apps)) {
            if ((appData as any).mapping) {
                const variants = widgetConfig.variants[appName as Appearance] || [];
                const variantName = variants.includes('standard') ? 'standard' : 'default';
                extractTokens((appData as any).mapping, appName, variantName, []);
            }
        }
    }

    console.log(`📦 [Test Data] Total Applied Token Pairs: ${appliedPairs.length}`);

    // Shared browser sessions for reuse
    let androidBrowser: Browser | undefined;
    let iosBrowser: Browser | undefined;

    // Helper functions to create sessions
    async function createAndroid(sessionName: string, type: 'baseline' | 'actual'): Promise<Browser> {
        return createAndroidSession({
            sessionName,
            type,
            runLocal,
            widgetKey,
            baselineApps,
            actualApps,
        });
    }

    async function createIOS(sessionName: string, type: 'baseline' | 'actual'): Promise<Browser> {
        return createIOSSession({
            sessionName,
            type,
            runLocal,
            widgetKey,
            baselineApps,
            actualApps,
        });
    }

    // Global afterEach for counting
    afterEach(function () {
        // Exclude the screenshot comparison test from token statistics
        if (this.currentTest?.title?.includes('baseline vs actual screenshot')) {
            return;
        }

        if (this.currentTest?.state === 'passed') {
            passedTests++;
        } else if (this.currentTest?.state === 'failed') {
            failedTests++;
        }
    });

    // Baseline vs Actual screenshot comparison
    it(`Android baseline vs actual screenshot (${widgetKey} page)`, async function () {
        if (!shouldRunAndroid) this.skip();

        const screenshotName = `${widgetKey}-page`;
        const screenshotHelpers = new ScreenshotHelpers();
        const widgetPage = new MobileWidgetPage();

        // BASELINE
        let baselineBrowser: Browser | undefined;
        try {
            baselineBrowser = await createAndroid(`Android Baseline - ${screenshotName}`, 'baseline');
            await widgetPage.navigateToWidget(baselineBrowser, widgetKey);
            await widgetPage.waitForWidget(baselineBrowser, widgetKey);
            const buffer = Buffer.from(await baselineBrowser.takeScreenshot(), 'base64');
            await screenshotHelpers.saveBaseline(buffer, 'android', screenshotName);
        } finally {
            if (baselineBrowser) await baselineBrowser.deleteSession();
        }

        // ACTUAL
        try {
            androidBrowser = await createAndroid(`Android Actual - ${screenshotName}`, 'actual');
            await widgetPage.navigateToWidget(androidBrowser, widgetKey);
            await widgetPage.waitForWidget(androidBrowser, widgetKey);
            const buffer = Buffer.from(await androidBrowser.takeScreenshot(), 'base64');
            const actualPath = await screenshotHelpers.saveActual(buffer, 'android', screenshotName);
            const result = await screenshotHelpers.compareWithBaseline(actualPath, 'android', screenshotName);
            console.log(`📊 Android screenshot match=${result.match}, diff%=${result.diffPercentage.toFixed(2)}%`);
        } catch (err) {
            throw err;
        }
    });

    it(`iOS baseline vs actual screenshot (${widgetKey} page)`, async function () {
        if (!shouldRunIOS) {
            console.log('⏭ Skipping iOS baseline screenshot (MOBILE_PLATFORM excludes ios)');
            this.skip();
        }

        const screenshotName = `${widgetKey}-page`;
        const screenshotHelpers = new ScreenshotHelpers();
        const widgetPage = new MobileWidgetPage();

        // Baseline
        let baselineBrowser: Browser | undefined;
        try {
            baselineBrowser = await createIOS(`iOS Baseline - ${screenshotName}`, 'baseline');
            await widgetPage.navigateToWidget(baselineBrowser, widgetKey);
            await widgetPage.waitForWidget(baselineBrowser, widgetKey);

            const baselineBuffer = Buffer.from(await baselineBrowser.takeScreenshot(), 'base64');
            await screenshotHelpers.saveBaseline(baselineBuffer, 'ios', screenshotName);
        } finally {
            if (baselineBrowser) await baselineBrowser.deleteSession();
        }

        // Actual
        try {
            iosBrowser = await createIOS(`iOS Actual - ${screenshotName}`, 'actual');
            await widgetPage.navigateToWidget(iosBrowser, widgetKey);
            await widgetPage.waitForWidget(iosBrowser, widgetKey);

            const actualBuffer = Buffer.from(await iosBrowser.takeScreenshot(), 'base64');
            const actualPath = await screenshotHelpers.saveActual(actualBuffer, 'ios', screenshotName);
            await screenshotHelpers.compareWithBaseline(actualPath, 'ios', screenshotName);
        } catch (err) {
            throw err;
        }
    });

    // Per-token validation
    appliedPairs.forEach((pair) => {
        const { tokenRef, variantName, studioWidgetName, propertyPath } = pair;

        describe(`Token Validate: ${tokenRef} Property: ${propertyPath.join('.')}`, function () {
            it(`Android: validate ${tokenRef} @ ${variantName} [${propertyPath.join('.')}]`, async function () {
                if (!shouldRunAndroid) this.skip();

                if (!androidBrowser) {
                    androidBrowser = await createAndroid(`Android Token Tests - ${widgetKey}`, 'actual');
                    const wp = new MobileWidgetPage();
                    await wp.navigateToWidget(androidBrowser, widgetKey);
                    await wp.waitForWidget(androidBrowser, widgetKey);
                }

                const browser = androidBrowser!;
                const widgetPage = new MobileWidgetPage();
                const verifier = new MobileVerificationHelper(widgetPage, new ScreenshotHelpers());

                console.log(`🤖 [Android] Testing ${variantName} | Token=${tokenRef} | Property=${propertyPath.join('.')}`);
                await verifier.verifyTokenApplication(
                    browser, 'android', widgetKey, variantName, tokenRef, {}, `${widgetKey}-page`, propertyPath
                );
            });

            it(`iOS: validate ${tokenRef} @ ${variantName} [${propertyPath.join('.')}]`, async function () {
                if (!shouldRunIOS) this.skip();

                if (!iosBrowser) {
                    iosBrowser = await createIOS(`iOS Token Tests - ${widgetKey}`, 'actual');
                    const wp = new MobileWidgetPage();
                    await wp.navigateToWidget(iosBrowser, widgetKey);
                    await wp.waitForWidget(iosBrowser, widgetKey);
                }

                const browser = iosBrowser!;
                const widgetPage = new MobileWidgetPage();
                const verifier = new MobileVerificationHelper(widgetPage, new ScreenshotHelpers());

                console.log(`🍎 [iOS] Testing ${variantName} | Token=${tokenRef} | Property=${propertyPath.join('.')}`);
                await verifier.verifyTokenApplication(
                    browser, 'ios', widgetKey, variantName, tokenRef, {}, `${widgetKey}-page`, propertyPath
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
                    const actualFile = path.join(process.cwd(), 'screenshots', 'mobile-actual', platform, `${snapshotName}.png`);
                    if (fs.existsSync(actualFile)) allure.addAttachment('Actual Screenshot', fs.readFileSync(actualFile), 'image/png');

                    const verdictPath = path.join(process.cwd(), 'artifacts', 'mobile-styles', widgetKey, `${studioWidgetName || variantName}.styles.json`);
                    if (fs.existsSync(verdictPath)) allure.addAttachment(`Style Verdict`, fs.readFileSync(verdictPath), 'application/json');
                } catch (err) { }
            });
        });
    });

    after(async function () {
        if (androidBrowser) await androidBrowser.deleteSession();
        if (iosBrowser) await iosBrowser.deleteSession();

        const outputDir = path.join(process.cwd(), 'artifacts', 'token-validation-reports');
        const { MobileWidgetPage } = require('../pages/MobileWidget.page');
        const { PayloadConfigComparator } = require('../utils/payloadConfigComparator');

        // ========================================
        // PAYLOAD vs CONFIGURATION COMPARISON
        // ========================================
        console.log('\n🔍 Comparing payload against configuration...');
        const payloadComparison = PayloadConfigComparator.compare(widgetKey, appliedPayload);
        const payloadReport = PayloadConfigComparator.generateReport(payloadComparison);

        // Save payload comparison report
        const payloadReportPath = path.join(outputDir, "android", `${widgetKey}-android-payload-comparison.txt`);
        const platformDir = path.join(outputDir, "android"); if (!fs.existsSync(platformDir)) fs.mkdirSync(platformDir, { recursive: true });
        fs.writeFileSync(payloadReportPath, payloadReport);

        console.log(`✅ Payload comparison saved to: ${payloadReportPath}`);
        console.log(payloadReport);

        // ========================================
        // TEST RESULTS COMPARISON
        // ========================================
        console.log('\n📊 Generating test results comparison table...');
        MobileWidgetPage.resultTracker.saveComparisonTable(widgetKey, 'android', outputDir);
        MobileWidgetPage.resultTracker.exportToJson(outputDir);

        console.log(`\n✅ Tested ${appliedPairs.length} token pairs for ${widgetKey}. Passed: ${passedTests}, Failed: ${failedTests}`);
    });
});
