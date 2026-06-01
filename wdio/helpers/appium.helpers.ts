/**
 * Appium Helper Utilities
 * Mobile-specific test helpers for element location, gestures, and interactions
 */
export class AppiumHelpers {
  
  /**
   * Waits for an element to be visible
   * @param browser WebDriver browser instance
   * @param selector Element selector
   * @param timeout Timeout in milliseconds
   */
  async waitForElement(browser: WebdriverIO.Browser, selector: string, timeout: number = 30000): Promise<void> {
    const element = await browser.$(selector);
    await element.waitForDisplayed({ timeout });
    console.log(`✓ Element visible: ${selector}`);
  }
  
  /**
   * Taps on an element
   * @param browser WebDriver browser instance
   * @param selector Element selector
   */
  async tapElement(browser: WebdriverIO.Browser, selector: string): Promise<void> {
    const element = await browser.$(selector);
    await element.waitForDisplayed();
    await element.click();
    console.log(`✓ Tapped element: ${selector}`);
  }
  
  /**
   * Gets element text
   * @param browser WebDriver browser instance
   * @param selector Element selector
   * @returns Element text
   */
  async getElementText(browser: WebdriverIO.Browser, selector: string): Promise<string> {
    const element = await browser.$(selector);
    await element.waitForDisplayed();
    return await element.getText();
  }
  
  /**
   * Gets computed CSS property from element.
   *
   * IMPORTANT:
   * - This helper is only safe in a web context where `document` and `window`
   *   are available (e.g. Playwright/Webdriver-based web tests).
   * - On native mobile (Appium / UiAutomator2 / XCUITest) calling executeScript
   *   like this will return 405 "Method is not implemented" and can destabilize
   *   the session.
   *
   * For safety, we now short‑circuit on native mobile and return an empty
   * string. All **mobile** token validation specs must rely on RN styles JSON
   * (`verifyStylesIncludeTokenValue`) instead of CSS.
   */
  async getCssProperty(browser: WebdriverIO.Browser, selector: string, property: string): Promise<string> {
    const caps: any = browser.capabilities;
    const platform = (caps?.platformName || caps?.platform || '').toString().toLowerCase();

    // On native Android/iOS, do NOT attempt to run document/window JS - return
    // empty and let callers treat CSS as best‑effort only.
    if (platform === 'android' || platform === 'ios') {
      console.warn(
        `⚠️  getCssProperty called on native platform (${platform}); ` +
          'skipping executeScript and returning empty string. Use RN styles JSON instead.',
      );
      return '';
    }

    const element = await browser.$(selector);
    await element.waitForDisplayed();

    // Get CSS value via execute script in web context only
    const value = await browser.execute((sel: string, prop: string) => {
      const el = (document as Document).querySelector(sel);
      if (!el) return '' as string;
      const style = window.getComputedStyle(el as Element);
      return style.getPropertyValue(prop) || (style as any)[prop] || '';
    }, selector, property);

    return value as string;
  }
  
  /**
   * Scrolls to an element
   * @param browser WebDriver browser instance
   * @param selector Element selector
   */
  async scrollToElement(browser: WebdriverIO.Browser, selector: string): Promise<void> {
    const element = await browser.$(selector);
    await element.scrollIntoView();
    console.log(`✓ Scrolled to element: ${selector}`);
  }
  
  /**
   * Swipes up on screen
   * @param browser WebDriver browser instance
   * @param distance Swipe distance (0-1, default 0.5)
   */
  async swipeUp(browser: WebdriverIO.Browser, distance: number = 0.5): Promise<void> {
    await this.swipe(browser, 'up', distance);
    console.log(`✓ Swiped up (distance: ${distance})`);
  }
  
  /**
   * Swipes down on screen
   * @param browser WebDriver browser instance
   * @param distance Swipe distance (0-1, default 0.5)
   */
  async swipeDown(browser: WebdriverIO.Browser, distance: number = 0.5): Promise<void> {
    await this.swipe(browser, 'down', distance);
    console.log(`✓ Swiped down (distance: ${distance})`);
  }

