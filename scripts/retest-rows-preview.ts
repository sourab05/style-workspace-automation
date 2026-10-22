/**
 * retest-rows-preview.ts
 *
 * Re-tests table rows from scratch in the RN preview, one phase at a time:
 *   --build      build one payload per widget from .test-cache/retest-input.json (the exact Oct 19 token per
 *                instance/property, plus regenerated tokens for rows that never had a test). Writes
 *                .test-cache/retest-payloads/<widget>.json. Touches nothing remote.
 *   --apply      apply those payloads to the Studio project (updateComponentOverride per widget)
 *   --deploy     trigger an in-place deploy and wait until the preview build is ready
 *   --evaluate   read each row's value with the same command the device tests use and compare to its token
 *
 * Usage: WM_ENV=stage-ai AUTH_METHOD=platformdb npx ts-node scripts/retest-rows-preview.ts --build [--widget w]
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { chromium, Page } from '@playwright/test';
import { ENV } from '../src/utils/env';
import { StudioClient } from '../src/api/studioClient';
import { ensureAuthCookies, evaluatePreviewConsoleCommand } from '../src/playwright/helpers';
import { MobileMapper } from '../wdio/utils/mobileMapper';
import { getStudioWidgetNameForVariant } from '../wdio/utils/mobileWidgetVariantCsv';
import { studioWidgetsPropertyAccess } from '../wdio/utils/studioWidgetAccess';
import { WIDGET_CONFIG } from '../src/matrix/widgets';
import { generateVariantPayload, getWidgetKey } from '../src/matrix/generator';
import { BatchTokenMerger, TokenVariantPair } from '../wdio/utils/batch-token-merger';
import { resolveStyleValue, formatResolvedValue } from '../wdio/utils/styleObjectResolver';

const ROOT = process.cwd();
const CACHE = path.join(ROOT, '.test-cache');
const PAYLOAD_DIR = path.join(CACHE, 'retest-payloads');
const OUT_DIR = path.join(ROOT, 'artifacts', 'retest');
const KNOWN_STATES = ['default', 'active', 'disabled', 'checked', 'focused', 'on', 'hover', 'selected', 'current', 'invalid'];
const STATE_AWARE_WIDGETS = [
  'tabbar', 'tabs', 'button', 'checkbox', 'checkboxset', 'wizard', 'carousel',
  'chips', 'formcontrols', 'radioset', 'toggle', 'switch',
];
const WIDGET_PAGE_NAME_MAP: Record<string, string> = {
  formcontrols: 'formC', 'form-wrapper': 'formC', navbar: 'Main', tabbar: 'Main', picture: 'Picture',
  carousel: 'Carousel', 'button-group': 'ButtonGroup', icon: 'Icon', lottie: 'Lottie', audio: 'Audio',
  webview: 'Webview', message: 'Message', spinner: 'Spinner', search: 'Search', 'progress-bar': 'ProgressBar',
  'progress-circle': 'ProgressCircle', 'dropdown-menu': 'DropdownMenu', popover: 'Popover', login: 'Login',
  'modal-dialog': 'ModalDialog', fileupload: 'FileUpload', calendar: 'Calendar', slider: 'Slider',
  rating: 'Rating', currency: 'Currency', select: 'Select', 'panel-footer': 'panel',
  'accordion-pane': 'accordion', camera: 'Camera', datetime: 'Datetime', video: 'Video',
};

interface Pair { widget: string; instance: string; appearance: string; variant: string; state: string; prop: string; token: string; tokenType: string; source: 'oct19' | 'regenerated'; }

const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'wdio/config/widget-token-slots.json'), 'utf-8'));
function typeOf(widget: string, prop: string): string {
  for (const s of registry[widget]?.tokenSlots ?? []) if (s.properties.includes(prop)) return s.tokenType;
  return 'color';
}

function splitInstance(widget: string, instance: string, stateHint?: string): { appearance: string; variant: string; state: string } {
  const rest = instance.slice(widget.length + 1);
  const states = [...(WIDGET_CONFIG as any)[widget]?.states ?? [], ...KNOWN_STATES];
  const state = stateHint && rest.endsWith('-' + stateHint) ? stateHint : states.find(s => rest.endsWith('-' + s)) ?? 'default';
  const head = rest.slice(0, rest.length - state.length - 1);
  const apps: string[] = (WIDGET_CONFIG as any)[widget]?.appearances ?? [];
  const app = apps.filter(a => head.startsWith(a + '-')).sort((a, b) => b.length - a.length)[0];
  if (app) return { appearance: app, variant: head.slice(app.length + 1), state };
  const i = head.indexOf('-');
  return { appearance: head.slice(0, i), variant: head.slice(i + 1), state };
}

function loadPairs(): { pairs: Pair[]; rows: Set<string> } {
  const inp = JSON.parse(fs.readFileSync(path.join(CACHE, 'retest-input.json'), 'utf-8'));
  const rows = new Set<string>(inp.rows.map((r: any) => `${r.widget}|${r.property}`));
  const pairs: Pair[] = [];
  for (const t of inp.allure) {
    const m = /^states\.([^.]+)\.(.*)$/.exec(t.propFull);
    const prop = m ? m[2] : t.propFull;
    const sp = splitInstance(t.widget, t.instance, m?.[1]);
    pairs.push({ widget: t.widget, instance: t.instance, ...sp, prop, token: t.token, tokenType: typeOf(t.widget, prop), source: 'oct19' });
  }
  for (const r of inp.regen) {
    pairs.push({
      widget: r.widget, instance: `${r.widget}-${r.appearance}-${r.variant}-${r.state}`, appearance: r.appearance,
      variant: r.variant, state: r.state, prop: r.propFull, token: r.token, tokenType: r.tokenType, source: 'regenerated',
    });
  }
  return { pairs, rows };
}

function groupBy<T>(xs: T[], f: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) { const k = f(x); (m.get(k) ?? m.set(k, []).get(k)!).push(x); }
  return m;
}

function buildPayloads(only?: string[]) {
  const { pairs } = loadPairs();
  fs.mkdirSync(PAYLOAD_DIR, { recursive: true });
  const byWidget = groupBy(pairs, p => p.widget);
  const log = console.log; const merger = new BatchTokenMerger();
  for (const [widget, ps] of byWidget) {
    if (only && !only.includes(widget)) continue;
    const tvp: TokenVariantPair[] = ps.map(p => ({
      tokenRef: `{${p.token}}`, propertyPath: p.prop.split('.'), tokenType: p.tokenType,
      item: { widget, appearance: p.appearance, variant: p.variant, state: p.state, tokenType: p.tokenType } as any,
    }));
    console.log = () => {};
    const payload = merger.mergePayloads(tvp, generateVariantPayload as any);
    console.log = log;
    fs.writeFileSync(path.join(PAYLOAD_DIR, `${widget}.json`), JSON.stringify(payload, null, 2));
    console.log(`built ${widget}: ${ps.length} pairs (${ps.filter(p => p.source === 'regenerated').length} regenerated)`);
  }
}

async function authed(): Promise<{ client: StudioClient; cookie: string }> {
  const c0 = new StudioClient({ baseUrl: ENV.studioBaseUrl, projectId: ENV.projectId });
  const cookie = await c0.loginWithPlatformDB(ENV.studioUsername, ENV.studioPassword);
  fs.writeFileSync(path.join(CACHE, 'auth-cookie.txt'), cookie);
  return { client: new StudioClient({ baseUrl: ENV.studioBaseUrl, projectId: ENV.projectId, cookie }), cookie };
}

async function apply(only?: string[]) {
  const { client } = await authed();
  const backupDir = path.join(CACHE, 'retest-backup');
  fs.mkdirSync(backupDir, { recursive: true });
  for (const f of fs.readdirSync(PAYLOAD_DIR).sort()) {
    const widget = f.replace(/\.json$/, '');
    if (only && !only.includes(widget)) continue;
    const key = widget === 'formcontrols' ? getWidgetKey(widget as any) : widget;
    try { fs.writeFileSync(path.join(backupDir, `${widget}.json`), JSON.stringify(await client.getComponentOverride(key), null, 2)); }
    catch (e: any) { console.log(`backup of ${widget} failed: ${e?.message || e}`); }
  }
  console.log(`backed up current overrides to ${backupDir}`);
  for (const f of fs.readdirSync(PAYLOAD_DIR).sort()) {
    const widget = f.replace(/\.json$/, '');
    if (only && !only.includes(widget)) continue;
    const payload = JSON.parse(fs.readFileSync(path.join(PAYLOAD_DIR, f), 'utf-8'));
    const key = widget === 'formcontrols' ? getWidgetKey(widget as any) : widget;
    for (let a = 1; ; a++) {
      try { await client.updateComponentOverride(key, payload); console.log(`applied ${widget} -> ${key}`); break; }
      catch (e: any) { if (a >= 3) { console.log(`FAILED ${widget}: ${e?.message || e}`); break; } await new Promise(r => setTimeout(r, 5000 * a)); }
    }
  }
  console.log('waiting 8s for propagation');
  await new Promise(r => setTimeout(r, 8000));
}

async function deploy() {
  const { client, cookie } = await authed();
  let url: string | null = null;
  for (let a = 1; a <= 3 && !url; a++) { url = (await client.inplaceDeploy()) ?? null; if (!url) await new Promise(r => setTimeout(r, 10000 * a)); }
  if (!url) throw new Error('no preview url');
  console.log('deploy url', url);
  for (let i = 1; i <= 90; i++) {
    const res = await fetch(`${url.replace(/\/$/, '')}/rn-bundle/`, { headers: { Cookie: cookie } });
    const body = (await res.text()).slice(0, 20000);
    if (res.ok && !body.includes('Preview is being generated')) { console.log(`preview ready after ~${i * 10}s`); break; }
    if (i === 90) throw new Error('preview not ready after 900s');
    await new Promise(r => setTimeout(r, 10000));
  }
  fs.writeFileSync(path.join(CACHE, 'retest-preview.json'), JSON.stringify({ previewUrl: url, readyAt: new Date().toISOString() }));
}

function resolveTokenValue(map: Record<string, string>, ref: string): string | null {
  const raw = map[ref]; if (raw == null) return null;
  const px = raw.match(/^([\d.]+)px$/); if (px) return String(parseFloat(px[1]));
  if (/^[\d.]+$/.test(raw)) return raw;
  if (/^#[0-9a-fA-F]{3,8}$/.test(raw)) return raw.toLowerCase();
  return raw;
}
function valuesMatch(actual: string, expected: string): boolean {
  const norm = (s: string) => (/^#[0-9a-fA-F]{3,8}$/.test(s.trim()) ? s.trim().toLowerCase() : s.trim());
  const a = norm(actual), e = expected.trim();
  if (a === e) return true;
  const na = parseFloat(a), ne = parseFloat(e);
  if (!isNaN(na) && !isNaN(ne) && na === ne && /^[\d.\-]+(px)?$/.test(a)) return true;
  const ex = (h: string) => { const m = h.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i); return m ? `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`.toLowerCase() : h.toLowerCase(); };
  return ex(a) === ex(e);
}

function commandFor(p: Pair): { command: string; mappedPath: string } {
  const studioWidgetName = getStudioWidgetNameForVariant(p.widget as any, p.instance) || `${p.widget}1`;
  const stylesKey = p.widget === 'cards' ? 'calcStyles' : 'styles';
  const path0 = p.prop.split('.');
  const eff = p.state !== 'default' && STATE_AWARE_WIDGETS.includes(p.widget) ? ['states', p.state, ...path0] : path0;
  const mappedPath = MobileMapper.mapToRnStylePath(eff, p.widget as any, 'android');
  const field = p.instance.endsWith('-disabled') ? 'custom' : 'entestkey';
  const command = p.widget === 'cards'
    ? `wm.App.appConfig.currentPage.Widgets.supportedLocaleList1.itemWidgets[0].card1._INSTANCE.${stylesKey}.${mappedPath}`
    : p.widget === 'formcontrols'
      ? `wm.App.appConfig.currentPage.Widgets.supportedLocaleForm1.formWidgets.${field}._INSTANCE.styles.${mappedPath}`
      : `wm.App.appConfig.currentPage.Widgets${studioWidgetsPropertyAccess(studioWidgetName)}._INSTANCE.${stylesKey}.${mappedPath}`;
  return { command, mappedPath };
}

async function evaluate(only?: string[]) {
  const { previewUrl } = JSON.parse(fs.readFileSync(path.join(CACHE, 'retest-preview.json'), 'utf-8'));
  const cookie = fs.readFileSync(path.join(CACHE, 'auth-cookie.txt'), 'utf-8').trim();
  const { loadGlobalTokenMap } = require('../src/playwright/globalTokenLoader');
  const tokenMap: Record<string, string> = loadGlobalTokenMap();
  const { pairs, rows } = loadPairs();
  const targets = pairs.filter(p => rows.has(`${p.widget}|${p.prop}`) && (!only || only.includes(p.widget)));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const results: any[] = [];
  for (const [widget, ps] of groupBy(targets, p => p.widget)) {
    const page = await ctx.newPage();
    const pageName = WIDGET_PAGE_NAME_MAP[widget] || widget;
    const url = `${previewUrl.replace(/\/$/, '')}/rn-bundle/#/${pageName}`;
    try {
      await ensureAuthCookies(page, url, cookie);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForFunction(() => Object.keys((window as any).wm?.App?.appConfig?.currentPage?.Widgets || {}).length > 0, null, { timeout: 90000 });
    } catch (e: any) { console.log(`  page load issue for ${widget}: ${e?.message}`); }
    let n = 0;
    for (const p of ps) {
      const { command, mappedPath } = commandFor(p);
      const raw = await evaluatePreviewConsoleCommand(page, command, { maxWaitMs: 8000, pollIntervalMs: 500 });
      const output = (raw ?? '').trim();
      const expected = resolveTokenValue(tokenMap, `{${p.token}}`);
      let status: string, reason = '';
      if (!output || output.startsWith('CONSOLE_ERROR:') || output === '{}' || output === '[]') { status = 'NO OUTPUT'; reason = output || 'empty'; }
      else if (expected !== null && valuesMatch(output, expected)) status = 'PASS';
      else { status = 'VALUE MISMATCH'; reason = expected === null ? 'token not in token map' : `expected ${expected}`; }
      results.push({ widget, instance: p.instance, state: p.state, property: p.prop, token: p.token, source: p.source, command, mappedPath, output, expected, status, reason });
      n++;
    }
    console.log(`${widget}: ${n} rows -> ` + JSON.stringify(results.filter(r => r.widget === widget).reduce((a: any, r) => (a[r.status] = (a[r.status] || 0) + 1, a), {})));
    await page.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT_DIR, 'retest-results.json'), JSON.stringify({ previewUrl, generatedAt: new Date().toISOString(), results }, null, 2));
  console.log('results ->', path.join(OUT_DIR, 'retest-results.json'));
}


/** Device-equivalent evaluation: same command builder and value resolution as the wdio specs, plus trace check.
 *  PASS = value matches the applied token. FAIL = the token's CSS var is bound in the trace but the value is wrong/missing.
 *  NOT MAPPED = no trace binds the token's CSS var on that instance. datetime is skipped (device reads a picker label). */
