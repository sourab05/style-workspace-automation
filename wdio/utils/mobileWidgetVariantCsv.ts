import * as fs from 'fs';
import * as path from 'path';
import type { Widget } from '../../src/matrix/widgets';

/**
 * Simple CSV loader for per-page mobile widget variant mapping.
 *
 * CSV format (per page):
 *   variantName,studioWidgetName
 *   button-filled-primary-default,button1
 */

export interface WidgetVariantCsvRow {
  variantName: string;
  studioWidgetName: string;
}

function getCsvPathForWidget(widget: Widget): string {
  // NOTE: widget is already the canonical key (e.g. 'button', 'accordian').
  return path.join(
    process.cwd(),
    'tests',
    'testdata',
    'mobile',
    `${widget}-widget-variants.csv`,
  );
}

/**
 * Loads the CSV rows for a given widget page.
 */
export function loadWidgetVariantRows(widget: Widget): WidgetVariantCsvRow[] {
  const csvPath = getCsvPathForWidget(widget);

  if (!fs.existsSync(csvPath)) {
    console.warn(`Widget variant CSV not found for widget '${widget}' at ${csvPath}`);
    return [];
  }

  const raw = fs.readFileSync(csvPath, 'utf-8');
  const lines = raw
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length <= 1) {
    return [];
  }

  // Assume first line is header: variantName,studioWidgetName
  const rows: WidgetVariantCsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const [variantNameRaw, studioWidgetNameRaw] = line.split(',');

    if (!variantNameRaw || !studioWidgetNameRaw) {
      continue;
    }

    rows.push({
      variantName: variantNameRaw.trim(),
      studioWidgetName: studioWidgetNameRaw.trim(),
    });
  }

  return rows;
}

/**
 * Looks up the studio widget name for a given widget + variantName
 * based on the per-page CSV.
 */
export function getStudioWidgetNameForVariant(
  widget: Widget,
  variantName: string,
): string | null {
  const rows = loadWidgetVariantRows(widget);

  const match = rows.find(r => r.variantName === variantName);
  if (!match) {
    console.warn(
      `No studioWidgetName mapping found for widget='${widget}', variantName='${variantName}' ` +
        '(check the per-page CSV under tests/testdata/mobile)',
    );
    return null;
  }

  return match.studioWidgetName;
}