  /**
   * W3C touch swipe (works on Appium 2 / UiAutomator2 / XCUITest).
   */
  async swipe(browser: WebdriverIO.Browser, direction: 'up' | 'down', distance: number = 0.5): Promise<void> {
    const { width, height } = await browser.getWindowSize();
    const startX = Math.floor(width / 2);
    const startY = direction === 'up'
      ? Math.floor(height * (0.75 + (0.25 * (1 - distance))))
      : Math.floor(height * (0.25 - (0.25 * (1 - distance))));
    const endY = direction === 'up'
      ? Math.floor(height * (0.25 - (0.25 * (1 - distance))))
      : Math.floor(height * (0.75 + (0.25 * (1 - distance))));

    await browser.performActions([{
      type: 'pointer',
      id: 'finger1',
      parameters: { pointerType: 'touch' },
      actions: [
        { type: 'pointerMove', duration: 0, x: startX, y: startY },
        { type: 'pointerDown', button: 0 },
        { type: 'pause', duration: 250 },
        { type: 'pointerMove', duration: 450, x: startX, y: endY },
        { type: 'pointerUp', button: 0 },
      ],
    }]);
    await browser.releaseActions();
  }

  /**
   * Returns true when the element exists and is displayed.
   */
  async isElementDisplayed(browser: WebdriverIO.Browser, selector: string): Promise<boolean> {
    try {
      const element = await browser.$(selector);
      if (!(await element.isExisting())) return false;
      return await element.isDisplayed();
    } catch {
      return false;
    }
  }

  /**
   * Android UiScrollable helper for accessibility-id nav links on scrollable home pages.
   */
  private async androidScrollToAccessibilityId(
    browser: WebdriverIO.Browser,
    accessibilityId: string,
  ): Promise<boolean> {
    try {
      const scrollSelector =
        `android=new UiScrollable(new UiSelector().scrollable(true)).` +
        `scrollIntoView(new UiSelector().description("${accessibilityId}"))`;
      const element = await browser.$(scrollSelector);
      return await element.isDisplayed();
    } catch {
      return false;
    }
  }

  /**
   * Swipes until an element becomes visible (or max swipes exhausted).
   * Tries swipe-up first (scroll down), then swipe-down to recover overscroll.
   */
  async swipeUntilElementVisible(
    browser: WebdriverIO.Browser,
    selector: string,
    options: {
      maxSwipes?: number;
      pauseMs?: number;
      swipeDistance?: number;
    } = {},
  ): Promise<boolean> {
    const maxSwipes = options.maxSwipes ?? 8;
    const pauseMs = options.pauseMs ?? 600;
    const swipeDistance = options.swipeDistance ?? 0.55;

    if (await this.isElementDisplayed(browser, selector)) {
      return true;
    }

    const caps: any = browser.capabilities || {};
    const platform = (caps.platformName || caps.platform || '').toString().toLowerCase();
    const accessibilityId = selector.startsWith('~') ? selector.slice(1) : '';

    if (platform === 'android' && accessibilityId) {
      const scrolled = await this.androidScrollToAccessibilityId(browser, accessibilityId);
      if (scrolled || await this.isElementDisplayed(browser, selector)) {
        console.log(`✓ Nav link visible after UiScrollable: ~${accessibilityId}`);
        return true;
      }
    }

    for (let i = 0; i < maxSwipes; i++) {
      await this.swipe(browser, 'up', swipeDistance);
      await browser.pause(pauseMs);
      if (await this.isElementDisplayed(browser, selector)) {
        console.log(`✓ Element visible after ${i + 1} swipe(s): ${selector}`);
        return true;
      }
    }

    for (let i = 0; i < Math.min(maxSwipes, 4); i++) {
      await this.swipe(browser, 'down', swipeDistance);
      await browser.pause(pauseMs);
      if (await this.isElementDisplayed(browser, selector)) {
        console.log(`✓ Element visible after reverse swipe ${i + 1}: ${selector}`);
        return true;
      }
    }

    return false;
  }
  
