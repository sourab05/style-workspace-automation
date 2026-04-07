/**
 * Scrape Token Slots from WaveMaker Style Workspace
 *
 * Navigates to each widget's style page in Studio, extracts all token slot
 * definitions (token types + properties), and writes them to a separate file.
 *
 * The source of truth (wdio/config/widget-token-slots.json) is NEVER modified
 * directly. Use --approve to merge the scraped file into the source of truth
 * after manual review.
 *
 * Usage:
 *   npx ts-node scripts/scrape-token-slots.ts                           # scrape all widgets → reports/scraped-token-slots.json
 *   npx ts-node scripts/scrape-token-slots.ts --widgets button,popover  # scrape specific widgets
 *   npx ts-node scripts/scrape-token-slots.ts --explore popover         # explore DOM of one widget
 *   npx ts-node scripts/scrape-token-slots.ts --diff                    # show diff between scraped and source of truth
 *   npx ts-node scripts/scrape-token-slots.ts --approve                 # merge scraped into source of truth
 */

import { chromium, Page, BrowserContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { ENV } from '../src/utils/env';
import { googleBrowserLogin } from '../src/auth/googleAuth';
import { WIDGET_CONFIG, Widget } from '../src/matrix/widgets';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PROJECT_ID = ENV.projectId;
const BASE_URL = ENV.studioBaseUrl.replace(/\/$/, '');
const STYLE_PATH = '/s/style/widgets';
const OUT_DIR = path.join(process.cwd(), 'reports');
const OUT_FILE = path.join(OUT_DIR, 'scraped-token-slots.json');
const SOURCE_OF_TRUTH = path.join(process.cwd(), 'wdio', 'config', 'widget-token-slots.json');
const EXPLORE_DIR = path.join(process.cwd(), 'artifacts', 'style-exploration');
const CACHE_DIR = path.join(process.cwd(), '.test-cache');

const ALL_WIDGETS = Object.keys(WIDGET_CONFIG) as Widget[];

// ---------------------------------------------------------------------------
// Derive appearance:variant combos per widget from WIDGET_CONFIG
// ---------------------------------------------------------------------------

interface VariantCombo {
  appearance: string;
  variant: string;
  urlParam: string; // "appearance:variant" for the URL query param
}

function getVariantCombos(widget: string): VariantCombo[] {
  const config = WIDGET_CONFIG[widget as Widget];
  if (!config) return [{ appearance: 'standard', variant: 'standard', urlParam: 'standard:standard' }];

  const combos: VariantCombo[] = [];
  for (const appearance of config.appearances) {
    const variants = config.variants[appearance];
    if (variants && variants.length > 0) {
      for (const variant of variants) {
        combos.push({ appearance, variant, urlParam: `${appearance}:${variant}` });
      }
    } else {
      combos.push({ appearance, variant: 'standard', urlParam: `${appearance}:standard` });
    }
  }

  return combos.length > 0
    ? combos
    : [{ appearance: 'standard', variant: 'standard', urlParam: 'standard:standard' }];
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TokenSlot {
  tokenType: string;
  properties: string[];
}

interface DiscoveredConfig {
  appearances: string[];
  variants: Record<string, string[]>;
  states: string[];
}

interface WidgetTokenSlots {
  tokenSlots: TokenSlot[];
  variantSlots?: Record<string, TokenSlot[]>;
  discoveredConfig?: DiscoveredConfig;
}

interface ScrapedResult {
  [widget: string]: WidgetTokenSlots;
}

// ---------------------------------------------------------------------------
// CLI arg parsing
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  let mode: 'scrape' | 'explore' | 'diff' | 'approve' = 'scrape';
  let widgets: string[] = ALL_WIDGETS;
  let exploreWidget = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--explore') {
      mode = 'explore';
      exploreWidget = args[i + 1] || 'button';
      i++;
    } else if (args[i] === '--widgets') {
      widgets = (args[i + 1] || '').split(',').map((w) => w.trim()).filter(Boolean);
      i++;
    } else if (args[i] === '--diff') {
      mode = 'diff';
    } else if (args[i] === '--approve') {
      mode = 'approve';
    }
  }

  return { mode, widgets, exploreWidget };
}

// ---------------------------------------------------------------------------
// Scroll the right-side token slots panel to load all sections
// ---------------------------------------------------------------------------

async function scrollTokenPanel(page: Page): Promise<{ found: boolean; scrolled: number; selector: string }> {
  return page.evaluate(async () => {
    // The token slots panel uses div.category-list as the container for all
    // styleConfigCard sections. Its parent (or itself) is the scrollable element.
    // Walk up from .category-list to find the nearest scrollable ancestor.
    const categoryList = document.querySelector('.category-list');
    let panel: Element | null = null;
    let usedSelector = '';

    if (categoryList) {
      // Check if category-list itself is scrollable
      let el: Element | null = categoryList;
      while (el && el !== document.body) {
        if (el.scrollHeight > el.clientHeight + 10) {
          panel = el;
          const tag = el.tagName.toLowerCase();
          const cls = el.className ? '.' + String(el.className).split(/\s+/).slice(0, 3).join('.') : '';
          usedSelector = `${tag}${cls}`;
          break;
        }
        el = el.parentElement;
      }
    }

    // Fallback: find any scrollable element on the right half of the screen
    if (!panel) {
      const midX = window.innerWidth / 2;
      const all = Array.from(document.querySelectorAll('*'));
      const candidates: { el: Element; diff: number }[] = [];
      for (let i = 0; i < all.length; i++) {
        const el = all[i] as HTMLElement;
        const sh = el.scrollHeight;
        const ch = el.clientHeight;
        if (sh <= ch + 10 || ch < 50) continue;
        const style = window.getComputedStyle(el);
        if (style.overflowY === 'visible') continue;
        const rect = el.getBoundingClientRect();
        if (rect.left < midX || rect.width < 80) continue;
        candidates.push({ el, diff: sh - ch });
      }
      if (candidates.length > 0) {
        candidates.sort((a, b) => b.diff - a.diff);
        panel = candidates[0].el;
        const tag = panel.tagName.toLowerCase();
        const cls = panel.className ? '.' + String(panel.className).split(/\s+/).slice(0, 3).join('.') : '';
        usedSelector = `${tag}${cls} (fallback)`;
      }
    }

    if (!panel) return { found: false, scrolled: 0, selector: '' };

    const startScrollTop = panel.scrollTop;
    const step = Math.max(panel.clientHeight - 50, 200);
    let lastHeight = panel.scrollHeight;
    let attempts = 0;

    while (attempts < 40) {
      panel.scrollTop += step;
      await new Promise((r) => setTimeout(r, 350));
      if (panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 5) {
        await new Promise((r) => setTimeout(r, 600));
        if (panel.scrollHeight === lastHeight) break;
        lastHeight = panel.scrollHeight;
      }
      attempts++;
    }

    const totalScrolled = panel.scrollTop - startScrollTop;

    // Scroll back to top
    panel.scrollTop = 0;
    await new Promise((r) => setTimeout(r, 400));

    return { found: true, scrolled: totalScrolled, selector: usedSelector };
  });
}

