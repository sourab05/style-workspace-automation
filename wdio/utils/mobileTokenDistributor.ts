import { WIDGET_CONFIG } from '../../src/matrix/widgets';
import fs from 'fs';
import path from 'path';

type TokenTypeKey = string;
type WidgetType = import('../../src/matrix/widgets').Widget;

// Helper to split all strings
const splitAll = (arr: string[]) => arr.map(s => s.split('.'));

type TokenSlotConfig = {
    tokenType: string;
    properties: string[];
};

type WidgetTokenSlots = Record<string, TokenSlotConfig[]>;

let widgetTokenSlotsCache: WidgetTokenSlots | null = null;

function normalizeWidgetKey(widget: string): string {
    return (widget || '').trim().toLowerCase();
}

function loadWidgetTokenSlots(): WidgetTokenSlots {
    if (widgetTokenSlotsCache) return widgetTokenSlotsCache;

    const configPath = path.join(__dirname, '../config/widget-token-slots.json');
    if (!fs.existsSync(configPath)) {
        widgetTokenSlotsCache = {};
        return widgetTokenSlotsCache;
    }

    const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as Record<string, { tokenSlots?: TokenSlotConfig[] }>;
    const normalized: WidgetTokenSlots = {};

    for (const [key, value] of Object.entries(raw)) {
        if (!value || !Array.isArray(value.tokenSlots)) continue;
        normalized[normalizeWidgetKey(key)] = value.tokenSlots;
    }

    widgetTokenSlotsCache = normalized;
    return widgetTokenSlotsCache;
}

function normalizeRequestedTokenType(tokenType: string): TokenTypeKey {
    return tokenType;
}

export function getPropertyPathsForType(
    widget: WidgetType,
    tokenType: string,
    candidatesCallback?: (widget: WidgetType, type: string) => string[][] // Optional callback if we need auto-discovery
): string[][] {
    const normalized = normalizeRequestedTokenType(tokenType);
    // Generic widget mapping using widget-token-slots.json
    const tokenSlots = loadWidgetTokenSlots()[normalizeWidgetKey(widget)];
    if (tokenSlots) {
        const slotProperties = tokenSlots
            .filter(slot => slot.tokenType === normalized)
            .flatMap(slot => slot.properties);

        if (slotProperties.length) {
            return splitAll(slotProperties);
        }
    }

    // Use callback for auto-discovery if provided (fallback)
    if (candidatesCallback) {
        const paths = candidatesCallback(widget, normalized);
        if (paths && paths.length) return paths;
    }

    // Safe defaults
    switch (tokenType) {
        case 'color':
            return splitAll(['background', 'color', 'border.color']);
        case 'font':
            return splitAll(['font-size', 'font-weight', 'line-height', 'letter-spacing', 'font-family']);
        case 'space':
        case 'gap':
        case 'margin':
        case 'spacer':
            return [['padding']];
        case 'border-width':
            return [['border', 'width']];
        case 'border-style':
            return [['border', 'style']];
        case 'border-radius':
        case 'radius':
            return [['border', 'radius']];
        case 'box-shadow':
        case 'elevation':
            return [['box-shadow']];
        case 'opacity':
            return [['opacity']];
        default:
            return [['background-color']];
    }
}
