import { Widget, TokenType } from '../../src/matrix/widgets';
import { WidgetTokenConfigRegistry } from '../config/widgetTokenConfig';
import { MobileMapper } from './mobileMapper';

/**
 * Represents a property that should be validated for a widget
 */
export interface ConfiguredProperty {
    /** Property path as array (e.g., ['text', 'font', 'size']) */
    path: string[];
    /** Property path as string (e.g., 'text.font.size') */
    pathString: string;
    /** Token type this property belongs to */
    tokenType: TokenType;
    /** RN extraction command for this property */
    extractionCommand: string;
}

/**
 * Represents a property found in the payload
 */
export interface PayloadProperty {
    /** Full property path */
    path: string[];
    /** Full property path as string */
    pathString: string;
    /** Logical property path (normalized) - Optional initially, set during comparison */
    logicalPath?: string;
    /** Token reference (e.g., '{colors.primary.value}') */
    tokenRef: string;
    /** Whether this property exists in configuration */
    isConfigured: boolean;
}

/**
 * Comparison result between configuration and payload
 */
export interface PayloadConfigComparison {
    widget: Widget;

    /** All properties configured for this widget */
    configuredProperties: ConfiguredProperty[];

    /** All properties found in the payload */
    payloadProperties: PayloadProperty[];

    /** Properties that are configured but NOT in payload */
    missingInPayload: ConfiguredProperty[];

    /** Properties that are in payload but NOT configured */
    unexpectedInPayload: PayloadProperty[];

    /** Properties that exist in both (should be tested) */
    matchedProperties: {
        configured: ConfiguredProperty;
        payload: PayloadProperty;
    }[];

    /** Coverage statistics */
    coverage: {
        totalConfigured: number;
        totalInPayload: number;
        matched: number;
        coveragePercent: number;
    };
}

/**
 * Compares widget configuration against batch payload
 */
export class PayloadConfigComparator {

    /**
     * Extracts all property paths from a nested payload object
     */
    static extractPayloadProperties(
        payload: any,
        basePath: string[] = []
    ): PayloadProperty[] {
        const properties: PayloadProperty[] = [];

        if (!payload || typeof payload !== 'object') {
            return properties;
        }

        // If this is a token value node (has 'value' property with token string)
        if ('value' in payload && typeof payload.value === 'string' && payload.value.startsWith('{')) {
            properties.push({
                path: [...basePath],
                pathString: basePath.join('.'),
                tokenRef: payload.value,
                isConfigured: false // Will be set during comparison
            });
            return properties;
        }

        // Recurse into nested objects
        for (const [key, value] of Object.entries(payload)) {
            // Skip metadata keys
            if (key === 'states' || key === 'mapping' || key === 'appearances') {
                // Still recurse into these
                properties.push(...this.extractPayloadProperties(value, [...basePath, key]));
            } else if (typeof value === 'object' && value !== null) {
                properties.push(...this.extractPayloadProperties(value, [...basePath, key]));
            }
        }

        return properties;
    }

    /**
     * Normalizes property paths for comparison
     * Handles differences in path representations
     */
    static normalizePath(path: string[], widget?: string): string {
        let result = [...path];

        // 1. Find the styles/mapping root
        const mappingIndex = result.lastIndexOf('mapping');
        if (mappingIndex !== -1) {
            result = result.slice(mappingIndex + 1);
        } else {
            const vgIndex = result.lastIndexOf('variantGroups');
            if (vgIndex !== -1) {
                // Path is [..., 'variantGroups', group, variant, prop1, prop2, ...]
                // Strip variantGroups and the next two levels (group and variant name)
                result = result.slice(vgIndex + 3);
            }
        }

        // 2. Filter out known metadata and state wrappers
        // We exclude 'default' only if it's likely a state, but appearances also use it.
        // However, in the context of extraction, we want the leaf property.
        const metadata = ['states', 'appearances', 'mapping', 'variantGroups', 'active', 'focused', 'disabled', 'hover'];
        if (widget) metadata.push(widget);

        const filtered = result.filter(p => !metadata.includes(p));

        return filtered.join('.');
    }

