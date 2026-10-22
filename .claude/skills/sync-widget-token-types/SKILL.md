---
name: sync-widget-token-types
description: Sync allowedTokenTypes in WIDGET_CONFIG (src/matrix/widgets.ts) with the actual token types defined in widget-token-slots.json. Use when token slots change, new widgets are added, after scrape:slots:approve, or when the user reports tests running for token types that don't exist in the widget's slots.
---

# Sync Widget Token Types

## Problem

`WIDGET_CONFIG[widget].allowedTokenTypes` in `src/matrix/widgets.ts` must match the actual `tokenType` values present in `wdio/config/widget-token-slots.json`. When they diverge:
- Tests run for token types that have no slots (wasted time, false failures)
- New token types from scraping aren't tested (missing coverage)

## When to Run

- After `npm run scrape:slots:approve` merges new token slots
- After manually editing `widget-token-slots.json`
- When mobile tests fail with tokens that don't exist in slots
- As a final step in the scraper workflow

## Workflow

### Step 1: Detect mismatches

Run this Node.js snippet to compare both files:

```bash
node -e "
const slots = require('./wdio/config/widget-token-slots.json');
const { WIDGET_CONFIG } = require('./dist/matrix/widgets') || {};
// If dist doesn't exist, use ts-node
" 2>/dev/null || npx ts-node -e "
import { WIDGET_CONFIG } from './src/matrix/widgets';
import * as fs from 'fs';
const slots = JSON.parse(fs.readFileSync('./wdio/config/widget-token-slots.json', 'utf-8'));

const mismatches: string[] = [];
for (const [widget, config] of Object.entries(WIDGET_CONFIG)) {
  const slotData = slots[widget];
  if (!slotData?.tokenSlots) continue;
  const slotTypes = new Set(slotData.tokenSlots.map((s: any) => s.tokenType));
  const configTypes = new Set(config.allowedTokenTypes || []);

  const inConfigNotSlots = [...configTypes].filter(t => !slotTypes.has(t));
  const inSlotsNotConfig = [...slotTypes].filter(t => !configTypes.has(t));

  if (inConfigNotSlots.length > 0) {
    mismatches.push(widget + ': REMOVE from allowedTokenTypes: ' + inConfigNotSlots.join(', '));
  }
  if (inSlotsNotConfig.length > 0) {
    mismatches.push(widget + ': ADD to allowedTokenTypes: ' + inSlotsNotConfig.join(', '));
  }
}
if (mismatches.length === 0) {
  console.log('All widgets in sync.');
} else {
  console.log('MISMATCHES FOUND:');
  mismatches.forEach(m => console.log('  ' + m));
}
"
```

### Step 2: Fix mismatches and generate report

For each mismatch, update `src/matrix/widgets.ts`:

| Mismatch | Action |
|----------|--------|
| `REMOVE from allowedTokenTypes: icon` | Delete `'icon'` from that widget's `allowedTokenTypes` array |
| `ADD to allowedTokenTypes: gap, margin` | Add `'gap', 'margin'` to that widget's `allowedTokenTypes` array |

After applying all fixes, generate a sync report at `reports/token-type-sync-report.txt`:

