import * as path from 'path';
import * as fs from 'fs';
import { createAndroidSession, createIOSSession } from '../utils/sessionFactory';
import allure from '@wdio/allure-reporter';
import { MobileWidgetPage } from '../pages/MobileWidget.page';
import { ScreenshotHelpers } from '../helpers/screenshot.helpers';
import { MobileVerificationHelper } from '../helpers/mobileVerification.helper';
import { loadMobileTestData } from '../utils/mobileTestData';
import { isLocalEnv } from '../utils/envFlags';
import type { Widget } from '../../src/matrix/widgets';
import { WIDGET_CONFIG } from '../../src/matrix/widgets';
import { getWidgetKey } from '../../src/matrix/generator';

const widgetKey: Widget = 'barcodescanner';
type Browser = WebdriverIO.Browser;

describe('Mobile Token Validation - Barcode Scanner Widget', function () {
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
    const batchPayloadPath = path.join(process.cwd(), '.test-cache/batch-payload-barcodescanner.json');
    if (!fs.existsSync(batchPayloadPath)) {
        throw new Error(`Missing batch payload file: ${batchPayloadPath}`);
    }
    const appliedPayload = JSON.parse(fs.readFileSync(batchPayloadPath, 'utf-8'));

    // LOAD preview→widget mapping from CSV
    const csvPath = path.join(process.cwd(), 'tests/testdata/mobile/barcodescanner-widget-variants.csv');
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

    console.log(`📋 [Widget Config] Appearances: ${widgetConfig.appearances.join(', ')}`);

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

            const variantName = `barcodescanner-${appearance}-${variant}-${stateSuffix}`;
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

    // Extract tokens based on widget configuration
    const payloadKey = getWidgetKey(widgetKey);
    const widgetPayload = appliedPayload[payloadKey] || appliedPayload[widgetKey];
    if (widgetPayload?.mapping) {
        console.log(`📂 [${payloadKey}] Extracting tokens from mapping structure`);

        // For barcodescanner, we extract tokens from the mapping object directly (direct-mapping)
        const barcodescannerMapping = widgetPayload.mapping;

        // Use the first appearance and variant as defaults for barcodescanner structure (standard/standard)
        const defaultAppearance = widgetConfig.appearances[0] || 'standard';
        const defaultVariant = widgetConfig.variants[defaultAppearance]?.[0] || 'standard';

        console.log(`   ✓ Extracting tokens for ${defaultAppearance}.${defaultVariant}`);
        extractTokens(barcodescannerMapping, defaultAppearance, defaultVariant, []);
    } else {
        console.log(`⚠️  No mapping found in barcodescanner payload`);
    }

    console.log(`📦 [Test Data] Total Applied Token Pairs: ${appliedPairs.length}`);

    // Shared browser sessions for reuse
    let androidBrowser: Browser | undefined;
    let iosBrowser: Browser | undefined;

    // ---------------------------------------------------------------------------
    // Helper functions to create sessions
    // ---------------------------------------------------------------------------

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

    // ---------------------------------------------------------------------------
    // 1) Baseline vs Actual screenshot comparison
    // ---------------------------------------------------------------------------

    it('Android baseline vs actual screenshot (Barcode Scanner page)', async function () {
        if (!shouldRunAndroid) {
            console.log('⏭ Skipping Android baseline screenshot (MOBILE_PLATFORM excludes android)');
            this.skip();
        }

        const screenshotName = 'barcodescanner-page';
        const screenshotHelpers = new ScreenshotHelpers();
        const widgetPage = new MobileWidgetPage();

        // --- BASELINE SESSION ---
        let baselineBrowser: Browser | undefined;
        try {
            baselineBrowser = await createAndroid(`Android Baseline - ${screenshotName}`, 'baseline');
            console.log('✅ Android baseline app launched for screenshot');

            await widgetPage.navigateToWidget(baselineBrowser, widgetKey);
            await widgetPage.waitForWidget(baselineBrowser, widgetKey);

            console.log('📸 Capturing Android BASELINE screenshot...');
            const baselineBuffer = Buffer.from(await baselineBrowser.takeScreenshot(), 'base64');
            await screenshotHelpers.saveBaseline(baselineBuffer, 'android', screenshotName);
            console.log('✅ Android baseline screenshot saved');
        } catch (err: any) {
            console.error(`❌ Android baseline capture failed for ${screenshotName}: ${err?.message || err}`);
            throw err;
        } finally {
            if (baselineBrowser) {
                await baselineBrowser.deleteSession();
                console.log('🧹 Closed Android baseline session');
            }
        }

        // --- ACTUAL SESSION (reused for token tests) ---
        try {
            androidBrowser = await createAndroid(`Android Actual - ${screenshotName}`, 'actual');
            console.log('✅ Android ACTUAL app launched for screenshot & token validation');

            await widgetPage.navigateToWidget(androidBrowser, widgetKey);
            await widgetPage.waitForWidget(androidBrowser, widgetKey);

            console.log('📸 Capturing Android ACTUAL screenshot for comparison...');
            const actualBuffer = Buffer.from(await androidBrowser.takeScreenshot(), 'base64');
            const actualPath = await screenshotHelpers.saveActual(actualBuffer, 'android', screenshotName);

            const result = await screenshotHelpers.compareWithBaseline(actualPath, 'android', screenshotName);
            console.log(
                `   📊 Android screenshot match=${result.match}, ` +
                `diffPixels=${result.diffPixels}, diff%=${result.diffPercentage.toFixed(2)}%`,
            );
        } catch (err: any) {
            console.error(`Android actual screenshot comparison failed for ${screenshotName}: ${err?.message || err}`);
            throw err;
        }
    });

    it('iOS baseline vs actual screenshot (Barcode Scanner page)', async function () {
        if (!shouldRunIOS) {
            console.log('⏭ Skipping iOS baseline screenshot (MOBILE_PLATFORM excludes ios)');
            this.skip();
        }

        const screenshotName = 'barcodescanner-page';
        const screenshotHelpers = new ScreenshotHelpers();
        const widgetPage = new MobileWidgetPage();

        // --- BASELINE SESSION ---
        let baselineBrowser: Browser | undefined;
        try {
            baselineBrowser = await createIOS(`iOS Baseline - ${screenshotName}`, 'baseline');
            console.log('✅ iOS baseline app launched for screenshot');

            await widgetPage.navigateToWidget(baselineBrowser, widgetKey);
            await widgetPage.waitForWidget(baselineBrowser, widgetKey);

            console.log('📸 Capturing iOS BASELINE screenshot...');
            const baselineBuffer = Buffer.from(await baselineBrowser.takeScreenshot(), 'base64');
            await screenshotHelpers.saveBaseline(baselineBuffer, 'ios', screenshotName);
            console.log('✅ iOS baseline screenshot saved');
        } catch (err: any) {
            console.error(`❌ iOS baseline capture failed for ${screenshotName}: ${err?.message || err}`);
            throw err;
        } finally {
            if (baselineBrowser) {
                await baselineBrowser.deleteSession();
                console.log('🧹 Closed iOS baseline session');
            }
        }

        // --- ACTUAL SESSION (reused for token tests) ---
        try {
            iosBrowser = await createIOS(`iOS Actual - ${screenshotName}`, 'actual');
            console.log('✅ iOS ACTUAL app launched for screenshot & token validation');

            await widgetPage.navigateToWidget(iosBrowser, widgetKey);
            await widgetPage.waitForWidget(iosBrowser, widgetKey);

            console.log('📸 Capturing iOS ACTUAL screenshot for comparison...');
            const actualBuffer = Buffer.from(await iosBrowser.takeScreenshot(), 'base64');
            const actualPath = await screenshotHelpers.saveActual(actualBuffer, 'ios', screenshotName);

            const result = await screenshotHelpers.compareWithBaseline(actualPath, 'ios', screenshotName);
            console.log(
                `   📊 iOS screenshot match=${result.match}, ` +
                `diffPixels=${result.diffPixels}, diff%=${result.diffPercentage.toFixed(2)}%`,
            );
        } catch (err: any) {
            console.error(`iOS actual screenshot comparison failed for ${screenshotName}: ${err?.message || err}`);
            throw err;
        }
    });

    // ---------------------------------------------------------------------------
    // 2) Per-token validation on ACTUAL apps (reuse sessions)
    // ---------------------------------------------------------------------------

    appliedPairs.forEach((pair) => {
        const { tokenRef, variantName, studioWidgetName, propertyPath } = pair;

        describe(`Token Validate: ${tokenRef} Property: ${propertyPath.join('.')}`, function () {
            it(`Android: validate ${tokenRef} @ ${variantName} [${propertyPath.join('.')}]`, async function () {
                if (!shouldRunAndroid) this.skip();

                // Ensure session exists
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
                    {}, // Empty token file data (not needed when using applied payload)
                    'barcodescanner-page', // Use the full-page screenshot baseline for all token validation tests
                    propertyPath
                );
            });

            it(`iOS: validate ${tokenRef} @ ${variantName} [${propertyPath.join('.')}]`, async function () {
                if (!shouldRunIOS) this.skip();

                // Ensure session exists
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
                    {}, // Empty token file data (not needed when using applied payload)
                    'barcodescanner-page',
                    propertyPath
                );
            });

            // Attach artifacts after each test
            afterEach(function () {
                try {
                    // Construct screenshot name from variant name
                    const tokenShortName = tokenRef
            .replace(/[{}\.@]/g, '-')
            .replace(/-value$/, '')
            .replace(/^-+|-+$/g, '');
          const safeVariantName = variantName.replace(/[^a-zA-Z0-9-_]/g, '-');
          const snapshotName = `${tokenShortName}-${safeVariantName}`;
          const platform = this.currentTest?.title?.toLowerCase().includes('ios') ? 'ios' : 'android';

                    // Attach comparison images from disk
                    const baseDir = path.join(process.cwd(), 'screenshots', 'mobile-base', platform);
                    const actualDir = path.join(process.cwd(), 'screenshots', 'mobile-actual', platform);
                    const diffDir = path.join(process.cwd(), 'screenshots', 'mobile-diff', platform);

                    const baseFile = path.join(baseDir, `${snapshotName}.png`);
                    const actualFile = path.join(actualDir, `${snapshotName}.png`);
                    const diffFile = path.join(diffDir, `${snapshotName}.png`);

                    // Attach Base image
                    if (fs.existsSync(baseFile)) {
                        try {
                            allure.addAttachment('Base Screenshot', fs.readFileSync(baseFile), 'image/png');
                        } catch (err) {
                            console.error("Base Screenshot", err);
                        }
                    }

                    // Attach Actual image
                    if (fs.existsSync(actualFile)) {
                        try {
                            allure.addAttachment('Actual Screenshot', fs.readFileSync(actualFile), 'image/png');
                        } catch (err) {
                            console.error("Actual Screenshot", err);
                        }
                    }

                    // Attach Diff image
                    if (fs.existsSync(diffFile)) {
                        try {
                            allure.addAttachment('Diff Screenshot', fs.readFileSync(diffFile), 'image/png');
                        } catch (err) {
                            console.error("Diff Screenshot", err);
                        }
                    }

                    // Attach style verdict JSON
                    const verdictPath = path.join(
                        process.cwd(),
                        'artifacts',
                        'mobile-styles',
                        widgetKey,
                        `${studioWidgetName || variantName}.styles.json`
                    );
                    if (fs.existsSync(verdictPath)) {
                        try {
                            const data = fs.readFileSync(verdictPath);
                            allure.addAttachment(`Style Verdict (${variantName})`, data, 'application/json');
                        } catch (verdictErr) {
                            // Silently ignore verdict attachment errors
                        }
                    }
                } catch (err) {
                    console.error(err);
                }
            });
        });

        // ---------------------------------------------------------------------------
        // Cleanup & summary
        // ---------------------------------------------------------------------------

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

            console.log('\n' + '='.repeat(80));
            console.log('📱 Mobile Barcode Scanner Token Validation Tests Complete');
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
});
