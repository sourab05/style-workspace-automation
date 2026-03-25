import { AppiumHelpers } from '../helpers/appium.helpers';
import fs from 'fs';
import path from 'path';
import { MOBILE_WIDGET_SELECTORS, getMobileSelectorForVariant } from './mobileWidgetConfig';
import { getStudioWidgetNameForVariant } from '../utils/mobileWidgetVariantCsv';
import { MobileSelectors } from './selectors/MobileSelectors';
import { enterText, waitFor } from '../utils/Utils';
import type { Widget } from '../../src/matrix/widgets';
import { TokenMappingService } from '../../src/tokens/mappingService';
import { TokenTestResultTracker, isLiteralTokenString, type TokenExecutionResult } from '../utils/tokenTestResultTracker';
import { MobileMapper } from '../utils/mobileMapper';

// Align Browser type with global WebdriverIO.Browser used in specs/helpers
// Fix TS error: BrowserAsync doesn't exist; use the main WebdriverIO Browser type which *does* include $()
type Browser = WebdriverIO.Browser;

export interface StyleVerificationResult {
  passed: boolean;
  expectedValue: string;
  actualValue: string;
  normalizedExpected: string;
  normalizedActual: string;
  commandSuffix: string;
  fullCommand: string;
  error?: string;
  skipped?: boolean;
}

// Selectors for the RN style command input and output label.
const STYLE_COMMAND_INPUT_SELECTOR = MobileSelectors.inspector.styleCommandInput;
const STYLE_OUTPUT_LABEL_SELECTOR = MobileSelectors.inspector.styleOutputLabel;

// Helper: returns correct style output label for widget type
function getStyleOutputSelector(widget: string) {
  if (widget === 'panel') return MobileSelectors.inspector.panelStyleOutputLabel;
  if (widget === 'label') return MobileSelectors.inspector.labelStyleOutputLabel;
  if (widget === 'formcontrols') return MobileSelectors.inspector.formcontrolsStyleOutputLabel;
  return MobileSelectors.inspector.styleOutputLabel;
}

// Helper: returns correct style input selector for widget type
function getStyleInputSelector(widget: string) {
  if (widget === 'bottomsheet') return MobileSelectors.inspector.bottomsheetStyleCommandInput;
  if (widget === 'modal-dialog') return MobileSelectors.inspector.modalStyleCommandInput;
  return MobileSelectors.inspector.styleCommandInput;
}

// Helper: derive widget type from a studioWidgetName (label6, panel1, etc.) or from an RN command
function getWidgetTypeFromStudioNameOrCommand(input: string): 'label' | 'panel' | 'bottomsheet' | 'modal-dialog' | 'formcontrols' | 'other' {
  const s = (input || '').toLowerCase();
  // RN command example: App.appConfig.currentPage.Widgets.panel1._INSTANCE.styles...
  // or studioWidgetName: panel1
  if (s.includes('widgets.label') || s.startsWith('label')) return 'label';
  if (s.includes('widgets.panel') || s.startsWith('panel')) return 'panel';
  if (s.includes('widgets.bottomsheet') || s.startsWith('bottomsheet')) return 'bottomsheet';
  if (s.includes('widgets.dialog') || s.startsWith('dialog') || s.includes('widgets.modal') || s.startsWith('modal')) return 'modal-dialog';
  if (s.includes('widgets.formcontrols') || s.startsWith('formcontrols') || s.endsWith('_formlabel')) return 'formcontrols';
  return 'other';
}

