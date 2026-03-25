import { Page, expect } from '@playwright/test';
import { getComputedCss } from '../../src/playwright/helpers';
import fs from 'fs';
import path from 'path';
import { widgetXPaths } from '../../src/matrix/widget-xpaths';
import { getWidgetKey } from '../../src/matrix/generator';


/**
 * WidgetPage Page Object
 * Handles widget-specific operations including:
 * - Element location and interaction
 * - CSS property verification
 * - Widget state validation
 */
export class WidgetPage {
  constructor(private page: Page) { }

  // New helper: Recover closed page and reload Canvas/Preview
  private async recoverPageAndReloadView(snapshotName: string, isPreview: boolean): Promise<void> {
    const rawWidget = snapshotName.split('-')[0];
    const context = this.page.context();
    // BrowserContext has no isClosed(); always create a fresh page
    this.page = await context.newPage();
    const { gotoCanvas, gotoPreview } = require('../../src/playwright/helpers');

    // Navigation uses the core widget name ('formcontrols') as requested
    if (isPreview) await gotoPreview(this.page, rawWidget);
    else await gotoCanvas(this.page, rawWidget);
  }

  /**
   * Maps token property names to actual CSS property names
   * @param tokenProperty - Property name from token (e.g., 'background', 'font-family')
   * @returns Actual CSS property name (e.g., 'backgroundColor', 'fontFamily')
   */
  private mapTokenPropertyToCssProperty(tokenProperty: string): string {
    const { TokenMappingService } = require('../../src/tokens/mappingService');
    return TokenMappingService.mapToComputedProperty(tokenProperty);
  }

  /**
   * Gets the XPath for a widget in canvas view
   * @param snapshotName - Name identifying the widget (e.g., 'button-filled-primary-default')
   * @param flattenedPath - Optional property path (e.g., 'header.background-color')
   * @returns XPath string
   */
  getCanvasXPath(snapshotName: string, flattenedPath?: string): string {
    const widget = snapshotName.split('-')[0];

    // Accordion specialized resolution: distinguish between header and body only
    if (widget === 'accordion' && flattenedPath) {
      const isBody = flattenedPath === 'background-color' || flattenedPath === 'background';
      const componentKey = isBody ? `${snapshotName}-body` : `${snapshotName}-header`;
      console.log(`[Accordion] Property "${flattenedPath}" -> Targeting ${isBody ? 'BODY' : 'HEADER'} element (${componentKey})`);
      const componentMap = widgetXPaths.canvas[componentKey as keyof typeof widgetXPaths.canvas];
      if (componentMap) return componentMap;
    }

    // Direct map
    const directMap = widgetXPaths.canvas[snapshotName as keyof typeof widgetXPaths.canvas];
    if (directMap) return directMap;

    // 3. Fallback: Try stripping the state (e.g., -active, -hover) and using -default
    const parts = snapshotName.split('-');
    if (parts.length >= 4) {
      const baseName = parts.slice(0, 3).join('-') + '-default';
      const fallbackMap = widgetXPaths.canvas[baseName as keyof typeof widgetXPaths.canvas];
      if (fallbackMap) {
        console.log(`ℹ️  Canvas fallback: "${snapshotName}" not found, using "${baseName}"`);
        return fallbackMap;
      }
    }
    return directMap; // Will be undefined
  }

  /**
   * Gets the XPath for a widget in preview view
   * @param snapshotName - Name identifying the widget
   * @param flattenedPath - Optional property path
   * @returns XPath string
   */
  getPreviewXPath(snapshotName: string, flattenedPath?: string): string {
    const widget = snapshotName.split('-')[0];

    // Accordion specialized resolution: distinguish between header and body only
    if (widget === 'accordion' && flattenedPath) {
      const isBody = flattenedPath === 'background-color' || flattenedPath === 'background';
      const componentKey = isBody ? `${snapshotName}-body` : `${snapshotName}-header`;
      console.log(`[Accordion] Property "${flattenedPath}" -> Targeting ${isBody ? 'BODY' : 'HEADER'} element (${componentKey})`);
      const componentMap = widgetXPaths.preview[componentKey as keyof typeof widgetXPaths.preview];
      if (componentMap) return componentMap;
    }

    // Direct map
    const directMap = widgetXPaths.preview[snapshotName as keyof typeof widgetXPaths.preview];
    if (directMap) return directMap;

    // 3. Fallback: Try stripping the state and using -default
    const parts = snapshotName.split('-');
    if (parts.length >= 4) {
      const baseName = parts.slice(0, 3).join('-') + '-default';
      const fallbackMap = widgetXPaths.preview[baseName as keyof typeof widgetXPaths.preview];
      if (fallbackMap) {
        console.log(`ℹ️  Preview fallback: "${snapshotName}" not found, using "${baseName}"`);
        return fallbackMap;
      }
    }
    return directMap; // Will be undefined
  }