// ---------------------------------------------------------------------------
// Build the style workspace URL for a widget + variant
// ---------------------------------------------------------------------------

// Config key → URL slug mapping for widgets where the config key differs from the URL path.
// Most widgets use the config key directly (e.g. "popover" → /widgets/popover).
const WIDGET_URL_SLUG: Record<string, string> = {
  'formcontrols': 'form-controls',
};

function getUrlSlug(widget: string): string {
  return WIDGET_URL_SLUG[widget] || widget;
}

function buildWidgetUrl(widget: string, variantParam: string): string {
  const slug = getUrlSlug(widget);
  return `${BASE_URL}${STYLE_PATH}/${slug}?project-id=${PROJECT_ID}&variant=${variantParam}`;
}

// ---------------------------------------------------------------------------
// Discover available variants and states from the Style Workspace UI
// ---------------------------------------------------------------------------

async function discoverWidgetConfig(page: Page, widget: string): Promise<DiscoveredConfig> {
  const slug = getUrlSlug(widget);
  const url = `${BASE_URL}${STYLE_PATH}/${slug}?project-id=${PROJECT_ID}`;

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
    await page.waitForTimeout(3000);
  } catch (e: any) {
    console.warn(`[Discover] [${widget}] Navigation warning: ${e.message}`);
  }

  // ── Variant discovery ─────────────────────────────────────────────────
  // The center panel shows ALL appearances and their variants as a visual grid.
  // Each appearance has a heading (e.g. "filled", "outlined", "standard") and
  // rows beneath it for each variant (e.g. "default", "primary", "secondary").
  // This is the most reliable source — no dropdown interaction needed.
  //
  // Additionally we open the Variant typeahead dropdown (wms-typeahead with
  // groupby="category") and read its grouped list items as a secondary source.

  // Open the variant typeahead dropdown and read grouped items.
  //
  // DOM structure (from inspecting the page):
  //   <wms-typeahead name="varaint-options-list" groupby="category">
  //     <input class="typeahead-input" placeholder="Select Variant">
  //     <button class="typeahead-expand-btn ng-hide">  ← hidden when no value
  //     <button class="typeahead-clear-btn">           ← visible when value set
  //
  // To open: click the <input> field, which triggers the dropdown.
  // The dropdown is a scrollable <ul> with <li> for group headers + items.
  // Group headers (appearances like "filled", "outlined") have a distinct class.
  // Items (variants like "default", "primary") are the clickable options.

  let dropdownData: { groups: { header: string; items: string[] }[]; allItems: string[]; rawHtml: string } = {
    groups: [],
    allItems: [],
    rawHtml: '',
  };

  try {
    const variantInput = page.locator(
      'wms-typeahead[name="varaint-options-list"] input.typeahead-input'
    );

    if (await variantInput.count() > 0) {
      // Clear any existing value first, then click to open the full list
      const clearBtn = page.locator(
        'wms-typeahead[name="varaint-options-list"] button.typeahead-clear-btn'
      );
      if (await clearBtn.isVisible().catch(() => false)) {
        await clearBtn.click();
        await page.waitForTimeout(500);
      }

      // Click the input to open the dropdown
      await variantInput.click();
      await page.waitForTimeout(1500);

      // The ng-bootstrap typeahead renders the dropdown as a SEPARATE element
      // outside the wms-typeahead container (appended to body).
      // The input's aria-owns attribute points to the dropdown's id (e.g. "ngb-typeahead-0").
      // Find it using that reference or by tag name.

      // Scroll the dropdown <ul> to load all items (it's scrollable)
      await page.evaluate(async () => {
        const input = document.querySelector(
          'wms-typeahead[name="varaint-options-list"] input.typeahead-input'
        ) as HTMLInputElement | null;
        const dropdownId = input?.getAttribute('aria-owns') || '';
        const container = dropdownId
          ? document.getElementById(dropdownId)
          : document.querySelector('typeahead-container');
        if (!container) return;

        const ul = container.querySelector('ul') || container;
        for (let i = 0; i < 10; i++) {
          ul.scrollTop = ul.scrollHeight;
          await new Promise(r => setTimeout(r, 300));
          if (ul.scrollTop + ul.clientHeight >= ul.scrollHeight - 5) break;
        }
        ul.scrollTop = 0;
        await new Promise(r => setTimeout(r, 300));
      });

      // Read all items from the dropdown.
      //
      // Actual DOM structure (from raw HTML dump):
      //   <typeahead-container id="ngb-typeahead-0">
      //     <ul class="wms-typeahead-dropdown variant-dropdown">
      //       <li class="uib-typeahead-match">
      //         <div class="typeahead-group-header">filled</div>   ← group header
      //       </li>
      //       <li class="uib-typeahead-match">
      //         <a><span title="default">default</span></a>       ← variant item
      //       </li>
      //       ...
      //     </ul>
      //   </typeahead-container>

      dropdownData = await page.evaluate(() => {
        const groups: { header: string; items: string[] }[] = [];
        const allItems: string[] = [];

        const input = document.querySelector(
          'wms-typeahead[name="varaint-options-list"] input.typeahead-input'
        ) as HTMLInputElement | null;
        const dropdownId = input?.getAttribute('aria-owns') || '';
        const dropdown = dropdownId
          ? document.getElementById(dropdownId)
          : document.querySelector('typeahead-container');

        let rawHtml = '';
        if (!dropdown) {
          return { groups, allItems, rawHtml: `dropdown not found (aria-owns="${dropdownId}")` };
        }

        rawHtml = dropdown.outerHTML.slice(0, 8000);

        // Get the <ul> inside the dropdown container
        const ul = dropdown.querySelector('ul');
        if (!ul) return { groups, allItems, rawHtml };

        // Iterate <li class="uib-typeahead-match"> elements
        const allLis = ul.querySelectorAll('li.uib-typeahead-match');
        allLis.forEach(li => {
          // Group header: <li> contains <div class="typeahead-group-header">
          const headerDiv = li.querySelector('div.typeahead-group-header');
          if (headerDiv) {
            const headerText = (headerDiv.textContent || '').trim();
            if (headerText) {
              groups.push({ header: headerText, items: [] });
            }
            return;
          }

          // Variant item: <li> contains <a> > <span title="variant-name">
          const link = li.querySelector('a');
          if (link) {
            const span = link.querySelector('span[title]');
            const variantName = span
              ? (span.getAttribute('title') || span.textContent || '').trim()
              : (link.textContent || '').trim();
            if (variantName) {
              allItems.push(variantName);
              if (groups.length > 0) {
                groups[groups.length - 1].items.push(variantName);
              } else {
                groups.push({ header: '__ungrouped__', items: [variantName] });
              }
            }
          }
        });

        return { groups, allItems, rawHtml };
      });

      // Close the dropdown
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  } catch (e: any) {
    console.warn(`[Discover] [${widget}] Variant dropdown error: ${e.message}`);
  }

  console.log(`[Discover] [${widget}] Dropdown groups: ${JSON.stringify(dropdownData.groups)}`);
  console.log(`[Discover] [${widget}] Dropdown all items: ${JSON.stringify(dropdownData.allItems)}`);
  if (dropdownData.allItems.length === 0) {
    console.log(`[Discover] [${widget}] Dropdown raw HTML:\n${dropdownData.rawHtml.slice(0, 3000)}`);
  }

  // ── Build appearances + variants from dropdown data ────────────────────
  const appearances: string[] = [];
  const variants: Record<string, string[]> = {};

  if (dropdownData.groups.length > 0) {
    // Grouped dropdown — each group header is an appearance, items are variants
    for (const g of dropdownData.groups) {
      const app = g.header.toLowerCase().trim();
      if (!app || app === '__ungrouped__') continue;
      if (appearances.indexOf(app) === -1) appearances.push(app);
      if (!variants[app]) variants[app] = [];
      for (const item of g.items) {
        const v = item.toLowerCase().trim();
        if (v && variants[app].indexOf(v) === -1) variants[app].push(v);
      }
    }
  }

  // If groups parsing failed, try reading items as "appearance:variant" format
  if (appearances.length === 0 && dropdownData.allItems.length > 0) {
    for (const item of dropdownData.allItems) {
      const cleaned = item.replace(/\s+/g, '').trim();
      if (cleaned.indexOf(':') !== -1) {
        const parts = cleaned.split(':');
        if (parts.length === 2) {
          const [app, v] = parts;
          if (appearances.indexOf(app) === -1) appearances.push(app);
          if (!variants[app]) variants[app] = [];
          if (variants[app].indexOf(v) === -1) variants[app].push(v);
        }
      }
    }
  }

  // ── State discovery ────────────────────────────────────────────────────
  // The State <select class="variant-state"> only populates after a variant
  // is selected. We need to select a variant first, then read the states.

  // Build the first variant combo so we can select it
  let firstVariantParam = 'standard:standard';
  if (appearances.length > 0) {
    const firstApp = appearances[0];
    const firstVar = (variants[firstApp] && variants[firstApp][0]) || 'standard';
    firstVariantParam = `${firstApp}:${firstVar}`;
  }

  // Navigate to the widget page with a specific variant selected
  // This ensures the token panel and state dropdown are loaded
  try {
    const variantUrl = buildWidgetUrl(widget, firstVariantParam);
    await page.goto(variantUrl, { waitUntil: 'networkidle', timeout: 60_000 });
    await page.waitForTimeout(3000);
  } catch (e: any) {
    console.warn(`[Discover] [${widget}] State nav warning: ${e.message}`);
  }

  const stateOptions = await page.evaluate(() => {
    const sel = document.querySelector('select.variant-state');
    if (!sel) return [] as string[];
    return Array.from(sel.querySelectorAll('option'))
      .map(o => (o.value || o.textContent || '').trim())
      .filter(Boolean);
  });

  console.log(`[Discover] [${widget}] Raw state options: ${JSON.stringify(stateOptions)}`);

  const states = stateOptions
    .map(s => s.toLowerCase().trim())
    .filter(s => s && s !== 'select' && s !== 'choose');

  if (states.length === 0) states.push('default');

  if (appearances.length === 0) {
    appearances.push('standard');
    variants['standard'] = ['standard'];
  }

  return { appearances, variants, states };
}