// Navigation selectors
const HOME_HEADER_SELECTOR = MobileSelectors.common.homeHeader;
const HAMBURGER_MENU_SELECTOR = MobileSelectors.common.hamburgerMenu;
const BUTTON_NAV_ITEM_SELECTOR = MobileSelectors.navItems.button;
const BUTTON_PAGE_HEADER_SELECTOR = MobileSelectors.headers.button;
const ACCORDION_NAV_ITEM_SELECTOR = MobileSelectors.navItems.accordion;
const ACCORDION_PAGE_HEADER_SELECTOR = MobileSelectors.headers.accordion;
const PANEL_NAV_ITEM_SELECTOR = MobileSelectors.navItems.panel;
const PANEL_PAGE_HEADER_SELECTOR = MobileSelectors.headers.panel;
const CARDS_NAV_ITEM_SELECTOR = MobileSelectors.navItems.cards;
const CARDS_PAGE_HEADER_SELECTOR = MobileSelectors.headers.cards;
const LABEL_NAV_ITEM_SELECTOR = MobileSelectors.navItems.label;
const LABEL_PAGE_HEADER_SELECTOR = MobileSelectors.headers.label;
const FORMCONTROLS_NAV_ITEM_SELECTOR = MobileSelectors.navItems.formcontrols;
const FORMCONTROLS_PAGE_HEADER_SELECTOR = MobileSelectors.headers.formcontrols;
const PICTURE_NAV_ITEM_SELECTOR = MobileSelectors.navItems.picture;
const PICTURE_PAGE_HEADER_SELECTOR = MobileSelectors.headers.picture;
const CAROUSEL_NAV_ITEM_SELECTOR = MobileSelectors.navItems.carousel;
const CAROUSEL_PAGE_HEADER_SELECTOR = MobileSelectors.headers.carousel;
const BOTTOMSHEET_NAV_ITEM_SELECTOR = MobileSelectors.navItems.bottomsheet;
const BOTTOMSHEET_PAGE_HEADER_SELECTOR = MobileSelectors.headers.bottomsheet;
const BARCODESCANNER_NAV_ITEM_SELECTOR = MobileSelectors.navItems.barcodescanner;
const BARCODESCANNER_PAGE_HEADER_SELECTOR = MobileSelectors.headers.barcodescanner;
const TABS_NAV_ITEM_SELECTOR = MobileSelectors.navItems.tabs;
const TABS_PAGE_HEADER_SELECTOR = MobileSelectors.headers.tabs;
const LIST_NAV_ITEM_SELECTOR = MobileSelectors.navItems.list;
const LIST_PAGE_HEADER_SELECTOR = MobileSelectors.headers.list;
const CHIPS_NAV_ITEM_SELECTOR = MobileSelectors.navItems.chips;
const CHIPS_PAGE_HEADER_SELECTOR = MobileSelectors.headers.chips;
const RADIOSET_NAV_ITEM_SELECTOR = MobileSelectors.navItems.radioset;
const RADIOSET_PAGE_HEADER_SELECTOR = MobileSelectors.headers.radioset;
const CHECKBOX_NAV_ITEM_SELECTOR = MobileSelectors.navItems.checkbox;
const CHECKBOX_PAGE_HEADER_SELECTOR = MobileSelectors.headers.checkbox;
const CHECKBOXSET_NAV_ITEM_SELECTOR = MobileSelectors.navItems.checkboxset;
const CHECKBOXSET_PAGE_HEADER_SELECTOR = MobileSelectors.headers.checkboxset;
const TOGGLE_NAV_ITEM_SELECTOR = MobileSelectors.navItems.toggle;
const TOGGLE_PAGE_HEADER_SELECTOR = MobileSelectors.headers.toggle;
const SWITCH_NAV_ITEM_SELECTOR = MobileSelectors.navItems.switch;
const SWITCH_PAGE_HEADER_SELECTOR = MobileSelectors.headers.switch;



/**
 * Mobile Widget Page Object
 * Handles widget-specific operations on mobile platforms (Android/iOS)
 */
export class MobileWidgetPage {
  private appiumHelpers: AppiumHelpers;

  // Static tracker for accumulating test results across all widget tests
  static resultTracker: TokenTestResultTracker = new TokenTestResultTracker();

  // Tracks widget instances whose full styles object has already been dumped this run
  private static dumpedStyleInstances: Set<string> = new Set();

  constructor() {
    this.appiumHelpers = new AppiumHelpers();
  }

  /**
   * Gets platform-specific selector for a widget or widget variant.
   *
   * - If `widgetName` looks like a variant key (e.g. 'button-filled-primary-default'),
   *   we first try the per-variant selector matrix in `mobileWidgetSelectors`.
   * - Otherwise we treat it as the canonical widget key (e.g. 'button') and
   *   fall back to `MOBILE_WIDGET_SELECTORS`.
   */
  private getWidgetSelector(browser: Browser, widgetName: string): string {
    const platform = this.getPlatform(browser);

    // 1) Prefer per-variant selector when widgetName matches the snapshotName
    // format used in the matrix (contains '-').
    if (widgetName.includes('-')) {
      const variantSelector = getMobileSelectorForVariant(widgetName, platform);
      if (variantSelector) {
        return variantSelector;
      }
    }

    // 2) Fall back to widget-level selector map
    const widgetKey = widgetName as Widget;
    const cfg = MOBILE_WIDGET_SELECTORS[widgetKey];

    if (!cfg) {
      console.warn(
        `⚠️ No mobile selector config defined for widget/variant "${widgetName}"; ` +
        'falling back to data-widget-name attribute selector.',
      );
      return `[data-widget-name="${widgetName}"]`;
    }

    return platform === 'ios' ? cfg.ios : cfg.android;
  }

