import { AppiumHelpers } from '../helpers/appium.helpers';
import fs from 'fs';
import path from 'path';
import {
  MOBILE_WIDGET_SELECTORS,
  getMobileSelectorForVariant,
  getWidgetPageReadySelector,
  isHomePageWidget,
} from './mobileWidgetConfig';
import { getStudioWidgetNameForVariant } from '../utils/mobileWidgetVariantCsv';
import { MobileSelectors } from './selectors/MobileSelectors';
import { enterText, waitFor } from '../utils/Utils';
import type { Widget } from '../../src/matrix/widgets';
import { TokenMappingService } from '../../src/tokens/mappingService';
import { TokenTestResultTracker, isLiteralTokenString, type TokenExecutionResult } from '../utils/tokenTestResultTracker';
import { MobileMapper } from '../utils/mobileMapper';
import { studioWidgetsPropertyAccess } from '../utils/studioWidgetAccess';
import { formatResolvedValue, resolveStyleValue } from '../utils/styleObjectResolver';
import { isBrowserStackEnv, shouldRelaxWidgetWait } from '../utils/envFlags';
import { MobileSessionDeadError, MobileSessionGuard } from '../utils/mobileSessionGuard';

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

type StylesCacheEntry = {
  styles: unknown;
  fullCommand: string;
  /** Tabs only: body styles from _INSTANCE.styles (background, border, min). */
  tabsRootStyles?: unknown;
  tabsRootCommand?: string;
};

// Selectors for the RN style command input and output label.
const STYLE_COMMAND_INPUT_SELECTOR = MobileSelectors.inspector.styleCommandInput;
const STYLE_OUTPUT_LABEL_SELECTOR = MobileSelectors.inspector.styleOutputLabel;

// Helper: returns correct style output label for widget type
function getStyleOutputSelector(widget: string, platform?: 'android' | 'ios') {
  if (widget === 'panel') {
    return platform === 'ios'
      ? MobileSelectors.inspector.panelStyleOutputLabelIos
      : MobileSelectors.inspector.panelStyleOutputLabel;
  }
  if (widget === 'bottomsheet') {
    return platform === 'ios'
      ? MobileSelectors.inspector.bottomsheetStyleOutputLabelIos
      : MobileSelectors.inspector.bottomsheetStyleOutputLabel;
  }
  if (widget === 'label') return MobileSelectors.inspector.labelStyleOutputLabel;
  if (widget === 'formcontrols') {
    return platform === 'ios'
      ? MobileSelectors.inspector.formcontrolsStyleOutputLabelIos
      : MobileSelectors.inspector.formcontrolsStyleOutputLabel;
  }
  if (widget === 'tile') {
    return platform === 'ios'
      ? MobileSelectors.inspector.tileStyleOutputLabelIos
      : MobileSelectors.inspector.tileStyleOutputLabel;
  }
  if (widget === 'datetime') {
    return platform === 'ios'
      ? MobileSelectors.inspector.datetimeStyleOutputLabelIos
      : MobileSelectors.inspector.datetimeStyleOutputLabel;
  }
  return MobileSelectors.inspector.styleOutputLabel;
}

// Helper: returns correct style input selector for widget type
function getStyleInputSelector(widget: string) {
  if (widget === 'bottomsheet') return MobileSelectors.inspector.bottomsheetStyleCommandInput;
  if (widget === 'modal-dialog') return MobileSelectors.inspector.modalStyleCommandInput;
  return MobileSelectors.inspector.styleCommandInput;
}

// Helper: derive widget type from a studioWidgetName (label6, panel1, etc.) or from an RN command
function getWidgetTypeFromStudioNameOrCommand(input: string): 'label' | 'panel' | 'bottomsheet' | 'modal-dialog' | 'formcontrols' | 'tile' | 'datetime' | 'other' {
  const s = (input || '').toLowerCase();
  // RN command example: App.appConfig.currentPage.Widgets.panel1._INSTANCE.styles...
  // or studioWidgetName: panel1
  if (s.includes('widgets.label') || s.startsWith('label')) return 'label';
  if (s.includes('widgets.panel') || s.startsWith('panel')) return 'panel';
  if (s.includes('widgets.bottomsheet') || s.startsWith('bottomsheet')) return 'bottomsheet';
  if (s.includes('widgets.dialog') || s.startsWith('dialog') || s.includes('widgets.modal') || s.startsWith('modal')) return 'modal-dialog';
  if (s.includes('widgets.formcontrols') || s.startsWith('formcontrols') || s.endsWith('_formlabel')) return 'formcontrols';
  if (s.includes('widgets.tile') || s.startsWith('tile')) return 'tile';
  if (s.includes('widgets.datetime') || s.startsWith('datetime')) return 'datetime';
  return 'other';
}

// Navigation selectors
const HOME_HEADER_SELECTOR = MobileSelectors.common.homeHeader;
const BACK_BUTTON_SELECTOR = MobileSelectors.common.backButton;
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