// ---------------------------------------------------------------------------
// Login and get an authenticated browser context
// ---------------------------------------------------------------------------

async function getAuthenticatedContext(): Promise<{ context: BrowserContext; page: Page }> {
  const profileDir = path.join(CACHE_DIR, 'google-browser-profile');
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
    ],
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
  });

  const page = context.pages()[0] || (await context.newPage());

  if (ENV.isPlatformDB) {
    console.log('[Scraper] Authenticating via Platform DB REST login...');
    const { StudioClient } = await import('../src/api/studioClient');
    const client = new StudioClient({ baseUrl: BASE_URL, projectId: PROJECT_ID });
    const cookie = await client.loginWithPlatformDB(
      ENV.studioUsername,
      ENV.studioPassword
    );

    const baseUrlObj = new URL(BASE_URL);
    const cookieParts = cookie.split('; ');
    for (const part of cookieParts) {
      const [name, value] = part.split('=');
      if (name && value) {
        await context.addCookies([{
          name: name.trim(),
          value: value.trim(),
          domain: baseUrlObj.hostname,
          path: '/',
        }]);
      }
    }
  } else {
    console.log('[Scraper] Authenticating via Google OAuth...');
    const authResult = await googleBrowserLogin({ page, headless: false });
    if (!authResult.cookieHeader) {
      throw new Error('Failed to authenticate');
    }
  }

  console.log('[Scraper] Authentication successful');
  return { context, page };
}

// ---------------------------------------------------------------------------
// Explore mode: screenshot + DOM dump for a single widget
// ---------------------------------------------------------------------------

