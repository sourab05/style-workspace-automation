import fs from 'fs';
import path from 'path';

/**
 * Generates an HTML report from Playwright's JSON log using streaming writes
 * to handle large test suites (thousands of tests with attachments).
 *
 * Reads:  logs/playwright-log.json
 * Writes: reports/playwright-report.html
 *
 * Images and videos are embedded as base64 so the report is self-contained
 * and works when served from S3 or any static host.
 */

const OUT_DIR = path.resolve('reports');
const OUT_FILE = path.join(OUT_DIR, 'playwright-report.html');
const PROJECT_ROOT = process.cwd();

// ——— CLI Args ———
const cliArgs = process.argv.slice(2);
const cliWidgets: string[] = [];
const cliExcludeWidgets: string[] = [];
const cliExcludeStatus: string[] = [];
let cliLogFile: string | null = null;
let cliPreviewDir: string | null = null;

for (let i = 0; i < cliArgs.length; i++) {
  const arg = cliArgs[i];
  if (arg === '--widgets' || arg === '-w') {
    const raw = cliArgs[++i] || '';
    raw.split(',').map(v => v.trim().toLowerCase()).filter(Boolean).forEach(v => cliWidgets.push(v));
  } else if (arg === '--exclude-widgets' || arg === '--ew') {
    const raw = cliArgs[++i] || '';
    raw.split(',').map(v => v.trim().toLowerCase()).filter(Boolean).forEach(v => cliExcludeWidgets.push(v));
  } else if (arg === '--exclude-status') {
    const raw = cliArgs[++i] || '';
    raw.split(',').map(v => v.trim().toLowerCase()).filter(Boolean).forEach(v => cliExcludeStatus.push(v));
  } else if (arg === '--log' || arg === '-l') {
    cliLogFile = cliArgs[++i] || null;
  } else if (arg === '--preview-dir' || arg === '--pd') {
    cliPreviewDir = cliArgs[++i] || null;
  }
}

const LOG_FILE = cliLogFile ? path.resolve(cliLogFile) : path.resolve('logs/playwright-log.json');

// ——— Types ———

interface Attachment { name: string; contentType: string; path?: string; body?: string; }
interface TestResult { status: string; duration: number; errors: any[]; stdout: { text?: string }[]; stderr: { text?: string }[]; retry: number; startTime: string; attachments: Attachment[]; }
interface TestEntry { timeout: number; annotations: any[]; expectedStatus: string; projectId: string; projectName: string; results: TestResult[]; status: string; }
interface Spec { title: string; ok: boolean; tests: TestEntry[]; id: string; file: string; line: number; column: number; }
interface Suite { title: string; file: string; specs: Spec[]; suites: Suite[]; }

interface FlatTest {
  title: string;
  widget: string;
  suite: string;
  status: 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted';
  duration: number;
  errors: string[];
  stdout: string[];
  stderr: string[];
  attachments: Attachment[];
  startTime: string;
  env: 'canvas' | 'preview' | 'unknown';
}

// ——— Helpers ———

function decodeBase64(b64: string): string {
  return Buffer.from(b64, 'base64').toString('utf-8');
}