function collectBoundVars(o: any, out: Set<string>, inTrace = false, depth = 0) {
  if (!o || typeof o !== 'object' || depth > 12) return;
  for (const [k, v] of Object.entries(o)) {
    if (k === '__trace' && Array.isArray(v)) { for (const t of v as any[]) collectBoundVars(t?.value, out, true, depth + 1); continue; }
    if (typeof v === 'string' && inTrace && !k.startsWith('--wm-')) { for (const m of v.matchAll(/var\((--wm-[a-z0-9-]+)\)/g)) out.add(m[1]); }
    else if (v && typeof v === 'object') collectBoundVars(v, out, inTrace, depth + 1);
  }
}
interface Binding { ns: string; prop: string; cssVar: string }
/** Every `<prop>: var(--wm-x)` inside a __trace entry, with the namespace (path of the object owning the __trace) and the RN property key. */
function collectBindings(o: any, pathSegs: string[], out: Binding[], depth = 0) {
  if (!o || typeof o !== 'object' || Array.isArray(o) || depth > 12) return;
  for (const [k, v] of Object.entries(o)) {
    if (k === '__trace' && Array.isArray(v)) {
      for (const t of v as any[]) for (const [pk, pv] of Object.entries(t?.value ?? {})) {
        if (typeof pv === 'string' && !pk.startsWith('--wm-')) for (const m of pv.matchAll(/var\((--wm-[a-z0-9-]+)\)/g)) out.push({ ns: pathSegs.join('.'), prop: pk, cssVar: m[1] });
      }
    } else if (v && typeof v === 'object' && !Array.isArray(v)) collectBindings(v, [...pathSegs, k], out, depth + 1);
  }
}
const LONGHAND: Record<string, string[]> = {
  borderRadius: ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius'],
  borderWidth: ['borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth'],
  padding: ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'],
  margin: ['marginTop', 'marginRight', 'marginBottom', 'marginLeft'],
};
function samePath(mapped: string, ns: string, prop: string): boolean {
  const i = mapped.lastIndexOf('.'); const mns = i < 0 ? '' : mapped.slice(0, i); const mprop = i < 0 ? mapped : mapped.slice(i + 1);
  if (mns !== ns) return false;
  return mprop === prop || (LONGHAND[prop] ?? []).includes(mprop) || (LONGHAND[mprop] ?? []).includes(prop);
}
const pct = (e: string | null) => (e && /^[\d.]+%$/.test(e) ? String(parseFloat(e) / 100) : e);