async function exploreWidget(page: Page, widget: string): Promise<void> {
  if (!fs.existsSync(EXPLORE_DIR)) {
    fs.mkdirSync(EXPLORE_DIR, { recursive: true });
  }

  // Discover variants/states from the UI first
  console.log(`\n[Explore] Discovering variants/states for "${widget}" from UI...`);
  const discoveredConfig = await discoverWidgetConfig(page, widget);
  const variantList = discoveredConfig.appearances
    .map(app => (discoveredConfig.variants[app] || []).map(v => `${app}:${v}`))
    .reduce((a, b) => a.concat(b), []);
  console.log(`[Explore] Discovered ${variantList.length} variant(s):`);
  variantList.forEach((v) => console.log(`  - ${v}`));
  console.log(`[Explore] Discovered ${discoveredConfig.states.length} state(s): ${discoveredConfig.states.join(', ')}`);

  const firstVariant = variantList[0] || 'standard:standard';
  const url = buildWidgetUrl(widget, firstVariant);
  console.log(`\n[Explore] Navigating to ${widget} (${firstVariant}): ${url}`);

  const apiCalls: { url: string; method: string; status?: number }[] = [];
  page.on('response', (resp) => {
    const reqUrl = resp.url();
    if (reqUrl.includes('/studio/') || reqUrl.includes('/style') || reqUrl.includes('/design-token')) {
      apiCalls.push({ url: reqUrl, method: resp.request().method(), status: resp.status() });
    }
  });

  await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForTimeout(5000);

  // Scroll the right panel to load all lazy content
  const scrollResult = await scrollTokenPanel(page);
  if (scrollResult.found) {
    console.log(`[Explore] Scrolled token panel (${scrollResult.scrolled}px) to load all sections`);
  } else {
    console.log('[Explore] WARNING: Could not find scrollable token panel — content may be incomplete');
  }

  // Screenshot (top of page)
  const ssPath = path.join(EXPLORE_DIR, `${widget}-full.png`);
  await page.screenshot({ path: ssPath, fullPage: true });
  console.log(`[Explore] Screenshot saved: ${ssPath}`);

  // Take a second screenshot with the token panel scrolled to the bottom
  await page.evaluate(async () => {
    // Walk up from .category-list to find the scrollable ancestor
    let el: Element | null = document.querySelector('.category-list');
    while (el && el !== document.body) {
      if (el.scrollHeight > el.clientHeight + 10) {
        el.scrollTop = el.scrollHeight;
        await new Promise((r) => setTimeout(r, 600));
        return;
      }
      el = el.parentElement;
    }
  });
  const ssBottom = path.join(EXPLORE_DIR, `${widget}-scrolled-bottom.png`);
  await page.screenshot({ path: ssBottom, fullPage: true });
  console.log(`[Explore] Bottom screenshot saved: ${ssBottom}`);

  // Scroll back to top
  await page.evaluate(() => {
    let el: Element | null = document.querySelector('.category-list');
    while (el && el !== document.body) {
      if (el.scrollHeight > el.clientHeight + 10) {
        el.scrollTop = 0;
        return;
      }
      el = el.parentElement;
    }
  });

  // Dump the page HTML structure (just the main content area)
  const domDump = await page.evaluate(() => {
    function dumpEl(el: Element, depth: number, maxDepth: number): string {
      if (depth > maxDepth) return '';
      const tag = el.tagName.toLowerCase();
      const cls = el.className ? `.${String(el.className).split(/\s+/).join('.')}` : '';
      const id = el.id ? `#${el.id}` : '';
      const text = el.childNodes.length === 1 && el.childNodes[0].nodeType === 3
        ? ` "${(el.textContent || '').trim().slice(0, 60)}"`
        : '';
      const indent = '  '.repeat(depth);
      let result = `${indent}<${tag}${id}${cls}>${text}\n`;
      for (let c = 0; c < el.children.length; c++) {
        result += dumpEl(el.children[c], depth + 1, maxDepth);
      }
      return result;
    }

    const root = document.querySelector('main') || document.querySelector('#root') ||
                 document.querySelector('.app-content') || document.body;
    return dumpEl(root!, 0, 8);
  });

  const domPath = path.join(EXPLORE_DIR, `${widget}-dom.txt`);
  fs.writeFileSync(domPath, domDump);
  console.log(`[Explore] DOM dump saved: ${domPath}`);

  // Dump all visible text grouped by sections
  const textDump = await page.evaluate(() => {
    const sections: { heading: string; items: string[] }[] = [];
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6, [class*="heading"], [class*="title"], [class*="label"]');
    headings.forEach((h) => {
      const text = (h.textContent || '').trim();
      if (text) sections.push({ heading: text, items: [] });
    });

    const allText = document.body.innerText;
    return { sections: sections.map((s) => s.heading), fullText: allText.slice(0, 20000) };
  });

  const textPath = path.join(EXPLORE_DIR, `${widget}-text.txt`);
  fs.writeFileSync(textPath, textDump.fullText);
  console.log(`[Explore] Page text saved: ${textPath}`);

  // Dump intercepted API calls
  const apiPath = path.join(EXPLORE_DIR, `${widget}-api-calls.json`);
  fs.writeFileSync(apiPath, JSON.stringify(apiCalls, null, 2));
  console.log(`[Explore] API calls (${apiCalls.length}) saved: ${apiPath}`);

  // Try to find token-slot-like elements
  const slotData = await page.evaluate(() => {
    const result: { selector: string; text: string; count: number }[] = [];

    const candidates = [
      '[class*="token"]', '[class*="slot"]', '[class*="property"]',
      '[class*="Token"]', '[class*="Slot"]', '[class*="Property"]',
      '[data-token]', '[data-slot]', '[data-property]',
      'tr', 'li', '.row', '[class*="item"]', '[class*="field"]',
    ];

    for (const sel of candidates) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        const samples = Array.from(els).slice(0, 5).map((e) => (e.textContent || '').trim().slice(0, 100));
        result.push({ selector: sel, text: samples.join(' | '), count: els.length });
      }
    }

    return result;
  });

  const slotsPath = path.join(EXPLORE_DIR, `${widget}-slot-candidates.json`);
  fs.writeFileSync(slotsPath, JSON.stringify(slotData, null, 2));
  console.log(`[Explore] Slot candidates saved: ${slotsPath}`);

  // Save discovered config
  const configPath = path.join(EXPLORE_DIR, `${widget}-discovered-config.json`);
  fs.writeFileSync(configPath, JSON.stringify(discoveredConfig, null, 2));
  console.log(`[Explore] Discovered config saved: ${configPath}`);

  console.log('\n[Explore] === Summary ===');
  console.log(`Widget: ${widget}`);
  console.log(`URL: ${url}`);
  console.log(`Discovered variants: ${variantList.join(', ')}`);
  console.log(`Discovered states: ${discoveredConfig.states.join(', ')}`);
  console.log(`API calls intercepted: ${apiCalls.length}`);
  console.log('Potential slot selectors:');
  for (const s of slotData) {
    console.log(`  ${s.selector} (${s.count} elements): ${s.text.slice(0, 120)}`);
  }
}

// ---------------------------------------------------------------------------
// Scrape token slots from a widget's style page
// ---------------------------------------------------------------------------

