import { Widget, TokenType } from '../../src/matrix/widgets';
import fs from 'fs';
import path from 'path';

/**
 * Represents a single token slot configuration for a widget
 */
export interface TokenSlot {
    /** The token type (e.g., 'color', 'font', 'space') */
    tokenType: TokenType;

    /** Property paths for this token type (e.g., ['text.font.size', 'text.font.weight']) */
    properties: string[];
}

/**
 * Configuration for all token slots on a widget
 */
export interface WidgetTokenConfiguration {
    /** Widget name */
    widget: Widget;

    /** All token slots configured for this widget */
    tokenSlots: TokenSlot[];
}

/**
 * Raw configuration format from JSON file
 */
interface RawTokenConfig {
    [widget: string]: {
        tokenSlots: Array<{
            tokenType: string;
            properties: string[];
        }>;
    };
}

/**
 * Master configuration registry for all widgets
 * Reads from widget-token-slots.json file
 */
export class WidgetTokenConfigRegistry {
    private static configs: Map<Widget, WidgetTokenConfiguration> = new Map();
    private static rawConfig: RawTokenConfig | null = null;

    /**
     * Loads the configuration from JSON file
     */
    private static loadConfig(): RawTokenConfig {
        if (this.rawConfig) {
            return this.rawConfig;
        }

        const configPath = path.join(__dirname, 'widget-token-slots.json');

        if (!fs.existsSync(configPath)) {
            throw new Error(`Token configuration file not found: ${configPath}`);
        }

        const fileContent = fs.readFileSync(configPath, 'utf-8');
        const config = JSON.parse(fileContent) as RawTokenConfig;
        this.rawConfig = config;

        return config;
    }

    /**
     * Normalizes widget name from TypeScript format to JSON key format
     * e.g., 'tile' -> 'Tile', 'button-group' -> 'Button-Group'
     */
    private static normalizeWidgetKey(widget: Widget): string {
        const keyMap: Partial<Record<Widget, string>> = {
            /* 'tile': 'Tile',
            'button-group': 'Button-Group',
            'progress-bar': 'Progress-Bar',
            'progress-circle': 'Progress-Circle',
            'dropdown-menu': 'Dropdown-Menu',
            'modal-dialog': 'Modal-Dialog', */
        };
        return keyMap[widget] || widget;
    }

    /**
     * Gets or generates the token configuration for a widget
     */
    static getConfig(widget: Widget): WidgetTokenConfiguration {
        if (this.configs.has(widget)) {
            return this.configs.get(widget)!;
        }

        const rawConfig = this.loadConfig();
        const jsonKey = this.normalizeWidgetKey(widget);

        if (!rawConfig[jsonKey]) {
            throw new Error(`No token configuration found for widget: ${widget} (JSON key: ${jsonKey}). Please add it to widget-token-slots.json`);
        }

        const widgetConfig: WidgetTokenConfiguration = {
            widget,
            tokenSlots: rawConfig[jsonKey].tokenSlots.map(slot => ({
                tokenType: slot.tokenType as TokenType,
                properties: slot.properties
            }))
        };

        this.configs.set(widget, widgetConfig);
        return widgetConfig;
    }

    /**
     * Gets all configured widgets
     */
    static getAllWidgets(): Widget[] {
        const rawConfig = this.loadConfig();
        return Object.keys(rawConfig) as Widget[];
    }

    /**
     * Checks if a widget has configuration
     */
    static hasConfig(widget: Widget): boolean {
        const rawConfig = this.loadConfig();
        return this.normalizeWidgetKey(widget) in rawConfig;
    }

    /**
     * Exports the entire configuration as JSON string
     */
    static exportAsJson(): string {
        const rawConfig = this.loadConfig();
        return JSON.stringify(rawConfig, null, 2);
    }

    /**
     * Gets total number of properties configured for a widget
     */
    static getTotalProperties(widget: Widget): number {
        const config = this.getConfig(widget);
        return config.tokenSlots.reduce((sum, slot) => sum + slot.properties.length, 0);
    }
}
