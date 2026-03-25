import fs from 'fs';
import path from 'path';
import { WIDGET_CONFIG, Widget, TokenType, MatrixItem } from '../matrix/widgets';
import { generateVariantPayload, getWidgetKey } from '../matrix/generator';

/**
 * Token Slot Configuration
 * Matches the structure in widget-token-slots.json
 */
export interface TokenSlot {
    tokenType: TokenType;
    properties: string[];
}

export interface WidgetTokenSlots {
    tokenSlots: TokenSlot[];
}

/**
 * Token Slot Test Case
 * Represents a single test case for a token slot
 */
export interface TokenSlotTestCase {
    widget: Widget;
    appearance: string;
    variant: string;
    state: string;
    tokenType: TokenType;
    propertyPath: string[];
    tokenRef: string;
    testId: string; // Unique identifier for this test case
}

/**
 * Token Slot Generator
 * Generates comprehensive test cases based on widget-token-slots.json
 * Ensures 100% slot coverage for all widgets
 */
export class TokenSlotGenerator {
    private widgetTokenSlots: Record<string, WidgetTokenSlots>;
    private configPath: string;

    constructor(configPath?: string) {
        this.configPath = configPath || path.join(process.cwd(), 'wdio/config/widget-token-slots.json');
        this.widgetTokenSlots = this.loadWidgetTokenSlots();
    }

    /**
     * Loads widget-token-slots.json configuration
     */
    private loadWidgetTokenSlots(): Record<string, WidgetTokenSlots> {
        if (!fs.existsSync(this.configPath)) {
            throw new Error(`widget-token-slots.json not found at: ${this.configPath}`);
        }

        const raw = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
        const normalized: Record<string, WidgetTokenSlots> = {};

        for (const [key, value] of Object.entries(raw)) {
            if (key === '$schema' || key === 'description') continue;
            if (value && typeof value === 'object' && 'tokenSlots' in value) {
                normalized[key.toLowerCase()] = value as WidgetTokenSlots;
            }
        }

        return normalized;
    }

    /**
     * Gets token slots for a widget
     */
    getTokenSlotsForWidget(widget: Widget): TokenSlot[] {
        const slots = this.widgetTokenSlots[widget.toLowerCase()];
        if (!slots) {
            console.warn(`⚠️  No token slots found for widget: ${widget}`);
            return [];
        }
        return slots.tokenSlots;
    }

    /**
     * Generates all test cases for a single widget with 100% slot coverage
     */
    generateTestCasesForWidget(
        widget: Widget,
        tokenMap: Record<string, string>
    ): TokenSlotTestCase[] {
        const testCases: TokenSlotTestCase[] = [];
        const config = WIDGET_CONFIG[widget];

        if (!config) {
            console.warn(`⚠️  No config found for widget: ${widget}`);
            return [];
        }

        const tokenSlots = this.getTokenSlotsForWidget(widget);
        if (tokenSlots.length === 0) {
            console.warn(`⚠️  No token slots configured for widget: ${widget}`);
            return [];
        }

        console.log(`\n📋 Generating test cases for widget: ${widget}`);
        console.log(`   Appearances: ${config.appearances.join(', ')}`);
        console.log(`   Token Slots: ${tokenSlots.length}`);

        // For each appearance
        for (const appearance of config.appearances) {
            const variants = config.variants[appearance] || [];

            if (variants.length === 0) {
                console.warn(`⚠️  No variants for appearance: ${appearance}`);
                continue;
            }

            // For each variant
            for (const variant of variants) {
                // For each state
                for (const state of config.states) {
                    // For each token slot
                    for (const slot of tokenSlots) {
                        // Only include if widget allows this token type
                        if (
                            !config.allowedTokenTypes ||
                            !config.allowedTokenTypes.includes(slot.tokenType)
                        ) {
                            continue;
                        }

                        // For each property in the slot
                        for (const property of slot.properties) {
                            const propertyPath = property.split('.');

                            // Find a compatible token from the token map
                            // Include appearance/variant/state in selection to ensure different variants get different tokens
                            const tokenRef = this.findCompatibleToken(
                                slot.tokenType,
                                propertyPath,
                                tokenMap,
                                widget,
                                appearance,
                                variant,
                                state
                            );

                            if (!tokenRef) {
                                console.warn(
                                    `⚠️  No compatible token found for ${widget}.${appearance}.${variant}.${state}.${slot.tokenType}.${property}`
                                );
                                continue;
                            }

                            const testId = `${widget}-${appearance}-${variant}-${state}-${property.replace(/\./g, '-')}`;

                            testCases.push({
                                widget,
                                appearance,
                                variant,
                                state,
                                tokenType: slot.tokenType,
                                propertyPath,
                                tokenRef,
                                testId,
                            });
                        }
                    }
                }
            }
        }

        console.log(`   ✅ Generated ${testCases.length} test cases`);
        return testCases;
    }