  /**
   * Locates a widget element in canvas view
   * @param snapshotName - Name identifying the widget
   * @param flattenedPath - Optional property path
   * @returns Playwright Locator
   */
  locateCanvasWidget(snapshotName: string, flattenedPath?: string) {
    const xpath = this.getCanvasXPath(snapshotName, flattenedPath);
    return this.page.locator(xpath);
  }

  /**
   * Locates a widget element in preview view
   * @param snapshotName - Name identifying the widget
   * @param flattenedPath - Optional property path
   * @returns Playwright Locator
   */
  locatePreviewWidget(snapshotName: string, flattenedPath?: string) {
    const xpath = this.getPreviewXPath(snapshotName, flattenedPath);
    return this.page.locator(xpath);
  }

  /**
   * Verifies a widget is visible in canvas view
   * @param snapshotName - Name identifying the widget
   * @param flattenedPath - Optional property path
   */
  async verifyCanvasWidgetVisible(snapshotName: string, flattenedPath?: string): Promise<void> {
    const element = this.locateCanvasWidget(snapshotName, flattenedPath);
    await expect(element).toBeVisible();
  }

  /**
   * Verifies a widget is visible in preview view
   * @param snapshotName - Name identifying the widget
   * @param flattenedPath - Optional property path
   */
  async verifyPreviewWidgetVisible(snapshotName: string, flattenedPath?: string): Promise<void> {
    const element = this.locatePreviewWidget(snapshotName, flattenedPath);
    await expect(element).toBeVisible();
  }

  /**
   * Gets the computed CSS property value for a canvas widget
   * @param snapshotName - Name identifying the widget
   * @param cssProperty - CSS property name (e.g., 'background', 'color')
   * @param flattenedPath - Optional property path
   * @returns The computed CSS property value
   */
  async getCanvasWidgetCssProperty(snapshotName: string, cssProperty: string, flattenedPath?: string): Promise<string> {
    const mappedProperty = this.mapToComputedProperty(cssProperty);
    const { TokenMappingService } = require('../../src/tokens/mappingService');
    const longhands = TokenMappingService.getLonghandProperties(mappedProperty);

    console.log(`   🔍 Mapping token property "${cssProperty}" to CSS property "${mappedProperty}" (Longhands: ${longhands.length > 0 ? longhands.join(', ') : 'none'})`);
    const xpath = this.getCanvasXPath(snapshotName, flattenedPath);

    // Entry Guard: wait for element to be visible using Playwright native sync
    await this.page.locator(xpath).waitFor({ state: 'visible', timeout: 10000 });

    // Retry logic to handle style propagation delays
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds

    // PRIMARY: try getComputedCss first
    const primary = await getComputedCss(this.page, xpath, cssProperty);
    // FULL DEBUG ATTACHMENT
    try {
      const t = (globalThis as any).test;
      if (t?.info) {
        await t.info().attach(`canvas-css-debug-${snapshotName}-${cssProperty}.txt`, {
          body: `Canvas CSS Debug Report\nSnapshot: ${snapshotName}\nProperty: ${cssProperty}\nRaw: ${primary}\nResolved: ${primary}\nUsedVar: (see helpers log)`,
          contentType: 'text/plain'
        });
      }
    } catch { }

    if (primary && !['0px', '0', 'none', 'normal', ''].includes(primary.toLowerCase())) {
      console.log(`   🎯 getComputedCss PRIMARY used for ${cssProperty}: ${primary}`);
      return primary;
    }
    console.log(`   ⚠️ getComputedCss returned default for ${cssProperty}, falling back to longhand...`);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`   💻 Executing Robust JS Extraction (attempt ${attempt}/${maxRetries})`);

      const result = await this.page.evaluate(
        ({ xpath, prop, longhands }) => {
          // 1. Safe element resolution (XPath)
          const el = document.evaluate(
            xpath,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          ).singleNodeValue as HTMLElement | null;

          // 2. Null & connectivity guard
          if (!el || !el.isConnected) {
            return { error: "Element not found or not mounted" };
          }

          // 3. Visibility check (optional but recommended)
          const rect = el.getBoundingClientRect();
          const isVisible = rect.width > 0 && rect.height > 0;
          if (!isVisible) {
            console.warn("Element found but not visible in viewport");
          }

          const style = window.getComputedStyle(el);

          // 4. Extraction Logic
          if (longhands && longhands.length > 0) {
            const values = longhands.map((p: string) => style.getPropertyValue(p.replace(/([A-Z])/g, "-$1").toLowerCase()) || (style as any)[p]);
            const uniqueValues = Array.from(new Set(values.map((v: any) => (v || '').toString().trim())));

            // If all longhands are the same, return that single value
            if (uniqueValues.length === 1) return { value: uniqueValues[0] };

            // Otherwise return the full set (or we could pick one based on logic)
            return { value: uniqueValues.join(' '), details: values };
          }

          // Fallback to single property
          const val = (prop in style) ? (style as any)[prop] : style.getPropertyValue(prop.replace(/([A-Z])/g, "-$1").toLowerCase());
          return { value: val };
        },
        { xpath, prop: mappedProperty, longhands }
      );

