import fs from 'fs';
import path from 'path';
import { Widget, TokenType } from '../matrix/widgets';
import { TokenSlotTestCase } from './tokenSlotGenerator';

/**
 * Represents the execution result of a single token test
 */
export interface PlaywrightTokenTestResult {
    /** Unique test identifier */
    testId: string;

    /** Widget being tested */
    widget: Widget;

    /** Appearance */
    appearance: string;

    /** Variant */
    variant: string;

    /** State */
    state: string;

    /** Token type */
    tokenType: TokenType;

    /** Property path tested */
    propertyPath: string;

    /** Token reference */
    tokenRef: string;

    /** Expected value */
    expectedValue: string;

    /** Canvas validation result */
    canvas: {
        status: 'PASS' | 'FAIL' | 'ERROR' | 'SKIPPED';
        actualValue: string | null;
        error: string | null;
        visualChange: boolean;
        diffPixels?: number;
    };

    /** Preview validation result */
    preview: {
        status: 'PASS' | 'FAIL' | 'ERROR' | 'SKIPPED';
        actualValue: string | null;
        error: string | null;
        visualChange: boolean;
        diffPixels?: number;
    };

    /** Overall test status */
    overallStatus: 'PASS' | 'FAIL' | 'ERROR';

    /** Timestamp */
    timestamp: string;

    /** Duration in milliseconds */
    duration?: number;
}

/**
 * Aggregated test results for a widget
 */
export interface WidgetTestReport {
    widget: Widget;
    totalTests: number;
    passedTests: number;
    failedTests: number;
    errorTests: number;
    canvasPassRate: number;
    previewPassRate: number;
    timestamp: string;
    results: PlaywrightTokenTestResult[];
}

/**
 * Coverage statistics for token slots
 */
export interface SlotCoverageReport {
    widget: Widget;
    totalSlots: number;
    testedSlots: number;
    passedSlots: number;
    coverage: number;
    slotDetails: {
        tokenType: TokenType;
        totalProperties: number;
        testedProperties: number;
        passedProperties: number;
        failedProperties: string[];
        totalResults: number;
    }[];
}

/**
 * Token Test Reporter for Playwright
 * Generates comprehensive validation reports similar to WDIO
 */
export class PlaywrightTokenTestReporter {
    private results: Map<string, PlaywrightTokenTestResult> = new Map();
    private testCases: TokenSlotTestCase[] = [];

    constructor(testCases?: TokenSlotTestCase[]) {
        this.testCases = testCases || [];
    }

    /**
     * Records a test result
     */
    recordResult(result: PlaywrightTokenTestResult): void {
        this.results.set(result.testId, result);
    }

    /**
     * Loads results from artifacts directory
     */
    loadResultsFromArtifacts(artifactsDir: string): void {
        if (!fs.existsSync(artifactsDir)) {
            return;
        }

        const files = fs.readdirSync(artifactsDir).filter(f => f.endsWith('.json'));
        for (const file of files) {
            const filePath = path.join(artifactsDir, file);
            const result: PlaywrightTokenTestResult = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            this.results.set(result.testId, result);
        }
    }

    /**
     * Gets all results for a specific widget
     */
    getResultsForWidget(widget: Widget): PlaywrightTokenTestResult[] {
        return Array.from(this.results.values()).filter(r => r.widget === widget);
    }

    /**
     * Derives slot ID from test ID (strips -canvas or -preview suffix).
     * Used to count unique slots when Canvas and Preview both produce results for the same slot.
     */
    private getSlotIdFromTestId(testId: string): string {
        return testId.replace(/-canvas$|-preview$/, '');
    }

    /**
     * Gets unique slot IDs from results (one slot can have canvas + preview results).
     */
    private getUniqueSlotIds(results: PlaywrightTokenTestResult[]): Set<string> {
        return new Set(results.map(r => this.getSlotIdFromTestId(r.testId)));
    }

    /**
     * Generates widget test report
     */
    generateWidgetReport(widget: Widget): WidgetTestReport {
        const widgetResults = this.getResultsForWidget(widget);

        const totalTests = widgetResults.length;
        const passedTests = widgetResults.filter(r => r.overallStatus === 'PASS').length;
        const failedTests = widgetResults.filter(r => r.overallStatus === 'FAIL').length;
        const errorTests = widgetResults.filter(r => r.overallStatus === 'ERROR').length;

        const canvasPass = widgetResults.filter(r => r.canvas.status === 'PASS').length;
        const previewPass = widgetResults.filter(r => r.preview.status === 'PASS').length;

        const canvasPassRate = totalTests > 0 ? (canvasPass / totalTests) * 100 : 0;
        const previewPassRate = totalTests > 0 ? (previewPass / totalTests) * 100 : 0;

        return {
            widget,
            totalTests,
            passedTests,
            failedTests,
            errorTests,
            canvasPassRate,
            previewPassRate,
            timestamp: new Date().toISOString(),
            results: widgetResults,
        };
    }

