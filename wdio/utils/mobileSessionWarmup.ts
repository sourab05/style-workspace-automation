import { MobileWidgetPage } from '../pages/MobileWidget.page';
import type { Widget } from '../../src/matrix/widgets';

type Browser = WebdriverIO.Browser;

/**
 * Opens a mobile session, navigates to the widget, and warms the styles cache.
 * Deletes the session if warmup fails so later tests do not reuse a broken browser.
 */
export async function warmupMobileTokenSession(
  createSession: () => Promise<Browser>,
  widgetKey: Widget,
  variantName: string,
): Promise<Browser> {
  const browser = await createSession();
  const widgetPage = new MobileWidgetPage();
  try {
    await widgetPage.navigateToWidget(browser, widgetKey);
    await widgetPage.waitForWidget(browser, widgetKey);
    await widgetPage.warmStylesCache(browser, widgetKey, variantName);
    return browser;
  } catch (err) {
    try {
      await browser.deleteSession();
    } catch {
      // Session may already be terminated.
    }
    throw err;
  }
}