      if (result.error) {
        console.warn(`   ⚠️  Attempt ${attempt}: ${result.error}`);
        if (attempt === maxRetries) throw new Error(result.error);
      } else {
        const normalized = (result.value || '').toString().trim();
        console.log(`   🎯 Retrieved CSS value: "${normalized}"`);

        // If we got a non-default value, return it
        if (normalized && normalized !== '0px' && normalized !== 'none' && normalized !== '0') {
          return normalized;
        }
      }

      if (attempt < maxRetries) {
        console.log(`   ⏳ Waiting ${retryDelay}ms before retry...`);
        await this.page.waitForTimeout(retryDelay);
      } else {
        return (result.value || '').toString().trim();
      }
    }

    return '';
  }

  private mapToComputedProperty(prop: string): string {
    const { TokenMappingService } = require('../../src/tokens/mappingService');
    return TokenMappingService.mapToComputedProperty(prop);
  }

  /**
   * Gets the computed CSS property value for a preview widget
   * @param snapshotName - Name identifying the widget
   * @param cssProperty - CSS property name (e.g., 'background', 'color')
   * @returns The computed CSS property value
   */
  async getPreviewWidgetCssProperty(snapshotName: string, cssProperty: string, flattenedPath?: string): Promise<string> {
    const mappedProperty = this.mapToComputedProperty(cssProperty);
    const { TokenMappingService } = require('../../src/tokens/mappingService');
    const longhands = TokenMappingService.getLonghandProperties(mappedProperty);

    console.log(`   🔍 Mapping token preview property "${cssProperty}" to CSS property "${mappedProperty}" (Longhands: ${longhands.length > 0 ? longhands.join(', ') : 'none'})`);
    const xpath = this.getPreviewXPath(snapshotName, flattenedPath);

    // Entry Guard: wait for element to be visible using Playwright native sync
    await this.page.locator(xpath).waitFor({ state: 'visible', timeout: 10000 });

    // Retry logic to handle style propagation delays
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds

    // PRIMARY: try getComputedCss first
    const primaryPrev = await getComputedCss(this.page, xpath, cssProperty);
    // FULL DEBUG ATTACHMENT
    try {
      const t = (globalThis as any).test;
      if (t?.info) {
        await t.info().attach(`preview-css-debug-${snapshotName}-${cssProperty}.txt`, {
          body: `Preview CSS Debug Report\nSnapshot: ${snapshotName}\nProperty: ${cssProperty}\nRaw: ${primaryPrev}\nResolved: ${primaryPrev}\nUsedVar: (see helpers log)`,
          contentType: 'text/plain'
        });
      }
    } catch { }

    if (primaryPrev && !['0px', '0', 'none', 'normal', ''].includes(primaryPrev.toLowerCase())) {
      console.log(`   🎯 getComputedCss PRIMARY used for PREVIEW ${cssProperty}: ${primaryPrev}`);
      return primaryPrev;
    }
    console.log(`   ⚠️ getComputedCss returned default for PREVIEW ${cssProperty}, falling back to longhand...`);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`   💻 Executing Robust JS Extraction PREVIEW (attempt ${attempt}/${maxRetries})`);

      const result = await this.page.evaluate(
        ({ xpath, prop, longhands }: { xpath: string, prop: string, longhands: string[] }) => {
          // 1. Safe element resolution (XPath)
          const el = document.evaluate(
            xpath,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          ).singleNodeValue as HTMLElement | null;

          // 2. Null & connectivity guard
          if (!el || !el.isConnected) {
            return { error: "Element not found or not mounted" };
          }

          const style = window.getComputedStyle(el);

          // 3. Extraction Logic
          if (longhands && longhands.length > 0) {
            const values = longhands.map((p: string) => style.getPropertyValue(p.replace(/([A-Z])/g, "-$1").toLowerCase()) || (style as any)[p]);
            const uniqueValues = Array.from(new Set(values.map((v: any) => (v || '').toString().trim())));

            // If all longhands are the same, return that single value
            if (uniqueValues.length === 1) return { value: uniqueValues[0] };

            // Otherwise return the full set
            return { value: uniqueValues.join(' '), details: values };
          }

          // Fallback to single property
          const val = (prop in style) ? (style as any)[prop] : style.getPropertyValue(prop.replace(/([A-Z])/g, "-$1").toLowerCase());
          return { value: val };
        },
        { xpath, prop: mappedProperty, longhands }
      );

      if (result.error) {
        console.warn(`   ⚠️  Attempt ${attempt}: ${result.error}`);
        if (attempt === maxRetries) throw new Error(result.error);
      } else {
        const normalized = (result.value || '').toString().trim();
        console.log(`   🎯 Retrieved CSS value: "${normalized}"`);

        // If we got a non-default value, return it
        if (normalized && normalized !== '0px' && normalized !== 'none' && normalized !== '0') {
          return normalized;
        }
      }

      if (attempt < maxRetries) {
        console.log(`   ⏳ Waiting ${retryDelay}ms before retry...`);
        await this.page.waitForTimeout(retryDelay);
      } else {
        return (result.value || '').toString().trim();
      }
    }

    return '';
  }

  /**
   * Verifies CSS property value for a canvas widget
   * @param snapshotName - Name identifying the widget
   * @param cssProperty - CSS property name
   * @param expectedValue - Expected CSS value
   * @param flattenedPath - Optional property path
   */
  async verifyCanvasWidgetCssProperty(
    snapshotName: string,
    cssProperty: string,
    expectedValue: string,
    flattenedPath?: string
  ): Promise<void> {
    await this.verifyCanvasWidgetVisible(snapshotName, flattenedPath);
    const actualValue = await this.getCanvasWidgetCssProperty(snapshotName, cssProperty, flattenedPath);
    const { TokenMappingService } = require('../../src/tokens/mappingService');
    const normalizedExpected = TokenMappingService.normalizeValue(expectedValue, cssProperty);
    const normalizedActual = TokenMappingService.normalizeValue(actualValue, cssProperty);

    const cssReport = `Canvas CSS Verification\nSnapshot: ${snapshotName}\nProperty: ${cssProperty}\nExpected: ${normalizedExpected} (raw: ${expectedValue})\nActual: ${normalizedActual} (raw: ${actualValue})`;
    try {
      const t = (globalThis as any).test;
      if (t?.info) {
        await t.info().attach(`canvas-css-${snapshotName}-${cssProperty}.txt`, {
          body: cssReport,
          contentType: 'text/plain'
        });
        console.log('📎 Attached canvas CSS verification to report');
      }
    } catch { }

    console.log(`Canvas ${cssProperty}: expected=${normalizedExpected} (raw: ${expectedValue}), actual=${normalizedActual} (raw: ${actualValue})`);
    expect(normalizedActual).toBe(normalizedExpected);
  }

  /**
   * Verifies CSS property value for a preview widget
   * @param snapshotName - Name identifying the widget
   * @param cssProperty - CSS property name
   * @param expectedValue - Expected CSS value
   * @param flattenedPath - Optional property path
   */
  async verifyPreviewWidgetCssProperty(
    snapshotName: string,
    cssProperty: string,
    expectedValue: string,
    flattenedPath?: string
  ): Promise<void> {
    await this.verifyPreviewWidgetVisible(snapshotName, flattenedPath);
    const actualValue = await this.getPreviewWidgetCssProperty(snapshotName, cssProperty, flattenedPath);
    const { TokenMappingService } = require('../../src/tokens/mappingService');
    const normalizedExpected = TokenMappingService.normalizeValue(expectedValue, cssProperty);
    const normalizedActual = TokenMappingService.normalizeValue(actualValue, cssProperty);

    const cssReportPrev = `Preview CSS Verification\nSnapshot: ${snapshotName}\nProperty: ${cssProperty}\nExpected: ${normalizedExpected} (raw: ${expectedValue})\nActual: ${normalizedActual} (raw: ${actualValue})`;
    try {
      const t = (globalThis as any).test;
      if (t?.info) {
        await t.info().attach(`preview-css-${snapshotName}-${cssProperty}.txt`, {
          body: cssReportPrev,
          contentType: 'text/plain'
        });
        console.log('📎 Attached preview CSS verification to report');
      }
    } catch { }

    console.log(`Preview ${cssProperty}: expected=${normalizedExpected} (raw: ${expectedValue}), actual=${normalizedActual} (raw: ${actualValue})`);
    expect(normalizedActual).toBe(normalizedExpected);
  }

  /**
   * Extracts expected CSS value by resolving the token reference.
   */
  extractExpectedValue(tokenReference: string, tokenData: any): string {
    const { TokenMappingService } = require('../../src/tokens/mappingService');
    return TokenMappingService.extractExpectedValue(tokenReference, tokenData);
  }


}