const STATE_AWARE_WIDGETS: Widget[] = [
  'tabbar', 'tabs', 'button', 'checkbox', 'checkboxset', 'wizard', 'carousel',
  'chips', 'formcontrols', 'radioset', 'toggle', 'switch',
];

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

  // One full styles fetch per widget instance; token checks resolve paths locally
  private static stylesObjectCache = new Map<string, StylesCacheEntry>();

  static clearStylesObjectCache(): void {
    MobileWidgetPage.stylesObjectCache.clear();
    MobileWidgetPage.dumpedStyleInstances.clear();
  }

  static buildStylesCacheKey(
    widget: Widget,
    studioWidgetName: string,
    variantName: string,
    platform: 'android' | 'ios',
  ): string {
    if (widget === 'formcontrols') {
      const formFieldKey = variantName.endsWith('-disabled') ? 'custom' : 'entestkey';
      return `${platform}::${widget}::${formFieldKey}`;
    }
    return `${platform}::${widget}::${studioWidgetName}`;
  }

  /** Platform-scoped disk path so parallel Android/iOS Jenkins jobs do not cross-contaminate. */
  static getStylesDiskPath(
    widget: Widget,
    studioWidgetName: string,
    platform: 'android' | 'ios',
  ): string {
    return path.join(
      process.cwd(),
      'artifacts',
      'mobile-styles',
      widget,
      `${studioWidgetName}.${platform}.styles.json`,
    );
  }

  static hasStylesCache(
    widget: Widget,
    variantName: string,
    platform: 'android' | 'ios',
  ): boolean {
    const studioWidgetName = getStudioWidgetNameForVariant(widget, variantName);
    if (!studioWidgetName) return false;
    const cacheKey = MobileWidgetPage.buildStylesCacheKey(
      widget,
      studioWidgetName,
      variantName,
      platform,
    );
    const memoryEntry = MobileWidgetPage.stylesObjectCache.get(cacheKey);
    if (memoryEntry) {
      if (widget === 'datetime') {
        return MobileWidgetPage.isValidDatetimePickerStyles(memoryEntry.styles);
      }
      return true;
    }
    const diskPath = MobileWidgetPage.getStylesDiskPath(widget, studioWidgetName, platform);
    if (!fs.existsSync(diskPath)) return false;
    if (widget === 'datetime') {
      try {
        const diskData = JSON.parse(fs.readFileSync(diskPath, 'utf-8'));
        return MobileWidgetPage.isValidDatetimePickerStyles(diskData);
      } catch {
        return false;
      }
    }
    return true;
  }

  /** Picker-auto styles include populated cancelBtn.text; _INSTANCE.styles shells do not. */
  private static isValidDatetimePickerStyles(styles: unknown): boolean {
    if (!styles || typeof styles !== 'object' || Array.isArray(styles)) return false;
    const cancelBtn = (styles as Record<string, unknown>).cancelBtn;
    if (!cancelBtn || typeof cancelBtn !== 'object') return false;
    const text = (cancelBtn as Record<string, unknown>).text;
    if (!text || typeof text !== 'object') return false;
    const fontSize = (text as Record<string, unknown>).fontSize;
    return fontSize !== undefined && fontSize !== null && fontSize !== '';
  }

  /**
   * Prefetch full styles JSON once per widget instance + platform (same path Android/iOS token tests use).
   */
  async warmStylesCache(
    browser: Browser,
    widget: Widget,
    variantName: string,
  ): Promise<void> {
    const platform = this.getPlatform(browser);
    const studioWidgetName = getStudioWidgetNameForVariant(widget, variantName);
    if (!studioWidgetName) {
      console.warn(`   ⚠️ warmStylesCache: no studio widget for ${widget} / ${variantName}`);
      return;
    }
    if (MobileWidgetPage.hasStylesCache(widget, variantName, platform)) {
      return;
    }
    if (widget === 'datetime') {
      // Datetime styles auto-populate in ~label2_caption after the picker is opened
      // and dismissed — no style command via ~exinput_i is needed.
      await this.warmDatetimeStylesFromPicker(browser, widget, studioWidgetName, variantName, platform);
      return;
    }
    await this.getCachedStylesObject(browser, widget, studioWidgetName, variantName, platform);
  }

  /**
   * Datetime-specific style warm-up.
   *
   * Tapping the datetime widget opens the picker modal; the WaveMaker test app
   * automatically writes the picker's styles JSON into ~label2_caption at that
   * point. We then dismiss the picker (tap in the dim overlay above the sheet)
   * so the label is no longer obscured, read the JSON, and cache it — exactly
   * as if getCachedStylesObject had fetched it via a style command.
   *
   * No style command via ~exinput_i is needed.
   */
  private async warmDatetimeStylesFromPicker(
    browser: Browser,
    widget: Widget,
    studioWidgetName: string,
    variantName: string,
    platform: 'android' | 'ios',
  ): Promise<StylesCacheEntry | null> {
    const datetimeSelector = MobileSelectors.headers.datetime; // ~datetime1_l
    const outputSelector = getStyleOutputSelector('datetime', platform);
    const pickerOpenWaitMs = isBrowserStackEnv() ? 2000 : 1000;
    const pickerDismissWaitMs = isBrowserStackEnv() ? 1200 : 800;

    console.log(`   📅 [datetime] Tapping picker to auto-populate ~label2_caption…`);
    try {
      await this.navigateToWidget(browser, widget);
      await this.waitForWidget(browser, widget);

      // 1. Open the picker
      const datetimeEl = await (browser as any).$(datetimeSelector);
      await datetimeEl.waitForDisplayed({ timeout: 10000 });
      await datetimeEl.click();
      await waitFor(pickerOpenWaitMs);

      // 2. Dismiss by tapping in the dim overlay (top 10 % of screen)
      const { height } = await (browser as any).getWindowSize();
      const tapY = Math.max(80, Math.floor(height * 0.1));
      await (browser as any).touchAction([{ action: 'tap', x: 200, y: tapY }]);
      await waitFor(pickerDismissWaitMs);

      // 3. Read the styles that were auto-written to ~label2_caption
      const output = await (browser as any).$(outputSelector);
      await output.waitForDisplayed({ timeout: 10000 });
      const rawJson = await output.getText().catch(() => '');

      if (!rawJson || rawJson.trim() === '' || rawJson === '{}') {
        console.warn(`   ⚠️ [datetime] ~label2_caption was empty after picker dismiss`);
        return null;
      }

      // 4. Parse and store in the in-memory + disk cache
      const styles = JSON.parse(rawJson);
      if (!MobileWidgetPage.isValidDatetimePickerStyles(styles)) {
        console.warn(`   ⚠️ [datetime] ~label2_caption JSON missing cancelBtn.text.fontSize`);
        return null;
      }

      const cacheKey = MobileWidgetPage.buildStylesCacheKey(widget, studioWidgetName, variantName, platform);
      const entry: StylesCacheEntry = { styles, fullCommand: '[datetime-picker-auto]' };
      MobileWidgetPage.stylesObjectCache.set(cacheKey, entry);

      const diskPath = MobileWidgetPage.getStylesDiskPath(widget, studioWidgetName, platform);
      const dir = path.dirname(diskPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(diskPath, JSON.stringify(styles, null, 2), 'utf-8');

      console.log(`   ✅ [datetime] Styles cached from picker auto-populate (${Object.keys(styles).length} namespaces)`);
      return entry;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`   ⚠️ [datetime] warmDatetimeStylesFromPicker failed (continuing): ${msg}`);
      return null;
    }
  }

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
   * Platform-aware page-ready selector: explicit header overrides, else widget matrix sentinel.
   * ~exinput_i is the Main style console — only a valid page-ready for tabbar/navbar on home.
   */
  private getPageHeaderSelector(browser: Browser, widgetName: string): string {
    const explicit = (MobileSelectors.headers as Record<string, string>)[widgetName];
    if (explicit) {
      if (explicit === STYLE_COMMAND_INPUT_SELECTOR && !isHomePageWidget(widgetName)) {
        return getWidgetPageReadySelector(widgetName as Widget, this.getPlatform(browser));
      }
      return explicit;
    }
    return getWidgetPageReadySelector(widgetName as Widget, this.getPlatform(browser));
  }

  private async isHomePageVisible(browser: Browser): Promise<boolean> {
    return this.appiumHelpers.isElementDisplayed(browser, HOME_HEADER_SELECTOR);
  }

  private async isOnWidgetPage(browser: Browser, widgetName: string): Promise<boolean> {
    if (isHomePageWidget(widgetName)) {
      return this.isOnHomePageWidget(browser, widgetName);
    }
    const pageHeaderSelector = this.getPageHeaderSelector(browser, widgetName);
    return this.appiumHelpers.isElementDisplayed(browser, pageHeaderSelector);
  }

  /** tabbar / navbar only — home screen + widget sentinel visible (no nav link tap). */
  private async isOnHomePageWidget(browser: Browser, widgetName: string): Promise<boolean> {
    if (!isHomePageWidget(widgetName)) {
      return false;
    }
    if (!(await this.isHomePageVisible(browser))) {
      return false;
    }
    const widgetSelector = this.getPageHeaderSelector(browser, widgetName);
    if (widgetName === 'navbar') {
      return (
        widgetSelector === HOME_HEADER_SELECTOR ||
        await this.appiumHelpers.isElementDisplayed(browser, widgetSelector)
      );
    }
    if (widgetName === 'tabbar') {
      return this.appiumHelpers.isElementDisplayed(browser, widgetSelector);
    }
    return false;
  }

  /**
   * Main-page widgets (tabbar, navbar) live on the Main/home screen — verify there, never tap a nav link.
   */
  private async navigateToHomePageWidget(
    browser: Browser,
    widgetName: string,
    options?: { fromRecovery?: boolean },
  ): Promise<void> {
    console.log(`   🏠 ${widgetName} is a home-page widget — verifying on Main (no nav link tap)`);

    await this.ensureOnHomePage(browser);

    if (await this.isHomePageVisible(browser)) {
      console.log('   ✅ Home header is visible');
    } else if (!options?.fromRecovery) {
      try {
        const homeHeader = await (browser as any).$(HOME_HEADER_SELECTOR);
        await homeHeader.waitForDisplayed({ timeout: 30000 });
        console.log('   ✅ Home header is visible');
      } catch {
        console.warn('   ⚠️ Home header not found on Main page');
      }
    }

    const widgetSelector = this.getPageHeaderSelector(browser, widgetName);
    if (widgetSelector !== HOME_HEADER_SELECTOR) {
      try {
        const widgetEl = await (browser as any).$(widgetSelector);
        await widgetEl.waitForDisplayed({ timeout: 30000 });
        console.log(`   ✅ ${widgetName} visible on home page (${widgetSelector})`);
      } catch {
        console.warn(`   ⚠️ ${widgetName} not visible on home page: ${widgetSelector}`);
      }
    }

    console.log(`✓ Ready to verify ${widgetName} on home page`);
  }

  /**
   * Returns to home before tapping a nav link (recovery often leaves us on a widget page).
   */
  private async ensureOnHomePage(browser: Browser): Promise<void> {
    if (await this.isHomePageVisible(browser)) {
      return;
    }

    const platform = this.getPlatform(browser);
    const maxAttempts = 5;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (await this.isHomePageVisible(browser)) {
        console.log('   ✅ Returned to home page');
        return;
      }

      try {
        const backBtn = await (browser as any).$(BACK_BUTTON_SELECTOR);
        if (await backBtn.isExisting() && await backBtn.isDisplayed()) {
          await backBtn.click();
          await waitFor(1000);
          continue;
        }
      } catch {
        // try platform back next
      }

      if (platform === 'android') {
        try {
          await (browser as any).back();
          await waitFor(1000);
        } catch {
          break;
        }
      } else {
        try {
          await (browser as any).back();
          await waitFor(1000);
        } catch {
          break;
        }
      }
    }

    if (!(await this.isHomePageVisible(browser))) {
      console.warn('   ⚠️ Could not confirm home page after back navigation');
    }
  }

  private async tapNavLink(browser: Browser, navSelector: string, widgetName: string): Promise<void> {
    const platform = this.getPlatform(browser);
    const visible = await this.appiumHelpers.swipeUntilElementVisible(browser, navSelector, {
      maxSwipes: platform === 'ios' ? 20 : 10,
      pauseMs: platform === 'ios' ? 900 : 700,
    });
    if (!visible) {
      throw new Error(`${widgetName} nav link not visible after swiping: ${navSelector}`);
    }
    const widgetLink = await (browser as any).$(navSelector);
    await widgetLink.waitForDisplayed({ timeout: 10000 });
    await widgetLink.click();
  }

  /**
   * Navigates to widget screen.
   *
   * Flow:
   *  1) skip if already on target widget page
   *  2) ensure home page (back navigation during recovery)
   *  3) verify home header
   *  4) swipe until nav link visible, then tap
   *  5) verify widget-specific page-ready sentinel
   */
  async navigateToWidget(
    browser: Browser,
    widgetName: string,
    options?: { fromRecovery?: boolean },
  ): Promise<void> {
    return MobileSessionGuard.run(browser, async () => {
      console.log(`\n🧭 Navigating to widget: ${widgetName}`);

      await this.appiumHelpers.waitForAppReady(browser);

      if (isHomePageWidget(widgetName)) {
        if (await this.isOnHomePageWidget(browser, widgetName)) {
          console.log(`   ℹ️ Already on home with ${widgetName} — skipping navigation`);
          return;
        }
        await this.navigateToHomePageWidget(browser, widgetName, options);
        return;
      }

      const navSelector = (MobileSelectors.navItems as Record<string, string>)[widgetName];
      if (!navSelector) {
        console.warn(`   ⚠️ No home link selector configured for widget: ${widgetName}`);
        console.log(`✓ Navigated to widget: ${widgetName}`);
        return;
      }

      if (await this.isOnWidgetPage(browser, widgetName)) {
        console.log(`   ℹ️ Already on ${widgetName} page — skipping navigation`);
        return;
      }

      await this.ensureOnHomePage(browser);

      if (await this.isHomePageVisible(browser)) {
        console.log('   ✅ Home header is visible');
      } else if (!options?.fromRecovery) {
        try {
          const homeHeader = await (browser as any).$(HOME_HEADER_SELECTOR);
          await homeHeader.waitForDisplayed({ timeout: 30000 });
          console.log('   ✅ Home header is visible');
        } catch {
          console.warn('   ⚠️ Home header not found — continuing to nav link');
        }
      } else {
        console.log('   ℹ️ Recovery navigation — skipping long home header wait');
      }

      await this.tapNavLink(browser, navSelector, widgetName);
      console.log(`   ✅ Tapped ${widgetName} link`);

      const pageHeaderSelector = this.getPageHeaderSelector(browser, widgetName);
      try {
        const pageHeader = await (browser as any).$(pageHeaderSelector);
        await pageHeader.waitForDisplayed({ timeout: 30000 });
        console.log(`   ✅ ${widgetName} page ready (${pageHeaderSelector})`);
      } catch {
        console.warn(`   ⚠️ ${widgetName} page ready selector not found: ${pageHeaderSelector}`);
      }

      console.log(`✓ Navigated to widget: ${widgetName}`);
    });
  }


  /**
   * Waits for widget to be visible
   * @param browser WebDriver browser 
   * 
   * @param widgetName Widget identifier
   */
  async waitForWidget(browser: Browser, widgetName: string): Promise<void> {
    // When only validating style tokens (no screenshots), skip the selector wait.
    // RN console commands work as long as the page JS is loaded — the widget
    // element doesn't need to be visually rendered on screen.
    if (process.env.SKIP_VISUAL_VERIFICATION === 'true') {
      await waitFor(2000);
      return;
    }

    const relax = shouldRelaxWidgetWait();
    const selector = this.getWidgetSelector(browser, widgetName);
    try {
      await this.appiumHelpers.waitForElement(browser, selector);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`   🔄 Widget not visible (${message}), restarting app...`);
      try {
        await this.restartAppAndNavigate(browser, widgetName);
        await this.appiumHelpers.waitForElement(browser, selector);
      } catch (err2: unknown) {
        const message2 = err2 instanceof Error ? err2.message : String(err2);
        if (relax) {
          console.warn(
            `   ⚠️ waitForWidget(${widgetName}) sentinel still not ready after restart — continuing so RN/style commands can run (${message2})`,
          );
          return;
        }
        throw err2;
      }
    }
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
      command = `App.appConfig.currentPage.Widgets.supportedLocaleForm1.formWidgets.entestkey._INSTANCE.styles`;
    } else {
      command = `App.appConfig.currentPage.Widgets${studioWidgetsPropertyAccess(studioWidgetName)}._INSTANCE.styles`;
    }
    console.log(`   🧾 Entering style command: ${command}`);

    const input = await (browser as any).$(STYLE_COMMAND_INPUT_SELECTOR);
    // Select correct output label for this widget type
    const outputSelector = getStyleOutputSelector(widgetType, this.getPlatform(browser));
    console.log(`   🧭 [OutputLabel] widgetType='${widgetType}', studioWidgetName='${studioWidgetName}', selector='${outputSelector}'`);
    const output = await (browser as any).$(outputSelector);

    // 1. Enter the command
    await input.waitForDisplayed({ timeout: 30000 });
    await input.clearValue();
    await input.click();
    await input.setValue(command);
    await this.appiumHelpers.submitKeyboardAction(browser, 'style command');

    // 2. Wait for the output label after the keyboard action commits/dismisses.
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
      await this.appiumHelpers.submitKeyboardAction(browser, 'style command cleanup');
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

    const platform = this.getPlatform(browser);
    const filePath = MobileWidgetPage.getStylesDiskPath(widget, studioWidgetName, platform);
    fs.writeFileSync(filePath, JSON.stringify(styles, null, 2), 'utf-8');

    console.log(`   💾 Saved styles JSON for ${studioWidgetName} to ${filePath}`);
    return filePath;
  }

  private buildFullStylesCommand(widget: Widget, studioWidgetName: string, variantName: string): string {
    const formFieldKey = variantName.endsWith('-disabled') ? 'custom' : 'entestkey';
    if (widget === 'cards') {
      return 'App.appConfig.currentPage.Widgets.supportedLocaleList1.itemWidgets[0].card1._INSTANCE.calcStyles';
    }
    if (widget === 'formcontrols') {
      return `App.appConfig.currentPage.Widgets.supportedLocaleForm1.formWidgets.${formFieldKey}._INSTANCE.styles`;
    }
    if (widget === 'tabs') {
      return MobileMapper.getTabsHeaderStylesCommand(studioWidgetName);
    }
    return `App.appConfig.currentPage.Widgets${studioWidgetsPropertyAccess(studioWidgetName)}._INSTANCE.styles`;
  }

  private parseStylesJson(rawResult: string, studioWidgetName: string): unknown {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawResult);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && '__trace' in parsed) {
        delete (parsed as Record<string, unknown>).__trace;
      }
    } catch {
      throw new Error(`Invalid styles JSON for ${studioWidgetName}: ${rawResult.substring(0, 100)}...`);
    }
    return parsed;
  }

  private loadTabsStylesFromDisk(diskData: unknown): StylesCacheEntry | null {
    if (!diskData || typeof diskData !== 'object' || Array.isArray(diskData)) return null;
    const record = diskData as Record<string, unknown>;
    if (record.header && record.tabsRoot) {
      return {
        styles: record.header,
        tabsRootStyles: record.tabsRoot,
        fullCommand: '[loaded from disk: tabs header]',
        tabsRootCommand: '[loaded from disk: tabs root]',
      };
    }
    return null;
  }

  private saveTabsStylesToDisk(
    widget: Widget,
    studioWidgetName: string,
    platform: 'android' | 'ios',
    headerStyles: unknown,
    rootStyles: unknown,
  ): void {
    const filePath = MobileWidgetPage.getStylesDiskPath(widget, studioWidgetName, platform);
    fs.writeFileSync(
      filePath,
      JSON.stringify({ header: headerStyles, tabsRoot: rootStyles }, null, 2),
      'utf-8',
    );
    console.log(`   💾 Saved tabs header + root styles to ${filePath}`);
  }

  private resolveTabsStylesLookup(
    entry: StylesCacheEntry,
    propertyPath: string[],
  ): { stylesLookup: unknown; commandBase: string } {
    const usesRoot = MobileMapper.usesTabsRootStyles(propertyPath);
    if (usesRoot && entry.tabsRootStyles) {
      return {
        stylesLookup: entry.tabsRootStyles,
        commandBase: entry.tabsRootCommand || entry.fullCommand,
      };
    }
    return { stylesLookup: entry.styles, commandBase: entry.fullCommand };
  }

  /**
   * Fetch the complete styles object once per widget instance and cache in memory.
   */
  async getCachedStylesObject(
    browser: Browser,
    widget: Widget,
    studioWidgetName: string,
    variantName: string,
    platform?: 'android' | 'ios',
  ): Promise<StylesCacheEntry> {
    MobileSessionGuard.assertAlive(browser);
    const resolvedPlatform = platform ?? this.getPlatform(browser);
    const cacheKey = MobileWidgetPage.buildStylesCacheKey(
      widget,
      studioWidgetName,
      variantName,
      resolvedPlatform,
    );
    const cached = MobileWidgetPage.stylesObjectCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Try loading from disk cache before hitting BrowserStack (platform-scoped only).
    const diskPath = MobileWidgetPage.getStylesDiskPath(widget, studioWidgetName, resolvedPlatform);
    if (fs.existsSync(diskPath)) {
      try {
        const diskData = JSON.parse(fs.readFileSync(diskPath, 'utf-8'));
        if (widget === 'tabs') {
          const tabsDiskEntry = this.loadTabsStylesFromDisk(diskData);
          if (tabsDiskEntry) {
            MobileWidgetPage.stylesObjectCache.set(cacheKey, tabsDiskEntry);
            console.log(`   💾 Loaded tabs header + root styles from disk: ${diskPath}`);
            return tabsDiskEntry;
          }
          console.warn(
            `   ⚠️ Stale tabs disk cache (expected {header,tabsRoot}) — refetching from device: ${diskPath}`,
          );
        } else if (widget === 'datetime') {
          if (MobileWidgetPage.isValidDatetimePickerStyles(diskData)) {
            const diskEntry: StylesCacheEntry = { styles: diskData, fullCommand: '[datetime-picker-auto]' };
            MobileWidgetPage.stylesObjectCache.set(cacheKey, diskEntry);
            console.log(`   💾 Loaded datetime picker styles from disk: ${diskPath}`);
            return diskEntry;
          }
          console.warn(
            `   ⚠️ Stale datetime disk cache (expected picker JSON with cancelBtn.text.fontSize) — refetching: ${diskPath}`,
          );
        } else {
          const diskEntry = { styles: diskData, fullCommand: `[loaded from disk: ${diskPath}]` };
          MobileWidgetPage.stylesObjectCache.set(cacheKey, diskEntry);
          console.log(`   💾 Loaded styles from disk cache: ${diskPath}`);
          return diskEntry;
        }
      } catch (err) {
        console.warn(`   ⚠️ Failed to load disk cache ${diskPath}, fetching from device...`);
      }
    }

    const fetchWithRetry = async (command: string): Promise<string> => {
      const maxRetries = 3;
      let rawResult = '{}';
      for (let i = 0; i < maxRetries; i++) {
        try {
          rawResult = await this.executeRnCommand(browser, command);
          if (!this.isEmptyObject(rawResult) && rawResult !== 'undefined' && rawResult !== '') {
            return rawResult;
          }
          if (i < maxRetries - 1) {
            console.log(`   🔄 Empty styles object, recovering UI (${i + 1}/${maxRetries})...`);
            await this.recoverWidgetContext(browser, widget);
            await waitFor(1000);
          }
        } catch (err: unknown) {
          if (err instanceof MobileSessionDeadError) {
            throw err;
          }
          const message = err instanceof Error ? err.message : String(err);
          if (i === maxRetries - 1) throw err;
          console.log(`   🔄 Styles fetch failed, recovering UI (${message})...`);
          await this.recoverWidgetContext(browser, widget);
        }
      }
      return rawResult;
    };

    let entry: StylesCacheEntry;

    if (widget === 'datetime') {
      const pickerEntry = await this.warmDatetimeStylesFromPicker(
        browser,
        widget,
        studioWidgetName,
        variantName,
        resolvedPlatform,
      );
      if (!pickerEntry) {
        throw new Error(
          'Datetime styles could not be loaded via picker (~label2_caption). ' +
            'The _INSTANCE.styles style-command path is not valid for datetime.',
        );
      }
      return pickerEntry;
    }

    if (widget === 'tabs') {
      const headerCommand = MobileMapper.getTabsHeaderStylesCommand(studioWidgetName);
      const rootCommand = MobileMapper.getTabsRootStylesCommand(studioWidgetName);
      console.log(`   📦 Fetching tabs header styles (${resolvedPlatform}): ${headerCommand}`);
      const headerRaw = await fetchWithRetry(headerCommand);
      console.log(`   📦 Fetching tabs root styles (${resolvedPlatform}): ${rootCommand}`);
      const rootRaw = await fetchWithRetry(rootCommand);
      const headerStyles = this.parseStylesJson(headerRaw, studioWidgetName);
      const rootStyles = this.parseStylesJson(rootRaw, studioWidgetName);
      entry = {
        styles: headerStyles,
        tabsRootStyles: rootStyles,
        fullCommand: headerCommand,
        tabsRootCommand: rootCommand,
      };
    } else {
      const fullCommand = this.buildFullStylesCommand(widget, studioWidgetName, variantName);
      console.log(`   📦 Fetching full styles object once (${resolvedPlatform}): ${fullCommand}`);
      const rawResult = await fetchWithRetry(fullCommand);
      entry = { styles: this.parseStylesJson(rawResult, studioWidgetName), fullCommand };
    }

    MobileWidgetPage.stylesObjectCache.set(cacheKey, entry);

    if (!MobileWidgetPage.dumpedStyleInstances.has(cacheKey)) {
      MobileWidgetPage.dumpedStyleInstances.add(cacheKey);
      try {
        const dir = path.join(process.cwd(), 'artifacts', 'mobile-styles', widget);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        if (widget === 'tabs' && entry.tabsRootStyles) {
          this.saveTabsStylesToDisk(
            widget,
            studioWidgetName,
            resolvedPlatform,
            entry.styles,
            entry.tabsRootStyles,
          );
        } else {
          const filePath = MobileWidgetPage.getStylesDiskPath(widget, studioWidgetName, resolvedPlatform);
          fs.writeFileSync(filePath, JSON.stringify(entry.styles, null, 2), 'utf-8');
          console.log(`   💾 Saved full styles object to ${filePath}`);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`   ⚠️ Failed to save styles JSON: ${message}`);
      }
    }

    // Full styles JSON is rendered in the inspector output label and can cover the whole screen,
    // hiding back/home navigation. Restart so later navigation (back button, home links) works.
    // Datetime uses picker auto-populate (~label2_caption) — no inspector overlay, no restart needed.
    if (widget !== 'datetime') {
      console.log('   🔄 Restarting app after styles fetch (output covers navigation UI)...');
      await this.restartAppAndNavigate(browser, widget, { preserveStylesCache: true });
    }

    return entry;
  }

  private getEffectivePropertyPath(widget: Widget, variantName: string, propertyPath: string[]): string[] {
    const variantState = variantName.split('-').pop() || 'default';
    // Only prepend states prefix if path doesn't already start with 'states'
    // (extractTokens stores the path including 'states.*' from the payload structure)
    if (variantState !== 'default' && STATE_AWARE_WIDGETS.includes(widget) && propertyPath[0] !== 'states') {
      return ['states', variantState, ...propertyPath];
    }
    return propertyPath;
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
    return MobileSessionGuard.run(browser, async () => {
      const widgetType = getWidgetTypeFromStudioNameOrCommand(command);
      const inputSelector = getStyleInputSelector(widgetType);
      const outputSelector = getStyleOutputSelector(widgetType, this.getPlatform(browser));

      const input = await (browser as any).$(inputSelector);
      console.log(`   🧭 [Input/Output] widgetType='${widgetType}', command='${command}', inputSelector='${inputSelector}', outputSelector='${outputSelector}'`);
      const output = await (browser as any).$(outputSelector);

      await input.waitForDisplayed({ timeout: 30000 });

      await input.click();
      await input.setValue('');
      await input.setValue(command);

      await this.appiumHelpers.submitKeyboardAction(browser, 'RN style command');

      await waitFor(1500);
      await output.waitForDisplayed({ timeout: 15000 });

      const result = await output.getText().catch(() => '');

      try {
        await input.click();
        await input.setValue('');
        await this.appiumHelpers.submitKeyboardAction(browser, 'RN style command cleanup');
      } catch { }

      return result;
    });
  }



  /**
   * Restarts the app and navigates back to the specified widget page.
   */
  /** Lighter recovery for style-fetch retries (navigate only on cloud). */
  private async recoverWidgetContext(browser: Browser, widget: string): Promise<void> {
    if (MobileSessionGuard.isDead(browser)) {
      throw new MobileSessionDeadError();
    }
    if (isBrowserStackEnv()) {
      try {
        await this.navigateToWidget(browser, widget, { fromRecovery: true });
        await this.waitForWidget(browser, widget);
        MobileWidgetPage.clearStylesObjectCache();
        return;
      } catch (err: unknown) {
        if (err instanceof MobileSessionDeadError) {
          throw err;
        }
        // fall through to full recovery
      }
    }
    await this.restartAppAndNavigate(browser, widget);
  }

  /**
   * Recover UI state and return to the widget page.
   * On BrowserStack, skips terminate/activate when bundle ID is unavailable (common with bs:// app URLs).
   */
  async restartAppAndNavigate(
    browser: Browser,
    widget: string,
    options?: { preserveStylesCache?: boolean },
  ): Promise<void> {
    console.log(`   🔄 Recovering app and navigating back to ${widget}...`);
    try {
      const pkg = await this.appiumHelpers.getCurrentPackage(browser);
      const onCloud = isBrowserStackEnv();

      if (pkg) {
        try {
          await (browser as any).terminateApp(pkg);
          await waitFor(2000);
          await (browser as any).activateApp(pkg);
        } catch {
          try {
            await this.appiumHelpers.closeApp(browser);
            await waitFor(2000);
            await this.appiumHelpers.launchApp(browser);
          } catch {
            // continue to navigation
          }
        }
      } else if (onCloud) {
        console.warn(
          '   ℹ️  BrowserStack: no bundle/package ID — trying closeApp/launchApp fallback',
        );
        try {
          await this.appiumHelpers.closeApp(browser);
          await waitFor(2000);
          await this.appiumHelpers.launchApp(browser);
        } catch {
          console.warn('   ⚠️ closeApp/launchApp fallback failed — re-navigating in-place');
        }
      } else {
        console.error('   ❌ Could not determine package/bundle ID for restart');
      }

      await this.appiumHelpers.waitForAppReady(browser);
      await this.navigateToWidget(browser, widget);
      if (!options?.preserveStylesCache) {
        MobileWidgetPage.clearStylesObjectCache();
      }
      console.log(`   ✅ Recovered and navigated back to ${widget}`);
    } catch (err: any) {
      console.error(`   ⚠️ Failed during app recovery/navigation: ${err.message}`);
    }
  }

  /**
  * Verifies a token by resolving its mapped RN path against a cached full styles object
  * (one Appium fetch per widget instance). Falls back to per-property RN commands only
  * when MOBILE_STYLE_PER_PROPERTY=1 is set.
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

    const resolvedPlatform = (platform ?? this.getPlatform(browser)) as 'android' | 'ios';
    const stylesKey = widget === 'cards' ? 'calcStyles' : 'styles';
    let commandSuffix = stylesKey;
    let mappedPath = '';
    let fullCommand = '';
    let actualValue: string;

    let effectivePropertyPath: string[] | undefined;
    if (propertyPath && propertyPath.length > 0) {
      effectivePropertyPath = this.getEffectivePropertyPath(widget, variantName, propertyPath);
      mappedPath = MobileMapper.mapToRnStylePath(effectivePropertyPath, widget, resolvedPlatform);
      commandSuffix = `${stylesKey}.${mappedPath}`;
      console.log(`   🔍 Mapping [${propertyPath.join('.')}] -> [${mappedPath}] (cached styles lookup)`);
    } else {
      console.log(`   ℹ️  No property path provided, using full '${stylesKey}' object.`);
    }

    const usePerPropertyCommands = process.env.MOBILE_STYLE_PER_PROPERTY === '1';

    if (!usePerPropertyCommands) {
      const cacheEntry = await this.getCachedStylesObject(
        browser,
        widget,
        studioWidgetName,
        variantName,
        resolvedPlatform,
      );
      fullCommand = cacheEntry.fullCommand;

      if (mappedPath) {
        let stylesLookup = cacheEntry.styles;
        let commandBase = cacheEntry.fullCommand;
        if (widget === 'tabs' && effectivePropertyPath) {
          const tabsResolved = this.resolveTabsStylesLookup(cacheEntry, effectivePropertyPath);
          stylesLookup = tabsResolved.stylesLookup;
          commandBase = tabsResolved.commandBase;
        }
        const resolved = resolveStyleValue(stylesLookup, mappedPath);
        fullCommand = `${commandBase}.${resolved.resolvedPath}`;
        actualValue = formatResolvedValue(resolved.value);
        console.log(`   ⚡ Resolved from cache: ${fullCommand} = "${actualValue}"`);
      } else {
        actualValue = formatResolvedValue(cacheEntry.styles);
      }
    } else {
      // Legacy: one RN command per property (slow; opt-in via MOBILE_STYLE_PER_PROPERTY=1)
      let command = mappedPath && effectivePropertyPath
        ? MobileMapper.getExtractionCommand(widget, effectivePropertyPath, studioWidgetName, resolvedPlatform)
        : this.buildFullStylesCommand(widget, studioWidgetName, variantName);
      fullCommand = command;
      console.log(`   🧾 Executing RN Command (legacy): ${command}`);
      actualValue = await this.executeRnCommand(browser, command);
    }

    console.log(`   🎯 Expected Value: "${expectedValue}"`);
    console.log(`   🧐 Actual Value: "${actualValue}"`);

    const propHint = propertyPath?.join('.') || 'color';
    const normalizedActual = TokenMappingService.normalizeValue(String(actualValue), propHint);
    const normalizedExpected = TokenMappingService.normalizeValue(expectedValue, propHint);

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
      const parsed = JSON.parse(actualValue);
      if (typeof parsed === 'object' && parsed !== null) {
        console.log(`   📦 Result is an object, searching for value...`);
        const jsonStr = JSON.stringify(parsed);
        if (jsonStr.includes(expectedValue)) {
          console.log(`   ✅ Style property ${commandSuffix} contains expected value "${expectedValue}"`);
          result.passed = true;

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
    result.error = `Style mismatch for ${studioWidgetName} property ${commandSuffix}.\nExpected: "${expectedValue}", Actual: "${actualValue}"`;

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

  /**
   * Batch-verify all tokens for a widget in a single Appium round-trip.
   *
   * Fetches the full styles object once, then resolves every token path
   * in memory. Returns a per-token result array and prints a summary table.
   */
  async verifyAllTokensBatch(
    browser: Browser,
    widget: Widget,
    tokens: Array<{
      tokenRef: string;
      variantName: string;
      propertyPath: string[];
      tokenData?: any;
    }>,
    platform?: 'android' | 'ios',
  ): Promise<Array<{
    tokenRef: string;
    variantName: string;
    propertyPath: string[];
    passed: boolean;
    expectedValue: string;
    actualValue: string;
    resolvedPath: string;
    error?: string;
  }>> {
    const resolvedPlatform = (platform ?? this.getPlatform(browser)) as 'android' | 'ios';

    // Group tokens by studioWidgetName so we only fetch each styles object once
    const groupMap = new Map<string, typeof tokens>();
    for (const token of tokens) {
      const studioWidgetName = getStudioWidgetNameForVariant(widget, token.variantName) || token.variantName;
      if (!groupMap.has(studioWidgetName)) groupMap.set(studioWidgetName, []);
      groupMap.get(studioWidgetName)!.push(token);
    }

    const results: Array<{
      tokenRef: string;
      variantName: string;
      propertyPath: string[];
      passed: boolean;
      expectedValue: string;
      actualValue: string;
      resolvedPath: string;
      error?: string;
    }> = [];

    for (const [studioWidgetName, group] of groupMap) {
      // One Appium fetch for this widget instance (cached after first call)
      let stylesObj: unknown;
      try {
        const { styles } = await this.getCachedStylesObject(
          browser,
          widget,
          studioWidgetName,
          group[0].variantName,
          resolvedPlatform,
        );
        stylesObj = styles;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        for (const token of group) {
          results.push({
            tokenRef: token.tokenRef,
            variantName: token.variantName,
            propertyPath: token.propertyPath,
            passed: false,
            expectedValue: '',
            actualValue: '',
            resolvedPath: '',
            error: `Styles fetch failed: ${message}`,
          });
        }
        continue;
      }

      for (const token of group) {
        const expectedValue = this.extractExpectedValue(token.tokenRef, token.tokenData ?? {});
        if (!expectedValue) {
          results.push({
            tokenRef: token.tokenRef,
            variantName: token.variantName,
            propertyPath: token.propertyPath,
            passed: true,
            expectedValue: '',
            actualValue: '',
            resolvedPath: '',
            error: 'Could not resolve expected value — skipped',
          });
          continue;
        }

        const effectivePath = this.getEffectivePropertyPath(widget, token.variantName, token.propertyPath);
        const mappedPath = MobileMapper.mapToRnStylePath(effectivePath, widget, resolvedPlatform);
        const { value, resolvedPath } = resolveStyleValue(stylesObj, mappedPath);
        const actualValue = formatResolvedValue(value);

        const propHint = token.propertyPath.join('.') || 'color';
        const normActual = TokenMappingService.normalizeValue(actualValue, propHint);
        const normExpected = TokenMappingService.normalizeValue(expectedValue, propHint);
        const passed = normActual === normExpected ||
          (actualValue !== '' && JSON.stringify(stylesObj).includes(expectedValue));

        results.push({
          tokenRef: token.tokenRef,
          variantName: token.variantName,
          propertyPath: token.propertyPath,
          passed,
          expectedValue,
          actualValue,
          resolvedPath,
          error: passed ? undefined : `Expected "${expectedValue}", got "${actualValue}"`,
        });
      }
    }

    // Print summary table
    const passed = results.filter(r => r.passed && !r.error?.includes('skipped')).length;
    const failed = results.filter(r => !r.passed).length;
    const skipped = results.filter(r => r.error?.includes('skipped')).length;

    console.log('\n' + '═'.repeat(72));
    console.log(`  Batch Token Verification — ${widget} (${resolvedPlatform})`);
    console.log('═'.repeat(72));
    for (const r of results) {
      const icon = r.error?.includes('skipped') ? '⏭' : r.passed ? '✅' : '❌';
      console.log(`  ${icon}  [${r.propertyPath.join('.')}]`);
      if (!r.passed && !r.error?.includes('skipped')) {
        console.log(`       expected: ${r.expectedValue}`);
        console.log(`       actual:   ${r.actualValue}  (path: ${r.resolvedPath})`);
      }
    }
    console.log('─'.repeat(72));
    console.log(`  ✅ ${passed} passed  ❌ ${failed} failed  ⏭ ${skipped} skipped  (total ${results.length})`);
    console.log('═'.repeat(72) + '\n');

    return results;
  }
}