  /**
   * Navigates to widget screen.
   *
   * Placeholder implementation for button widget using generic selectors:
   *  1) verify home header visible
   *  2) tap hamburger menu
   *  3) tap button nav item
   *  4) verify button widget page header visible
   */
  async navigateToWidget(browser: Browser, widgetName: string): Promise<void> {
    console.log(`\n🧭 Navigating to widget: ${widgetName}`);

    // Wait for app to be ready
    await this.appiumHelpers.waitForAppReady(browser);

    const navSelector = (MobileSelectors.navItems as Record<string, string>)[widgetName];
    const headerSelector = (MobileSelectors.headers as Record<string, string>)[widgetName];

    if (navSelector) {
      // Step 1: verify home header is visible
      try {
        const homeHeader = await (browser as any).$(HOME_HEADER_SELECTOR);
        await homeHeader.waitForDisplayed({ timeout: 30000 });
        console.log('   ✅ Home header is visible');
      } catch {
        console.warn('   ⚠️ Home header selector not found (placeholder selector in use)');
      }

      // Step 2: tap widget link on home page
      try {
        const widgetLink = await (browser as any).$(navSelector);
        await widgetLink.waitForDisplayed({ timeout: 30000 });
        await widgetLink.click();
        console.log(`   ✅ Tapped ${widgetName} link`);
      } catch {
        console.error(`${widgetName} link selector not found (placeholder selector in use)`);
      }

      // Step 3: verify header is visible on widget page (if configured)
      if (headerSelector) {
        try {
          const pageHeader = await (browser as any).$(headerSelector);
          await pageHeader.waitForDisplayed({ timeout: 30000 });
          console.log(`   ✅ ${widgetName} widget page header is visible`);
        } catch {
          console.warn(`   ⚠️ ${widgetName} page header selector not found (placeholder selector in use)`);
        }
      }

      console.log(`✓ Navigated to widget: ${widgetName}`);
      return;
    }

    console.warn(`   ⚠️ No home link selector configured for widget: ${widgetName}`);
    console.log(`✓ Navigated to widget: ${widgetName}`);
  }


  /**
   * Waits for widget to be visible
   * @param browser WebDriver browser 
   * 
   * @param widgetName Widget identifier
   */
  async waitForWidget(browser: Browser, widgetName: string): Promise<void> {
    const selector = this.getWidgetSelector(browser, widgetName);
    await this.appiumHelpers.waitForElement(browser, selector);
  }

  /**
   * Gets CSS property value for a widget
   * @param browser WebDriver browser instance
   * @param widgetName Widget identifier
   * @param cssProperty CSS property name
   * @returns CSS property value
   */
  async getWidgetCssProperty(
    browser: Browser,
    widgetName: string,
    cssProperty: string
  ): Promise<string> {
    const selector = this.getWidgetSelector(browser, widgetName);
    await this.appiumHelpers.waitForElement(browser, selector);

    const value = await this.appiumHelpers.getCssProperty(browser, selector, cssProperty);

    console.log(`   📊 ${widgetName}.${cssProperty} = "${value}"`);

    return value;
  }

  /**
   * Verifies CSS property matches expected value
   * @param browser WebDriver browser instance
   * @param widgetName Widget identifier
   * @param cssProperty CSS property name
   * @param expectedValue Expected value
   */
  async verifyCssProperty(
    browser: Browser,
    widgetName: string,
    cssProperty: string,
    expectedValue: string
  ): Promise<void> {
    const actualValue = await this.getWidgetCssProperty(browser, widgetName, cssProperty);
    const { TokenMappingService } = require('../../src/tokens/mappingService');
    const normalizedExpected = TokenMappingService.normalizeValue(expectedValue, cssProperty);
    const normalizedActual = TokenMappingService.normalizeValue(actualValue, cssProperty);

    if (normalizedActual !== normalizedExpected) {
      throw new Error(
        `CSS property mismatch for ${widgetName}.${cssProperty}\n` +
        `Expected: "${normalizedExpected}" (raw: "${expectedValue}")\n` +
        `Actual: "${normalizedActual}" (raw: "${actualValue}")`
      );
    }

    console.log(`   ✅ ${widgetName}.${cssProperty} matches expected value`);
  }


  /**
   * Takes screenshot of widget
   * @param browser WebDriver browser instance
   * @param widgetName Widget identifier
   * @returns Screenshot buffer
   */
  async takeWidgetScreenshot(browser: Browser, widgetName: string): Promise<Buffer> {
    const selector = this.getWidgetSelector(browser, widgetName);
    return await this.appiumHelpers.takeElementScreenshot(browser, selector);
  }

  /**
   * Checks if widget is visible
   * @param browser WebDriver browser instance
   * @param widgetName Widget identifier
   * @returns True if visible
   */
  async isWidgetVisible(browser: Browser, widgetName: string): Promise<boolean> {
    const selector = this.getWidgetSelector(browser, widgetName);
    return await this.appiumHelpers.isElementVisible(browser, selector);
  }

  /**
   * Taps on widget
   * @param browser WebDriver browser instance
   * @param widgetName Widget identifier
   */
  async tapWidget(browser: Browser, widgetName: string): Promise<void> {
    const selector = this.getWidgetSelector(browser, widgetName);
    await this.appiumHelpers.tapElement(browser, selector);
    console.log(`✓ Tapped widget: ${widgetName}`);
  }

  /**
   * Scrolls to widget
   * @param browser WebDriver browser instance
   * @param widgetName Widget identifier
   */
  async scrollToWidget(browser: Browser, widgetName: string): Promise<void> {
    const selector = this.getWidgetSelector(browser, widgetName);
    await this.appiumHelpers.scrollToElement(browser, selector);
    console.log(`✓ Scrolled to widget: ${widgetName}`);
  }

