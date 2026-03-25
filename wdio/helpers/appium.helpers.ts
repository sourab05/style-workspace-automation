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
    const { width, height } = await browser.getWindowSize();
    const startX = width / 2;
    const startY = height * 0.8;
    const endY = height * (0.8 - distance);
    
    await browser.touchPerform([
      { action: 'press', options: { x: startX, y: startY } },
      { action: 'wait', options: { ms: 500 } },
      { action: 'moveTo', options: { x: startX, y: endY } },
      { action: 'release' }
    ]);
    
    console.log(`✓ Swiped up (distance: ${distance})`);
  }
  
  /**
   * Swipes down on screen
   * @param browser WebDriver browser instance
   * @param distance Swipe distance (0-1, default 0.5)
   */
  async swipeDown(browser: WebdriverIO.Browser, distance: number = 0.5): Promise<void> {
    const { width, height } = await browser.getWindowSize();
    const startX = width / 2;
    const startY = height * 0.2;
    const endY = height * (0.2 + distance);
    
    await browser.touchPerform([
      { action: 'press', options: { x: startX, y: startY } },
      { action: 'wait', options: { ms: 500 } },
      { action: 'moveTo', options: { x: startX, y: endY } },
      { action: 'release' }
    ]);
    
    console.log(`✓ Swiped down (distance: ${distance})`);
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
   * Gets current app package/bundle ID
   * @param browser WebDriver browser instance
   * @returns Package ID
   */
  async getCurrentPackage(browser: WebdriverIO.Browser): Promise<string> {
    const capabilities: any = browser.capabilities;
    const platform = capabilities.platformName?.toLowerCase();
    
    if (platform === 'android') {
      return await browser.execute('mobile: getCurrentPackage') as string;
    } else if (platform === 'ios') {
      return capabilities['appium:bundleId'] || '';
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
