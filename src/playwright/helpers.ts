import { Page, expect, test } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { ENV } from '../utils/env';
import { StudioClient } from '../api/studioClient';

function parseCookieHeader(header?: string): Array<{ name: string; value: string }> {
  if (!header) return [];
  return header
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((kv) => {
      const i = kv.indexOf('=');
      const name = i === -1 ? kv : kv.slice(0, i);
      const value = i === -1 ? '' : kv.slice(i + 1);
      return { name, value };
    })
    .filter((c) => !!c.name);
}

// Restored full debug getComputedCss()
export async function getComputedCss(page: Page, selector: string, cssProp: string) {
  // Force Playwright to treat selector as XPath, not CSS
  const xpathSelector = selector.startsWith('xpath=') ? selector : `xpath=${selector}`;

  await page.waitForSelector(xpathSelector, { timeout: 15000 });

  const result = await page.$eval(xpathSelector, (el, prop) => {
    const computed = getComputedStyle(el);
    const vars: Record<string,string> = {};

    for (let i = 0; i < computed.length; i++) {
      const n = computed[i];
      if (n.startsWith('--wm-')) vars[n] = computed.getPropertyValue(n).trim();
    }

    // --- DIAGNOSTIC LOGGING START ---
    console.log('[DIAG] Inline style:', el.getAttribute('style'));
    console.log('[DIAG] Computed background:', computed.getPropertyValue('background'));
    console.log('[DIAG] Computed background-color:', computed.getPropertyValue('background-color'));
    console.log('[DIAG] Computed color:', computed.getPropertyValue('color'));
    // list wm vars
    const diagVars: Record<string,string> = {};
    for (let i = 0; i < computed.length; i++) {
      const n = computed[i];
      if (n.startsWith('--wm-')) diagVars[n] = computed.getPropertyValue(n);
    }
    console.log('[DIAG] WM VARS:', diagVars);
    // --- DIAGNOSTIC LOGGING END ---

    // Convert camelCase → kebab-case
    const dashedProp = prop.replace(/([A-Z])/g, "-$1").toLowerCase();

    // Get raw computed value
    const raw = computed.getPropertyValue(dashedProp).trim();

    // Also get shorthand background if applicable
    let rawBackground = '';
    if (dashedProp === 'background-color' || dashedProp === 'background') {
      rawBackground = computed.getPropertyValue('background').trim();
    }

    // 1️⃣ Check inline style for var(--xxx)
    const inline = (el.getAttribute('style') || '').toLowerCase();
    // First check dashedProp
    let inlineRegex = new RegExp(`${dashedProp}\\s*:\\s*var\\((--[a-z0-9-]+)\\)`);
    let inlineMatch = inline.match(inlineRegex);
    // Then check shorthand background
    if (!inlineMatch && (dashedProp === 'background-color' || dashedProp === 'background')) {
      inlineRegex = new RegExp(`background\\s*:\\s*var\\((--[a-z0-9-]+)\\)`);
      inlineMatch = inline.match(inlineRegex);
    }
    if (inlineMatch) {
      const usedVar = inlineMatch[1];
      const resolved = computed.getPropertyValue(usedVar).trim();
      return { raw, resolved, vars, usedVar };
    }

    // 2️⃣ Scan WM/Studio stylesheets only (background + background-color)
    let usedVar = '';
    try {
      const sheets = Array.from(document.styleSheets).filter(s => (s.href || '').includes('wm') || (s.href || '').includes('style'));
      for (const sheet of sheets) {
        for (const rule of sheet.cssRules || []) {
          const styleRule = rule as CSSStyleRule;
          if (styleRule.selectorText && el.matches(styleRule.selectorText)) {
            // Check dashedProp first
            let ruleValue = styleRule.style?.getPropertyValue(dashedProp);
            if (!ruleValue && (dashedProp === 'background-color' || dashedProp === 'background')) {
              // Check shorthand background as fallback
              ruleValue = styleRule.style?.getPropertyValue('background');
            }
            if (ruleValue && ruleValue.includes('var(')) {
              const m = ruleValue.match(/var\((--[a-z0-9-]+)\)/);
              if (m) usedVar = m[1];
            }
          }
        }
      }
    } catch (e) {}

    if (usedVar) {
      const resolved = computed.getPropertyValue(usedVar).trim();
      return { raw, resolved, vars, usedVar };
    }

    // 1) if raw is var(--x) → resolve that specific var
    if (raw.startsWith('var(')) {
      const varName = raw.replace('var(', '').replace(')', '').trim();
      const resolved = computed.getPropertyValue(varName).trim() || raw;
      return { raw, resolved, vars, usedVar: varName };
    }

    // ❌ Removed legacy fallback guessing — ONLY use real var source
    // No variable guessing allowed

    // 3) fallback → raw
    return { raw, resolved: raw, vars, usedVar: '' };
  }, cssProp);


  console.log(`[CSS-DEBUG] Raw: ${result.raw}, Resolved: ${result.resolved}, Var: ${result.usedVar}`);
  return result.resolved;
}