  /**
   * Extracts expected value from token reference
   */
  extractExpectedValue(tokenRef: string, tokenData: any): string {
    const { TokenMappingService } = require('../../src/tokens/mappingService');
    return TokenMappingService.extractExpectedValue(tokenRef, tokenData);
  }

  /**
   * Enters the RN style command for a given studio widget name into the app's input field.
   * Command format: App.appConfig.currentPage.Widgets.${studioWidgetName}._INSTANCE.styles
   */
  // async enterStyleCommand(browser: Browser, studioWidgetName: string): Promise<void> {
  //   const command = `App.appConfig.currentPage.Widgets.${studioWidgetName}._INSTANCE.styles`;

  //   console.log(`   🧾 Entering style command into RN console input: ${command}`);

  //   // IMPORTANT: do NOT use the global Utils.enterText here because that
  //   // relies on a global `driver` session, which is different from the
  //   // per-spec Appium `browser` session created via remote(). Instead, work
  //   // directly with this "browser" instance so we always talk to the correct
  //   // device session.
  //   const input = await (browser as any).$(STYLE_COMMAND_INPUT_SELECTOR);
  //   const exists = await input.isExisting();
  //   console.log(`   [DEBUG] Style input found: ${exists}`);
  //   await input.waitForDisplayed({ timeout: 30000 }).catch(() => {
  //     console.error(`   [DEBUG] Style input NOT displayed: selector='${STYLE_COMMAND_INPUT_SELECTOR}'`);
  //     throw new Error(`Style input not found: ${STYLE_COMMAND_INPUT_SELECTOR}`);
  //   });

  //   try {
  //     // Clear any previous command text (if supported)
  //     await input.clearValue();
  //     console.log('   ✅ Style command input cleared');
  //   } catch (err) {
  //     console.warn(
  //       '   ⚠️  Failed to clear style command input, continuing:',
  //       (err as Error).message,
  //     );
  //   }

  //   await input.click();
  //   await input.setValue(command);

  //   // Log what is currently in the input after typing the command so we can
  //   // verify that the RN console field actually received the text.
  //   try {
  //     const typed = await input.getText();
  //     console.log(`   📝 Style command input now contains: ${typed}`);


  //   } catch (err) {
  //     console.warn(
  //       '   ⚠️  Failed to read back style command input text (getText)',
  //       (err as Error).message,
  //     );
  //   }

  //   // Best-effort submit: some RN shells evaluate on change, others on Enter.
  //   await (browser as any).keys('Enter');

  //   await waitFor(2000); // brief pause before submitting

  //   await input.setValue('');
  //   await input.click();
  //   await waitFor(2000);
  //   await (browser as any).keys('Enter');


  //   // Then, send the Enter key


  // }
  /**
   * Reads and parses the styles JSON for a given studio widget.
   * Ignores any __trace information and returns only the resolved top-level style object.
   */
  // async readStylesObject(browser: Browser, studioWidgetName: string): Promise<any> {
  //   await this.enterStyleCommand(browser, studioWidgetName);

  //   const output = await (browser as any).$(ButtonWidgetSelectors.styleOutputLabel);
  //   const existsOut = await output.isExisting();
  //   console.log(`   [DEBUG] Style output label found: ${existsOut}`);
  //   await output.waitForDisplayed({ timeout: 30000 }).catch(() => {
  //     console.error(`   [DEBUG] Style output label NOT displayed: selector='${STYLE_OUTPUT_LABEL_SELECTOR}'`);
  //     throw new Error(`Style output label not found: ${STYLE_OUTPUT_LABEL_SELECTOR}`);
  //   });

  //   // Wait additional time for RN to evaluate and update label
  //   await waitFor(1500);

  //   const rawText = await output.getText().catch((err) => {
  //     console.error(`   [DEBUG] Failed to get text from output label: ${err.message}`);
  //     return '';
  //   });
  //   console.log(`   [DEBUG] Raw output text length: ${rawText ? rawText.length : 0}`);
  //   console.log(`   📄 Raw styles JSON for ${studioWidgetName}: ${rawText.substring(0, 200)}...`);

  //   let parsed: any;
  //   try {
  //     parsed = JSON.parse(rawText);
  //   } catch (err) {
  //     console.error(`Failed to parse styles JSON for ${studioWidgetName}:`, err);
  //     throw err;
  //   }

  //   // Drop trace metadata for comparisons; keep only resolved values
  //   if (Array.isArray(parsed.__trace)) {
  //     delete parsed.__trace;
  //   }