    /**
     * Generates all test cases for all widgets (or a filtered subset via widgetFilter)
     */
    generateAllTestCases(tokenMap: Record<string, string>, widgetFilter?: string[]): TokenSlotTestCase[] {
        const allTestCases: TokenSlotTestCase[] = [];
        const allWidgets = Object.keys(WIDGET_CONFIG) as Widget[];
        const widgets = widgetFilter
            ? allWidgets.filter(w => widgetFilter.includes(w))
            : allWidgets;

        console.log(`\n🎯 Generating test cases for ${widgets.length} widgets...`);

        for (const widget of widgets) {
            const testCases = this.generateTestCasesForWidget(widget, tokenMap);
            allTestCases.push(...testCases);
        }

        console.log(`\n✅ Total test cases generated: ${allTestCases.length}`);
        return allTestCases;
    }

    /**
     * Finds a compatible token from the token map
     * Uses appearance/variant/state to ensure different variants get different tokens
     */
    private findCompatibleToken(
        tokenType: TokenType,
        propertyPath: string[],
        tokenMap: Record<string, string>,
        widget: Widget,
        appearance: string,
        variant: string,
        state: string
    ): string | null {
        const propertyName = propertyPath.length >= 2
            ? propertyPath.slice(-2).join('-')
            : propertyPath[propertyPath.length - 1];

        // Find tokens that match the type
        const compatibleTokens = Object.keys(tokenMap).filter((tokenRef) => {
            return this.isTokenCompatible(tokenRef, tokenType, propertyName);
        });

        if (compatibleTokens.length === 0) {
            return null;
        }

        // Use hash-based selection that includes appearance/variant/state for variety
        // This ensures different variants get different tokens
        const hashInput = `${widget}.${appearance}.${variant}.${state}.${propertyPath.join('.')}`;
        const hash = hashInput.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const selectedToken = compatibleTokens[hash % compatibleTokens.length];

        return selectedToken;
    }

    /**
     * Checks if a token is compatible with a token type and property
     */
    private isTokenCompatible(
        tokenRef: string,
        tokenType: TokenType,
        propertyName: string
    ): boolean {
        const lowerRef = tokenRef.toLowerCase();

        switch (tokenType) {
            case 'color':
                return lowerRef.includes('color');

            case 'font':
                if (propertyName.endsWith('font-family') || propertyName.endsWith('family')) {
                    return lowerRef.includes('font-family') || lowerRef.includes('family');
                }
                if (propertyName.endsWith('font-size') || propertyName.endsWith('size')) {
                    return lowerRef.includes('font-size') || lowerRef.includes('size');
                }
                if (propertyName.endsWith('font-weight') || propertyName.endsWith('weight')) {
                    return lowerRef.includes('font-weight') || lowerRef.includes('weight');
                }
                if (propertyName.endsWith('line-height')) {
                    return lowerRef.includes('line-height') || lowerRef.includes('line_height');
                }
                if (propertyName.endsWith('letter-spacing')) {
                    return lowerRef.includes('letter-spacing');
                }
                return lowerRef.includes('font');

            case 'space':
                return lowerRef.includes('space') || lowerRef.includes('spacer');
            case 'gap':
                return lowerRef.includes('gap');
            case 'margin':
                return lowerRef.includes('margin');
            case 'padding':
                return lowerRef.includes('padding') || lowerRef.includes('space') || lowerRef.includes('spacer');

            case 'border-width':
                return lowerRef.includes('border') && lowerRef.includes('width');

            case 'border-style':
                return lowerRef.includes('border') && lowerRef.includes('style');

            case 'border-radius':
                return lowerRef.includes('radius');

            case 'elevation':
            case 'box-shadow':
                return lowerRef.includes('shadow') || lowerRef.includes('elevation');

            case 'opacity':
                return lowerRef.includes('opacity');

            case 'icon':
                return lowerRef.includes('icon');

            default:
                return false;
        }
    }