async function evaluate2(only?: string[]) {
  const { previewUrl } = JSON.parse(fs.readFileSync(path.join(CACHE, 'retest-preview.json'), 'utf-8'));
  const { cookie } = await authed(); // fresh login every run: the saved cookie expires after about an hour and every read then comes back empty
  const { loadGlobalTokenMap } = require('../src/playwright/globalTokenLoader');
  const tokenMap: Record<string, string> = loadGlobalTokenMap();
  const { pairs, rows } = loadPairs();
  const targets = pairs.filter(p => rows.has(`${p.widget}|${p.prop}`) && p.widget !== 'datetime' && p.widget !== 'modal-dialog' && (!only || only.includes(p.widget)));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const results: any[] = [];
  for (const [widget, ps] of groupBy(targets, p => p.widget)) {
    const page = await ctx.newPage();
    const url = `${previewUrl.replace(/\/$/, '')}/rn-bundle/#/${WIDGET_PAGE_NAME_MAP[widget] || widget}`;
    try {
      await ensureAuthCookies(page, url, cookie);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.waitForFunction(() => Object.keys((window as any).wm?.App?.appConfig?.currentPage?.Widgets || {}).length > 0, null, { timeout: 90000 });
      await page.waitForTimeout(1500);
    } catch (e: any) { console.log(`  page load issue for ${widget}: ${e?.message}`); }
    const cache = new Map<string, any>();
    for (const p of ps) {
      const studioWidgetName = getStudioWidgetNameForVariant(p.widget as any, p.instance) || `${p.widget}1`;
      const path0 = p.prop.split('.');
      const eff = p.state !== 'default' && STATE_AWARE_WIDGETS.includes(p.widget) ? ['states', p.state, ...path0] : path0;
      const mappedPath = MobileMapper.mapToRnStylePath(eff, p.widget as any, 'android');
      const full = MobileMapper.getExtractionCommand(p.widget as any, eff, studioWidgetName, 'android');
      const base = full.slice(0, full.length - mappedPath.length - 1);
      if (!cache.has(base)) {
        let styles: any = null;
        try {
          const json = await page.evaluate((cmd: string) => { try { return JSON.stringify(new Function('App', 'return ' + cmd)((window as any).wm.App)); } catch (e: any) { return 'ERR:' + e.message; } }, base);
          styles = json && !json.startsWith('ERR:') ? JSON.parse(json) : null;
        } catch { styles = null; }
        cache.set(base, styles);
      }
      const styles = cache.get(base);
      const all: Binding[] = []; if (styles) collectBindings(styles, [], all);
      const suffix = '-' + p.prop.replace(/\./g, '-');
      const matching = all.filter(b => b.cssVar.endsWith(suffix));
      const atMapped = matching.filter(b => samePath(mappedPath, b.ns, b.prop));
      const traceVars = [...new Set(atMapped.map(b => b.cssVar))];
      const elsewhere = [...new Set(matching.filter(b => !atMapped.includes(b)).map(b => `${b.ns ? b.ns + '.' : ''}${b.prop}`))];
      const resolved = styles ? resolveStyleValue(styles, mappedPath) : { value: undefined, resolvedPath: mappedPath };
      const output = formatResolvedValue(resolved.value);
      const expected = pct(resolveTokenValue(tokenMap, `{${p.token}}`));
      const matches = output !== '' && expected !== null && valuesMatch(output, expected);
      const status = matches ? 'PASS' : atMapped.length ? 'FAIL' : 'NOT MAPPED';
      const reason = matches ? '' : !styles ? 'styles object not readable'
        : atMapped.length ? (output === '' ? 'token is bound at the mapped property but it returns nothing' : `token is bound at the mapped property but value is ${output}, expected ${expected}`)
        : elsewhere.length ? `trace binds this token at ${elsewhere.join(', ')}, not at the mapped path ${mappedPath}` : 'no trace binds this token on the instance';
      results.push({ widget, instance: p.instance, state: p.state, property: p.prop, token: p.token, source: p.source, command: full, mappedPath, resolvedPath: resolved.resolvedPath, output, expected, traceVars, boundElsewhere: elsewhere, bindings: matching.map(b => ({ path: `${b.ns ? b.ns + '.' : ''}${b.prop}`, cssVar: b.cssVar, atMapped: atMapped.includes(b) })), status, reason });
    }
    console.log(`${widget}: ` + JSON.stringify(results.filter(r => r.widget === widget).reduce((a: any, r) => (a[r.status] = (a[r.status] || 0) + 1, a), {})));
    await page.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT_DIR, 'retest-results-v2.json'), JSON.stringify({ previewUrl, generatedAt: new Date().toISOString(), results }, null, 2));
  console.log('results ->', path.join(OUT_DIR, 'retest-results-v2.json'));
}

(async () => {
  const args = process.argv.slice(2);
  const only = args.flatMap((a, i) => (a === '--widget' ? [args[i + 1]] : []));
  const o = only.length ? only : undefined;
  if (args.includes('--build')) buildPayloads(o);
  if (args.includes('--apply')) await apply(o);
  if (args.includes('--deploy')) await deploy();
  if (args.includes('--evaluate')) await evaluate(o);
  if (args.includes('--evaluate2')) await evaluate2(o);
})().catch(e => { console.error(e); process.exit(1); });
