import fs from 'fs';
import path from 'path';
import { Widget, TokenType } from '../../src/matrix/widgets';
import { WidgetTokenConfigRegistry } from '../config/widgetTokenConfig';

/**
 * Represents the execution status of a single token test
 */
export interface TokenExecutionResult {
    /** Token reference that was tested */
    tokenRef: string;

    /** Property path that was tested */
    propertyPath: string[];

    /** Whether the token execution succeeded */
    executed: boolean;

    /** Whether the extracted value was a literal token string (e.g., "{}") */
    isLiteralToken: boolean;

    /** The actual value extracted from RN */
    actualValue: string;

    /** The expected value */
    expectedValue: string;

    /** Whether the test passed */
    passed: boolean;

    /** Error details if any */
    error?: string;

    /** The full RN command that was executed */
    command?: string;
}

/**
 * Aggregated results for all tokens tested on a widget
 */
export interface WidgetTestResults {
    widget: Widget;
    platform: 'android' | 'ios';
    timestamp: string;

    /** All test results keyed by tokenRef */
    tokenResults: Map<string, TokenExecutionResult[]>;

    /** Summary statistics */
    stats: {
        totalTests: number;
        executedTests: number;
        passedTests: number;
        failedTests: number;
        literalTokenFailures: number;
    };
}

/**
 * Manages test results for token validation
 */
export class TokenTestResultTracker {
    private results: Map<string, WidgetTestResults> = new Map();

    /**
     * Records a token test result
     */
    recordResult(
        widget: Widget,
        platform: 'android' | 'ios',
        result: TokenExecutionResult
    ): void {
        const key = `${widget}-${platform}`;

        if (!this.results.has(key)) {
            this.results.set(key, {
                widget,
                platform,
                timestamp: new Date().toISOString(),
                tokenResults: new Map(),
                stats: {
                    totalTests: 0,
                    executedTests: 0,
                    passedTests: 0,
                    failedTests: 0,
                    literalTokenFailures: 0
                }
            });
        }

        const widgetResults = this.results.get(key)!;

        // Add result to token results
        if (!widgetResults.tokenResults.has(result.tokenRef)) {
            widgetResults.tokenResults.set(result.tokenRef, []);
        }
        widgetResults.tokenResults.get(result.tokenRef)!.push(result);

        // Update stats
        widgetResults.stats.totalTests++;
        if (result.executed) widgetResults.stats.executedTests++;
        if (result.passed) widgetResults.stats.passedTests++;
        else widgetResults.stats.failedTests++;
        if (result.isLiteralToken) widgetResults.stats.literalTokenFailures++;
    }

    /**
     * Gets results for a specific widget and platform
     */
    getResults(widget: Widget, platform: 'android' | 'ios'): WidgetTestResults | undefined {
        return this.results.get(`${widget}-${platform}`);
    }

    /**
     * Exports results to JSON file
     * Now saves in platform-specific subfolder: outputDir/{platform}/
     */
    exportToJson(outputDir: string): void {
        for (const [key, widgetResults] of this.results.entries()) {
            // key format: "widget-platform" (e.g., "button-android")
            const platform = widgetResults.platform;
            
            // Create platform-specific subfolder
            const platformDir = path.join(outputDir, platform);
            if (!fs.existsSync(platformDir)) {
                fs.mkdirSync(platformDir, { recursive: true });
            }

            const fileName = `${key}-token-results.json`;
            const filePath = path.join(platformDir, fileName);

            // Convert Map to Object for JSON serialization
            const serializable = {
                ...widgetResults,
                tokenResults: Object.fromEntries(
                    Array.from(widgetResults.tokenResults.entries())
                )
            };

            fs.writeFileSync(filePath, JSON.stringify(serializable, null, 2));
        }
    }