  //   return parsed;
  // }
  /**
     * Enters the RN style command, waits for the result label, fetches the JSON,
     * and then clears the input field.
     * * @returns The raw JSON string fetched from the label
     */
  async enterStyleCommand(browser: Browser, studioWidgetName: string): Promise<string> {
    const widgetType = getWidgetTypeFromStudioNameOrCommand(studioWidgetName);
    let command: string;
    if (widgetType === 'formcontrols') {
      command = `App.appConfig.currentPage.Widgets.supportedLocaleForm1.formWidgets.entestkey.calcStyles`;
    } else {
      command = `App.appConfig.currentPage.Widgets.${studioWidgetName}._INSTANCE.styles`;
    }
    console.log(`   🧾 Entering style command: ${command}`);

    const input = await (browser as any).$(STYLE_COMMAND_INPUT_SELECTOR);
    // Select correct output label for this widget type
    const widgetType = getWidgetTypeFromStudioNameOrCommand(studioWidgetName);
    const outputSelector = getStyleOutputSelector(widgetType);
    console.log(`   🧭 [OutputLabel] widgetType='${widgetType}', studioWidgetName='${studioWidgetName}', selector='${outputSelector}'`);
    const output = await (browser as any).$(outputSelector);

    // 1. Enter the command
    await input.waitForDisplayed({ timeout: 30000 });
    await input.clearValue();
    await input.click();
    await input.setValue(command);
    await (browser as any).keys('Enter');

    // 2. Wait for the label to be populated with data
    // A brief pause allows the RN bridge to update the UI label
    await waitFor(2000);
    await output.waitForDisplayed({ timeout: 15000 });

    // 3. FETCH JSON (Before clearing the input)
    const rawJson = await output.getText().catch(() => '');
    console.log(`   📥 Data fetched from label (Length: ${rawJson.length})`);

    // 4. CLEAR INPUT (Cleanup)
    try {
      await input.click();
      await input.clearValue();
      await (browser as any).keys('Enter');
      console.log('   🧹 Input field cleared.');
    } catch (err) {
      console.warn('   ⚠️ Cleanup failed, but data was already captured.');
    }

    return rawJson;
  }

  /**
   * Reads and parses the styles JSON for a given studio widget.
   */
  async readStylesObject(browser: Browser, studioWidgetName: string): Promise<any> {
    // Call the updated command logic
    const rawText = await this.enterStyleCommand(browser, studioWidgetName);

    if (!rawText || rawText.trim() === '') {
      throw new Error(`Style output label was empty for: ${studioWidgetName}`);
    }

    try {
      const parsed = JSON.parse(rawText);
      // Clean up trace metadata if present
      if (parsed && parsed.__trace) {
        delete parsed.__trace;
      }
      return parsed;
    } catch (err) {
      console.error(`🔴 JSON Parse Error for ${studioWidgetName}`);
      throw new Error(`Invalid JSON received: ${rawText.substring(0, 100)}...`);
    }
  }
  /**
   * Reads styles JSON for a studio widget and saves it to
   * artifacts/mobile-styles/{widget}/{studioWidgetName}.styles.json
   */
  async saveStylesJson(
    browser: Browser,
    widget: Widget,
    studioWidgetName: string
  ): Promise<string> {
    const styles = await this.readStylesObject(browser, studioWidgetName);

    const dir = path.join(process.cwd(), 'artifacts', 'mobile-styles', widget);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const filePath = path.join(dir, `${studioWidgetName}.styles.json`);
    fs.writeFileSync(filePath, JSON.stringify(styles, null, 2), 'utf-8');

    console.log(`   💾 Saved styles JSON for ${studioWidgetName} to ${filePath}`);
    return filePath;
  }

  /**
   * Recursively checks whether the given object contains the expected value
   * in any string/primitive leaf, employing normalization for robustness.
   */
  private objectContainsValue(obj: any, expected: string, propHint: string = 'unknown'): boolean {
    const { TokenMappingService } = require('../../src/tokens/mappingService');
    // Pre-normalize expected value once
    const normExpected = TokenMappingService.normalizeValue(expected, propHint);

    if (obj == null) return false;

    if (typeof obj === 'string') {
      const normObj = TokenMappingService.normalizeValue(obj, propHint);
      return normObj === normExpected;
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return String(obj) === expected; // Unit normalization not applied to raw numbers usually, but can check
    }

    if (Array.isArray(obj)) {
      return obj.some((item) => this.objectContainsValue(item, expected, propHint));
    }

    if (typeof obj === 'object') {
      // Pass the key as hint if we can? 
      // Actually, traversing deep might lose context. 
      // But for verifying "is this token value present", we usually check if the value exists *anywhere*.
      // We'll stick to the global propHint derived from the token itself.
      return Object.values(obj).some((v) => this.objectContainsValue(v, expected, propHint));
    }

    return false;
  }

