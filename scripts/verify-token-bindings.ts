/**
 * verify-token-bindings.ts
 *
 * Offline verification: for every token slot defined in widget-token-slots.json,
 * confirms that the expected CSS variable is bound as a VALUE inside a
 * `__trace[].value` entry of the styles object (not just declared as a key).
 *
 *   Expected binding pattern (the "good" form):
 *     "backgroundColor": "var(--wm-accordion-badge-background-color)"
 *
 *   Rejected pattern (var declared as key, never applied):
 *     "--wm-accordion-badge-background-color": "transparent"
 *
 * State coverage: if a binding exists in a base namespace (e.g. `badge`) and a
 * state-prefixed sibling namespace also exists in the styles object
 * (e.g. `activeBadge`), the binding must exist in BOTH.
 *
 * Reads pre-saved styles from artifacts/style-comparison/{widget}.{source}.json
 * (produced by `compare-styles.ts`). No browser, no auth, no deploy.
 *
 * Usage:
 *   npx ts-node scripts/verify-token-bindings.ts
 *   npx ts-node scripts/verify-token-bindings.ts --widget accordion
 *   npx ts-node scripts/verify-token-bindings.ts --source remote
 *   npx ts-node scripts/verify-token-bindings.ts --styles-dir artifacts/rn-styles --suffix styles
 */

import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const TOKEN_SLOTS_PATH = path.join(process.cwd(), 'wdio', 'config', 'widget-token-slots.json');
const DEFAULT_STYLES_DIR = path.join(process.cwd(), 'artifacts', 'style-comparison');
const REPORT_DIR = path.join(process.cwd(), 'artifacts', 'token-bindings');