    /**
     * Generates individual payload for a single test case
     * (Playwright applies token-by-token, not batch)
     */
    generatePayloadForTestCase(testCase: TokenSlotTestCase): Record<string, any> {
        const matrixItem: MatrixItem = {
            widget: testCase.widget,
            appearance: testCase.appearance as any,
            variant: testCase.variant as any,
            state: testCase.state as any,
            tokenType: testCase.tokenType,
        };

        const payload = generateVariantPayload(
            matrixItem,
            testCase.propertyPath,
            testCase.tokenRef
        );

        return payload;
    }

    /**
     * Saves test cases to a JSON file
     */
    saveTestCases(testCases: TokenSlotTestCase[], outputPath: string): void {
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(outputPath, JSON.stringify(testCases, null, 2), 'utf-8');
        console.log(`✅ Test cases saved to: ${outputPath}`);
    }


    /**
     * Generates a coverage report showing slot coverage
     */
    generateCoverageReport(testCases: TokenSlotTestCase[]): string {
        const coverageByWidget = new Map<Widget, {
            totalSlots: number;
            coveredSlots: number;
            properties: Set<string>;
        }>();

        // Calculate coverage per widget
        for (const testCase of testCases) {
            if (!coverageByWidget.has(testCase.widget)) {
                const slots = this.getTokenSlotsForWidget(testCase.widget);
                const totalProperties = slots.reduce((sum, slot) => sum + slot.properties.length, 0);

                coverageByWidget.set(testCase.widget, {
                    totalSlots: totalProperties,
                    coveredSlots: 0,
                    properties: new Set(),
                });
            }

            const coverage = coverageByWidget.get(testCase.widget)!;
            const propertyKey = `${testCase.tokenType}.${testCase.propertyPath.join('.')}`;
            coverage.properties.add(propertyKey);
            coverage.coveredSlots = coverage.properties.size;
        }

        // Generate report
        let report = '\n' + '='.repeat(80) + '\n';
        report += '📊 TOKEN SLOT COVERAGE REPORT\n';
        report += '='.repeat(80) + '\n\n';

        for (const [widget, coverage] of coverageByWidget.entries()) {
            const percentage = ((coverage.coveredSlots / coverage.totalSlots) * 100).toFixed(2);
            report += `Widget: ${widget}\n`;
            report += `  Covered: ${coverage.coveredSlots}/${coverage.totalSlots} (${percentage}%)\n`;
            report += `  Status: ${percentage === '100.00' ? '✅ COMPLETE' : '⚠️  INCOMPLETE'}\n\n`;
        }

        const totalSlots = Array.from(coverageByWidget.values()).reduce(
            (sum, c) => sum + c.totalSlots,
            0
        );
        const totalCovered = Array.from(coverageByWidget.values()).reduce(
            (sum, c) => sum + c.coveredSlots,
            0
        );
        const totalPercentage = ((totalCovered / totalSlots) * 100).toFixed(2);

        report += '='.repeat(80) + '\n';
        report += `TOTAL COVERAGE: ${totalCovered}/${totalSlots} (${totalPercentage}%)\n`;
        report += '='.repeat(80) + '\n';

        return report;
    }
}
