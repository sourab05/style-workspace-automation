/**
 * Verify all tokens in .test-cache/batch-payload-*.json against widget-token-slots.json.
 * Writes a summary + per-widget report under artifacts/payload-coverage/
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Widget } from '../src/matrix/widgets';
import { PayloadConfigComparator } from '../wdio/utils/payloadConfigComparator';
import { WidgetTokenConfigRegistry } from '../wdio/config/widgetTokenConfig';

const CACHE_DIR = path.join(process.cwd(), '.test-cache');
const OUT_DIR = path.join(process.cwd(), 'artifacts', 'payload-coverage');

interface WidgetSummary {
  widget: string;
  payloadFile: string;
  totalConfigured: number;
  totalInPayload: number;
  matched: number;
  coveragePercent: number;
  missingInPayload: number;
  unexpectedInPayload: number;
  error?: string;
}

function main(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    console.error(`Missing cache dir: ${CACHE_DIR}`);
    process.exit(1);
  }

  const payloadFiles = fs
    .readdirSync(CACHE_DIR)
    .filter((f) => f.startsWith('batch-payload-') && f.endsWith('.json'))
    .sort();

  if (payloadFiles.length === 0) {
    console.error('No batch-payload-*.json files found in .test-cache');
    process.exit(1);
  }

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const summaries: WidgetSummary[] = [];
  const fullReports: string[] = [];

  for (const file of payloadFiles) {
    const widget = file.replace(/^batch-payload-/, '').replace(/\.json$/, '') as Widget;
    const payloadPath = path.join(CACHE_DIR, file);

    try {
      const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf-8'));

      if (!WidgetTokenConfigRegistry.hasConfig(widget)) {
        summaries.push({
          widget,
          payloadFile: file,
          totalConfigured: 0,
          totalInPayload: 0,
          matched: 0,
          coveragePercent: 0,
          missingInPayload: 0,
          unexpectedInPayload: 0,
          error: 'No widget-token-slots.json entry',
        });
        continue;
      }

      const comparison = PayloadConfigComparator.compare(widget, payload);
      const report = PayloadConfigComparator.generateReport(comparison);

      fs.writeFileSync(path.join(OUT_DIR, `${widget}-payload-comparison.txt`), report, 'utf-8');
      fullReports.push(report);

      summaries.push({
        widget,
        payloadFile: file,
        totalConfigured: comparison.coverage.totalConfigured,
        totalInPayload: comparison.coverage.totalInPayload,
        matched: comparison.coverage.matched,
        coveragePercent: comparison.coverage.coveragePercent,
        missingInPayload: comparison.missingInPayload.length,
        unexpectedInPayload: comparison.unexpectedInPayload.length,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      summaries.push({
        widget,
        payloadFile: file,
        totalConfigured: 0,
        totalInPayload: 0,
        matched: 0,
        coveragePercent: 0,
        missingInPayload: 0,
        unexpectedInPayload: 0,
        error: message,
      });
    }
  }

  const ok = summaries.filter((s) => !s.error && s.missingInPayload === 0 && s.unexpectedInPayload === 0);
  const partial = summaries.filter(
    (s) => !s.error && (s.missingInPayload > 0 || s.unexpectedInPayload > 0),
  );
  const errored = summaries.filter((s) => s.error);

  let summaryText = '';
  summaryText += `${'='.repeat(100)}\n`;
  summaryText += `BATCH PAYLOAD vs TOKEN SLOTS — SUMMARY\n`;
  summaryText += `Generated: ${new Date().toISOString()}\n`;
  summaryText += `Payload files: ${payloadFiles.length}\n`;
  summaryText += `${'='.repeat(100)}\n\n`;

  summaryText += `| Widget | Configured | In Payload | Matched | Coverage | Missing | Unexpected |\n`;
  summaryText += `|${'-'.repeat(20)}|${'-'.repeat(12)}|${'-'.repeat(12)}|${'-'.repeat(9)}|${'-'.repeat(10)}|${'-'.repeat(9)}|${'-'.repeat(12)}|\n`;

  for (const s of summaries) {
    if (s.error) {
      summaryText += `| ${s.widget.padEnd(18)} | ERROR: ${s.error.substring(0, 60)} |\n`;
      continue;
    }
    const icon = s.missingInPayload === 0 && s.unexpectedInPayload === 0 ? '✅' : '⚠️';
    summaryText += `| ${icon} ${s.widget.padEnd(16)} | ${String(s.totalConfigured).padStart(10)} | ${String(s.totalInPayload).padStart(10)} | ${String(s.matched).padStart(7)} | ${s.coveragePercent.toFixed(1).padStart(8)}% | ${String(s.missingInPayload).padStart(7)} | ${String(s.unexpectedInPayload).padStart(10)} |\n`;
  }

  summaryText += `\n${'='.repeat(100)}\n`;
  summaryText += `✅ Full match (no gaps):     ${ok.length}\n`;
  summaryText += `⚠️  Gaps (missing/unexpected): ${partial.length}\n`;
  summaryText += `❌ Errors:                   ${errored.length}\n`;
  summaryText += `${'='.repeat(100)}\n`;

  if (partial.length > 0) {
    summaryText += `\nWIDGETS WITH GAPS:\n`;
    for (const s of partial) {
      summaryText += `  • ${s.widget}: ${s.missingInPayload} missing in payload, ${s.unexpectedInPayload} unexpected in payload\n`;
    }
  }

  if (errored.length > 0) {
    summaryText += `\nERRORS:\n`;
    for (const s of errored) {
      summaryText += `  • ${s.widget}: ${s.error}\n`;
    }
  }

  const summaryPath = path.join(OUT_DIR, 'payload-coverage-summary.txt');
  const fullPath = path.join(OUT_DIR, 'payload-coverage-full.txt');
  fs.writeFileSync(summaryPath, summaryText, 'utf-8');
  fs.writeFileSync(fullPath, fullReports.join('\n'), 'utf-8');

  console.log(summaryText);
  console.log(`\n📄 Summary: ${summaryPath}`);
  console.log(`📄 Full reports: ${fullPath}`);
  console.log(`📄 Per-widget: ${OUT_DIR}/*-payload-comparison.txt`);

  process.exit(partial.length > 0 || errored.length > 0 ? 1 : 0);
}

main();