async function scrapeWidgetTokenSlots(page: Page, widget: string, variantParam: string): Promise<TokenSlot[]> {
  const url = buildWidgetUrl(widget, variantParam);
  console.log(`[Scraper] [${widget}] (${variantParam}) Navigating...`);

  // Intercept API responses that might contain token slot data
  let apiTokenData: any = null;
  const responseHandler = async (resp: any) => {
    const reqUrl = resp.url();
    if (reqUrl.includes('design-token') || reqUrl.includes('token-slot') || reqUrl.includes('/style/')) {
      try {
        const ct = resp.headers()['content-type'] || '';
        if (ct.includes('json')) {
          const body = await resp.json().catch(() => null);
          if (body && (body.tokenSlots || body.slots || body.properties)) {
            apiTokenData = body;
          }
        }
      } catch { /* ignore */ }
    }
  };

  page.on('response', responseHandler);

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
    await page.waitForTimeout(3000);
  } catch (e: any) {
    console.warn(`[Scraper] [${widget}] Navigation warning: ${e.message}`);
  }

  page.off('response', responseHandler);

  // Strategy 1: If we intercepted API data, use it
  if (apiTokenData) {
    console.log(`[Scraper] [${widget}] Got token data from API`);
    return normalizeApiData(apiTokenData);
  }

  // Scroll the right panel to load all lazy-rendered sections
  const scrapeScroll = await scrollTokenPanel(page);
  if (!scrapeScroll.found) {
    console.log(`  [Warn] Could not find scrollable panel for ${widget}`);
  } else if (scrapeScroll.scrolled > 0) {
    console.log(`  [Scroll] Scrolled ${scrapeScroll.scrolled}px to load all token sections`);
  }

  // Strategy 2: DOM scraping using exact selectors from the Style Workspace UI.
  //
  // Structure:
  //   div.category-list
  //     div.styleConfigCard          (one per section: COLOR, SIZE, TEXT, STYLE)
  //       label.config-card-header   (UI section name)
  //       div.tokens-list
  //         div.token-item           (one per property)
  //           div.token-name > span  (property name, e.g. "background-color")
  //           div.linked-token-value > wms-typeahead > input.typeahead-input  (applied token)
  //           div.delinked-token-value > input.token-input  (raw value, no token)
  //
  // We read the applied token value (e.g. "color.on-info.@", "space.3",
  // "border.width.0", "radius.none") to classify each property into the
  // correct framework token type instead of relying on the UI section name.
  //
  const slots = await page.evaluate(() => {
    // Classify by the applied token value prefix
    function classifyFromToken(tokenVal: string, uiSection: string, propName = ''): string {
      const t = tokenVal.toLowerCase().trim();
      if (!t || t === 'none') return classifyFallback(uiSection, propName);

      if (t.indexOf('color.') === 0 || t.indexOf('color-') === 0) return 'color';
      if (t.indexOf('space.') === 0 || t.indexOf('space-') === 0) return 'space';
      if (t.indexOf('border.width') === 0) return 'border-width';
      if (t.indexOf('border.style') === 0) return 'border-style';
      if (t.indexOf('radius') === 0) return 'border-radius';
      if (t.indexOf('elevation') === 0 || t.indexOf('box-shadow') === 0) return 'elevation';
      if (t.indexOf('opacity') === 0) return 'opacity';
      if (t.indexOf('icon') === 0) return 'icon';
      if (t.indexOf('gap') === 0) return 'gap';
      if (t.indexOf('margin') === 0) return 'margin';

      // Font tokens: patterns like "body.medium.font-size", "h6.font-weight",
      // "label.small.font-family", "display.medium.font-family"
      if (/\.font[-.]|font[-.]?family|font[-.]?size|font[-.]?weight|line[-.]height|letter[-.]spacing|text[-.]transform/i.test(t)) return 'font';

      return classifyFallback(uiSection, propName);
    }

    // Fallback: classify by property name patterns, then by UI section
    function classifyFallback(uiSection: string, propName = ''): string {
      const p = propName.toLowerCase();

      // Property name patterns take priority over UI section
      if (p.indexOf('border.width') !== -1 || p.indexOf('border-width') !== -1) return 'border-width';
      if (p.indexOf('border.style') !== -1 || p.indexOf('border-style') !== -1) return 'border-style';
      if (p.indexOf('border.color') !== -1 || p.indexOf('border-color') !== -1) return 'color';
      if (p.indexOf('radius') !== -1) return 'border-radius';
      if (p.indexOf('shadow') !== -1 || p.indexOf('elevation') !== -1) return 'elevation';
      if (p.indexOf('opacity') !== -1) return 'opacity';
      if (p.indexOf('icon') !== -1 && p.indexOf('size') !== -1) return 'icon';
      if (p.indexOf('icon') !== -1 && p.indexOf('color') !== -1) return 'color';
      if (p === 'gap') return 'gap';
      if (p.indexOf('font') !== -1 || p.indexOf('letter-spacing') !== -1 || p.indexOf('line-height') !== -1) return 'font';

      if (uiSection === 'color') return 'color';
      if (uiSection === 'text') return 'font';
      if (uiSection === 'size') return 'space';
      if (uiSection === 'style') return 'style';
      return uiSection;
    }

    const typeMap: Record<string, string[]> = {};

    function addProp(type: string, prop: string) {
      if (!typeMap[type]) typeMap[type] = [];
      if (typeMap[type].indexOf(prop) === -1) typeMap[type].push(prop);
    }

    const cards = Array.from(document.querySelectorAll('.styleConfigCard'));
    for (let c = 0; c < cards.length; c++) {
      const card = cards[c];
      const headerEl = card.querySelector('.config-card-header');
      if (!headerEl) continue;
      const uiSection = (headerEl.textContent || '').trim().toLowerCase();

      const items = Array.from(card.querySelectorAll('.token-item'));
      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        // Property name
        const nameSpan = item.querySelector('.token-name span');
        if (!nameSpan) continue;
        const propName = (nameSpan.textContent || '').trim().replace(/\.@$/, '').trim();
        if (!propName) continue;

        // Applied token value — read from input.typeahead-input or input.token-input
        let tokenVal = '';
        const typeaheadInput = item.querySelector('input.typeahead-input') as HTMLInputElement | null;
        const rawInput = item.querySelector('input.token-input') as HTMLInputElement | null;
        if (typeaheadInput) {
          tokenVal = (typeaheadInput.value || '').trim();
        } else if (rawInput) {
          tokenVal = (rawInput.value || '').trim();
        }

        const frameworkType = classifyFromToken(tokenVal, uiSection, propName);
        addProp(frameworkType, propName);
      }
    }

    // Build result in consistent order
    const result: { tokenType: string; properties: string[] }[] = [];
    const typeOrder = ['color', 'font', 'space', 'icon', 'border-width', 'border-style', 'border-radius', 'elevation', 'opacity', 'gap', 'margin', 'style'];
    for (let o = 0; o < typeOrder.length; o++) {
      const t = typeOrder[o];
      if (typeMap[t] && typeMap[t].length > 0) {
        result.push({ tokenType: t, properties: typeMap[t].sort() });
      }
    }
    // Any extra types not in the order
    const allTypes = Object.keys(typeMap);
    for (let k = 0; k < allTypes.length; k++) {
      const t = allTypes[k];
      if (typeOrder.indexOf(t) === -1 && typeMap[t].length > 0) {
        result.push({ tokenType: t, properties: typeMap[t].sort() });
      }
    }
    return result;
  });

  if (slots.length > 0) {
    console.log(`[Scraper] [${widget}] Found ${slots.length} token types via DOM + token-value classification`);
    return slots;
  }

  // Strategy 3: Extract all visible text and parse it heuristically
  const textContent = await page.evaluate(() => document.body.innerText);
  const parsed = parseTextForTokenSlots(textContent);
  if (parsed.length > 0) {
    const categorized = recategorize(parsed);
    console.log(`[Scraper] [${widget}] Found ${categorized.length} token types via text parsing (re-categorized)`);
    return categorized;
  }

  console.warn(`[Scraper] [${widget}] Could not extract token slots`);
  return [];
}

// ---------------------------------------------------------------------------
// Re-categorize scraped UI sections into framework token types
// ---------------------------------------------------------------------------