  /**
   * Checks if element is visible
   * @param browser WebDriver browser instance
   * @param selector Element selector
   * @returns True if visible
   */
  async isElementVisible(browser: WebdriverIO.Browser, selector: string): Promise<boolean> {
    try {
      const element = await browser.$(selector);
      return await element.isDisplayed();
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Waits for element to be clickable
   * @param browser WebDriver browser instance
   * @param selector Element selector
   * @param timeout Timeout in milliseconds
   */
  async waitForClickable(browser: WebdriverIO.Browser, selector: string, timeout: number = 30000): Promise<void> {
    const element = await browser.$(selector);
    await element.waitForClickable({ timeout });
    console.log(`✓ Element clickable: ${selector}`);
  }
  
  /**
   * Gets element attribute
   * @param browser WebDriver browser instance
   * @param selector Element selector
   * @param attribute Attribute name
   * @returns Attribute value
   */
  async getAttribute(browser: WebdriverIO.Browser, selector: string, attribute: string): Promise<string | null> {
    const element = await browser.$(selector);
    await element.waitForDisplayed();
    return await element.getAttribute(attribute);
  }
  
  /**
   * Takes a screenshot of specific element
   * @param browser WebDriver browser instance
   * @param selector Element selector
   * @returns Screenshot buffer
   */
  async takeElementScreenshot(browser: WebdriverIO.Browser, selector: string): Promise<Buffer> {
    const element = await browser.$(selector);
    await element.waitForDisplayed();
    const screenshot = await element.takeScreenshot();
    return Buffer.from(screenshot, 'base64');
  }
  
  /**
   * Hides keyboard (mobile specific)
   * @param browser WebDriver browser instance
   */
  async hideKeyboard(browser: WebdriverIO.Browser): Promise<void> {
    try {
      await browser.hideKeyboard();
      console.log('✓ Keyboard hidden');
    } catch (error) {
      // Keyboard might not be visible, ignore error
    }
  }

  /**
   * Commits/dismisses the focused mobile soft keyboard after text entry.
   *
   * The RN style console evaluates when the keyboard action is submitted on
   * some devices, and the open keyboard can cover the output label on others.
   */
  async submitKeyboardAction(browser: WebdriverIO.Browser, context: string = 'input'): Promise<void> {
    const caps: any = browser.capabilities || {};
    const platform = (caps.platformName || caps.platform || '').toString().toLowerCase();

    if (platform === 'android') {
      try {
        await (browser as any).execute('mobile: performEditorAction', { action: 'done' });
        await browser.pause(500);
        console.log(`✓ Submitted Android keyboard action for ${context}`);
        return;
      } catch {
        // Fall back to the physical Enter key code.
      }

      try {
        await (browser as any).pressKeyCode(66);
        await browser.pause(500);
        console.log(`✓ Pressed Android Enter key for ${context}`);
        return;
      } catch {
        // Last resort below.
      }

      try {
        await browser.hideKeyboard();
        await browser.pause(500);
        console.log(`✓ Hid Android keyboard for ${context}`);
      } catch {
        console.warn(`   ⚠️ Could not dismiss Android keyboard for ${context}`);
      }
      return;
    }

    if (platform === 'ios') {
      const keyboardButtons = ['~Done', '~Return', '~OK', '~Ok', '~Go', '~Search'];
      for (const selector of keyboardButtons) {
        try {
          const button = await browser.$(selector);
          if (await button.isExisting() && await button.isDisplayed()) {
            await button.click();
            await browser.pause(500);
            console.log(`✓ Pressed iOS keyboard button ${selector} for ${context}`);
            return;
          }
        } catch {
          // Try the next keyboard button label.
        }
      }

      for (const keyName of ['Done', 'Return']) {
        try {
          await (browser as any).hideKeyboard('pressKey', keyName);
          await browser.pause(500);
          console.log(`✓ Hid iOS keyboard with ${keyName} for ${context}`);
          return;
        } catch {
          // Try the next iOS hide strategy.
        }
      }

      try {
        await browser.hideKeyboard();
        await browser.pause(500);
        console.log(`✓ Hid iOS keyboard for ${context}`);
      } catch {
        console.warn(`   ⚠️ Could not dismiss iOS keyboard for ${context}`);
      }
    }
  }
  
  /**
   * Gets current app package/bundle ID
   * @param browser WebDriver browser instance
   * @returns Package ID
   */
  async getCurrentPackage(browser: WebdriverIO.Browser): Promise<string> {
    const capabilities: any = browser.capabilities || {};
    const platform = (capabilities.platformName || '').toString().toLowerCase();

    if (platform === 'android') {
      try {
        const pkg = (await browser.execute('mobile: getCurrentPackage')) as string;
        if (pkg) return pkg;
      } catch {
        // fall through to caps
      }
      return (
        capabilities['appium:appPackage'] ||
        capabilities['appium:bundleId'] ||
        process.env.ANDROID_APP_PACKAGE ||
        ''
      );
    }

    if (platform === 'ios') {
      const fromCaps =
        capabilities['appium:bundleId'] ||
        process.env.IOS_BUNDLE_ID ||
        '';
      if (fromCaps) return fromCaps;

      try {
        const info = await browser.execute('mobile: activeAppInfo');
        if (info && typeof info === 'object') {
          const bundleId = (info as { bundleId?: string }).bundleId;
          if (bundleId) return bundleId;
        }
      } catch {
        // Session may be booting; activeAppInfo unavailable on some clouds
      }
    }

    return '';
  }
  
  /**
   * Resets app to initial state
   * @param browser WebDriver browser instance
   */
  async resetApp(browser: WebdriverIO.Browser): Promise<void> {
    await browser.execute('mobile: reset');
    console.log('✓ App reset');
  }
  
  /**
   * Launches app
   * @param browser WebDriver browser instance
   */
  async launchApp(browser: WebdriverIO.Browser): Promise<void> {
    await browser.launchApp();
    console.log('✓ App launched');
  }
  
  /**
   * Closes app
   * @param browser WebDriver browser instance
   */
  async closeApp(browser: WebdriverIO.Browser): Promise<void> {
    await browser.closeApp();
    console.log('✓ App closed');
  }
  
  /**
   * Builds Android UiSelector
   * @param attribute Attribute name (text, contentDescription, resourceId, className)
   * @param value Attribute value
   * @returns UiSelector string
   */
  buildAndroidSelector(attribute: string, value: string): string {
    return `android=new UiSelector().${attribute}("${value}")`;
  }
  
  /**
   * Builds iOS predicate string
   * @param attribute Attribute name (label, name, value, type)
   * @param value Attribute value
   * @returns Predicate string
   */
  buildIOSSelector(attribute: string, value: string): string {
    return `-ios predicate string:${attribute} == "${value}"`;
  }
  
  /**
   * Builds accessibility ID selector (cross-platform)
   * @param id Accessibility ID
   * @returns Accessibility ID selector
   */
  buildAccessibilitySelector(id: string): string {
    return `~${id}`;
  }
  
  /**
   * Waits for app to be ready
   * @param browser WebDriver browser instance
   * @param timeout Timeout in milliseconds
   */
  async waitForAppReady(browser: WebdriverIO.Browser, timeout: number = 30000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        // Check if any element is visible (app is loaded)
        const elements = await browser.$$('*');
        if (elements.length > 0) {
          console.log('✓ App ready');
          return;
        }
      } catch (error) {
        // Continue waiting
      }
      
      await browser.pause(1000);
    }
    
    throw new Error(`App not ready after ${timeout}ms`);
  }
}