```bash
npx ts-node -e "
import { WIDGET_CONFIG } from './src/matrix/widgets';
import * as fs from 'fs';
const slots = JSON.parse(fs.readFileSync('./wdio/config/widget-token-slots.json', 'utf-8'));

const lines: string[] = [];
lines.push('════════════════════════════════════════════════════════════════');
lines.push('  TOKEN TYPE SYNC REPORT');
lines.push('════════════════════════════════════════════════════════════════');
lines.push('  Generated: ' + new Date().toLocaleString());
lines.push('');

let totalWidgets = 0, syncedWidgets = 0, mismatchWidgets = 0;
const changes: string[] = [];

for (const [widget, config] of Object.entries(WIDGET_CONFIG)) {
  const slotData = (slots as any)[widget];
  if (!slotData?.tokenSlots) continue;
  totalWidgets++;
  const slotTypes = [...new Set(slotData.tokenSlots.map((s: any) => s.tokenType))].sort();
  const configTypes = [...new Set(config.allowedTokenTypes || [])].sort();

  const inConfigNotSlots = configTypes.filter((t: string) => !slotTypes.includes(t));
  const inSlotsNotConfig = slotTypes.filter((t: string) => !configTypes.includes(t));

  if (inConfigNotSlots.length === 0 && inSlotsNotConfig.length === 0) {
    syncedWidgets++;
    lines.push('  ✅ ' + widget + ': [' + configTypes.join(', ') + ']');
  } else {
    mismatchWidgets++;
    lines.push('  ❌ ' + widget + ':');
    lines.push('     slots:  [' + slotTypes.join(', ') + ']');
    lines.push('     config: [' + configTypes.join(', ') + ']');
    if (inConfigNotSlots.length) {
      lines.push('     REMOVE: ' + inConfigNotSlots.join(', '));
      changes.push(widget + ': removed ' + inConfigNotSlots.join(', '));
    }
    if (inSlotsNotConfig.length) {
      lines.push('     ADD:    ' + inSlotsNotConfig.join(', '));
      changes.push(widget + ': added ' + inSlotsNotConfig.join(', '));
    }
  }
}

lines.push('');
lines.push('────────────────────────────────────────────────────────────────');
lines.push('  SUMMARY');
lines.push('────────────────────────────────────────────────────────────────');
lines.push('  Total widgets with slots: ' + totalWidgets);
lines.push('  In sync:                  ' + syncedWidgets);
lines.push('  Mismatched:               ' + mismatchWidgets);
lines.push('');

if (changes.length > 0) {
  lines.push('  CHANGES APPLIED:');
  changes.forEach(c => lines.push('    • ' + c));
} else {
  lines.push('  ✅ All widgets in sync — no changes needed.');
}
lines.push('');

const report = lines.join('\n');
fs.mkdirSync('reports', { recursive: true });
fs.writeFileSync('reports/token-type-sync-report.txt', report);
console.log(report);
console.log('📄 Report saved to: reports/token-type-sync-report.txt');
"
```

### Step 3: Verify

Re-run the mismatch detection script. Output should be `All widgets in sync.`

### Step 4: Regenerate test cases and confirm coverage

```bash
npm run generate:slot-tests        # writes .test-cache/slot-test-cases.json
```

Then confirm each newly allowed token type actually produced cases, e.g. count entries in
`.test-cache/slot-test-cases.json` where `widget` and `propertyPath` match a token that was NO RESULT before.
Fields per case: `widget, appearance, variant, state, tokenType, propertyPath, tokenRef, testId`.

## Gotchas (learned 2026-10)

1. **Silent coverage loss is the main failure mode.** Test cases are generated per `allowedTokenTypes`. After
   `scrape:slots:approve`, tokens whose type changed (e.g. `space` → `margin` / `gap` / `font`) or that arrived
   under a new type simply get **no test and no failure**. In the Oct 19 Jenkins run, 31 of 45 re-typed tokens and
   several new ones (button `gap`, chips `gap`/`margin`, carousel `margin`, list `box-shadow`) had no result for
   this reason. Always run this skill right after `approve`, before the next device run.
2. **Removals reduce coverage on purpose.** `icon` was removed from barcodescanner, fileupload, radioset, icon and
   `font` from rating because their slots no longer use those types (tokens were re-typed). That follows the
   source-of-truth rule; expect those widgets' re-typed tokens to be tested under the new type.
3. **Run ad-hoc detection scripts from the repo root with `npx ts-node -e "$(cat script.ts)"`** and a relative import
   (`./src/matrix/widgets`). A `.ts` file in the scratchpad fails with `Unknown file extension ".ts"`.
   The `node -e ... require('./dist/...')` prefix in Step 1 never works (no `dist/`); use the ts-node form.
4. **`TokenType` union must contain the type** (`src/matrix/widgets.ts`). `gap`, `margin`, `opacity`, `icon`,
   `elevation` already exist; a brand-new type needs adding to the union first, or `tsc` fails.
5. **text-transform is deliberately not tested** (user decision, 2026-10-22). A missing result for anchor/button
   `text-transform` is expected and is not a sync problem.
6. **Slot-type sync does not fix mappings.** A token with test cases but an empty or wrong `Actual` needs a
   `mobileMapper.ts` entry; use `verify-rn-style-mapping --new-slots-only`.

## Key Files

| File | Purpose |
|------|---------|
| `wdio/config/widget-token-slots.json` | Source of truth for token types per widget |
| `src/matrix/widgets.ts` | `WIDGET_CONFIG` with `allowedTokenTypes` arrays |
| `reports/token-type-sync-report.txt` | Generated report showing sync status of all widgets |

## Rules

- `widget-token-slots.json` is the **source of truth** — `allowedTokenTypes` must match it, not the other way around.
- Never add a token type to `allowedTokenTypes` that doesn't exist in the widget's token slots.
- Never remove a token type from `widget-token-slots.json` to match `allowedTokenTypes`.
- After fixing, regenerate test data: `npm run test:mobile:setup` or `npm run generate:slot-tests`.