    /**
     * Generates slot coverage report
     */
    generateSlotCoverageReport(widget: Widget): SlotCoverageReport {
        const widgetTestCases = this.testCases.filter(tc => tc.widget === widget);
        const widgetResults = this.getResultsForWidget(widget);

        // Group by token type
        const slotsByType = new Map<TokenType, TokenSlotTestCase[]>();
        for (const testCase of widgetTestCases) {
            if (!slotsByType.has(testCase.tokenType)) {
                slotsByType.set(testCase.tokenType, []);
            }
            slotsByType.get(testCase.tokenType)!.push(testCase);
        }

        const slotDetails = Array.from(slotsByType.entries()).map(([tokenType, testCases]) => {
            const totalProperties = testCases.length;
            const testedResults = widgetResults.filter(r => r.tokenType === tokenType);
            const uniqueSlotsForType = this.getUniqueSlotIds(testedResults);
            const testedProperties = uniqueSlotsForType.size;
            const passedCount = testedResults.filter(r => r.overallStatus === 'PASS').length;
            const failedCount = testedResults.filter(r => r.overallStatus === 'FAIL').length;
            const failedProperties = testedResults
                .filter(r => r.overallStatus === 'FAIL')
                .map(r => r.propertyPath);

            return {
                tokenType,
                totalProperties,
                testedProperties,
                passedProperties: passedCount,
                failedProperties,
                totalResults: testedResults.length,
            };
        });

        const totalSlots = widgetTestCases.length;
        const uniqueSlotIds = this.getUniqueSlotIds(widgetResults);
        const testedSlots = uniqueSlotIds.size;
        const passedSlots = widgetResults.filter(r => r.overallStatus === 'PASS').length;
        const coverage = totalSlots > 0 ? Math.min(100, (testedSlots / totalSlots) * 100) : 0;

        return {
            widget,
            totalSlots,
            testedSlots,
            passedSlots,
            coverage,
            slotDetails,
        };
    }

    /**
     * Infers environment from results (Canvas only / Preview only / both).
     */
    private inferEnvironment(results: PlaywrightTokenTestResult[]): string {
        const hasCanvas = results.some(r => r.testId.endsWith('-canvas'));
        const hasPreview = results.some(r => r.testId.endsWith('-preview'));
        if (hasCanvas && hasPreview) return 'Canvas + Preview';
        if (hasCanvas) return 'Canvas only';
        if (hasPreview) return 'Preview only';
        return 'Unknown';
    }