  /**
   * Helper to execute arbitrary RN command via the input/output UI
   */
  async executeRnCommand(browser: Browser, command: string): Promise<string> {
    const widgetType = getWidgetTypeFromStudioNameOrCommand(command);
    const inputSelector = getStyleInputSelector(widgetType);
    const outputSelector = getStyleOutputSelector(widgetType);

    const input = await (browser as any).$(inputSelector);
    console.log(`   🧭 [Input/Output] widgetType='${widgetType}', command='${command}', inputSelector='${inputSelector}', outputSelector='${outputSelector}'`);
    const output = await (browser as any).$(outputSelector);

    await input.waitForDisplayed({ timeout: 30000 });

    // Clear and set value with better focus logic
    await input.click();
    await input.setValue('');
    await input.setValue(command);

    // Submit via Enter
    await (browser as any).keys('Enter');

    // Wait for output to be non-empty or change
    await waitFor(1500);
    await output.waitForDisplayed({ timeout: 15000 });

    const result = await output.getText().catch(() => '');

    // Cleanup: Clear input so it doesn't affect next command if UI persists
    try {
      await input.click();
      await input.setValue('');
      await (browser as any).keys('Enter');
    } catch { }

    return result;
  }



  /**
   * Restarts the app and navigates back to the specified widget page.
   */
  async restartAppAndNavigate(browser: Browser, widget: string): Promise<void> {
    console.log(`   🔄 Restarting app and navigating back to ${widget}...`);
    try {
      const pkg = await this.appiumHelpers.getCurrentPackage(browser);
      if (pkg) {
        // Use modern terminate/activate if possible, fallback to close/launch
        try {
          await (browser as any).terminateApp(pkg);
          await waitFor(2000);
          await (browser as any).activateApp(pkg);
        } catch {
          await this.appiumHelpers.closeApp(browser);
          await waitFor(2000);
          await this.appiumHelpers.launchApp(browser);
        }

        await this.appiumHelpers.waitForAppReady(browser);
        await this.navigateToWidget(browser, widget);
        console.log(`   ✅ App restarted and navigated back to ${widget}`);
      } else {
        console.error('   ❌ Could not determine package/bundle ID for restart');
      }
    } catch (err: any) {
      console.error(`   ⚠️ Failed during app restart/navigation: ${err.message}`);
    }
  }