const KNOWN_STATES = [
  'active', 'disabled', 'hover', 'focused', 'checked',
  'on', 'selected', 'current',
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TokenSlot {
  tokenType: string;
  properties: string[];
}

interface TraceBinding {
  namespace: string;
  rnProperty: string;
  cssVar: string;
  resolvedValue: any;
}

interface MissingState {
  baseNamespace: string;
  state: string;
  expectedNamespace: string;
}

interface PropertyResult {
  property: string;
  tokenType: string;
  expectedSuffix: string;
  foundBindings: TraceBinding[];
  missingStates: MissingState[];
  status: 'verified' | 'partial' | 'unbound';
}

interface WidgetResult {
  widget: string;
  stylesFound: boolean;
  discoveredStates: string[];
  properties: PropertyResult[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadTokenSlots(): Record<string, { tokenSlots: TokenSlot[] }> {
  const raw = JSON.parse(fs.readFileSync(TOKEN_SLOTS_PATH, 'utf-8'));
  delete raw.$schema;
  delete raw.description;
  return raw;
}

function isPascalStart(s: string): boolean {
  if (s.length === 0) return false;
  const c = s[0];
  return c === c.toUpperCase() && c !== c.toLowerCase();
}

function pascalCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Build the CSS variable suffix for a token slot property.
 * Different widgets use different prefixes (button → --wm-btn-*, accordion → --wm-accordion-*),
 * so we match on the property suffix rather than a fixed prefix.
 *
 *   property="badge.background-color" → suffix "-badge-background-color"
 *   property="background"              → suffix "-background"
 *
 * A var matches if its full name ends with this suffix (e.g.
 * --wm-accordion-badge-background-color ends with -badge-background-color).
 */
function buildPropertySuffix(property: string): string {
  return `-${property.replace(/\./g, '-').toLowerCase()}`;
}

/**
 * Discover state names actually present in the styles object by inspecting
 * top-level keys. e.g. `activeBadge` → state "active" with base "badge".
 */
function discoverStates(stylesObj: any): string[] {
  const states = new Set<string>(['default']);
  for (const key of Object.keys(stylesObj)) {
    for (const state of KNOWN_STATES) {
      if (
        key.startsWith(state) &&
        key.length > state.length &&
        isPascalStart(key.slice(state.length))
      ) {
        states.add(state);
        break;
      }
    }
  }
  return Array.from(states);
}

/**
 * For a found binding namespace (e.g. "activeBadge"), strip the state prefix
 * if present and return the base namespace + state.
 *   "activeBadge" → { baseNamespace: "badge", foundState: "active" }
 *   "badge"       → { baseNamespace: "badge", foundState: "default" }
 *   "root"        → { baseNamespace: "root",  foundState: "default" }
 */
function stripStatePrefix(
  ns: string,
  states: string[],
): { baseNamespace: string; foundState: string } {
  for (const state of states) {
    if (state === 'default') continue;
    if (
      ns.startsWith(state) &&
      ns.length > state.length &&
      isPascalStart(ns.slice(state.length))
    ) {
      const rest = ns.slice(state.length);
      const baseNamespace = rest.charAt(0).toLowerCase() + rest.slice(1);
      return { baseNamespace, foundState: state };
    }
  }
  return { baseNamespace: ns, foundState: 'default' };
}

/**
 * Build the state-prefixed namespace name.
 *   stateNamespace("badge", "active") → "activeBadge"
 *   stateNamespace("badge", "default") → "badge"
 */
function stateNamespace(baseNs: string, state: string): string {
  if (state === 'default') return baseNs;
  return state + pascalCase(baseNs);
}

/**
 * Check whether a top-level key exists in the styles object (matches our
 * binding-collection convention which uses top-level keys as namespaces).
 */
function namespaceExists(stylesObj: any, ns: string): boolean {
  if (ns === 'root' || ns === '(top)') return true;
  return stylesObj[ns] != null && typeof stylesObj[ns] === 'object' && !Array.isArray(stylesObj[ns]);
}

/**
 * Walk the styles object and collect every binding from `__trace[].value`
 * entries where `someProp: "var(--wm-...)"`.
 *
 * Pattern is identical to scripts/verify-rn-mappings.ts collectTraceBindings(),
 * with the namespace normalized to "root" for top-level traces.
 */
function collectTraceBindings(obj: any, prefix = ''): TraceBinding[] {
  const out: TraceBinding[] = [];
  if (obj == null || typeof obj !== 'object') return out;

  const traces = obj.__trace;
  if (Array.isArray(traces)) {
    for (const trace of traces) {
      const val = trace?.value;
      if (val && typeof val === 'object') {
        for (const [rnProp, rawVal] of Object.entries(val)) {
          if (rnProp.startsWith('--')) continue;
          if (typeof rawVal === 'string' && rawVal.includes('var(--wm-')) {
            const m = rawVal.match(/var\((--wm-[a-z0-9-]+)\)/);
            if (m) {
              out.push({
                namespace: prefix || 'root',
                rnProperty: rnProp,
                cssVar: m[1],
                resolvedValue: obj[rnProp],
              });
            }
          }
        }
      }
    }
  }

  for (const key of Object.keys(obj)) {
    if (key === '__trace') continue;
    const v = obj[key];
    if (v != null && typeof v === 'object' && !Array.isArray(v)) {
      const childPrefix = prefix ? `${prefix}.${key}` : key;
      out.push(...collectTraceBindings(v, childPrefix));
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const arg = (name: string) =>
    args.includes(name) ? args[args.indexOf(name) + 1] : null;

  const singleWidget = arg('--widget');
  const source = arg('--source') ?? 'local';
  const stylesDir = arg('--styles-dir') ?? DEFAULT_STYLES_DIR;
  const suffix = arg('--suffix') ?? source;

  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });

  const tokenSlots = loadTokenSlots();
  const widgetList = singleWidget ? [singleWidget] : Object.keys(tokenSlots);

  console.log(`\n📋 Verifying token slot bindings`);
  console.log(`   Widgets:    ${widgetList.length}`);
  console.log(`   Styles:     ${path.relative(process.cwd(), stylesDir)}/*.${suffix}.json`);
  console.log('');

  const results: WidgetResult[] = [];

  for (const widget of widgetList) {
    const slots = tokenSlots[widget]?.tokenSlots ?? [];
    const stylesPath = path.join(stylesDir, `${widget}.${suffix}.json`);

    if (!fs.existsSync(stylesPath)) {
      console.log(`  ⚠️  ${widget}: no styles file at ${path.relative(process.cwd(), stylesPath)} — skipping`);
      results.push({ widget, stylesFound: false, discoveredStates: [], properties: [] });
      continue;
    }

    const stylesObj = JSON.parse(fs.readFileSync(stylesPath, 'utf-8'));
    const discoveredStates = discoverStates(stylesObj);
    const bindings = collectTraceBindings(stylesObj);
    const propResults: PropertyResult[] = [];

    for (const slot of slots) {
      for (const property of slot.properties) {
        const suffix = buildPropertySuffix(property);
        const found = bindings.filter(b => b.cssVar.toLowerCase().endsWith(suffix));

        const baseCoverage = new Map<string, Set<string>>();
        for (const b of found) {
          const { baseNamespace, foundState } = stripStatePrefix(b.namespace, discoveredStates);
          if (!baseCoverage.has(baseNamespace)) baseCoverage.set(baseNamespace, new Set());
          baseCoverage.get(baseNamespace)!.add(foundState);
        }

        const missingStates: MissingState[] = [];
        for (const [baseNs, foundStatesSet] of baseCoverage.entries()) {
          for (const state of discoveredStates) {
            if (foundStatesSet.has(state)) continue;
            const expectedNs = stateNamespace(baseNs, state);
            if (namespaceExists(stylesObj, expectedNs)) {
              missingStates.push({ baseNamespace: baseNs, state, expectedNamespace: expectedNs });
            }
          }
        }

        const status: PropertyResult['status'] =
          found.length === 0 ? 'unbound' :
          missingStates.length > 0 ? 'partial' :
          'verified';

        propResults.push({
          property,
          tokenType: slot.tokenType,
          expectedSuffix: suffix,
          foundBindings: found,
          missingStates,
          status,
        });
      }
    }

    const verified = propResults.filter(p => p.status === 'verified').length;
    const partial = propResults.filter(p => p.status === 'partial').length;
    const unbound = propResults.filter(p => p.status === 'unbound').length;
    console.log(`  ${widget}: ✅ ${verified}  ⚠️ ${partial} state-gaps  ❌ ${unbound} unbound   (states: ${discoveredStates.join(', ')})`);

    results.push({ widget, stylesFound: true, discoveredStates, properties: propResults });
  }

  // ── Reports ──
  const jsonPath = path.join(REPORT_DIR, 'binding-report.json');
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));

  const lines: string[] = [
    '════════════════════════════════════════════════════════════════',
    '  TOKEN SLOT BINDING VERIFICATION REPORT',
    '════════════════════════════════════════════════════════════════',
    `  Generated: ${new Date().toLocaleString()}`,
    `  Styles:    ${path.relative(process.cwd(), stylesDir)}/*.${suffix}.json`,
    `  Widgets:   ${results.length}`,
    '',
  ];

  let totalVerified = 0, totalPartial = 0, totalUnbound = 0;

  for (const r of results) {
    const v = r.properties.filter(p => p.status === 'verified').length;
    const p = r.properties.filter(p => p.status === 'partial').length;
    const u = r.properties.filter(p => p.status === 'unbound').length;
    totalVerified += v; totalPartial += p; totalUnbound += u;

    if (!r.stylesFound) {
      lines.push('────────────────────────────────────────────────────────────────');
      lines.push(`  ${r.widget}  — ⚠️ NO STYLES FILE`);
      lines.push('────────────────────────────────────────────────────────────────');
      lines.push('');
      continue;
    }

    if (p === 0 && u === 0) continue;

    lines.push('────────────────────────────────────────────────────────────────');
    lines.push(`  ${r.widget.toUpperCase()}  (states: ${r.discoveredStates.join(', ')})`);
    lines.push(`  ✅ ${v} verified  |  ⚠️ ${p} state gaps  |  ❌ ${u} unbound`);
    lines.push('────────────────────────────────────────────────────────────────');

    const unboundProps = r.properties.filter(x => x.status === 'unbound');
    if (unboundProps.length > 0) {
      lines.push('  ❌ UNBOUND (no CSS var ending in expected suffix is bound as a value):');
      for (const pr of unboundProps) {
        lines.push(`    ${pr.tokenType} > ${pr.property}`);
        lines.push(`       expected any var ending with: ${pr.expectedSuffix}`);
      }
      lines.push('');
    }

    const partialProps = r.properties.filter(x => x.status === 'partial');
    if (partialProps.length > 0) {
      lines.push('  ⚠️  STATE COVERAGE GAPS (var bound in some states but missing in sibling state namespace):');
      for (const pr of partialProps) {
        lines.push(`    ${pr.tokenType} > ${pr.property}  (suffix: ${pr.expectedSuffix})`);
        lines.push('       bound in:');
        for (const b of pr.foundBindings) {
          const valStr = b.resolvedValue !== undefined ? ` = ${JSON.stringify(b.resolvedValue)}` : '';
          lines.push(`         - ${b.namespace}.${b.rnProperty}${valStr}`);
        }
        lines.push('       missing in (namespace exists but binding absent):');
        for (const m of pr.missingStates) {
          lines.push(`         - ${m.expectedNamespace}  (state: ${m.state}, base: ${m.baseNamespace})`);
        }
      }
      lines.push('');
    }
  }

  lines.push('════════════════════════════════════════════════════════════════');
  lines.push('  SUMMARY');
  lines.push('════════════════════════════════════════════════════════════════');
  lines.push(`  ✅ Verified:           ${totalVerified}`);
  lines.push(`  ⚠️  State coverage gaps: ${totalPartial}`);
  lines.push(`  ❌ Unbound:            ${totalUnbound}`);
  lines.push(`  Total properties:     ${totalVerified + totalPartial + totalUnbound}`);

  const txtPath = path.join(REPORT_DIR, 'binding-report.txt');
  fs.writeFileSync(txtPath, lines.join('\n'));

  console.log('\n📄 Reports:');
  console.log(`   ${path.relative(process.cwd(), jsonPath)}`);
  console.log(`   ${path.relative(process.cwd(), txtPath)}`);
  console.log('\n📊 SUMMARY:');
  console.log(`   ✅ Verified:           ${totalVerified}`);
  console.log(`   ⚠️  State coverage gaps: ${totalPartial}`);
  console.log(`   ❌ Unbound:            ${totalUnbound}`);
}

main();