    /**
     * Generates comparison table (similar to WDIO)
     */
    generateComparisonTable(widget: Widget): string {
        const widgetReport = this.generateWidgetReport(widget);
        const coverageReport = this.generateSlotCoverageReport(widget);
        const widgetResults = this.getResultsForWidget(widget);
        const environment = this.inferEnvironment(widgetResults);

        let table = '\n' + '='.repeat(120) + '\n';
        table += 'PLAYWRIGHT TOKEN VALIDATION REPORT\n';
        table += `Widget: ${widget} | Environment: ${environment} | Timestamp: ${widgetReport.timestamp}\n`;
        table += '='.repeat(120) + '\n\n';

        // Summary section
        table += 'SUMMARY:\n';
        table += `  Total Token Slots Configured: ${coverageReport.totalSlots}\n`;
        table += `  Unique Slots Tested: ${coverageReport.testedSlots}\n`;
        table += `  Result Entries: ${widgetReport.totalTests}\n`;
        table += `  Tests Passed: ${widgetReport.passedTests} (${((widgetReport.passedTests / widgetReport.totalTests) * 100).toFixed(2)}%)\n`;
        table += `  Tests Failed: ${widgetReport.failedTests}\n`;
        table += `  Tests with Errors: ${widgetReport.errorTests}\n`;
        table += `  Canvas Pass Rate: ${widgetReport.canvasPassRate.toFixed(2)}%\n`;
        table += `  Preview Pass Rate: ${widgetReport.previewPassRate.toFixed(2)}%\n`;
        table += `  Slot Coverage: ${coverageReport.coverage.toFixed(2)}%\n`;
        table += '\n' + '='.repeat(120) + '\n\n';

        // Token slot details
        table += 'TOKEN SLOT VALIDATION DETAILS:\n\n';
        table += `| Token Type       | Total Props | Tested | Passed | Failed | Pass Rate  |\n`;
        table += `|${'-'.repeat(18)}|${'-'.repeat(13)}|${'-'.repeat(8)}|${'-'.repeat(8)}|${'-'.repeat(8)}|${'-'.repeat(12)}|\n`;

        for (const detail of coverageReport.slotDetails) {
            const totalResults = detail.totalResults;
            const passRate = totalResults > 0
                ? ((detail.passedProperties / totalResults) * 100).toFixed(2)
                : '0.00';

            table += `| ${detail.tokenType.padEnd(16)} `;
            table += `| ${detail.totalProperties.toString().padStart(11)} `;
            table += `| ${detail.testedProperties.toString().padStart(6)} `;
            table += `| ${detail.passedProperties.toString().padStart(6)} `;
            table += `| ${detail.failedProperties.length.toString().padStart(6)} `;
            table += `| ${(passRate + '%').padStart(10)} |\n`;
        }

        table += '\n' + '='.repeat(120) + '\n\n';

        // Failed tests details
        const failedResults = widgetReport.results.filter(r => r.overallStatus === 'FAIL');
        if (failedResults.length > 0) {
            table += 'FAILED TESTS DETAILS:\n\n';

            for (const result of failedResults) {
                table += `Test: ${result.testId}\n`;
                table += `  Token: ${result.tokenRef}\n`;
                table += `  Property: ${result.propertyPath}\n`;
                table += `  Expected: ${result.expectedValue}\n`;

                if (result.canvas.status === 'FAIL') {
                    table += `  Canvas:\n`;
                    table += `    Status: FAIL\n`;
                    table += `    Actual: ${result.canvas.actualValue}\n`;
                    table += `    Error: ${result.canvas.error || 'N/A'}\n`;
                }

                if (result.preview.status === 'FAIL') {
                    table += `  Preview:\n`;
                    table += `    Status: FAIL\n`;
                    table += `    Actual: ${result.preview.actualValue}\n`;
                    table += `    Error: ${result.preview.error || 'N/A'}\n`;
                }

                table += '\n';
            }

            table += '='.repeat(120) + '\n';
        }

        // Error tests details
        const errorResults = widgetReport.results.filter(r => r.overallStatus === 'ERROR');
        if (errorResults.length > 0) {
            table += '\nTESTS WITH ERRORS:\n\n';

            for (const result of errorResults) {
                table += `Test: ${result.testId}\n`;
                table += `  Token: ${result.tokenRef}\n`;
                table += `  Property: ${result.propertyPath}\n`;

                if (result.canvas.status === 'ERROR') {
                    table += `  Canvas Error: ${result.canvas.error}\n`;
                }

                if (result.preview.status === 'ERROR') {
                    table += `  Preview Error: ${result.preview.error}\n`;
                }

                table += '\n';
            }

            table += '='.repeat(120) + '\n';
        }

        return table;
    }

    /**
     * Saves comparison table to file
     */
    saveComparisonTable(widget: Widget, outputDir: string): void {
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const table = this.generateComparisonTable(widget);
        const fileName = `${widget}-playwright-token-validation.txt`;
        const filePath = path.join(outputDir, fileName);

        fs.writeFileSync(filePath, table);
        console.log(`\n📊 Token validation report saved to: ${filePath}`);
    }