  /**
  * Uses the RN style command input to fetch the SPECIFIC style value for the
  * given token property and asserts that it matches the expected token value.
  * Records results in the static tracker for comparison table generation.
  */
  async verifyStylesIncludeTokenValue(
    browser: Browser,
    widget: Widget,
    variantName: string,
    tokenRef: string,
    tokenData: any,
    propertyPath?: string[],
    platform?: 'android' | 'ios'
  ): Promise<StyleVerificationResult> {
    const studioWidgetName = getStudioWidgetNameForVariant(widget, variantName);

    const emptyResult = (skippedReason: string): StyleVerificationResult => ({
      passed: true,
      expectedValue: '',
      actualValue: '',
      normalizedExpected: '',
      normalizedActual: '',
      commandSuffix: '',
      fullCommand: '',
      skipped: true,
      error: skippedReason
    });

    if (!studioWidgetName) {
      const msg = `⚠️  No studio widget mapping found for widget='${widget}', variant='${variantName}'. Skipping styles check.`;
      console.warn(msg);
      return emptyResult(msg);
    }

    const expectedValue = this.extractExpectedValue(tokenRef, tokenData);
    if (!expectedValue) {
      const msg = `⚠️  Could not resolve expected value for tokenRef='${tokenRef}'. Skipping styles check.`;
      console.warn(msg);
      return emptyResult(msg);
    }

    // --- DEBUG LOGS: SESSION INFO ---
    const caps = (browser as any).capabilities as any;
    const appPath = caps.app || caps['appium:app'] || 'Unknown';
    console.log(`   📱 [Session Info] App Path: ${appPath}`);
    console.log(`   📱 [Session Info] OS/Version: ${caps.platformName} ${caps.platformVersion || ''}`);

    // --- DUMP FULL STYLES OBJECT (once per widget instance) ---
    const formFieldKey = variantName.endsWith('-disabled') ? 'custom' : 'entestkey';
    const dumpKey = `${widget}::${studioWidgetName}`;
    if (!MobileWidgetPage.dumpedStyleInstances.has(dumpKey)) {
      MobileWidgetPage.dumpedStyleInstances.add(dumpKey);
      try {
        let fullStylesCmd: string;
        if (widget === 'cards') {
          fullStylesCmd = `App.appConfig.currentPage.Widgets.supportedLocaleList1.itemWidgets[0].card1._INSTANCE.calcStyles`;
        } else if (widget === 'formcontrols') {
          fullStylesCmd = `App.appConfig.currentPage.Widgets.supportedLocaleForm1.formWidgets.${formFieldKey}.calcStyles`;
        } else {
          fullStylesCmd = `App.appConfig.currentPage.Widgets.${studioWidgetName}._INSTANCE.styles`;
        }
        console.log(`   💾 Dumping full styles object: ${fullStylesCmd}`);
        const fullStylesRaw = await this.executeRnCommand(browser, fullStylesCmd);
        const dir = path.join(process.cwd(), 'artifacts', 'mobile-styles', widget);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        const filePath = path.join(dir, `${studioWidgetName}.styles.json`);
        let parsed: any;
        try {
          parsed = JSON.parse(fullStylesRaw);
        } catch {
          parsed = fullStylesRaw;
        }
        fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2), 'utf-8');
        console.log(`   💾 Saved full styles object to ${filePath}`);
      } catch (err: any) {
        console.warn(`   ⚠️ Failed to dump full styles object for ${studioWidgetName}: ${err.message}`);
      }
    }

    // Construct the specific command suffix based on property path
    let commandSuffix = ((widget === 'cards') || (widget === 'formcontrols')) ? 'calcStyles' : 'styles';
    if (propertyPath && propertyPath.length > 0) {
      const platform = this.getPlatform(browser) as 'android' | 'ios';
      const variantState = variantName.split('-').pop() || 'default';
      const stateAwareWidgets = ['tabbar', 'tabs', 'button', 'checkbox', 'checkboxset', 'wizard', 'carousel', 'chips', 'formcontrols', 'radioset', 'toggle', 'switch'];
      const effectivePropertyPath = (variantState !== 'default' && stateAwareWidgets.includes(widget)) ? ['states', variantState, ...propertyPath] : propertyPath;
      const mappedPath = MobileMapper.mapToRnStylePath(effectivePropertyPath, widget, platform);
      console.log(`   🔍 Mapping property path [${propertyPath.join('.')}] -> RN path [${mappedPath}]`);
      commandSuffix = `${commandSuffix}.${mappedPath}`;
    } else {
      console.log(`   ℹ️  No property path provided, defaulting to fetching full '${commandSuffix}' object.`);
    }

    // Fetch just the value (or object if path points to a container)
    let command = '';
    if (widget === 'cards') {
      command = `App.appConfig.currentPage.Widgets.supportedLocaleList1.itemWidgets[0].card1._INSTANCE.${commandSuffix}`;
    } else if (widget === 'formcontrols') {
      command = `App.appConfig.currentPage.Widgets.supportedLocaleForm1.formWidgets.${formFieldKey}.${commandSuffix}`;
    } else {
      command = `App.appConfig.currentPage.Widgets.${studioWidgetName}._INSTANCE.${commandSuffix}`;
    }
    let fullCommand = command;
    console.log(`   🧾 Executing RN Command: ${command}`);

    // execute command via input/output with retry logic (up to 3 times)
    let rawResult = '{}';
    const maxRetries = 3;
    for (let i = 0; i < maxRetries; i++) {
      try {
        rawResult = await this.executeRnCommand(browser, command);
        if (!this.isEmptyObject(rawResult) && rawResult !== 'undefined' && rawResult !== '') {
          break;
        }
        if (i < maxRetries - 1) {
          console.log(`   🔄 Empty result for ${command}, retrying (${i + 1}/${maxRetries})...`);
          await waitFor(1000);
        }
      } catch (err: any) {
        console.error(`   ❌ Attempt ${i + 1} failed: ${err.message}`);
        if (i < maxRetries - 1) {
          console.log(`   🔄 Potential UI/Inspector freeze detected. Restarting app and navigating back to ${widget}...`);
          await this.restartAppAndNavigate(browser, widget);
        } else {
          throw err; // Re-throw if last attempt also failed
        }
      }
    }
    console.log(`   📥 Raw Result from App: "${rawResult}"`);

    // PER USER REQUEST: Direct comparison, no normalization
    let actualValue = rawResult;

    // Handle objects/shorthands by checking longhands if needed
    if (propertyPath && (this.isEmptyObject(rawResult) || rawResult === 'undefined' || rawResult === '')) {
      const lastPart = propertyPath[propertyPath.length - 1];
      const longhands = TokenMappingService.getLonghandProperties(lastPart);

      if (longhands.length > 0) {
        console.log(`   📦 Found longhands for shorthand [${lastPart}]: ${longhands.join(', ')}`);

        // Extract namespace from the mapped path (e.g. 'heading.paddingLeft' → 'heading')
         const lhVariantState = variantName.split('-').pop() || 'default';
         const lhStateAwareWidgets = ['tabbar', 'tabs', 'button', 'checkbox', 'checkboxset', 'wizard', 'carousel', 'chips', 'formcontrols', 'radioset', 'toggle', 'switch'];
         const lhEffectivePath = (lhVariantState !== 'default' && lhStateAwareWidgets.includes(widget)) ? ['states', lhVariantState, ...propertyPath] : propertyPath;
         const mappedPath = MobileMapper.mapToRnStylePath(lhEffectivePath, widget, platform);

        // Build the base command path for longhands
        let baseLhCommand = '';
        if (widget === 'cards') {
          const prefix = mappedPath.includes('.') ? mappedPath.substring(0, mappedPath.lastIndexOf('.')) : '';
          baseLhCommand = `App.appConfig.currentPage.Widgets.supportedLocaleList1.itemWidgets[0].card1._INSTANCE.calcStyles${prefix ? `.${prefix}` : ''}`;
        } else if (widget === 'formcontrols') {
          const prefix = mappedPath.includes('.') ? mappedPath.substring(0, mappedPath.lastIndexOf('.')) : '';
          baseLhCommand = `App.appConfig.currentPage.Widgets.supportedLocaleForm1.formWidgets.${formFieldKey}.calcStyles${prefix ? `.${prefix}` : ''}`;
        } else {
          const namespace = mappedPath.includes('.') ? mappedPath.split('.')[0] : 'root';
          baseLhCommand = `App.appConfig.currentPage.Widgets.${studioWidgetName}._INSTANCE.styles.${namespace}`;
        }

        // Check if ANY of the longhands have a value. Usually all will match for a token application.
        for (const lh of longhands) {
          const lhCommand = `${baseLhCommand}.${lh}`;
          const lhResult = await this.executeRnCommand(browser, lhCommand);
          if (!this.isEmptyObject(lhResult) && lhResult !== 'undefined' && lhResult !== '') {
            actualValue = lhResult;
            fullCommand = lhCommand;
            console.log(`   ✅ Resolved via longhand [${lh}] → "${lhResult}"`);
            break;
          }
        }
      }
    }

    console.log(`   🎯 Expected Value: "${expectedValue}"`);
    console.log(`   🧐 Actual Value: "${actualValue}"`);

    const normalizeValue = (val: string) => {
      let v = String(val).replace('px', '').trim();
      const rgbMatch = v.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (rgbMatch) {
        const r = parseInt(rgbMatch[1], 10).toString(16).padStart(2, '0');
        const g = parseInt(rgbMatch[2], 10).toString(16).padStart(2, '0');
        const b = parseInt(rgbMatch[3], 10).toString(16).padStart(2, '0');
        v = `#${r}${g}${b}`;
      }
      return v;
    };

    const normalizedActual = normalizeValue(actualValue);
    const normalizedExpected = normalizeValue(expectedValue);

    const result: StyleVerificationResult = {
      passed: false,
      expectedValue,
      actualValue: String(actualValue),
      normalizedExpected,
      normalizedActual,
      commandSuffix,
      fullCommand,
      skipped: false
    };

    //Check if it matches or is contained (for complex objects)
    if (normalizedActual === normalizedExpected) {
      console.log(`   ✅ Style property match: "${actualValue}" vs "${expectedValue}" (normalized: "${normalizedActual}")`);
      result.passed = true;

      // Record successful result
      if (platform && propertyPath) {
        MobileWidgetPage.resultTracker.recordResult(widget, platform, {
          tokenRef,
          propertyPath,
          executed: true,
          isLiteralToken: isLiteralTokenString(actualValue),
          actualValue: String(actualValue),
          expectedValue,
          passed: true,
          command: fullCommand
        });
      }
      return result;
    }

    // Try parsing as JSON to check object containment
    try {
      const parsed = JSON.parse(rawResult);
      if (typeof parsed === 'object' && parsed !== null) {
        console.log(`   📦 Result is an object, searching for value...`);
        // Use a simple containment check
        const jsonStr = JSON.stringify(parsed);
        if (jsonStr.includes(expectedValue)) {
          console.log(`   ✅ Style property ${commandSuffix} contains expected value "${expectedValue}"`);
          result.passed = true;

          // Record successful result for object containment
          if (platform && propertyPath) {
            MobileWidgetPage.resultTracker.recordResult(widget, platform, {
              tokenRef,
              propertyPath,
              executed: true,
              isLiteralToken: isLiteralTokenString(actualValue),
              actualValue: String(actualValue),
              expectedValue,
              passed: true,
              command: fullCommand
            });
          }

          return result;
        }
      }
    } catch (e) {
      // Not JSON
    }

    console.error(`   ❌ Mismatch!`);
    result.error = `Style mismatch for ${studioWidgetName} property ${commandSuffix}.\nExpected: "${expectedValue}", Actual: "${rawResult}"`;

    // Record failed result
    if (platform && propertyPath) {
      MobileWidgetPage.resultTracker.recordResult(widget, platform, {
        tokenRef,
        propertyPath,
        executed: true,
        isLiteralToken: isLiteralTokenString(actualValue),
        actualValue: String(actualValue),
        expectedValue,
        passed: false,
        error: result.error,
        command: fullCommand
      });
    }

    return result;
  }

  /**
   * Checks if a string or object represents an empty result
   */
  private isEmptyObject(result: any): boolean {
    if (!result) return true;
    if (typeof result === 'string') {
      const trimmed = result.trim();
      return trimmed === '{}' || trimmed === '[]' || trimmed === 'null' || trimmed === 'undefined';
    }
    if (typeof result === 'object') {
      return Object.keys(result).length === 0;
    }
    return false;
  }

  /**
   * Gets platform name
   * @param browser WebDriver browser instance
   * @returns Platform name (android/ios)
   */
  getPlatform(browser: Browser): 'android' | 'ios' {
    const capabilities: any = (browser as any).capabilities;
    const platform = capabilities.platformName?.toLowerCase();
    return platform === 'ios' ? 'ios' : 'android';
  }
}