    /**
     * Compares configuration against payload for a widget
     */
    static compare(widget: Widget, payload: any, platform: 'android' | 'ios' = 'android'): PayloadConfigComparison {
        // Get configuration
        const config = WidgetTokenConfigRegistry.getConfig(widget);

        // Extract configured properties
        const configuredProperties: ConfiguredProperty[] = [];
        for (const slot of config.tokenSlots) {
            for (const propPath of slot.properties) {
                const pathParts = propPath.split('.');
                configuredProperties.push({
                    path: pathParts,
                    pathString: propPath,
                    tokenType: slot.tokenType,
                    extractionCommand: MobileMapper.getExtractionCommand(widget, pathParts, '{widget}', platform)
                });
            }
        }

        // Extract payload properties
        const rawPayloadProperties = this.extractPayloadProperties(payload);

        // Create normalized lookup maps
        const configMap = new Map<string, ConfiguredProperty>();
        for (const prop of configuredProperties) {
            const normalized = this.normalizePath(prop.path, widget);
            configMap.set(normalized, prop);
        }

        const payloadProperties: PayloadProperty[] = [];
        const payloadMap = new Map<string, PayloadProperty>();

        for (const prop of rawPayloadProperties) {
            const normalized = this.normalizePath(prop.path, widget);
            const payloadProp: PayloadProperty = {
                ...prop,
                logicalPath: normalized,
                isConfigured: configMap.has(normalized)
            };

            payloadProperties.push(payloadProp);
            payloadMap.set(normalized, payloadProp);
        }

        // Find matches and gaps
        const missingInPayload: ConfiguredProperty[] = [];
        const matchedProperties: { configured: ConfiguredProperty; payload: PayloadProperty }[] = [];

        for (const [normalized, configured] of configMap.entries()) {
            const payloadProp = payloadMap.get(normalized);
            if (payloadProp) {
                matchedProperties.push({ configured, payload: payloadProp });
            } else {
                missingInPayload.push(configured);
            }
        }

        // Find unexpected properties
        const unexpectedInPayload: PayloadProperty[] = [];
        for (const [normalized, payloadProp] of payloadMap.entries()) {
            if (!configMap.has(normalized)) {
                unexpectedInPayload.push(payloadProp);
            }
        }

        // Calculate coverage
        const matched = matchedProperties.length;
        const totalConfigured = configuredProperties.length;
        const coveragePercent = totalConfigured > 0 ? (matched / totalConfigured) * 100 : 0;

        return {
            widget,
            configuredProperties,
            payloadProperties,
            missingInPayload,
            unexpectedInPayload,
            matchedProperties,
            coverage: {
                totalConfigured,
                totalInPayload: payloadProperties.length,
                matched,
                coveragePercent
            }
        };
    }

    /**
     * Generates a detailed comparison report
     */
    static generateReport(comparison: PayloadConfigComparison): string {
        let report = `\n${'='.repeat(120)}\n`;
        report += `PAYLOAD vs CONFIGURATION COMPARISON\n`;
        report += `Widget: ${comparison.widget}\n`;
        report += `${'='.repeat(120)}\n\n`;

        // Coverage Summary
        report += `COVERAGE SUMMARY:\n`;
        report += `  Total Configured Properties: ${comparison.coverage.totalConfigured}\n`;
        report += `  Total Properties in Payload: ${comparison.coverage.totalInPayload}\n`;
        report += `  Matched Properties: ${comparison.coverage.matched}\n`;
        report += `  Coverage: ${comparison.coverage.coveragePercent.toFixed(2)}%\n`;
        report += `  Missing in Payload: ${comparison.missingInPayload.length}\n`;
        report += `  Unexpected in Payload: ${comparison.unexpectedInPayload.length}\n`;
        report += `\n${'='.repeat(120)}\n\n`;

        // Matched Properties (should be tested)
        if (comparison.matchedProperties.length > 0) {
            report += `✅ MATCHED PROPERTIES (Should be Tested):\n\n`;
            report += `| Property Path | Token Type | Token Reference | Extraction Command |\n`;
            report += `|${'-'.repeat(40)}|${'-'.repeat(15)}|${'-'.repeat(30)}|${'-'.repeat(30)}|\n`;

            for (const match of comparison.matchedProperties) {
                const pathStr = match.configured.pathString.substring(0, 38).padEnd(38);
                const typeStr = match.configured.tokenType.padEnd(13);
                const tokenStr = match.payload.tokenRef.substring(0, 28).padEnd(28);
                const cmdStr = match.configured.extractionCommand.substring(0, 28).padEnd(28);

                report += `| ${pathStr} | ${typeStr} | ${tokenStr} | ${cmdStr} |\n`;
            }
            report += `\n`;
        }

        // Missing in Payload
        if (comparison.missingInPayload.length > 0) {
            report += `⚠️  CONFIGURED BUT MISSING IN PAYLOAD:\n\n`;
            report += `| Property Path | Token Type | Extraction Command |\n`;
            report += `|${'-'.repeat(50)}|${'-'.repeat(15)}|${'-'.repeat(50)}|\n`;

            for (const prop of comparison.missingInPayload) {
                const pathStr = prop.pathString.substring(0, 48).padEnd(48);
                const typeStr = prop.tokenType.padEnd(13);
                const cmdStr = prop.extractionCommand.substring(0, 48).padEnd(48);

                report += `| ${pathStr} | ${typeStr} | ${cmdStr} |\n`;
            }
            report += `\n`;
        }

        // Unexpected in Payload
        if (comparison.unexpectedInPayload.length > 0) {
            report += `❗ IN PAYLOAD BUT NOT CONFIGURED:\n\n`;
            report += `| Property Path | Token Reference |\n`;
            report += `|${'-'.repeat(60)}|${'-'.repeat(55)}|\n`;

            for (const prop of comparison.unexpectedInPayload) {
                const pathStr = (prop.logicalPath || prop.pathString).substring(0, 58).padEnd(58);
                const tokenStr = prop.tokenRef.substring(0, 53).padEnd(53);

                report += `| ${pathStr} | ${tokenStr} |\n`;
            }
            report += `\n`;
        }

        report += `${'='.repeat(120)}\n`;

        return report;
    }
}