function extractWidget(suiteTitle: string): string {
  const m = suiteTitle.match(/(?:Canvas|Preview) Token Validation - (\S+?)(?:\s+Widget|\s*\(|\s*$)/);
  return m ? m[1].toLowerCase() : 'unknown';
}

function extractEnv(suiteTitle: string): 'canvas' | 'preview' | 'unknown' {
  if (/Canvas Token Validation/i.test(suiteTitle)) return 'canvas';
  if (/Preview Token Validation/i.test(suiteTitle)) return 'preview';
  return 'unknown';
}

function collectTests(suite: Suite, parentTitle: string): FlatTest[] {
  const tests: FlatTest[] = [];
  const suitePath = parentTitle ? `${parentTitle} > ${suite.title}` : suite.title;

  for (const spec of suite.specs || []) {
    for (const t of spec.tests || []) {
      const result = t.results?.[t.results.length - 1];
      if (!result) continue;
      tests.push({
        title: spec.title,
        widget: extractWidget(suitePath),
        env: extractEnv(suitePath),
        suite: suitePath,
        status: result.status as FlatTest['status'],
        duration: result.duration,
        errors: result.errors?.map((e: any) => e.message || JSON.stringify(e)) ?? [],
        stdout: result.stdout?.map((s) => s.text || '').filter(Boolean) ?? [],
        stderr: result.stderr?.map((s) => s.text || '').filter(Boolean) ?? [],
        attachments: result.attachments ?? [],
        startTime: result.startTime,
      });
    }
  }

  for (const child of suite.suites || []) {
    tests.push(...collectTests(child, suitePath));
  }
  return tests;
}

function categoriseFailure(errors: string[]): string {
  const joined = errors.join(' ');
  if (/Trace Issue/i.test(joined)) return 'Trace Issue';
  if (/timeout/i.test(joined)) return 'Selector Timeout';
  if (/waitForSelector/i.test(joined)) return 'Selector Timeout';
  if (/Expected.*Got|value mismatch|!==|not equal/i.test(joined)) return 'Value Mismatch';
  if (/network|ECONNREFUSED|ECONNRESET|502|503|504/i.test(joined)) return 'Network Error';
  if (/auth|401|403|session/i.test(joined)) return 'Auth Error';
  if (/apply.*token|publish/i.test(joined)) return 'Token Apply Error';
  if (joined.length === 0) return 'Unknown';
  return 'Other';
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = ((ms % 60000) / 1000).toFixed(0);
  return `${m}m ${s}s`;
}

/** Get attachment as data URL (base64) for S3/self-contained reports */
function getAttachmentDataUrl(att: Attachment): string | null {
  if (att.body) {
    return `data:${att.contentType};base64,${att.body}`;
  }
  if (!att.path) return null;
  const abs = path.isAbsolute(att.path) ? att.path : path.resolve(PROJECT_ROOT, att.path);
  if (!fs.existsSync(abs)) return null;
  try {
    const buf = fs.readFileSync(abs);
    return `data:${att.contentType};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

function buildImageTag(att: Attachment, label: string, borderColor: string): string {
  const src = getAttachmentDataUrl(att);
  if (!src) return '';
  return `<div class="ss-item"><div class="ss-label" style="border-bottom:3px solid ${borderColor}">${esc(label)}</div><img src="${src}" alt="${esc(label)}" loading="lazy"/></div>`;
}

function buildVideoTag(att: Attachment): string {
  // Videos are too large to embed (would bloat report to GB). Use path for local; placeholder for S3.
  if (att.path) {
    const abs = path.isAbsolute(att.path) ? att.path : path.resolve(PROJECT_ROOT, att.path);
    if (fs.existsSync(abs)) {
      const rel = path.relative(OUT_DIR, abs);
      return `<video controls preload="metadata" style="max-width:100%;border-radius:6px"><source src="${esc(rel)}" type="${att.contentType}">Video not supported</video>`;
    }
  }
  return '<div class="verdict-block"><p style="color:#8b949e">Video available when viewing locally (npm run report:serve)</p></div>';
}

// ——— Preview Dir Loader ———

function collectTestsFromPreviewDir(dir: string): FlatTest[] {
  const absDir = path.resolve(dir);
  if (!fs.existsSync(absDir)) {
    console.error(`❌ Preview dir not found: ${absDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(absDir).filter(f => f.endsWith('-report.json') && f !== 'overall-summary.json');
  if (files.length === 0) {
    console.error(`❌ No *-report.json files found in: ${absDir}`);
    process.exit(1);
  }

  const tests: FlatTest[] = [];
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(absDir, file), 'utf-8'));
    const widget: string = (data.widget || '').toLowerCase();
    const timestamp: string = data.timestamp || new Date().toISOString();

    for (const r of (data.results || [])) {
      const previewResult = r.preview || {};
      const rawStatus: string = (previewResult.status || r.overallStatus || 'SKIPPED').toUpperCase();

      let status: FlatTest['status'] = 'skipped';
      if (rawStatus === 'PASS') status = 'passed';
      else if (rawStatus === 'FAIL' || rawStatus === 'ERROR') status = 'failed';

      const actualRaw = previewResult.actualValue;
      const actualStr = actualRaw === null || actualRaw === undefined
        ? ''
        : (typeof actualRaw === 'object' ? JSON.stringify(actualRaw) : String(actualRaw));

      const originalError: string = previewResult.error || '';
      const isTimeoutError = /timeout|waitForSelector|not found/i.test(originalError);

      const isTraceIssue = status === 'failed' && !isTimeoutError && (
        actualStr === '{}' || actualStr === '[]' ||
        actualStr === '' || actualStr === 'null' || actualStr === 'undefined'
      );

      const errors: string[] = [];
      if (isTimeoutError) {
        errors.push(originalError);
      } else if (isTraceIssue) {
        const reason = (actualStr === '{}' || actualStr === '[]')
          ? `Trace Issue: {} returned — shorthand property not expanded for "${r.propertyPath}"`
          : `Trace Issue: undefined returned — style path missing for "${r.propertyPath}"`;
        errors.push(reason);
      } else if (originalError) {
        errors.push(originalError);
      }

      const verdictLines: string[] = [
        `Token    : ${r.tokenRef || ''}`,
        `Property : ${r.propertyPath || ''}`,
        `Expected : ${r.expectedValue ?? ''}`,
        `Actual   : ${actualStr || '(empty)'}`,
        `Status   : ${rawStatus}`,
      ];
      if (isTraceIssue) verdictLines.push(`Category : Trace Issue`);
      if (r.tokenType) verdictLines.unshift(`Type     : ${r.tokenType}`);
      if (r.appearance) verdictLines.unshift(`Appearance: ${r.appearance}${r.variant ? ' / ' + r.variant : ''}${r.state ? ' / ' + r.state : ''}`);

      const verdictText = verdictLines.join('\n');
      const verdictB64 = Buffer.from(verdictText).toString('base64');

      const stdoutLines: string[] = [
        `[${rawStatus}] ${r.propertyPath} | expected: ${r.expectedValue ?? ''} | actual: ${actualStr || '(empty)'}`,
      ];
      if (errors.length > 0) stdoutLines.push(`Error: ${errors[0]}`);

      tests.push({
        title: r.testId || `${widget}-${r.propertyPath}`,
        widget,
        suite: `Preview Token Validation - ${widget} Widget`,
        status,
        duration: 0,
        errors,
        stdout: stdoutLines,
        stderr: [],
        attachments: [{ name: 'style-verdict', contentType: 'text/plain', body: verdictB64 }],
        startTime: timestamp,
        env: 'preview',
      });
    }
  }
  return tests;
}