export async function ensureAuthCookies(page: Page, targetBaseUrl: string, cookieHeader?: string) {
  if (!cookieHeader) {
    console.warn('⚠️ No cookie header provided to ensureAuthCookies');
    return;
  }

  const url = new URL(targetBaseUrl);
  const cookies = parseCookieHeader(cookieHeader).map((c) => ({
    name: c.name,
    value: c.value,
    domain: url.hostname,
    path: '/',
    httpOnly: false,
    secure: url.protocol === 'https:',
    sameSite: 'Lax' as const,
  }));

  if (cookies.length) {
    await page.context().addCookies(cookies);
    await page.waitForTimeout(500);
  } else {
    console.warn('⚠️ No cookies parsed from header');
  }
}

/**
 * Maps widget names from WIDGET_CONFIG to their actual Studio page names.
 * Only widgets whose page name differs from their config key need an entry here.
 */
const WIDGET_PAGE_NAME_MAP: Record<string, string> = {
  'formcontrols': 'formC',
  'form-wrapper': 'formC',
  'navbar': 'Main',
  'tabbar': 'Main',
  'picture': 'Picture',
  'carousel': 'Carousel',
  'button-group': 'ButtonGroup',
  'icon': 'Icon',
  'lottie': 'Lottie',
  'audio': 'Audio',
  'webview': 'Webview',
  'message': 'Message',
  'spinner': 'Spinner',
  'search': 'Search',
  'progress-bar': 'ProgressBar',
  'progress-circle': 'ProgressCircle',
  'dropdown-menu': 'DropdownMenu',
  'popover': 'Popover',
  'login': 'Login',
  'modal-dialog': 'ModalDialog',
  'fileupload': 'FileUpload',
  'calendar': 'Calendar',
  'slider': 'Slider',
  'rating': 'Rating',
  'currency': 'Currency',
  'select': 'Select',
  'panel-footer': 'panel',
  'camera': 'Camera',
  'datetime': 'Datetime',
  'video': 'Video',
};

/** Resolves the Studio page name for a given widget. */
function resolvePageName(widget: string): string {
  return WIDGET_PAGE_NAME_MAP[widget] || widget;
}

export async function gotoCanvas(page: Page, widgetPage: string = 'Main') {
  const pageName = resolvePageName(widgetPage);
  const navPath = `s/page/${pageName}?project-id=${ENV.projectId}`;
  console.log('canvas path:', navPath);
  await ensureAuthCookies(page, ENV.studioBaseUrl, ENV.studioCookie);
  const url = `${ENV.studioBaseUrl}${navPath}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  console.log('page.goto:', url);
  await waitForPageLoad(page);
}

export async function gotoPreview(page: Page, widgetPage: string = 'button', cachedDeployUrl?: string) {
  const pageName = resolvePageName(widgetPage);

  let basePreviewUrl = cachedDeployUrl;

  // Only call inplaceDeploy() if no cached URL was provided
  if (!basePreviewUrl) {
    const client = new StudioClient({
      baseUrl: ENV.studioBaseUrl,
      projectId: ENV.projectId,
      cookie: ENV.studioCookie,
    });
    basePreviewUrl = await client.inplaceDeploy();
    console.log('base previewUrl (fresh deploy):', basePreviewUrl);
  } else {
    console.log('base previewUrl (cached):', basePreviewUrl);
  }

  if (basePreviewUrl) {
    // Build the widget-specific RN preview URL, e.g.:
    // https://.../StyleWorkSpaceAutomation_master/rn-bundle/#/button
    const trimmed = basePreviewUrl.replace(/\/$/, '');
    const finalUrl = `${trimmed}/rn-bundle/#/${pageName}`;
    console.log('widget previewUrl:', finalUrl);

    await ensureAuthCookies(page, finalUrl, ENV.studioCookie);
    await page.goto(finalUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForPageLoad(page);
  }
}