    /**
     * Generates overall summary across widgets.
     * @param widgetFilter - If provided, only include these widgets (current test suite scope).
     */
    generateOverallSummary(widgetFilter?: Widget[]): string {
        const allWidgets = Array.from(new Set(Array.from(this.results.values()).map(r => r.widget)));
        const widgets = widgetFilter && widgetFilter.length > 0
            ? allWidgets.filter(w => widgetFilter.includes(w))
            : allWidgets;

        let summary = '\n' + '='.repeat(120) + '\n';
        summary += 'PLAYWRIGHT TOKEN VALIDATION - OVERALL SUMMARY\n';
        summary += '='.repeat(120) + '\n\n';

        let totalTests = 0;
        let totalPassed = 0;
        let totalFailed = 0;
        let totalErrors = 0;

        const widgetSummaries: { widget: Widget; report: WidgetTestReport }[] = [];

        for (const widget of widgets) {
            const report = this.generateWidgetReport(widget);
            widgetSummaries.push({ widget, report });

            totalTests += report.totalTests;
            totalPassed += report.passedTests;
            totalFailed += report.failedTests;
            totalErrors += report.errorTests;
        }

        summary += 'GLOBAL STATISTICS:\n';
        summary += `  Total Widgets Tested: ${widgets.length}\n`;
        summary += `  Total Tests: ${totalTests}\n`;
        summary += `  Total Passed: ${totalPassed} (${((totalPassed / totalTests) * 100).toFixed(2)}%)\n`;
        summary += `  Total Failed: ${totalFailed}\n`;
        summary += `  Total Errors: ${totalErrors}\n`;
        summary += '\n' + '='.repeat(120) + '\n\n';

        summary += 'PER-WIDGET SUMMARY:\n\n';
        summary += `| Widget           | Tests | Passed | Failed | Errors | Pass Rate  | Canvas % | Preview % |\n`;
        summary += `|${'-'.repeat(18)}|${'-'.repeat(7)}|${'-'.repeat(8)}|${'-'.repeat(8)}|${'-'.repeat(8)}|${'-'.repeat(12)}|${'-'.repeat(10)}|${'-'.repeat(11)}|\n`;

        for (const { widget, report } of widgetSummaries) {
            const passRate = report.totalTests > 0
                ? ((report.passedTests / report.totalTests) * 100).toFixed(2)
                : '0.00';

            summary += `| ${widget.padEnd(16)} `;
            summary += `| ${report.totalTests.toString().padStart(5)} `;
            summary += `| ${report.passedTests.toString().padStart(6)} `;
            summary += `| ${report.failedTests.toString().padStart(6)} `;
            summary += `| ${report.errorTests.toString().padStart(6)} `;
            summary += `| ${(passRate + '%').padStart(10)} `;
            summary += `| ${report.canvasPassRate.toFixed(2).padStart(8)}% `;
            summary += `| ${report.previewPassRate.toFixed(2).padStart(9)}% |\n`;
        }

        summary += '\n' + '='.repeat(120) + '\n';

        return summary;
    }

    /**
     * Saves overall summary to file.
     * @param outputDir - Output directory
     * @param widgetFilter - If provided, only include these widgets (current test suite scope).
     */
    saveOverallSummary(outputDir: string, widgetFilter?: Widget[]): void {
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const summary = this.generateOverallSummary(widgetFilter);
        const fileName = 'playwright-token-validation-summary.txt';
        const filePath = path.join(outputDir, fileName);

        fs.writeFileSync(filePath, summary);
        console.log(`\n📊 Overall summary saved to: ${filePath}`);
    }

    /**
     * Exports all reports to JSON.
     * @param outputDir - Output directory
     * @param widgetFilter - If provided, only include these widgets (current test suite scope).
     */
    exportToJson(outputDir: string, widgetFilter?: Widget[]): void {
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const allWidgets = Array.from(new Set(Array.from(this.results.values()).map(r => r.widget)));
        const widgets = widgetFilter && widgetFilter.length > 0
            ? allWidgets.filter(w => widgetFilter.includes(w))
            : allWidgets;

        // Export per-widget reports
        for (const widget of widgets) {
            const report = this.generateWidgetReport(widget);
            const coverage = this.generateSlotCoverageReport(widget);

            const fullReport = {
                widget,
                timestamp: report.timestamp,
                summary: {
                    totalTests: report.totalTests,
                    passedTests: report.passedTests,
                    failedTests: report.failedTests,
                    errorTests: report.errorTests,
                    canvasPassRate: report.canvasPassRate,
                    previewPassRate: report.previewPassRate,
                },
                coverage: {
                    totalSlots: coverage.totalSlots,
                    testedSlots: coverage.testedSlots,
                    passedSlots: coverage.passedSlots,
                    coverage: coverage.coverage,
                },
                slotDetails: coverage.slotDetails,
                results: report.results,
            };

            const fileName = `${widget}-report.json`;
            const filePath = path.join(outputDir, fileName);
            fs.writeFileSync(filePath, JSON.stringify(fullReport, null, 2));
        }

        // Export overall summary JSON
        const overallSummary = {
            timestamp: new Date().toISOString(),
            widgets: widgets.map(widget => {
                const report = this.generateWidgetReport(widget);
                const coverage = this.generateSlotCoverageReport(widget);
                return {
                    widget,
                    totalTests: report.totalTests,
                    passedTests: report.passedTests,
                    failedTests: report.failedTests,
                    errorTests: report.errorTests,
                    canvasPassRate: report.canvasPassRate,
                    previewPassRate: report.previewPassRate,
                    slotCoverage: coverage.coverage,
                };
            }),
        };

        const summaryPath = path.join(outputDir, 'overall-summary.json');
        fs.writeFileSync(summaryPath, JSON.stringify(overallSummary, null, 2));

        console.log(`\n✅ Exported JSON reports to: ${outputDir}`);
    }
}
