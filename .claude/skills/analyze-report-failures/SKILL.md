---
name: analyze-report-failures
description: Analyze failures in Style Workspace Playwright token validation reports. Use when the user wants to analyze test failures, categorize errors, find failure patterns, cluster failures by widget/token/property, compare runs, or understand why tests failed.
---

# Analyze Report Failures

## Report Locations

| File | Purpose |
|------|---------|
| `artifacts/playwright-token-reports/preview/<widget>-report.json` | Per-widget JSON results (primary source) |
| `artifacts/playwright-token-reports/preview/overall-summary.json` | Aggregated pass/fail counts per widget |
| `artifacts/playwright-token-reports/preview/<widget>-playwright-token-validation.txt` | Human-readable text verdicts |
| `reports/playwright-report.html` | Custom HTML report (generated via `npm run report:generate`) |

## JSON Report Schema

Each `<widget>-report.json` contains:

```json
{
  "widget": "popover",
  "summary": { "totalTests": 104, "passedTests": 50, "failedTests": 41, "errorTests": 13 },
  "coverage": { "totalSlots": 45, "testedSlots": 45, "coverage": 100 },
  "slotDetails": [{ "tokenType": "color", "totalProperties": 10, "passedProperties": 5, "failedProperties": ["border.color"] }],
  "results": [
    {
      "testId": "popover-standard-standard-default-border-radius-preview",
      "widget": "popover",
      "appearance": "standard",
      "variant": "standard",
      "state": "default",
      "tokenType": "border-radius",
      "propertyPath": "border.radius",
      "tokenRef": "{radius.sm.value}",
      "expectedValue": "8px",
      "preview": {
        "status": "PASS | FAIL | ERROR | SKIPPED",
        "actualValue": "0",
        "error": "CSS 'borderRadius' Expected: 8, Got: 0",
        "visualChange": true,
        "diffPixels": 185511
      },
      "overallStatus": "FAIL"
    }
  ]
}
```

## Failure Categories

Classify each failed test into one of these categories based on `preview.error` and `preview.actualValue`:

| Category | Pattern | Meaning |
|----------|---------|---------|
| **VALUE_MISMATCH** | `error` contains "Expected: X, Got: Y" and both are real values | Token applied but wrong value returned |
| **NOT_APPLIED** | Expected differs from actual, actual matches default/zero | Token wasn't applied to the widget |
| **EMPTY_OBJECT** | `actualValue` is `{}` or `[]` | Shorthand property not expanded (e.g., `borderWidth` → `borderTopWidth`) |
| **ELEMENT_NOT_FOUND** | `error` contains "Timeout", "waitForSelector", "not found" | Widget/element not visible in preview |
| **MAPPING_ERROR** | `error` contains wrong CSS property name or `actualValue` is from wrong property | `mobileMapper.ts` maps to wrong RN style path |
| **TOKEN_MISMATCH** | Expected value is wrong type for property (e.g., weight value `700` in `fontFamily`) | `tokenSlotGenerator.ts` selected incompatible token |
| **UNDEFINED** | `actualValue` is `null`, `undefined`, or empty string | RN command returned nothing — widget or style path doesn't exist |

## Analysis Workflow

### Step 1: Load reports

```javascript
// Read all latest widget report JSONs
const fs = require('fs');
const dir = 'artifacts/playwright-token-reports/preview';
const files = fs.readdirSync(dir).filter(f => f.endsWith('-report.json') && f !== 'overall-summary.json');
const allResults = [];
for (const f of files) {
  const data = JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8'));
  for (const r of data.results) allResults.push(r);
}
```

### Step 2: Filter failures

```javascript
const failures = allResults.filter(r => r.preview.status === 'FAIL' || r.preview.status === 'ERROR');
```

### Step 3: Categorize

Use the error patterns above to assign a category to each failure.

### Step 4: Cluster and output

Cluster failures by these dimensions (most useful first):
1. **By category** — shows what kind of fixes are needed
2. **By widget** — shows which widgets need attention
3. **By token type** — shows if a specific type (font, color, space) is systematically broken
4. **By property pattern** — shows if specific properties fail across widgets (e.g., all `border.width` failures)
5. **By state** — shows if non-default states (active, disabled, focused) fail more

## Output Format

Present results as a summary table first, then detailed clusters:

```
=== FAILURES: 263 (out of 746 tests) ===

--- BY CATEGORY ---
  VALUE_MISMATCH:     120  (token applied but wrong value)
  ELEMENT_NOT_FOUND:   85  (widget not visible)
  EMPTY_OBJECT:        30  (shorthand not expanded)
  MAPPING_ERROR:       15  (wrong RN style path)
  NOT_APPLIED:         13  (token not propagated)

--- BY WIDGET (top 10) ---
  button          fail=122, error=31, total=153
  tabbar          fail=38,  error=34, total=72
  ...

--- BY TOKEN TYPE ---
  space           98
  font            65
  color           52
  ...

--- TOP FAILING PROPERTIES ---
  border.width    → 30 failures across 6 widgets (EMPTY_OBJECT: shorthand expansion)
  border.radius   → 19 failures across 5 widgets (EMPTY_OBJECT)
  font-family     → 12 failures across 4 widgets (TOKEN_MISMATCH)
  ...

--- ACTIONABLE CLUSTERS ---
[EMPTY_OBJECT] 49 failures — FIX in mobileMapper.ts:
  border.width → should map to borderTopWidth (not borderWidth)
  border.radius → should map to borderTopLeftRadius (not borderRadius)
  padding → should map to paddingTop (not padding)

[MAPPING_ERROR] 15 failures — FIX in mobileMapper.ts:
  popover: root.padding should be popover.paddingTop
  tabbar active: icon.color should be activeTabIcon.icon.color
  ...
```

## Comparing Runs

When the user provides two reports (before/after a fix), compare them:
1. Count pass/fail deltas per widget
2. Identify newly passing tests (fixed)
3. Identify newly failing tests (regressions)
4. Highlight unchanged failures (still need fixing)

## Key Files for Fixing Issues

| Issue category | Fix in |
|---|---|
| MAPPING_ERROR / EMPTY_OBJECT | `wdio/utils/mobileMapper.ts` — `mapToRnStylePath()` |
| TOKEN_MISMATCH | `src/playwright/tokenSlotGenerator.ts` — `isTokenCompatible()` |
| ELEMENT_NOT_FOUND | Widget XPath or variant CSV — `src/matrix/widget-xpaths.ts`, `tests/testdata/mobile/*.csv` |
| NOT_APPLIED | Studio API or token payload — `src/playwright/tokenSlotGenerator.ts` — `generatePayloadForTestCase()` |

## Custom Report Generation

```bash
# Generate clean report (no skipped tests)
npm run report:generate:clean

# Filter by specific widgets
npx ts-node scripts/generate-playwright-report.ts --widgets popover,tabbar --exclude-status skipped

# Exclude widgets
npx ts-node scripts/generate-playwright-report.ts --exclude-widgets modal-dialog --exclude-status skipped

# Serve the report
npm run report:serve
```