    /**
     * Generates comparison table between configuration and actual results
     * @param widget Widget name
     * @param platform Platform (android/ios)
     * @param payloadComparison Optional payload comparison data
     */
    generateComparisonTable(widget: Widget, platform: 'android' | 'ios', payloadComparison?: any): string {
        const config = WidgetTokenConfigRegistry.getConfig(widget);
        const results = this.getResults(widget, platform);

        if (!results) {
            return `No test results found for ${widget} on ${platform}`;
        }

        let table = `\n${'='.repeat(120)}\n`;
        table += `TOKEN VALIDATION COMPARISON TABLE\n`;
        table += `Widget: ${widget} | Platform: ${platform} | Timestamp: ${results.timestamp}\n`;
        table += `${'='.repeat(120)}\n\n`;

        // Summary section
        table += `SUMMARY:\n`;
        table += `  Total Token Slots Configured: ${config.tokenSlots.length}\n`;
        if (payloadComparison) {
            table += `  Properties in Payload: ${payloadComparison.coverage.totalInPayload}\n`;
            table += `  Matched (Config + Payload): ${payloadComparison.coverage.matched}\n`;
            table += `  Coverage: ${payloadComparison.coverage.coveragePercent.toFixed(2)}%\n`;
        }
        table += `  Total Tests Executed: ${results.stats.totalTests}\n`;
        table += `  Tests Passed: ${results.stats.passedTests}\n`;
        table += `  Tests Failed: ${results.stats.failedTests}\n`;
        table += `  Literal Token Failures (Style Extraction Failures): ${results.stats.literalTokenFailures}\n`;
        table += `\n${'='.repeat(120)}\n\n`;

        // Token slot details
        table += `TOKEN SLOT VALIDATION DETAILS:\n\n`;
        table += `| Token Type | Executed | Properties with Literal Token Failures |\n`;
        table += `|${'-'.repeat(20)}|${'-'.repeat(12)}|${'-'.repeat(82)}|\n`;

        for (const slot of config.tokenSlots) {
            // Check if this token type was executed
            let executed = false;
            const literalFailures: string[] = [];

            for (const [tokenRef, testResults] of results.tokenResults.entries()) {
                for (const testResult of testResults) {
                    // Check if this test result is for this token slot
                    const pathStr = testResult.propertyPath.join('.');
                    const isMatchingSlot = slot.properties.some((p: string) => p === pathStr);

                    if (isMatchingSlot) {
                        executed = true;

                        // Check for literal token failures
                        if (testResult.isLiteralToken) {
                            literalFailures.push(`${pathStr} (value: "${testResult.actualValue}")`);
                        }
                    }
                }
            }

            const executedStatus = executed ? '✅ True' : '❌ False';
            const failuresStr = literalFailures.length > 0
                ? literalFailures.join(', ')
                : '—';

            table += `| ${slot.tokenType.padEnd(18)} | ${executedStatus.padEnd(10)} | ${failuresStr.substring(0, 80).padEnd(80)} |\n`;
        }

        table += `\n${'='.repeat(120)}\n\n`;

        // Detailed failures section
        if (results.stats.literalTokenFailures > 0) {
            table += `DETAILED LITERAL TOKEN FAILURES:\n\n`;

            for (const [tokenRef, testResults] of results.tokenResults.entries()) {
                const literalFailures = testResults.filter(r => r.isLiteralToken);

                if (literalFailures.length > 0) {
                    table += `Token: ${tokenRef}\n`;
                    for (const failure of literalFailures) {
                        table += `  • Property: ${failure.propertyPath.join('.')}\n`;
                        table += `    Actual Value: "${failure.actualValue}"\n`;
                        table += `    Expected Value: "${failure.expectedValue}"\n`;
                        table += `    Command: ${failure.command || 'N/A'}\n`;
                        table += `    Error: ${failure.error || 'N/A'}\n\n`;
                    }
                }
            }

            table += `${'='.repeat(120)}\n`;
        }

        return table;
    }

    /**
     * Saves comparison table to file
     * Now saves in platform-specific subfolder: outputDir/{platform}/
     */
    saveComparisonTable(widget: Widget, platform: 'android' | 'ios', outputDir: string): void {
        const table = this.generateComparisonTable(widget, platform);

        // Create platform-specific subfolder
        const platformDir = path.join(outputDir, platform);
        if (!fs.existsSync(platformDir)) {
            fs.mkdirSync(platformDir, { recursive: true });
        }

        const fileName = `${widget}-${platform}-comparison-table.txt`;
        const filePath = path.join(platformDir, fileName);

        fs.writeFileSync(filePath, table);
        console.log(`\n📊 Comparison table saved to: ${filePath}`);
        console.log(table);
    }
}

/**
 * Helper function to detect if a value is a literal token string
 */
export function isLiteralTokenString(value: string): boolean {
    if (!value || typeof value !== 'string') return false;

    const trimmed = value.trim();

    // Check for common literal token patterns
    return (
        trimmed === '{}' ||
        trimmed === '[]' ||
        trimmed === 'null' ||
        trimmed === 'undefined' ||
        trimmed === '' ||
        trimmed.startsWith('{') && trimmed.endsWith('}') && trimmed.length < 10
    );
}