function recategorize(scraped: TokenSlot[]): TokenSlot[] {
  // Maps a (UI section, property name) pair to a framework token type.
  // UI sections: color, size, text, style
  // Framework types: color, font, space, icon, border-width, border-style,
  //                  border-radius, elevation, opacity, gap, margin
  const frameworkMap: Record<string, string[]> = {};

  function addProp(type: string, prop: string) {
    if (!frameworkMap[type]) frameworkMap[type] = [];
    if (frameworkMap[type].indexOf(prop) === -1) frameworkMap[type].push(prop);
  }

  function classifyProperty(uiSection: string, prop: string): string {
    const p = prop.toLowerCase();

    if (uiSection === 'color') return 'color';
    if (uiSection === 'text') return 'font';

    if (uiSection === 'size') {
      if (/icon[._-]?size|\.icon\.size|icon\.font[._-]?size/i.test(p)) return 'icon';
      if (/border[._-]?width/i.test(p)) return 'border-width';
      if (/margin/i.test(p)) return 'margin';
      if (/\bgap\b/i.test(p)) return 'gap';
      if (/opacity/i.test(p)) return 'opacity';
      return 'space';
    }

    if (uiSection === 'style') {
      if (/radius/i.test(p)) return 'border-radius';
      if (/border[._-]?style/i.test(p)) return 'border-style';
      if (/shadow|z-index|elevation/i.test(p)) return 'elevation';
      return 'style';
    }

    return uiSection;
  }

  for (const slot of scraped) {
    const uiSection = slot.tokenType.toLowerCase();
    for (const prop of slot.properties) {
      const frameworkType = classifyProperty(uiSection, prop);
      addProp(frameworkType, prop);
    }
  }

  const result: TokenSlot[] = [];
  // Emit in a consistent order
  const typeOrder = ['color', 'font', 'space', 'icon', 'border-width', 'border-style', 'border-radius', 'elevation', 'opacity', 'gap', 'margin', 'style'];
  for (const t of typeOrder) {
    if (frameworkMap[t] && frameworkMap[t].length > 0) {
      result.push({ tokenType: t, properties: frameworkMap[t].sort() });
    }
  }
  // Catch any types not in the order list
  for (const t of Object.keys(frameworkMap)) {
    if (typeOrder.indexOf(t) === -1 && frameworkMap[t].length > 0) {
      result.push({ tokenType: t, properties: frameworkMap[t].sort() });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function areSlotsEqual(a: TokenSlot[], b: TokenSlot[]): boolean {
  if (a.length !== b.length) return false;
  const serialize = (slots: TokenSlot[]) =>
    slots
      .map(s => `${s.tokenType}:${s.properties.slice().sort().join(',')}`)
      .sort()
      .join('|');
  return serialize(a) === serialize(b);
}

function normalizeApiData(data: any): TokenSlot[] {
  if (Array.isArray(data.tokenSlots)) return data.tokenSlots;
  if (Array.isArray(data.slots)) {
    return data.slots.map((s: any) => ({
      tokenType: s.type || s.tokenType || 'unknown',
      properties: s.properties || s.props || [],
    }));
  }
  return [];
}

function parseTextForTokenSlots(text: string): TokenSlot[] {
  const sectionMap: Record<string, string> = {
    'color': 'color', 'size': 'size', 'text': 'text', 'style': 'style',
  };
  const sectionKeywords = Object.keys(sectionMap);

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const tokenTypeMap: Record<string, string[]> = {};
  let currentType = '';

  for (const line of lines) {
    const lower = line.toLowerCase();

    // Detect section headings: all-caps short text
    if (line === line.toUpperCase() && /^[A-Z]+$/.test(line) && line.length <= 15) {
      const matched = sectionKeywords.find((k) => k === lower);
      currentType = matched ? (sectionMap[matched] || lower) : lower;
      if (!tokenTypeMap[currentType]) tokenTypeMap[currentType] = [];
      continue;
    }

    // Property rows: lines that look like "background-color   color.on-primary.@"
    // We want only the property name (first token-like word)
    if (currentType) {
      const parts = line.split(/\s{2,}/);
      const propCandidate = (parts[0] || '').trim().toLowerCase();
      if (
        propCandidate &&
        /^[a-z][a-z0-9\-._@]*$/.test(propCandidate) &&
        propCandidate.length >= 2 && propCandidate.length < 50 &&
        propCandidate !== 'default' && propCandidate !== 'standard'
      ) {
        const cleanProp = propCandidate.replace(/\.@$/, '');
        if (tokenTypeMap[currentType].indexOf(cleanProp) === -1) {
          tokenTypeMap[currentType].push(cleanProp);
        }
      }
    }
  }

  return Object.entries(tokenTypeMap)
    .filter(([, props]) => props.length > 0)
    .map(([tokenType, properties]) => ({ tokenType, properties: Array.from(new Set(properties)).sort() }));
}

// ---------------------------------------------------------------------------
// Diff: compare scraped vs source of truth
// ---------------------------------------------------------------------------

function showDiff(): void {
  if (!fs.existsSync(OUT_FILE)) {
    console.error(`❌ No scraped file found at ${OUT_FILE}`);
    console.error('   Run "npm run scrape:slots" first to generate it.');
    process.exit(1);
  }
  if (!fs.existsSync(SOURCE_OF_TRUTH)) {
    console.error(`❌ Source of truth not found at ${SOURCE_OF_TRUTH}`);
    process.exit(1);
  }

  const scrapedRaw = JSON.parse(fs.readFileSync(OUT_FILE, 'utf-8'));
  const current = JSON.parse(fs.readFileSync(SOURCE_OF_TRUTH, 'utf-8'));

  // Filter out "style" token type from scraped data (excluded from merge)
  const scraped = { ...scrapedRaw };
  for (const key of Object.keys(scraped)) {
    if (key === '$schema' || key === 'description') continue;
    if (scraped[key]?.tokenSlots) {
      scraped[key] = {
        ...scraped[key],
        tokenSlots: scraped[key].tokenSlots.filter((s: TokenSlot) => s.tokenType !== 'style'),
      };
    }
  }

  const scrapedWidgets = Object.keys(scraped).filter((k) => k !== '$schema' && k !== 'description');
  const currentWidgets = Object.keys(current).filter((k) => k !== '$schema' && k !== 'description');

  const newWidgets = scrapedWidgets.filter((w) => !currentWidgets.includes(w));
  const removedWidgets = currentWidgets.filter((w) => !scrapedWidgets.includes(w));
  const commonWidgets = scrapedWidgets.filter((w) => currentWidgets.includes(w));

  const lines: string[] = [];
  const ln = (s = '') => lines.push(s);

  ln('════════════════════════════════════════════════════════════════');
  ln('  DIFF REPORT: Scraped Token Slots vs Source of Truth');
  ln('════════════════════════════════════════════════════════════════');
  ln();
  ln(`  Generated:        ${new Date().toLocaleString()}`);
  ln(`  Scraped file:     ${OUT_FILE}`);
  ln(`  Source of truth:  ${SOURCE_OF_TRUTH}`);
  ln(`  Scraped widgets:  ${scrapedWidgets.length}`);
  ln(`  Current widgets:  ${currentWidgets.length}`);
  ln();

  // ── New widgets ──────────────────────────────────────────────────────
  if (newWidgets.length > 0) {
    ln('────────────────────────────────────────────────────────────────');
    ln(`  NEW WIDGETS (${newWidgets.length})`);
    ln('────────────────────────────────────────────────────────────────');
    ln();
    for (const w of newWidgets) {
      const slots: TokenSlot[] = scraped[w]?.tokenSlots || [];
      const props = slots.reduce((s: number, t: TokenSlot) => s + t.properties.length, 0);
      ln(`  + ${w}`);
      ln(`    Token types: ${slots.length}  |  Properties: ${props}`);
      for (const slot of slots) {
        ln(`      ${slot.tokenType}: ${slot.properties.join(', ')}`);
      }
      const dc = scraped[w]?.discoveredConfig as DiscoveredConfig | undefined;
      if (dc) {
        ln(`    Appearances: ${dc.appearances.join(', ')}`);
        for (const app of dc.appearances) {
          ln(`      ${app}: ${(dc.variants[app] || []).join(', ')}`);
        }
        ln(`    States: ${dc.states.join(', ')}`);
      }
      ln();
    }
  }

  // ── Missing widgets ──────────────────────────────────────────────────
  if (removedWidgets.length > 0) {
    ln('────────────────────────────────────────────────────────────────');
    ln(`  MISSING FROM SCRAPED (${removedWidgets.length})`);
    ln('────────────────────────────────────────────────────────────────');
    ln();
    for (const w of removedWidgets) ln(`  - ${w}`);
    ln();
  }

  // ── Changed widgets ──────────────────────────────────────────────────
  let changedCount = 0;
  const changedLines: string[] = [];

  for (const w of commonWidgets) {
    const scrapedSlots: TokenSlot[] = scraped[w]?.tokenSlots || [];
    const currentSlots: TokenSlot[] = current[w]?.tokenSlots || [];

    const scrapedTypes = scrapedSlots.map((s) => s.tokenType).sort();
    const currentTypes = currentSlots.map((s) => s.tokenType).sort();

    const addedTypes = scrapedTypes.filter((t) => !currentTypes.includes(t));
    const removedTypes = currentTypes.filter((t) => !scrapedTypes.includes(t));

    const propAdded: string[] = [];
    const propRemoved: string[] = [];
    for (const st of scrapedSlots) {
      const ct = currentSlots.find((c) => c.tokenType === st.tokenType);
      if (!ct) continue;
      const added = st.properties.filter((p) => !ct.properties.includes(p));
      const removed = ct.properties.filter((p) => !st.properties.includes(p));
      for (const p of added) propAdded.push(`    + ${st.tokenType} > ${p}`);
      for (const p of removed) propRemoved.push(`    - ${st.tokenType} > ${p}`);
    }

    const hasVariantSlots = scraped[w]?.variantSlots && Object.keys(scraped[w].variantSlots).length > 0;

    if (addedTypes.length > 0 || removedTypes.length > 0 || propAdded.length > 0 || propRemoved.length > 0 || hasVariantSlots) {
      changedCount++;
      changedLines.push(`  ${w}`);
      changedLines.push(`  ${'─'.repeat(w.length + 2)}`);
      if (addedTypes.length > 0) changedLines.push(`    + New token types:     ${addedTypes.join(', ')}`);
      if (removedTypes.length > 0) changedLines.push(`    - Removed token types: ${removedTypes.join(', ')}`);
      for (const p of propAdded) changedLines.push(p);
      for (const p of propRemoved) changedLines.push(p);
      if (hasVariantSlots) {
        const vs = scraped[w].variantSlots as Record<string, TokenSlot[]>;
        changedLines.push(`    Variant-specific slot differences:`);
        for (const [variant, slots] of Object.entries(vs)) {
          const types = slots.map((s: TokenSlot) => s.tokenType);
          const totalP = slots.reduce((sum: number, s: TokenSlot) => sum + s.properties.length, 0);
          changedLines.push(`      ${variant}: ${types.length} types, ${totalP} props [${types.join(', ')}]`);
        }
      }
      changedLines.push('');
    }
  }

  if (changedCount > 0) {
    ln('────────────────────────────────────────────────────────────────');
    ln(`  CHANGED WIDGETS (${changedCount})`);
    ln('────────────────────────────────────────────────────────────────');
    ln();
    for (const cl of changedLines) ln(cl);
  }

  // ── WIDGET_CONFIG updates ────────────────────────────────────────────
  const configUpdates: string[] = [];
  for (const w of scrapedWidgets) {
    const dc = scraped[w]?.discoveredConfig as DiscoveredConfig | undefined;
    if (!dc) continue;
    const wConfig = WIDGET_CONFIG[w as Widget];

    if (!wConfig) {
      configUpdates.push(`  + ${w}  (NEW — not in WIDGET_CONFIG)`);
      configUpdates.push(`      appearances: ${dc.appearances.join(', ')}`);
      for (const app of dc.appearances) {
        configUpdates.push(`      variants.${app}: ${(dc.variants[app] || []).join(', ')}`);
      }
      configUpdates.push(`      states: ${dc.states.join(', ')}`);
      configUpdates.push('');
      continue;
    }

    const widgetDiffs: string[] = [];
    const currentApps = wConfig.appearances.slice().sort();
    const discoveredApps = dc.appearances.slice().sort();
    if (JSON.stringify(currentApps) !== JSON.stringify(discoveredApps)) {
      widgetDiffs.push(`      appearances:  ${currentApps.join(', ')}  →  ${discoveredApps.join(', ')}`);
    }
    const currentStates = wConfig.states.slice().sort();
    const discoveredStates = dc.states.slice().sort();
    if (JSON.stringify(currentStates) !== JSON.stringify(discoveredStates)) {
      widgetDiffs.push(`      states:       ${currentStates.join(', ')}  →  ${discoveredStates.join(', ')}`);
    }
    for (const app of dc.appearances) {
      const currentVars = (wConfig.variants[app as keyof typeof wConfig.variants] || []).slice().sort();
      const discoveredVars = (dc.variants[app] || []).slice().sort();
      if (JSON.stringify(currentVars) !== JSON.stringify(discoveredVars)) {
        widgetDiffs.push(`      variants.${app}:  ${currentVars.join(', ') || '(none)'}  →  ${discoveredVars.join(', ')}`);
      }
    }

    if (widgetDiffs.length > 0) {
      configUpdates.push(`  ${w}`);
      for (const d of widgetDiffs) configUpdates.push(d);
      configUpdates.push('');
    }
  }

  if (configUpdates.length > 0) {
    ln('────────────────────────────────────────────────────────────────');
    ln(`  WIDGET_CONFIG UPDATES NEEDED`);
    ln('────────────────────────────────────────────────────────────────');
    ln();
    for (const u of configUpdates) ln(u);
  }

  // ── Summary ──────────────────────────────────────────────────────────
  const unchangedCount = commonWidgets.length - changedCount;
  ln('════════════════════════════════════════════════════════════════');
  ln('  SUMMARY');
  ln('════════════════════════════════════════════════════════════════');
  ln();
  ln(`  New widgets:       ${newWidgets.length}`);
  ln(`  Changed widgets:   ${changedCount}`);
  ln(`  Unchanged widgets: ${unchangedCount}`);
  ln(`  Missing (not scraped): ${removedWidgets.length}`);
  ln(`  Config updates needed: ${configUpdates.length > 0 ? 'Yes' : 'No'}`);
  ln();
  ln('  To approve and merge into the source of truth, run:');
  ln('    npm run scrape:slots:approve');
  ln();

  // Write the diff file
  const diffFile = path.join(OUT_DIR, 'diff-report.txt');
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(diffFile, lines.join('\n'));
  console.log(`✅ Diff report saved to: ${diffFile}`);
  console.log(`   ${newWidgets.length} new, ${changedCount} changed, ${unchangedCount} unchanged, ${removedWidgets.length} missing`);
}

// ---------------------------------------------------------------------------
// Approve: merge scraped into source of truth
// ---------------------------------------------------------------------------

function approveAndMerge(): void {
  if (!fs.existsSync(OUT_FILE)) {
    console.error(`❌ No scraped file found at ${OUT_FILE}`);
    console.error('   Run "npm run scrape:slots" first to generate it.');
    process.exit(1);
  }

  const scraped = JSON.parse(fs.readFileSync(OUT_FILE, 'utf-8'));
  const current = fs.existsSync(SOURCE_OF_TRUTH)
    ? JSON.parse(fs.readFileSync(SOURCE_OF_TRUTH, 'utf-8'))
    : {};

  const scrapedWidgets = Object.keys(scraped).filter((k) => k !== '$schema' && k !== 'description');

  // Backup the current file
  const backupPath = SOURCE_OF_TRUTH.replace('.json', `.backup-${Date.now()}.json`);
  if (fs.existsSync(SOURCE_OF_TRUTH)) {
    fs.copyFileSync(SOURCE_OF_TRUTH, backupPath);
    console.log(`📦 Backup saved: ${backupPath}`);
  }

  // Merge: scraped widgets overwrite, existing non-scraped widgets are preserved
  const merged: Record<string, any> = {};
  if (current.$schema) merged.$schema = current.$schema;
  if (current.description) merged.description = current.description;

  // Keep existing widgets and overlay with scraped data
  const allWidgetKeys = Array.from(new Set([
    ...Object.keys(current).filter((k) => k !== '$schema' && k !== 'description'),
    ...scrapedWidgets,
  ])).sort();

  const filterOutStyle = (slots: TokenSlot[]) =>
    slots.filter((s: TokenSlot) => s.tokenType !== 'style');

  for (const w of allWidgetKeys) {
    if (scraped[w]) {
      const entry: any = { tokenSlots: filterOutStyle(scraped[w].tokenSlots) };
      if (scraped[w].variantSlots && Object.keys(scraped[w].variantSlots).length > 0) {
        const filtered: Record<string, TokenSlot[]> = {};
        for (const [v, slots] of Object.entries(scraped[w].variantSlots)) {
          filtered[v] = filterOutStyle(slots as TokenSlot[]);
        }
        entry.variantSlots = filtered;
      }
      merged[w] = entry;
    } else {
      merged[w] = current[w];
    }
  }

  fs.writeFileSync(SOURCE_OF_TRUTH, JSON.stringify(merged, null, 4) + '\n');

  console.log('╔═══════════════════════════════════════════╗');
  console.log('║   Approved & Merged into Source of Truth  ║');
  console.log('╚═══════════════════════════════════════════╝\n');
  console.log(`Updated: ${SOURCE_OF_TRUTH}`);
  console.log(`Widgets merged from scraped: ${scrapedWidgets.length}`);
  console.log(`Total widgets in source of truth: ${allWidgetKeys.length}`);
  console.log(`Backup: ${backupPath}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { mode, widgets, exploreWidget: ew } = parseArgs();

  // diff and approve don't need a browser
  if (mode === 'diff') {
    showDiff();
    return;
  }
  if (mode === 'approve') {
    approveAndMerge();
    return;
  }

  console.log('╔═══════════════════════════════════════════╗');
  console.log('║   WaveMaker Style Token Slots Scraper     ║');
  console.log('╚═══════════════════════════════════════════╝');
  console.log(`Mode: ${mode}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Project ID: ${PROJECT_ID}`);

  const { context, page } = await getAuthenticatedContext();

  try {
    if (mode === 'explore') {
      await exploreWidget(page, ew);
      console.log('\n[Explore] Done! Check the artifacts/style-exploration/ directory.');
      console.log('Use the exploration output to refine the scraping selectors.');
    } else {
      console.log(`\nScraping ${widgets.length} widgets...\n`);

      const result: ScrapedResult = {};
      const failures: string[] = [];

      for (let i = 0; i < widgets.length; i++) {
        const widget = widgets[i];
        const progress = `[${i + 1}/${widgets.length}]`;

        try {
          // Step 1: Discover variants and states from the UI
          console.log(`${progress} Discovering variants/states for ${widget}...`);
          const discoveredConfig = await discoverWidgetConfig(page, widget);
          const variantList = discoveredConfig.appearances
            .map(app => (discoveredConfig.variants[app] || []).map(v => `${app}:${v}`))
            .reduce((a, b) => a.concat(b), []);
          console.log(`${progress}   Variants: ${variantList.join(', ') || 'none found'}`);
          console.log(`${progress}   States: ${discoveredConfig.states.join(', ')}`);

          // Step 2: Scrape token slots for the first variant only
          const firstVariant = variantList[0] || 'standard:standard';
          console.log(`${progress}   Scraping slots for variant ${firstVariant}...`);
          const baseSlots = await scrapeWidgetTokenSlots(page, widget, firstVariant);

          if (baseSlots.length > 0) {
            result[widget] = { tokenSlots: baseSlots, discoveredConfig };
            const totalProps = baseSlots.reduce((sum, s) => sum + s.properties.length, 0);
            console.log(`${progress} ✅ ${widget}: ${baseSlots.length} token types, ${totalProps} properties | ${variantList.length} variant(s), ${discoveredConfig.states.length} state(s)`);
          } else {
            failures.push(widget);
            console.log(`${progress} ⚠️  ${widget}: no token slots found`);
          }
        } catch (e: any) {
          failures.push(widget);
          console.error(`${progress} ❌ ${widget}: ${e.message}`);
        }
      }

      // Write output
      if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

      const output = {
        $schema: './widget-token-slots.schema.json',
        description: `Scraped token slots from ${BASE_URL} on ${new Date().toISOString()}`,
        ...result,
      };
      fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 4));

      console.log('\n═══════════════════════════════════');
      console.log(`✅ Results saved to: ${OUT_FILE}`);
      console.log(`   Widgets scraped: ${Object.keys(result).length}/${widgets.length}`);
      if (failures.length > 0) {
        console.log(`   ⚠️  Failed: ${failures.join(', ')}`);
      }
      console.log('═══════════════════════════════════');
      console.log('\n📋 Next steps:');
      console.log('   1. Review the scraped file: reports/scraped-token-slots.json');
      console.log('   2. Compare with source of truth: npm run scrape:slots:diff');
      console.log('   3. If satisfied, approve: npm run scrape:slots:approve');
    }
  } finally {
    await context.close();
  }
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