// ——— Main ———

function generate(): void {
  let allTests: FlatTest[] = [];
  const globalErrors: string[] = [];

  if (cliPreviewDir) {
    console.log(`📂 Reading preview widget JSONs from: ${path.resolve(cliPreviewDir)}`);
    allTests = collectTestsFromPreviewDir(cliPreviewDir);
  } else {
    if (!fs.existsSync(LOG_FILE)) {
      console.error(`❌ Playwright log not found: ${LOG_FILE}`);
      console.error('   Run tests first: npx playwright test');
      console.error('   Or use --preview-dir <path> to read from widget JSON reports');
      process.exit(1);
    }
    console.log(`📖 Reading ${LOG_FILE}...`);
    const raw = JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8'));
    for (const suite of (raw.suites || []) as Suite[]) {
      allTests.push(...collectTests(suite, ''));
    }
    globalErrors.push(...(raw.errors || []).map((e: any) => e.message || JSON.stringify(e)));
  }

  console.log(`📊 Collected ${allTests.length} test results`);

  // Apply CLI filters
  let filteredTests = allTests;
  if (cliWidgets.length > 0) {
    filteredTests = filteredTests.filter(t => cliWidgets.includes(t.widget));
    console.log(`🔍 Widget filter (${cliWidgets.join(', ')}): ${filteredTests.length} tests remain`);
  }
  if (cliExcludeWidgets.length > 0) {
    filteredTests = filteredTests.filter(t => !cliExcludeWidgets.includes(t.widget));
    console.log(`🚫 Excluded widgets (${cliExcludeWidgets.join(', ')}): ${filteredTests.length} tests remain`);
  }
  if (cliExcludeStatus.length > 0) {
    filteredTests = filteredTests.filter(t => !cliExcludeStatus.includes(t.status));
    console.log(`🚫 Excluded status (${cliExcludeStatus.join(', ')}): ${filteredTests.length} tests remain`);
  }

  const tests = filteredTests;
  const total = tests.length;
  const passed = tests.filter((t) => t.status === 'passed').length;
  const failed = tests.filter((t) => t.status === 'failed' || t.status === 'timedOut').length;
  const canvasCount = tests.filter((t) => t.env === 'canvas').length;
  const previewCount = tests.filter((t) => t.env === 'preview').length;
  const skipped = tests.filter((t) => t.status === 'skipped' || t.status === 'interrupted').length;
  const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';

  const widgetMap = new Map<string, { total: number; pass: number; fail: number; skip: number }>();
  for (const t of tests) {
    if (!widgetMap.has(t.widget)) widgetMap.set(t.widget, { total: 0, pass: 0, fail: 0, skip: 0 });
    const r = widgetMap.get(t.widget)!;
    r.total++;
    if (t.status === 'passed') r.pass++;
    else if (t.status === 'failed' || t.status === 'timedOut') r.fail++;
    else r.skip++;
  }

  const failCats = new Map<string, number>();
  for (const t of tests) {
    if (t.status === 'failed' || t.status === 'timedOut') {
      const cat = categoriseFailure(t.errors);
      failCats.set(cat, (failCats.get(cat) || 0) + 1);
    }
  }

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const ws = fs.createWriteStream(OUT_FILE, { encoding: 'utf-8' });
  const w = (s: string) => ws.write(s);
  const ts = new Date().toISOString();

  // ——— HEAD & CSS ———
  w(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>Playwright Test Report</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0d1117;color:#c9d1d9;padding:20px}
.header{text-align:center;padding:24px 0;border-bottom:1px solid #21262d;margin-bottom:20px}
.header h1{font-size:26px;color:#f0f6fc;margin-bottom:6px}
.header .meta{color:#8b949e;font-size:13px}
.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
.card{background:#161b22;border:1px solid #21262d;border-radius:10px;padding:16px;text-align:center}
.card .num{font-size:32px;font-weight:bold}
.card .label{color:#8b949e;font-size:12px;margin-top:2px}
.green{color:#3fb950}.red{color:#f85149}.gray{color:#8b949e}.yellow{color:#d29922}
.row-2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px}
.section{background:#161b22;border:1px solid #21262d;border-radius:10px;padding:20px;margin-bottom:16px}
.section h2{font-size:16px;color:#f0f6fc;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid #21262d}
table{width:100%;border-collapse:collapse}
th{text-align:left;padding:8px 10px;background:#0d1117;color:#8b949e;font-size:11px;text-transform:uppercase;letter-spacing:.5px}
td{padding:6px 10px;border-bottom:1px solid #21262d;font-size:13px}
tr:hover{background:#1c2128}
.bar-bg{background:#333;border-radius:3px;overflow:hidden;height:14px;width:100px;display:inline-block;vertical-align:middle;margin-right:6px}
.bar-fill{height:100%;min-width:2px}
.cat-row{display:flex;justify-content:space-between;cursor:pointer;border-radius:4px;padding:6px 8px;border-bottom:1px solid #21262d}
.cat-row:hover{background:#1f6feb22}
.cat-row.active{background:#1f6feb33;border-color:#1f6feb}
.cat-cnt{font-weight:bold}
.clear-cat-btn{font-size:11px;color:#58a6ff;cursor:pointer;float:right;margin-top:-2px;display:none}
.clear-cat-btn:hover{text-decoration:underline}
.pass-ring{background:conic-gradient(#3fb950 0% ${passRate}%,#f85149 ${passRate}% 100%);width:120px;height:120px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto}
.pass-ring-inner{background:#161b22;width:84px;height:84px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:bold;color:#f0f6fc}
.filters{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center}
.filters input{background:#0d1117;border:1px solid #30363d;color:#c9d1d9;padding:8px 12px;border-radius:6px;font-size:13px;width:280px}
.filters button{background:#21262d;border:1px solid #30363d;color:#c9d1d9;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px}
.filters button:hover{background:#30363d}
.filters button.active{background:#1f6feb;border-color:#1f6feb;color:#fff}
.test-card{background:#161b22;border:1px solid #21262d;border-radius:8px;margin-bottom:8px;overflow:hidden}
.test-card.expanded .test-body{display:block}
.test-card.expanded .expand-icon{transform:rotate(180deg)}
.test-header{display:flex;align-items:center;padding:10px 14px;cursor:pointer;gap:10px}
.test-header:hover{background:#1c2128}
.status-badge{padding:3px 10px;border-radius:6px;font-size:11px;font-weight:bold;color:#fff;flex-shrink:0}
.pass-badge{background:#238636}.fail-badge{background:#da3633}
.test-title{flex:1;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.test-meta{color:#8b949e;font-size:11px;flex-shrink:0}
.expand-icon{color:#8b949e;font-size:10px;transition:transform .2s}
.test-body{display:none;padding:14px;border-top:1px solid #21262d;background:#0d1117}
.verdict-block,.trace-link{background:#1c2128;border:1px solid #30363d;border-radius:6px;padding:12px;margin-bottom:10px}
.verdict-block h3,.error-block h3,.ss-section h3,.video-section h3,.trace-link h3{font-size:13px;color:#8b949e;margin-bottom:8px}
.verdict-block pre{font-size:12px;white-space:pre-wrap;word-break:break-all;color:#c9d1d9;font-family:'SF Mono',Menlo,monospace}
.error-block{background:#2d1b1b;border:1px solid #5a2d2d;border-radius:6px;padding:12px;margin-bottom:10px}
.error-block pre{font-size:12px;color:#f85149;white-space:pre-wrap;word-break:break-all;font-family:'SF Mono',Menlo,monospace}
.screenshots-row{display:flex;gap:10px;overflow-x:auto;padding:8px 0;margin-bottom:10px}
.ss-item{flex:0 0 auto;max-width:360px}
.ss-item img{width:100%;border-radius:4px;border:1px solid #30363d}
.ss-label{font-size:11px;text-align:center;padding:4px;color:#c9d1d9;margin-bottom:4px}
.ss-section,.video-section{margin-bottom:10px}
.trace-link a{color:#58a6ff;text-decoration:none}
.trace-link a:hover{text-decoration:underline}
.trace-link code{font-size:11px;color:#8b949e}
.widget-row{cursor:pointer}
.widget-row:hover{background:#1f6feb22!important}
.widget-row.active{background:#1f6feb33!important}
#activeChips{display:flex;gap:6px;flex-wrap:wrap}
.chip{display:inline-flex;align-items:center;gap:5px;background:#1f6feb33;border:1px solid #1f6feb;color:#c9d1d9;padding:4px 10px 4px 12px;border-radius:16px;font-size:12px;animation:chipIn .15s ease}
.chip .chip-x{cursor:pointer;font-size:14px;line-height:1;color:#8b949e;border-radius:50%;width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;transition:background .15s,color .15s}
.chip .chip-x:hover{background:#f8514933;color:#f85149}
.chip.chip-category{background:#da363333;border-color:#da3633}
.chip.chip-widget{background:#23863633;border-color:#238636}
.chip.chip-search{background:#d2992233;border-color:#d29922}
.chip.chip-env{background:#58a6ff33;border-color:#58a6ff}
.env-badge{padding:2px 7px;border-radius:4px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.3px;flex-shrink:0}
.env-canvas{background:#1f6feb33;color:#58a6ff;border:1px solid #1f6feb55}
.env-preview{background:#8957e533;color:#bc8cff;border:1px solid #8957e555}
.env-toggle{display:flex;gap:2px;background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:2px;margin-left:4px}
.env-toggle button{background:transparent;border:none;color:#8b949e;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:11px;font-weight:600}
.env-toggle button:hover{color:#c9d1d9}
.env-toggle button.active{background:#30363d;color:#f0f6fc}
.widget-badge{padding:2px 7px;border-radius:4px;font-size:10px;font-weight:600;text-transform:capitalize;letter-spacing:.3px;flex-shrink:0;background:#23863633;color:#3fb950;border:1px solid #23863655}
@keyframes chipIn{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:scale(1)}}
@media(max-width:768px){.cards{grid-template-columns:repeat(2,1fr)}.row-2{grid-template-columns:1fr}.screenshots-row{flex-direction:column}.ss-item{max-width:100%}}
</style></head><body>\n`);

  // ——— Header + Cards ———
  w(`<div class="header"><h1>Playwright Token Validation Report</h1><div class="meta">Generated: ${ts} &middot; ${total} tests across ${widgetMap.size} widgets</div></div>\n`);

  // Global setup errors
  if (globalErrors.length > 0) {
    w(`<div class="section"><h2 style="color:#f85149">Global Setup Errors</h2><p style="color:#8b949e;font-size:13px;margin-bottom:10px">These errors prevented tests from running.</p>\n`);
    for (const e of globalErrors) {
      w(`<div class="error-block"><pre>${esc(e.replace(/\u001b\[[0-9;]*m/g, ''))}</pre></div>\n`);
    }
    w(`</div>\n`);
  }

  w(`<div class="cards">
<div class="card"><div class="num">${total}</div><div class="label">TOTAL TESTS</div></div>
<div class="card"><div class="num green">${passed}</div><div class="label">PASSED</div></div>
<div class="card"><div class="num red">${failed}</div><div class="label">FAILED</div></div>
<div class="card"><div class="num gray">${skipped}</div><div class="label">SKIPPED</div></div>
</div>\n`);

  // ——— Pass Rate + Failure Categories ———
  w(`<div class="row-2"><div class="section"><h2>Pass Rate</h2><div class="pass-ring"><div class="pass-ring-inner">${passRate}%</div></div></div>\n`);
  w(`<div class="section"><h2>Failure Categories <span class="clear-cat-btn" id="clearCatBtn" onclick="clearCategory()">clear filter</span></h2>\n`);
  const sortedCats = [...failCats.entries()].sort((a, b) => b[1] - a[1]);
  if (sortedCats.length === 0) {
    w(`<div class="cat-row"><span>No failures</span><span class="cat-cnt green">0</span></div>\n`);
  } else {
    for (const [cat, cnt] of sortedCats) {
      w(`<div class="cat-row" data-category="${esc(cat)}" onclick="filterByCategory('${esc(cat)}')"><span>${esc(cat)}</span><span class="cat-cnt red">${cnt}</span></div>\n`);
    }
  }
  w(`</div></div>\n`);

  // ——— Per-Widget Table ———
  w(`<div class="section"><h2>Per-Widget Results</h2><table><thead><tr><th>Widget</th><th>Total</th><th>Pass</th><th>Fail</th><th>Skip</th><th>Pass Rate</th></tr></thead><tbody>\n`);
  for (const [wName, s] of [...widgetMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const pct = s.total > 0 ? ((s.pass / s.total) * 100).toFixed(0) : '0';
    const barColor = s.fail > 0 ? '#f85149' : '#3fb950';
    w(`<tr class="widget-row" data-widget="${esc(wName)}" onclick="filterByWidget('${esc(wName)}')"><td style="text-transform:capitalize;cursor:pointer">${esc(wName)}</td><td>${s.total}</td><td class="green">${s.pass}</td><td class="red">${s.fail}</td><td class="gray">${s.skip}</td><td><div class="bar-bg"><div class="bar-fill" style="width:${pct}%;background:${barColor}"></div></div>${pct}%</td></tr>\n`);
  }
  w(`</tbody></table></div>\n`);

  // ——— Filters bar ———
  w(`<div class="section" id="test-list-section"><h2 id="test-list-heading">All Tests</h2>
<div class="filters">
<input type="text" id="searchBox" placeholder="Search by test name or widget..." oninput="onSearchInput()" onkeyup="onSearchInput()"/>
<button class="active" onclick="setStatusFilter('all',this)">All (${total})</button>
<button onclick="setStatusFilter('passed',this)">Passed (${passed})</button>
<button onclick="setStatusFilter('failed',this)">Failed (${failed})</button>
<div class="env-toggle"><button class="active" onclick="setEnvFilter('all',this)">Both</button><button onclick="setEnvFilter('canvas',this)">Canvas (${canvasCount})</button><button onclick="setEnvFilter('preview',this)">Preview (${previewCount})</button></div>
<div id="activeChips"></div>
</div><div id="testCards">\n`);

  // ——— Stream test cards one by one ———
  console.log(`📝 Writing ${tests.length} test cards...`);
  for (let i = 0; i < tests.length; i++) {
    if (i > 0 && i % 500 === 0) console.log(`   ... ${i}/${tests.length}`);
    const t = tests[i];
    const badgeClass = t.status === 'passed' ? 'pass-badge' : 'fail-badge';
    const badgeText = t.status.toUpperCase();
    const failCat = (t.status === 'failed' || t.status === 'timedOut') ? categoriseFailure(t.errors) : '';

    const envClass = t.env === 'canvas' ? 'env-canvas' : t.env === 'preview' ? 'env-preview' : '';
    const envLabel = t.env === 'canvas' ? 'Canvas' : t.env === 'preview' ? 'Preview' : '';

    w(`<div class="test-card" data-status="${t.status}" data-widget="${esc(t.widget)}" data-title="${esc(t.title.toLowerCase())}" data-fail-category="${esc(failCat)}" data-env="${t.env}">`);
    w(`<div class="test-header" onclick="this.parentElement.classList.toggle('expanded')">`);
    w(`<span class="status-badge ${badgeClass}">${badgeText}</span>`);
    if (envLabel) w(`<span class="env-badge ${envClass}">${envLabel}</span>`);
    w(`<span class="widget-badge">${esc(t.widget)}</span>`);
    w(`<span class="test-title">${esc(t.title)}</span>`);
    w(`<span class="test-meta">${formatDuration(t.duration)}</span>`);
    w(`<span class="expand-icon">&#9660;</span></div>`);

    w(`<div class="test-body">`);

    // Style verdict
    const verdictAtt = t.attachments.find((a) => a.name.startsWith('style-verdict'));
    if (verdictAtt?.body) {
      const text = decodeBase64(verdictAtt.body);
      if (text) w(`<div class="verdict-block"><h3>Style Verdict</h3><pre>${esc(text)}</pre></div>`);
    }

    // Errors
    if (t.errors.length > 0) {
      w(`<div class="error-block"><h3>Error</h3><pre>${t.errors.map(e => esc(e.replace(/\u001b\[[0-9;]*m/g, ''))).join('\n\n')}</pre></div>`);
    }

    // Screenshots (file-path references)
    const expectedImgs = t.attachments.filter((a) => a.name.includes('expected') && a.contentType.startsWith('image/'));
    const actualImgs = t.attachments.filter((a) => a.name.includes('actual') && a.contentType.startsWith('image/'));
    const diffImgs = t.attachments.filter((a) => a.name.includes('diff') && a.contentType.startsWith('image/'));
    const finalScreenshots = t.attachments.filter((a) => a.name === 'screenshot' && a.contentType.startsWith('image/'));
    const allImgTags: string[] = [];
    for (const a of expectedImgs) { const tag = buildImageTag(a, 'Baseline (Expected)', '#3fb950'); if (tag) allImgTags.push(tag); }
    for (const a of actualImgs) { const tag = buildImageTag(a, 'Actual', '#d29922'); if (tag) allImgTags.push(tag); }
    for (const a of diffImgs) { const tag = buildImageTag(a, 'Diff', '#f85149'); if (tag) allImgTags.push(tag); }
    for (const a of finalScreenshots) { const tag = buildImageTag(a, 'Final Screenshot', '#58a6ff'); if (tag) allImgTags.push(tag); }
    if (allImgTags.length > 0) {
      w(`<div class="ss-section"><h3>Screenshots</h3><div class="screenshots-row">${allImgTags.join('')}</div></div>`);
    }

    // Video (file-path reference)
    const videos = t.attachments.filter((a) => a.name === 'video');
    for (const v of videos) {
      const tag = buildVideoTag(v);
      if (tag) w(`<div class="video-section"><h3>Video Recording</h3>${tag}</div>`);
    }

    // Diff analysis
    const diffAnalysisAtt = t.attachments.find((a) => a.name.startsWith('diff-analysis'));
    if (diffAnalysisAtt?.body) {
      const text = decodeBase64(diffAnalysisAtt.body);
      if (text) w(`<div class="verdict-block"><h3>Diff Analysis</h3><pre>${esc(text)}</pre></div>`);
    }

    // Console output (key lines)
    const keyLines = t.stdout.filter(
      (l) => /token|property|css|pass|fail|xpath|actual|expected|diff|validat|error|canvas|preview/i.test(l)
    );
    if (keyLines.length > 0) {
      w(`<div class="verdict-block"><h3>Console Output</h3><pre>${keyLines.map(esc).join('')}</pre></div>`);
    }

    // Trace link
    const traces = t.attachments.filter((a) => a.name === 'trace');
    for (const tr of traces) {
      if (tr.path) {
        const rel = path.relative(PROJECT_ROOT, tr.path);
        w(`<div class="trace-link"><h3>Trace</h3><a href="https://trace.playwright.dev/" target="_blank">Open Trace Viewer</a> &mdash; <code>${esc(rel)}</code></div>`);
      }
    }

    w(`</div></div>\n`); // close test-body, test-card
  }

  // ——— Close test cards + JS ———
  w(`</div></div>\n`);

  w(`<script>
let currentStatus='all',currentWidget='',currentCategory='',currentSearch='',currentEnv='all',searchDebounce=null;

function renderChips(){
  var b=document.getElementById('activeChips');b.innerHTML='';
  if(currentCategory)b.innerHTML+='<span class="chip chip-category">'+currentCategory+'<span class="chip-x" onclick="clearCategory()">&times;</span></span>';
  if(currentWidget)b.innerHTML+='<span class="chip chip-widget">'+currentWidget.charAt(0).toUpperCase()+currentWidget.slice(1)+'<span class="chip-x" onclick="clearWidget()">&times;</span></span>';
  if(currentEnv!=='all')b.innerHTML+='<span class="chip chip-env">'+currentEnv.charAt(0).toUpperCase()+currentEnv.slice(1)+'<span class="chip-x" onclick="clearEnv()">&times;</span></span>';
  if(currentSearch)b.innerHTML+='<span class="chip chip-search">&ldquo;'+currentSearch+'&rdquo;<span class="chip-x" onclick="clearSearch()">&times;</span></span>';
}
function updateHeading(n){
  var p=[];
  if(currentCategory)p.push(currentCategory);
  if(currentWidget)p.push(currentWidget.charAt(0).toUpperCase()+currentWidget.slice(1));
  if(currentEnv!=='all')p.push(currentEnv.charAt(0).toUpperCase()+currentEnv.slice(1));
  if(currentSearch)p.push('"'+currentSearch+'"');
  var l=p.length?'Tests: '+p.join(' / '):'All Tests';
  if(typeof n==='number')l+=' ('+n+')';
  document.getElementById('test-list-heading').textContent=l;
}
function applyFilters(){
  var q=currentSearch,n=0;
  var cards=document.querySelectorAll('.test-card');
  for(var i=0;i<cards.length;i++){
    var c=cards[i];
    var s=currentStatus==='all'||c.dataset.status===currentStatus||(currentStatus==='failed'&&c.dataset.status==='timedOut');
    var w=!currentWidget||c.dataset.widget===currentWidget;
    var r=!q||(c.dataset.title&&c.dataset.title.indexOf(q)!==-1)||(c.dataset.widget&&c.dataset.widget.indexOf(q)!==-1)||(c.dataset.env&&c.dataset.env.indexOf(q)!==-1);
    var g=!currentCategory||c.dataset.failCategory===currentCategory;
    var e=currentEnv==='all'||c.dataset.env===currentEnv;
    var v=s&&w&&r&&g&&e;c.style.display=v?'':'none';if(v)n++;
  }
  renderChips();updateHeading(n);
}
function setStatusFilter(s,btn){
  currentStatus=s;
  document.querySelectorAll('.filters>button').forEach(function(b){b.classList.remove('active')});
  btn.classList.add('active');applyFilters();
}
function setEnvFilter(env,btn){
  currentEnv=env;
  document.querySelectorAll('.env-toggle button').forEach(function(b){b.classList.remove('active')});
  btn.classList.add('active');applyFilters();
}
function clearEnv(){currentEnv='all';document.querySelectorAll('.env-toggle button').forEach(function(b){b.classList.toggle('active',b.textContent==='Both')});applyFilters();}
function onSearchInput(){clearTimeout(searchDebounce);searchDebounce=setTimeout(function(){var v=document.getElementById('searchBox').value;currentSearch=v?v.toLowerCase().trim():'';applyFilters();},150);}
function clearSearch(){currentSearch='';document.getElementById('searchBox').value='';applyFilters();}
function filterByWidget(w){
  currentWidget=currentWidget===w?'':w;
  document.querySelectorAll('.widget-row').forEach(function(r){r.classList.toggle('active',r.dataset.widget===currentWidget)});
  applyFilters();
}
function clearWidget(){currentWidget='';document.querySelectorAll('.widget-row').forEach(function(r){r.classList.remove('active')});applyFilters();}
function filterByCategory(cat){
  currentCategory=currentCategory===cat?'':cat;
  document.querySelectorAll('.cat-row').forEach(function(r){r.classList.toggle('active',r.dataset.category===currentCategory)});
  document.getElementById('clearCatBtn').style.display=currentCategory?'inline':'none';
  if(currentCategory){currentStatus='failed';document.querySelectorAll('.filters>button').forEach(function(b){b.classList.remove('active')});document.querySelectorAll('.filters>button').forEach(function(b){if(b.textContent.startsWith('Failed'))b.classList.add('active')});}
  applyFilters();document.getElementById('test-list-section').scrollIntoView({behavior:'smooth'});
}
function clearCategory(){currentCategory='';document.querySelectorAll('.cat-row').forEach(function(r){r.classList.remove('active')});document.getElementById('clearCatBtn').style.display='none';applyFilters();}
</script></body></html>`);

  ws.end(() => {
    const stat = fs.statSync(OUT_FILE);
    const sizeMB = (stat.size / (1024 * 1024)).toFixed(1);
    console.log(`✅ Report generated: ${OUT_FILE} (${sizeMB} MB)`);
    console.log(`💡 To view with video playback, run: npm run report:serve`);
  });
}

generate();
