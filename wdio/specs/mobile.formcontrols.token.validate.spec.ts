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

const widgetKey: Widget = 'formcontrols';
type Browser = WebdriverIO.Browser;

describe('Mobile Token Validation - Form Controls Widget', function () {
    this.timeout(600000); // 10 minutes per test

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
    const batchPayloadPath = path.join(process.cwd(), '.test-cache/batch-payload-formcontrols.json');
    if (!fs.existsSync(batchPayloadPath)) {
        throw new Error(`Missing batch payload file: ${batchPayloadPath}`);
    }
    const appliedPayload = JSON.parse(fs.readFileSync(batchPayloadPath, 'utf-8'));

    // LOAD preview→widget mapping from CSV
    const csvPath = path.join(process.cwd(), 'tests/testdata/mobile/formcontrols-widget-variants.csv');
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
        propertyPath: string[] = []
    ): void {
        if (!obj || typeof obj !== 'object') return;

        if ('value' in obj && typeof obj.value === 'string') {
            let stateSuffix = 'default';
            // Search for 'states' in the property path to determine the state
            const statesIndex = propertyPath.indexOf('states');
            if (statesIndex !== -1 && propertyPath[statesIndex + 1]) {
                stateSuffix = propertyPath[statesIndex + 1];
            }

            const variantName = `formcontrols-${appearance}-standard-${stateSuffix}`;
            appliedPairs.push({
                tokenRef: obj.value,
                variantName,
                studioWidgetName: variantMap[variantName] || variantName,
                propertyPath: propertyPath.filter(p => !['states', stateSuffix].includes(p))
            });
            return;
        }

        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'object' && value !== null) {
                extractTokens(value, appearance, [...propertyPath, key]);
            }
        }
    }

    // Extract tokens based on hybrid-mapping structure
    if (appliedPayload['form-controls']) {
        const fc = appliedPayload['form-controls'];

        // 1. Root level mapping (standard appearance)
        if (fc.mapping) {
            extractTokens(fc.mapping, 'standard', []);
        }

        // 2. Specialized appearances (text, number, date, currency)
        if (fc.appearances) {
            for (const appearance of Object.keys(fc.appearances)) {
                if (fc.appearances[appearance].mapping) {
                    extractTokens(fc.appearances[appearance].mapping, appearance, []);
                }
            }
        }
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

    it('Android baseline vs actual screenshot (form-controls page)', async function () {
        if (!shouldRunAndroid) this.skip();

        const screenshotName = 'form-controls-page';
        const screenshotHelpers = new ScreenshotHelpers();
        const widgetPage = new MobileWidgetPage();

        // Baseline
        let baselineBrowser: Browser | undefined;
        try {
            baselineBrowser = await createAndroid(`Android Baseline - ${screenshotName}`, 'baseline');
            await widgetPage.navigateToWidget(baselineBrowser, widgetKey);
            await widgetPage.waitForWidget(baselineBrowser, widgetKey);
            const baselineBuffer = Buffer.from(await baselineBrowser.takeScreenshot(), 'base64');
            await screenshotHelpers.saveBaseline(baselineBuffer, 'android', screenshotName);
        } finally {
            if (baselineBrowser) await baselineBrowser.deleteSession();
        }

        // Actual
        try {
            androidBrowser = await createAndroid(`Android Actual - ${screenshotName}`, 'actual');
            await widgetPage.navigateToWidget(androidBrowser, widgetKey);
            await widgetPage.waitForWidget(androidBrowser, widgetKey);
            const actualBuffer = Buffer.from(await androidBrowser.takeScreenshot(), 'base64');
            const actualPath = await screenshotHelpers.saveActual(actualBuffer, 'android', screenshotName);
            await screenshotHelpers.compareWithBaseline(actualPath, 'android', screenshotName);
        } catch (err) {
            throw err;
        }
    });

    it('iOS baseline vs actual screenshot (form-controls page)', async function () {
        if (!shouldRunIOS) this.skip();

        const screenshotName = 'form-controls-page';
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

    appliedPairs.forEach((pair) => {
        const { tokenRef, variantName, propertyPath, studioWidgetName } = pair;

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

                await verifier.verifyTokenApplication(
                    browser,
                    'android',
                    widgetKey,
                    variantName,
                    tokenRef,
                    {},
                    'form-controls-page',
                    propertyPath
                );
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

                await verifier.verifyTokenApplication(
                    browser,
                    'ios',
                    widgetKey,
                    variantName,
                    tokenRef,
                    {},
                    'form-controls-page',
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
                    const baseFile = path.join(process.cwd(), 'screenshots', 'mobile-base', platform, `${snapshotName}.png`);
                    const actualFile = path.join(process.cwd(), 'screenshots', 'mobile-actual', platform, `${snapshotName}.png`);
                    const diffFile = path.join(process.cwd(), 'screenshots', 'mobile-diff', platform, `${snapshotName}.png`);

                    if (fs.existsSync(baseFile)) allure.addAttachment('Base Screenshot', fs.readFileSync(baseFile), 'image/png');
                    if (fs.existsSync(actualFile)) allure.addAttachment('Actual Screenshot', fs.readFileSync(actualFile), 'image/png');
                    if (fs.existsSync(diffFile)) allure.addAttachment('Diff Screenshot', fs.readFileSync(diffFile), 'image/png');

                    const verdictPath = path.join(process.cwd(), 'artifacts', 'mobile-styles', widgetKey, `${studioWidgetName || variantName}.styles.json`);
                    if (fs.existsSync(verdictPath)) allure.addAttachment(`Style Verdict (${variantName})`, fs.readFileSync(verdictPath), 'application/json');
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

        console.log(`\n✅ Tested ${appliedPairs.length} token pairs for ${widgetKey}`);
        console.log(`✅ Passed: ${passedTests} | Failed: ${failedTests}`);
    });
});
