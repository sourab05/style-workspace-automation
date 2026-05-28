import '../../src/utils/bootstrap-env';

/**
 * Returns true when tests/builds should run against local emulators/devices
 * instead of BrowserStack. Controlled via RUN_LOCAL env var.
 */
export function isLocalEnv(): boolean {
  return process.env.RUN_LOCAL === 'true';
}

/** True when tests target BrowserStack (not local Appium). */
export function isBrowserStackEnv(): boolean {
  return !isLocalEnv();
}

function isTruthyEnv(name: string): boolean {
  const v = process.env[name];
  return v === 'true' || v === '1';
}

/**
 * When true, skips all screenshot work:
 * - Section-1 baseline vs actual screenshot tests in mobile specs
 * - Per-token takeScreenshot() in MobileVerificationHelper
 *
 * Also honored by skipBaselineScreenshot() unless SKIP_BASELINE_SCREENSHOT is set alone.
 */
export function shouldSkipVisualVerification(): boolean {
  return isTruthyEnv('SKIP_VISUAL_VERIFICATION');
}

/** Alias for shouldSkipVisualVerification (per-token screenshots) */
export function skipVisualVerification(): boolean {
  return shouldSkipVisualVerification();
}

/**
 * Skip section-1 baseline vs actual screenshot tests (baseline APK + page screenshots).
 * True when SKIP_VISUAL_VERIFICATION or SKIP_BASELINE_SCREENSHOT is set.
 */
export function skipBaselineScreenshot(): boolean {
  return shouldSkipVisualVerification() || isTruthyEnv('SKIP_BASELINE_SCREENSHOT');
}

/**
 * When true (default), `MobileWidgetPage.waitForWidget` will not throw if the widget readiness
 * sentinel never appears after one restart + retry — RN style / token verification still runs.
 * Set MOBILE_STRICT_WIDGET_WAIT=true to restore fail-fast behavior on sentinel timeout.
 */
export function shouldRelaxWidgetWait(): boolean {
  return !isTruthyEnv('MOBILE_STRICT_WIDGET_WAIT');
}
