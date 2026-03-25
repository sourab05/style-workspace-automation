import { MobileWidgetPage, StyleVerificationResult } from '../pages/MobileWidget.page';
import { ScreenshotHelpers } from './screenshot.helpers';
import type { Widget } from '../../src/matrix/widgets';
import allure from '@wdio/allure-reporter';
import fs from 'fs';

export class MobileVerificationHelper {
    constructor(
        private widgetPage: MobileWidgetPage,
        private screenshotHelpers: ScreenshotHelpers
    ) { }

    /**
     * Verifies that a token has been correctly applied to a widget.
     * Performs:
     * 1. Visual Comparison against baseline (Soft Fail / Warning on mismatch)
     * 2. React Native Styles JSON verification (Hard Fail on mismatch)
     * 
     * Verdict Logic:
     * - Visual ✅ + Styles ✅ = PASS
     * - Visual ❌ + Styles ✅ = PARTIAL PASS (Warning)
     * - Styles ❌            = FAIL
     */
    async verifyTokenApplication(
        browser: WebdriverIO.Browser,
        platform: 'android' | 'ios',
        widget: Widget,
        snapshotName: string,
        tokenRef: string,
        tokenFileData: any,
        baselineName?: string, // Optional: Name of the generic baseline to compare against
        propertyPath?: string[] // Optional: Specific property path to verify
    ): Promise<void> {
        const tokenShortName = tokenRef
            .replace(/[{}\.@]/g, '-')
            .replace(/-value$/, '')
            .replace(/^-+|-+$/g, '');

        const uniqueSnapshotName = `${tokenShortName}-${snapshotName}`;
        // Use provided baselineName or fall back to uniqueSnapshotName
        const baselineTarget = baselineName || uniqueSnapshotName;

        allure.addArgument('Token', tokenRef);
        allure.addArgument('Widget', widget);
        allure.addArgument('Platform', platform);

        // --- 1. Visual Verification ---
        let visualPassed = false;
        let visualResult: any = null;
        let diffSummary = 'N/A';

        await allure.step('Visual Verification', async () => {
            try {
                const screenshotBuffer = Buffer.from(await browser.takeScreenshot(), 'base64');
                const actualPath = await this.screenshotHelpers.saveActual(screenshotBuffer, platform, uniqueSnapshotName);

                // 1. ALWAYS Attach Actual
                if (fs.existsSync(actualPath)) {
                    allure.addAttachment('Actual', fs.readFileSync(actualPath), 'image/png');
                }

                visualResult = await this.screenshotHelpers.compareWithBaseline(actualPath, platform, baselineTarget);
                diffSummary = `${visualResult.diffPixels}px changed (${visualResult.diffPercentage.toFixed(2)}%)`;

                // 2. ALWAYS Attach Expected (Baseline) if exists
                const baselinePath = this.screenshotHelpers.getBaselinePath(platform, baselineTarget);
                if (fs.existsSync(baselinePath)) {
                    allure.addAttachment('Expected', fs.readFileSync(baselinePath), 'image/png');
                }

                // 3. ALWAYS Attach Diff if generated
                if (visualResult.diffImagePath && fs.existsSync(visualResult.diffImagePath)) {
                    allure.addAttachment('Diff', fs.readFileSync(visualResult.diffImagePath), 'image/png');
                }

                // Pass if difference >= 10% (visual changes detected)
                if (visualResult.match) {
                    visualPassed = true;
                    allure.addArgument('Visual Verdict', 'PASS');
                } else {
                    allure.addArgument('Visual Verdict', visualResult.diffPercentage === 0 ? 'WARNING' : 'FAIL');
                }
                allure.addArgument('Diff %', `${visualResult.diffPercentage.toFixed(2)}%`);

            } catch (err: any) {
                allure.addAttachment('Visual Check Error', err.message, 'text/plain');
                allure.addArgument('Visual Verdict', 'ERROR');
            }
        });

        // --- 2. Styles/CSS Verification ---
        let styleResult: StyleVerificationResult | null = null;
        await allure.step('Styles Verification', async () => {
            styleResult = await this.widgetPage.verifyStylesIncludeTokenValue(
                browser,
                widget,
                snapshotName,
                tokenRef,
                tokenFileData,
                propertyPath,
                platform
            );

            if (styleResult?.passed) {
                allure.addArgument('Style Verdict', 'PASS');
            } else {
                allure.addArgument('Style Verdict', 'FAIL');
                if (styleResult?.error) allure.addAttachment('Style Mismatch Error', styleResult.error, 'text/plain');
            }

            if (styleResult?.fullCommand) {
                allure.addArgument('Style Command', styleResult.fullCommand);
            }

            // Include widget variant context in the style verdict
            if (snapshotName) {
                allure.addArgument('Widget Variant', snapshotName);
            }
        });

        // --- 3. Final Verdict & Report (Playwright Alignment) ---
        const sr = styleResult as StyleVerificationResult | null;
        const stylesPassed = sr?.passed || false;
        const isPartialMatch = !visualPassed && stylesPassed;
        const overallPass = stylesPassed; // Style is source of truth for PASS, Visual is for WARNING

        const verdict = overallPass ? (isPartialMatch ? '⚠️ PARTIAL PASS' : '✅ PASS') : '❌ FAIL';

        const report = `Style Validation Verdict: ${verdict}
=========================================
Token: ${tokenRef}
Widget: ${widget}
Variant: ${snapshotName}
Property Path: ${propertyPath?.join('.') || 'Full Object'}
RN Command Suffix: ${sr?.commandSuffix || 'N/A'}
Full Style Command: ${sr?.fullCommand || 'N/A'}

📊 VISUAL VERIFICATION: ${visualPassed ? '✅ PASS (Diff detected)' : '❌ FAIL (No diff detected)'}
   Visual Diff: ${diffSummary}
   Match Threshold: 0.03 (3%)
   Result: ${visualResult?.match ? 'DIFFERENT' : 'IDENTICAL'}

🎨 STYLE VERIFICATION: ${stylesPassed ? '✅ PASS' : '❌ FAIL'}
   Expected: ${sr?.expectedValue || 'N/A'}
   Actual: ${sr?.actualValue || 'N/A'}
   Normalized Expected: ${sr?.normalizedExpected || 'N/A'}
   Normalized Actual: ${sr?.normalizedActual || 'N/A'}
   Status: ${stylesPassed ? 'MATCHED' : 'MISMATCHED'}

${isPartialMatch ? '⚠️  **PARTIAL MATCH**: Visual diff failed (screenshot matched baseline), but the property value is CORRECT.' : ''}
=========================================`;

        allure.addAttachment('style-verdict.md', report, 'text/markdown');
        console.log(`\n${report}\n`);

        if (!stylesPassed) {
            throw new Error(`Style verification failed for ${tokenRef}. Expected: ${sr?.expectedValue}, Actual: ${sr?.actualValue}`);
        }
    }
}