export async function toHaveSnapshot(page: Page, name: string, baselineName?: string): Promise<{ imagesAreEqual: boolean; diffPixels?: number; totalPixels?: number }> {
  // Use generic baseline if provided, otherwise fallback to the unique name
  const effectiveBaselineName = baselineName || name;
  const { PNG } = require('pngjs');
  const pixelmatch = require('pixelmatch');

  // Ensure consistent viewport before taking screenshot
  await page.setViewportSize({ width: 1280, height: 720 });

  // Wait for stability
  await waitForPageLoad(page);

  // Create directory structure: base-image, actual-image, difference-image
  const screenshotsRoot = path.join(process.cwd(), 'screenshots');
  const baseImageDir = path.join(screenshotsRoot, 'base-image');
  const actualImageDir = path.join(screenshotsRoot, 'actual-image');
  const differenceImageDir = path.join(screenshotsRoot, 'difference-image');

  // Ensure all directories exist
  [baseImageDir, actualImageDir, differenceImageDir].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  const baseImagePath = path.join(baseImageDir, `${effectiveBaselineName}.png`);
  const actualImagePath = path.join(actualImageDir, `${name}.png`);
  const diffImagePath = path.join(differenceImageDir, `${name}.png`);

  // **CRITICAL CHANGE**: Use standard toHaveScreenshot() to trigger Playwright's visual diff UI
  // We EXPECT this to fail (images should differ), so we'll catch the error
  let visualDiffFailed = false;
  let diffPixels = 0;
  let totalPixels = 0;

  try {
    // **SAVE ACTUAL SCREENSHOT** for manual comparison logic below
    await page.screenshot({ path: actualImagePath, fullPage: true });

    // This will trigger Playwright's built-in visual comparison slider in the report
    await expect(page).toHaveScreenshot(`${effectiveBaselineName}.png`, {
      animations: 'disabled',
      maxDiffPixelRatio: 0.01,
      threshold: 0.1,
      fullPage: true,
    });

    // If we reach here, images matched (unexpected for our use case)
    console.log(`🔴 Screenshot MATCHED baseline (expected to DIFFER) → This indicates the token had NO visual effect`);
    visualDiffFailed = false; // Images matched = condition 1 FAILED

  } catch (err: any) {
    // Expected path: images differ, Playwright throws an error
    // This is what we WANT in this framework
    console.log(`🟢 Screenshot DIFFERS from baseline (as expected) → Visual change confirmed`);
    visualDiffFailed = true; // Images differ = condition 1 PASSED

    // Extract diff stats from Playwright's error if available
    const errorMessage = err.message || '';
    const pixelMatch = errorMessage.match(/(\d+) pixels? \(ratio ([\d.]+)/);
    if (pixelMatch) {
      diffPixels = parseInt(pixelMatch[1], 10);
      console.log(`   📊 Diff detected: ${diffPixels} pixels different`);
    }
  }

  // Performing additional manual comparison for detailed stats
  if (fs.existsSync(baseImagePath) && fs.existsSync(actualImagePath)) {
    try {
      const PNG_CLASS = require('pngjs').PNG;
      const img1 = PNG_CLASS.sync.read(fs.readFileSync(baseImagePath));
      const img2 = PNG_CLASS.sync.read(fs.readFileSync(actualImagePath));

      const width = Math.max(img1.width, img2.width);
      const height = Math.max(img1.height, img2.height);
      totalPixels = width * height;

      // Create padded buffers if dimensions mismatch
      let finalImg1 = img1;
      let finalImg2 = img2;

      if (img1.width !== img2.width || img1.height !== img2.height) {
        console.warn(`⚠️  Dimension mismatch: ${img1.width}x${img1.height} vs ${img2.width}x${img2.height}`);

        const padImage = (source: any, w: number, h: number) => {
          const padded = new PNG_CLASS({ width: w, height: h });
          // Ensure we have a PNG instance with methods
          const srcInstance = (typeof source.bitblt === 'function') ? source : new PNG_CLASS({ width: source.width, height: source.height });
          if (srcInstance !== source) srcInstance.data = source.data;

          srcInstance.bitblt(padded, 0, 0, source.width, source.height, 0, 0);
          return padded;
        };

        if (img1.width !== width || img1.height !== height) finalImg1 = padImage(img1, width, height);
        if (img2.width !== width || img2.height !== height) finalImg2 = padImage(img2, width, height);
      }

      const diff = new PNG({ width, height });
      const numDiffPixels = pixelmatch(
        finalImg1.data,
        finalImg2.data,
        diff.data,
        width,
        height,
        { threshold: 0.1 }
      );

      diffPixels = numDiffPixels;
      const diffPercent = ((numDiffPixels / totalPixels) * 100).toFixed(2);

      // Attach detailed diff stats to report
      await test.info().attach(`diff-analysis-${name}.txt`, {
        body: `Visual Comparison Analysis\n` +
          `==========================\n` +
          `Baseline: ${effectiveBaselineName}.png\n` +
          `Actual: ${name}.png\n\n` +
          `Diff Pixels: ${numDiffPixels}\n` +
          `Total Pixels: ${totalPixels}\n` +
          `Diff Percentage: ${diffPercent}%\n\n` +
          `Result: ${visualDiffFailed ? '✅ DIFFERS (as expected)' : '❌ MATCHED (unexpected)'}`,
        contentType: 'text/plain'
      });

      console.log(`   📊 Manual comparison: ${numDiffPixels} pixels different (${diffPercent}%)`);

    } catch (err: any) {
      console.error(`❌ Error during manual comparison:`, err.message);
    }
  } else {
    console.log(`📝 No baseline found for "${effectiveBaselineName}". Baseline will be created on first run.`);
  }

  // Return result: imagesAreEqual = false means they differ (which is what we want)
  return {
    imagesAreEqual: !visualDiffFailed,
    diffPixels,
    totalPixels
  };
}

export async function saveCssMetrics(
  page: Page,
  selector: string,
  properties: string[],
  outName: string
) {
  await page.waitForSelector(selector, { state: 'visible' });
  const metrics = await page.$eval(
    selector,
    (el, props) => {
      const computed = getComputedStyle(el as Element);
      const obj: Record<string, string> = {};
      (props as string[]).forEach((p) => (obj[p] = computed.getPropertyValue(p)));
      return obj;
    },
    properties
  );
  const dir = path.join(process.cwd(), 'artifacts', 'css');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${outName}.json`);
  fs.writeFileSync(file, JSON.stringify(metrics, null, 2));
  return file;
}
export async function waitForPageLoad(page: Page) {
  // Use a shorter timeout for networkidle as a best-effort stabilization
  try {
    await page.waitForLoadState('networkidle', { timeout: 7000 });
  } catch (e) {
    console.warn('⚠️  networkidle timed out, proceeding with domcontentloaded');
  }

  await page.waitForLoadState('domcontentloaded');

  // Wait for fonts to load
  await page.evaluate(() => {
    if ('fonts' in document) {
      return (document as any).fonts.ready;
    }
  });

  // Brief wait for animations to settle; kept short since this is called multiple
  // times per test and each call adds to the cumulative time budget.
  await page.waitForTimeout(1000);
}

/**
 * Waits for a selector with retry logic.
 * On each failed attempt, optionally reloads the page before retrying.
 */
export async function waitForSelectorWithRetry(
  page: Page,
  selector: string,
  options: { timeout?: number; retries?: number; reloadOnRetry?: boolean } = {}
): Promise<void> {
  const { timeout = 15000, retries = 3, reloadOnRetry = true } = options;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await page.waitForSelector(selector, { state: 'visible', timeout });
      return;
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`   ⚠️ Selector not found (attempt ${attempt}/${retries}), retrying...`);
      if (reloadOnRetry) {
        await page.reload();
        await waitForPageLoad(page);
      }
    }
  }
}
