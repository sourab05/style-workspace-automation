# Style Workspace Automation - Confluence

This is a split page version for stable Confluence rendering.

---

## 04-ADDING-NEW-WIDGETS

# Adding New Widgets

This guide walks you through every step required to add a new widget to the Style Workspace Automation framework. It covers both web (Playwright) and mobile (WebDriverIO) integration.

We use the **button** widget as a reference example throughout this guide.

---

## Table of Contents

1. [Overview](#overview)
2. [Step 1: Add Widget Configuration](#step-1-add-widget-configuration)
3. [Step 2: Define XPath Selectors](#step-2-define-xpath-selectors)
4. [Step 3: Add Token Slot Definitions](#step-3-add-token-slot-definitions)
5. [Step 4: Create Test Data CSV](#step-4-create-test-data-csv)
6. [Step 5: Add RN Style Mappings](#step-5-add-rn-style-mappings)
7. [Step 6: Create Mobile Spec File](#step-6-create-mobile-spec-file)
8. [Step 7: Capture Baseline Screenshots](#step-7-capture-baseline-screenshots)
9. [Step 8: Register NPM Scripts](#step-8-register-npm-scripts)
10. [Verification Checklist](#verification-checklist)
11. [Reference: Button Widget Walkthrough](#reference-button-widget-walkthrough)

---

## Overview

Adding a new widget involves touching these files:

| File | Purpose |
|------|---------|
| `src/matrix/widgets.ts` | Widget type, config, and structure type |
| `src/matrix/widget-xpaths.ts` | XPath selectors for canvas, preview, and mobile |
| `wdio/config/widget-token-slots.json` | Token slot definitions (source of truth) |
| `tests/testdata/mobile/{widget}-widget-variants.csv` | Variant-to-Studio-widget mapping |
| `wdio/utils/mobileMapper.ts` | RN style path mappings |
| `wdio/specs/mobile.{widget}.token.validate.spec.ts` | Mobile test spec |
| `package.json` | NPM scripts for running widget-specific tests |

---

## Step 1: Add Widget Configuration

**File**: `src/matrix/widgets.ts`

### 1a. Add the Widget Type

Add your widget name to the `Widget` type union:

```typescript
export type Widget =
  | 'button'
  | 'accordion'
  // ... existing widgets ...
  | 'my-new-widget';  // <-- Add here
```

### 1b. Add the Widget Config

Add a configuration entry to `WIDGET_CONFIG`:

```typescript
export const WIDGET_CONFIG: Record<Widget, WidgetConfig> = {
  // ... existing configs ...

  'my-new-widget': {
    appearances: ['filled', 'outlined'],   // Visual styles available
    variants: {
      filled: ['primary', 'secondary'],    // Variants per appearance
      outlined: ['primary'],
    },
    states: ['default', 'disabled'],       // Interactive states
    allowedTokenTypes: [                   // Which token types this widget supports
      'color', 'font', 'border-radius', 'border-width',
      'border-style', 'space', 'elevation'
    ]
  },
};
```

**How to determine these values:**

- **Appearances**: Check the widget's design spec in WaveMaker Studio
- **Variants**: List the variant options available per appearance
- **States**: Check which interactive states the widget supports
- **allowedTokenTypes**: See the section below on how to discover which token types your widget supports

### Where to Find Available Token Types

The framework supports 14 token types. They are defined in two places:

1. **`src/matrix/widgets.ts`** -- The `TokenType` union type lists all available token types:

   ```typescript
   export type TokenType =
     | 'color' | 'font' | 'border' | 'border-width' | 'border-style'
     | 'border-radius' | 'margin' | 'gap' | 'space' | 'spacer'
     | 'elevation' | 'box-shadow' | 'opacity' | 'icon' | 'asterisk-color'
     | 'padding';
   ```

2. **`src/matrix/generator.ts`** -- The `TOKEN_TYPES` array lists the token types used by the matrix generator:

   ```typescript
   const TOKEN_TYPES: TokenType[] = [
     'color', 'font', 'border-width', 'border-style', 'border-radius',
     'margin', 'gap', 'space', 'elevation', 'box-shadow', 'opacity',
     'icon', 'asterisk-color', 'padding'
   ];
   ```

**To determine which token types your widget supports:**

1. **Check the widget's token files**: Look in `tokens/web/components/{widget}/` and `tokens/mobile/components/{widget}/`. The token file names and their content indicate which property categories (color, font, spacing, etc.) the widget supports.
2. **Inspect in WaveMaker Studio**: Open the Style Workspace for your widget in Studio. The token customization panel shows which property categories are available (Background, Text, Border, Spacing, etc.).
3. **Reference similar widgets**: Look at existing widgets in `WIDGET_CONFIG` that have a similar structure. For example, if your widget is a simple container, reference `panel`; if it is an input, reference `formcontrols`.

| Token Type | What It Styles | Common Widgets |
|-----------|---------------|----------------|
| `color` | background-color, text color, border-color | Nearly all widgets |
| `font` | font-size, font-weight, line-height, font-family | Any widget with text |
| `border-width` | border-width | Widgets with visible borders |
| `border-style` | border-style (solid, dashed, etc.) | Widgets with visible borders |
| `border-radius` | border-radius | Widgets with rounded corners |
| `margin` | outer margin | Widgets that need spacing from siblings |
| `space` / `padding` / `spacer` | inner padding, height, width | Nearly all widgets |
| `gap` | gap between child elements | Widgets with flex layout |
| `elevation` / `box-shadow` | box-shadow / elevation | Widgets with raised appearance |
| `opacity` | opacity | Any widget needing transparency |
| `icon` | icon size | Widgets containing icons |
| `asterisk-color` | asterisk color in required fields | Form-related widgets |

### 1c. Add the Structure Type

Add your widget to `WIDGET_STRUCTURE_MAP`:

```typescript
export const WIDGET_STRUCTURE_MAP: Record<Widget, StructureType> = {
  // ... existing mappings ...
  'my-new-widget': 'variant-groups',  // Most widgets use this
};
```

**Structure type guide:**

| Structure Type | When to Use | Example Widgets |
|---------------|-------------|-----------------|
| `variant-groups` | Widget has appearances with variant groups (most common) | button, panel, label |
| `direct-mapping` | Widget has a simple flat mapping, no variant nesting | accordion, anchor |
| `appearance-mapping` | Widget has per-appearance mappings without variant groups | cards |
| `hybrid-mapping` | Widget has both root-level and appearance-specific mappings | navbar |

---

## Step 2: Define XPath Selectors

**File**: `src/matrix/widget-xpaths.ts`

Add XPath selectors for every appearance-variant-state combination.

### Canvas XPaths

```typescript
export const widgetXPaths = {
  canvas: {
    // Pattern: '{widget}-{appearance}-{variant}-{state}'
    'my-new-widget-filled-primary-default': '//div[contains(@class, "my-widget")]//div[contains(@class, "filled-primary")]',
    'my-new-widget-filled-primary-disabled': '//div[contains(@class, "my-widget")]//div[contains(@class, "filled-primary") and @disabled]',
    'my-new-widget-filled-secondary-default': '//div[contains(@class, "my-widget")]//div[contains(@class, "filled-secondary")]',
    'my-new-widget-outlined-primary-default': '//div[contains(@class, "my-widget")]//div[contains(@class, "outlined-primary")]',
    // ... one entry per combination
  }
};
```

### Mobile Selectors

```typescript
export const mobileWidgetSelectors = {
  android: {
    'my-new-widget-filled-primary-default': 'android=new UiSelector().resourceId("mywidget1")',
    // ...
  },
  ios: {
    'my-new-widget-filled-primary-default': '~mywidget1',
    // ...
  }
};
```

**Tips for finding XPaths:**

1. Open WaveMaker Studio in Chrome DevTools
2. Navigate to the widget on the canvas
3. Inspect the element to find unique class names or attributes
4. For mobile, check the accessibility IDs in the React Native component tree

---

## Step 3: Add Token Slot Definitions

**File**: `wdio/config/widget-token-slots.json`

This is the **source of truth** for what properties each widget supports. The structure uses a flat `tokenSlots` array per widget, where each entry specifies a token type and its applicable properties.

Add a complete definition for your widget:

```json
{
  "my-new-widget": {
    "tokenSlots": [
      {
        "tokenType": "color",
        "properties": [
          "background",
          "color",
          "border.color"
        ]
      },
      {
        "tokenType": "font",
        "properties": [
          "font-size",
          "font-weight",
          "line-height",
          "letter-spacing",
          "font-family"
        ]
      },
      {
        "tokenType": "border-radius",
        "properties": [
          "border.radius"
        ]
      },
      {
        "tokenType": "border-width",
        "properties": [
          "border.width"
        ]
      },
      {
        "tokenType": "border-style",
        "properties": [
          "border.style"
        ]
      },
      {
        "tokenType": "space",
        "properties": [
          "padding.top",
          "padding.bottom",
          "padding.left",
          "padding.right",
          "height"
        ]
      },
      {
        "tokenType": "elevation",
        "properties": [
          "shadow"
        ]
      }
    ]
  }
}
```

Here is the real button widget entry for reference:

```json
{
  "button": {
    "tokenSlots": [
      { "tokenType": "color", "properties": ["background", "color", "border.color"] },
      { "tokenType": "font", "properties": ["font-size", "font-weight", "line-height", "letter-spacing", "font-family"] },
      { "tokenType": "icon", "properties": ["icon-size"] },
      { "tokenType": "border-radius", "properties": ["radius"] },
      { "tokenType": "border-width", "properties": ["border.width"] },
      { "tokenType": "border-style", "properties": ["border.style"] },
      { "tokenType": "elevation", "properties": ["shadow"] },
      { "tokenType": "opacity", "properties": ["opacity"] },
      { "tokenType": "gap", "properties": ["gap"] },
      { "tokenType": "space", "properties": ["padding.top", "padding.bottom", "padding.left", "padding.right", "height", "min-width"] }
    ]
  }
}
```

**How to determine token slots:**

1. Check the widget's design tokens in `tokens/web/components/{widget}/` or `tokens/mobile/components/{widget}/`
2. Review the component's CSS/style sheet to see which properties are tokenized
3. Test in Studio by applying tokens manually and observing which properties change
4. Look at existing widgets (button, accordion, label) in `widget-token-slots.json` as examples

---

## Step 4: Create Test Data CSV

**File**: `tests/testdata/mobile/{widget}-widget-variants.csv`

Create a CSV mapping variant names to Studio widget instance names:

```csv
variantName,studioWidgetName
my-new-widget-filled-primary-default,mynewwidget1
my-new-widget-filled-primary-disabled,mynewwidget2
my-new-widget-filled-secondary-default,mynewwidget3
my-new-widget-outlined-primary-default,mynewwidget4
my-new-widget-outlined-primary-disabled,mynewwidget5
```

**Important:**

- `variantName` must match the key pattern used in `widget-xpaths.ts`
- `studioWidgetName` is the actual widget instance name in the WaveMaker Studio page (e.g., `button1`, `button2`)
- Create one instance per variant combination in the Studio project

---

## Step 5: Add RN Style Mappings

**File**: `wdio/utils/mobileMapper.ts`

Add mappings that convert logical CSS property paths to React Native style paths for your widget:

```typescript
// In the MobileMapper class
static mapToRnStylePath(widget: string, propertyPath: string): string {
  const mappings: Record<string, Record<string, string>> = {
    // ... existing mappings ...

    'my-new-widget': {
      'background': 'root.backgroundColor',
      'color': 'text.color',
      'border.color': 'root.borderColor',
      'fontSize': 'text.fontSize',
      'fontWeight': 'text.fontWeight',
      'lineHeight': 'text.lineHeight',
      'borderRadius': 'root.borderRadius',
      'borderWidth': 'root.borderWidth',
      'borderStyle': 'root.borderStyle',
      'padding': 'root.paddingTop',
      'shadow': 'root.elevation',
    },
  };

  return mappings[widget]?.[propertyPath] || `root.${propertyPath}`;
}
```

**How to determine RN style paths:**

1. Run the mobile app in debug mode
2. Use the style inspector (`~exinput_i`) to query different paths. For example, type `App.appConfig.currentPage.Widgets.mynewwidget1._INSTANCE.styles` to see the full style tree.
3. Check the React Native component source to understand the style hierarchy

---

## Step 6: Create Mobile Spec File

**File**: `wdio/specs/mobile.my-new-widget.token.validate.spec.ts`

Create a spec file following the same pattern as existing widget specs (e.g., `mobile.button.token.validate.spec.ts`). The spec file:

1. Loads the batch payload from `.test-cache/batch-payload-my-new-widget.json`
2. Loads the variant-to-widget mapping from the CSV file
3. Extracts applied token pairs by recursing into the payload structure
4. Creates test cases for screenshot comparison and style value verification

Use an existing spec as your template. Here is the key structure:

```typescript
import * as path from 'path';
import * as fs from 'fs';
import allure from '@wdio/allure-reporter';
import { MobileWidgetPage } from '../pages/MobileWidget.page';
import { ScreenshotHelpers } from '../helpers/screenshot.helpers';
import { MobileVerificationHelper } from '../helpers/mobileVerification.helper';
import { loadMobileTestData } from '../utils/mobileTestData';
import { isLocalEnv } from '../utils/envFlags';
import { createAndroidSession, createIOSSession } from '../utils/sessionFactory';
import type { Widget } from '../../src/matrix/widgets';
import { WIDGET_CONFIG } from '../../src/matrix/widgets';

const widgetKey: Widget = 'my-new-widget';

describe('Mobile Token Validation - My New Widget', function () {
  this.timeout(300000);

  const { baselineApps, actualApps } = loadMobileTestData();
  const runLocal = isLocalEnv();

  // Load batch payload
  const batchPayloadPath = path.join(process.cwd(), '.test-cache/batch-payload-my-new-widget.json');
  const appliedPayload = JSON.parse(fs.readFileSync(batchPayloadPath, 'utf-8'));

  // Load variant → studio widget name mapping from CSV
  const csvPath = path.join(process.cwd(), 'tests/testdata/mobile/my-new-widget-widget-variants.csv');
  const csv = fs.readFileSync(csvPath, 'utf8').trim().split(/\r?\n/);
  const variantMap: Record<string, string> = {};
  for (let i = 1; i < csv.length; i++) {
    const [variant, inst] = csv[i].split(',').map(s => s.trim());
    if (variant && inst) variantMap[variant] = inst;
  }

  // Extract applied token pairs from the batch payload
  // (recursively walk the payload to find token references)
  const appliedPairs: Array<{
    tokenRef: string;
    variantName: string;
    studioWidgetName: string;
    propertyPath: string[];
  }> = [];

  // ... extract tokens from appliedPayload based on WIDGET_CONFIG structure ...
  // See mobile.button.token.validate.spec.ts for the full extraction logic

  // Test: screenshot comparison and style verification per variant
  // ...
});
```

**Best practice**: Copy an existing spec (like `mobile.button.token.validate.spec.ts`) and modify:

- `widgetKey` to your widget name
- The batch payload filename
- The CSV filename
- The payload traversal logic to match your widget's structure type

The `WidgetTokenConfigRegistry` in `wdio/config/widgetTokenConfig.ts` automatically reads from `widget-token-slots.json`, so no manual registration is needed -- just adding your widget to `widget-token-slots.json` (Step 3) is sufficient.

---

## Step 7: Capture Baseline Screenshots

After adding the widget instances to the Studio project:

### For Mobile

```bash
# Build baseline app (no custom tokens) and actual app (with tokens)
npm run test:mobile:setup

# The setup process captures baseline screenshots automatically
# Baselines are saved to: screenshots/mobile-base/{platform}/
```

### For Web

```bash
# Run tests with snapshot update mode
npm run test:update
```

---

## Step 8: Register NPM Scripts

**File**: `package.json`

Add convenience scripts for running your widget's tests:

```json
{
  "scripts": {
    "test:mobile:my-new-widget": "rm -rf allure-results && RUN_LOCAL=false MOBILE_PLATFORM=both wdio run wdio/config/wdio.browserstack.conf.ts --spec wdio/specs/mobile.my-new-widget.token.validate.spec.ts"
  }
}
```

---

## Verification Checklist

After completing all steps, verify your integration:

- [ ] **Widget type** added to `Widget` union in `src/matrix/widgets.ts`
- [ ] **Widget config** added to `WIDGET_CONFIG` with correct appearances, variants, states, and token types
- [ ] **Structure type** added to `WIDGET_STRUCTURE_MAP`
- [ ] **Canvas XPaths** defined for all appearance-variant-state combinations
- [ ] **Mobile selectors** defined for both Android and iOS
- [ ] **Token slots** defined in `widget-token-slots.json`
- [ ] **CSV test data** created with correct variant names and Studio widget names
- [ ] **RN style mappings** added to `mobileMapper.ts`
- [ ] **Mobile spec** created following an existing spec as template
- [ ] **Baseline screenshots** captured
- [ ] **NPM script** added to `package.json`
- [ ] **Smoke test passes**: `TEST_WIDGETS=my-new-widget npm run test:slots:canvas`
- [ ] **Mobile test passes**: `npm run test:mobile:my-new-widget`

---

## Reference: Button Widget Walkthrough

Here is how the button widget is configured across all files, as a complete reference.

### Widget Config (`src/matrix/widgets.ts`)

```typescript
button: {
  appearances: ['filled', 'outlined', 'text', 'elevated'],
  variants: {
    filled: ['primary'],
  },
  states: ['default', 'disabled'],
  allowedTokenTypes: [
    'border-radius', 'border-style', 'border-width', 'color',
    'elevation', 'font', 'gap', 'icon', 'space', 'opacity'
  ]
}
```

### Structure Type

```typescript
WIDGET_STRUCTURE_MAP = {
  button: 'variant-groups',  // Uses full variant-group nesting
}
```

### Widget Key

```typescript
// button → btn (shortened key used in payloads)
getWidgetKey('button') === 'btn'
```

### Token Slots (`wdio/config/widget-token-slots.json`)

```json
{
  "button": {
    "tokenSlots": [
      { "tokenType": "color", "properties": ["background", "color", "border.color"] },
      { "tokenType": "font", "properties": ["font-size", "font-weight", "line-height", "letter-spacing", "font-family"] },
      { "tokenType": "icon", "properties": ["icon-size"] },
      { "tokenType": "border-radius", "properties": ["radius"] },
      { "tokenType": "border-width", "properties": ["border.width"] },
      { "tokenType": "border-style", "properties": ["border.style"] },
      { "tokenType": "elevation", "properties": ["shadow"] },
      { "tokenType": "opacity", "properties": ["opacity"] },
      { "tokenType": "gap", "properties": ["gap"] },
      { "tokenType": "space", "properties": ["padding.top", "padding.bottom", "padding.left", "padding.right", "height", "min-width"] }
    ]
  }
}
```

### Test Data CSV (`tests/testdata/mobile/button-widget-variants.csv`)

```csv
variantName,studioWidgetName
button-filled-primary-default,button1
button-filled-primary-disabled,button2
button-outlined-primary-default,button3
button-outlined-primary-disabled,button4
button-text-primary-default,button5
button-text-primary-disabled,button6
button-elevated-primary-default,button7
button-elevated-primary-disabled,button8
```

### Generated Payload (variant-groups structure)

```json
{
  "btn": {
    "appearances": {
      "filled": {
        "variantGroups": {
          "status": {
            "primary": {
              "stateStyles": {
                "default": {
                  "background": "{color.background.btn.primary.default.value}",
                  "color": "{color.text.btn.primary.default.value}"
                }
              }
            }
          }
        }
      }
    }
  }
}
```

---

## Tips and Common Pitfalls

1. **Variant name consistency**: Ensure the variant name pattern (`widget-appearance-variant-state`) is identical across `widget-xpaths.ts`, CSV files, and `widget-token-slots.json`

2. **Studio widget instances**: You must create actual widget instances in the WaveMaker Studio project, one per variant combination. The `studioWidgetName` in the CSV must match exactly.

3. **Structure type mismatch**: If your payload is not being applied correctly, check that the structure type in `WIDGET_STRUCTURE_MAP` matches the actual API format the widget expects.

4. **Missing token types**: If a token type is not in `allowedTokenTypes`, the matrix generator will skip it entirely. Make sure you list all supported types.

5. **RN style path errors**: The most common mobile test failure is an incorrect RN style path. Use the debug inspector in the mobile app to verify paths before adding them to `mobileMapper.ts`.

6. **Copy an existing spec**: The easiest way to create a new mobile spec is to copy `mobile.button.token.validate.spec.ts` and adapt it. Avoid writing from scratch.

---

## Next Steps

- [Web Testing Guide](05-WEB-TESTING-GUIDE.md) -- Running your new widget's web tests
- [Mobile Testing Guide](06-MOBILE-TESTING-GUIDE.md) -- Running your new widget's mobile tests
- [Architecture Deep Dive](03-ARCHITECTURE-DEEP-DIVE.md) -- Understanding the payload structure in detail

---

## 05-WEB-TESTING-GUIDE

# Web Testing Guide (Playwright)

This guide covers everything you need to know about running, understanding, and debugging web tests using Playwright. Web tests validate token rendering on two targets: **Canvas** (Studio design time) and **Preview** (React Native Web runtime).

---

## Table of Contents

1. [Test Architecture](#test-architecture)
2. [Global Setup](#global-setup)
3. [Canvas Testing](#canvas-testing)
4. [Preview Testing](#preview-testing)
5. [Slot Validation Testing](#slot-validation-testing)
6. [Running Tests](#running-tests)
7. [Filtering Tests](#filtering-tests)
8. [Understanding Test Reports](#understanding-test-reports)
9. [Debugging Failed Tests](#debugging-failed-tests)
10. [Configuration](#configuration)

---

## Test Architecture

![Web Test Architecture](web-test-architecture.png)

### Detailed Studio & Web Preview Automation Flow

![Studio and Web Preview Automation Flow](studio_web_preview_flow.png)

---

## Global Setup

**File**: `tests/global-setup.ts`

The global setup runs once before all test workers. It performs:

### 1. Authentication

```typescript
// Authenticates with WaveMaker Studio
// Captures auth_cookie and JSESSIONID
// Saves state to .test-cache/auth.json for use by all tests
```

Authentication state is stored in `.test-cache/auth.json` and loaded by Playwright via the `storageState` config:

```typescript
// playwright.config.ts
use: {
  storageState: '.test-cache/auth.json',
}
```

### 2. Token Loading and Selection

```typescript
// Loads all tokens from tokens/mobile/global/
// Selects 1-2 random tokens per file
// Infers token type via TokenMappingService
// Saves to .test-cache/selected-tokens.json
```

### 3. Baseline Screenshot Capture

Before applying any tokens, the setup captures baseline screenshots of all widgets in their default state. These are used for visual regression comparison.

---

## Canvas Testing

Canvas tests validate that tokens are correctly applied in WaveMaker Studio's design-time canvas view.

### How It Works

1. **Apply Token**: Send a token payload to the Studio API
2. **Publish**: Trigger a publish to update the canvas
3. **Navigate**: Open the canvas page with the widget
4. **Extract CSS**: Use `getComputedStyle()` to read the rendered CSS value
5. **Compare**: Check that the computed CSS matches the expected token value

### CSS Extraction

```typescript
// Extract a CSS property value from a widget element
const actualValue = await page.$eval(
  xpathSelector,
  (element, property) => {
    const style = window.getComputedStyle(element);
    return style.getPropertyValue(property);
  },
  cssPropertyName  // e.g., 'background-color', 'font-size'
);
```

### XPath Selector Resolution

Each widget variant has a unique XPath defined in `src/matrix/widget-xpaths.ts`:

```
Key format: {widget}-{appearance}-{variant}-{state}
Example:    button-filled-primary-default
Value:      //div[contains(@class, "btn-filled")]//button[contains(@class, "primary")]
```

For properties that apply to sub-elements (e.g., title font-size inside a card), a suffix is appended:

```
Base XPath:  card-default-standard-default
Property:    title.fontSize
Full XPath:  card-default-standard-default-title
```

### Canvas Page URL

```
{STUDIO_BASE_URL}/{CANVAS_PATH}
Default: https://stage-studio.wavemakeronline.com/s/page/Main?project-id={PROJECT_ID}
```

---

## Preview Testing

Preview tests validate tokens in the React Native Web runtime environment.

### How It Works

1. **Apply Token**: Same as canvas (Studio API)
2. **Deploy**: Trigger an in-place deploy for the preview
3. **Navigate**: Open the preview URL
4. **Enter RN Command**: Type a style command into the inspector input
5. **Read Result**: Read the style value from the inspector output
6. **Compare**: Check the value matches the expected token

### Style Inspector Interface

The preview includes a debugging interface:

```
Input:  //input[@data-testid="style-command-input"]
Output: //label[@data-testid="style-output-label"]
```

### RN Style Commands

```
# Format
App.appConfig.currentPage.Widgets.{widgetName}._INSTANCE.styles.{rnPath}

# Examples
App.appConfig.currentPage.Widgets.button1._INSTANCE.styles.root.backgroundColor
App.appConfig.currentPage.Widgets.label1._INSTANCE.styles.text.fontSize
App.appConfig.currentPage.Widgets.accordion1._INSTANCE.styles.header.backgroundColor
```

### Preview URL

```
{STUDIO_BASE_URL}{PREVIEW_PATH}
Default: https://stage-studio.wavemakeronline.com/preview
```

---

## Slot Validation Testing

**File**: `tests/token_slot_validation.spec.ts`

Slot validation is the most comprehensive test mode. It validates every defined token slot for every widget variant.

### How It Differs from Matrix Tests

| Aspect | Matrix Tests | Slot Validation |
|--------|-------------|-----------------|
| Coverage | Orthogonal (pairwise) | 100% slot coverage |
| Source of truth | `WIDGET_CONFIG` | `widget-token-slots.json` |
| Token selection | Random from pool | Hash-based per slot |
| Payload strategy | One token at a time | One token at a time |

### Test Flow

For each widget in `widget-token-slots.json`:

```
For each appearance:
  For each variant:
    For each state:
      For each token type:
        For each property slot:
          1. Find a compatible token
          2. Generate payload
          3. Apply via Studio API
          4. Validate on canvas and/or preview
```

### Slot Verification Targets

The `SLOT_VERIFY_TARGET` environment variable controls which targets are validated:

- `canvas` -- Validate on Studio Canvas only
- `preview` -- Validate on RN Web Preview only
- `both` (default) -- Validate on both targets

---

## Running Tests

### All Web Tests

```bash
npm test                    # Run all Playwright tests
npm run test:headed         # Run with visible browser (for debugging)
```

### Slot Validation

```bash
npm run test:slots          # Both canvas and preview
npm run test:slots:canvas   # Canvas only
npm run test:slots:preview  # Preview only (headed)
npm run test:slots:headed   # Both targets, visible browser
```

### Target-Specific

```bash
npm run test:canvas         # Canvas validation only
npm run test:preview        # Preview validation only
```

### Visual Regression

```bash
npm run test:update         # Update baseline screenshots
```

---

## Filtering Tests

### By Widget

Use the `TEST_WIDGETS` environment variable to test specific widgets:

```bash
# Single widget
TEST_WIDGETS=button npm run test:slots

# Multiple widgets (comma-separated)
TEST_WIDGETS=button,accordion,label npm run test:slots

# Combined with target filter
TEST_WIDGETS=button SLOT_VERIFY_TARGET=canvas npm run test:slots
```

### By Spec File

Run a specific test file using Playwright's `--grep` option:

```bash
npx playwright test tests/token_slot_validation.spec.ts
npx playwright test tests/token_apply_and_validate.spec.ts
```

---

## Understanding Test Reports

### Playwright HTML Report

After running tests, view the interactive HTML report:

```bash
npx playwright show-report
# or
npm run report
```

The report shows:

- Pass/fail status for each test
- Screenshots for failed tests (baseline, actual, diff)
- Trace files for step-by-step debugging
- Duration and retry information

### JSON Log

Detailed test execution logs are saved to `logs/playwright-log.json`. This includes:

- Token reference and expected value for each test
- Actual CSS value extracted
- Whether normalization was applied
- Error messages for failures

### Token Validation Report

The `tokenTestReporter.ts` generates a structured report showing:

- Total tokens tested per widget
- Pass/fail counts
- Property coverage per widget variant
- Missing or misconfigured slots

Reports are saved to `artifacts/playwright-token-reports/`.

---

## Debugging Failed Tests

### 1. View the Trace

Playwright captures traces for every test. Open them in the Trace Viewer:

```bash
npx playwright show-trace artifacts/test-results/{test-name}/trace.zip
```

The Trace Viewer shows:

- Every action (click, navigate, evaluate) with timestamps
- Screenshots at each step
- Network requests
- Console logs

### 2. Run in Headed Mode

See the browser during execution:

```bash
npm run test:headed
# or
npx playwright test --headed --debug
```

### 3. Common Failure Patterns

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Authentication failure | Expired credentials | Update STUDIO_USERNAME/STUDIO_PASSWORD in `.env` |
| Element not found | Incorrect XPath | Verify XPath in Chrome DevTools |
| Value mismatch | Normalization issue | Check `TokenMappingService.normalizeValue()` |
| Timeout | Slow deploy/publish | Increase timeout in `playwright.config.ts` |
| Screenshot mismatch | Animation/timing | Set `animations: 'disabled'` (already configured) |
| Studio API 401 | Session expired | Framework auto-retries, but check cookies |

### 4. Inspect Cached Data

Check `.test-cache/` for intermediate data:

```bash
# Authentication state
cat .test-cache/auth.json

# Selected tokens
cat .test-cache/selected-tokens.json

# Generated payloads per widget
ls .test-cache/payloads/
cat .test-cache/payloads/button.json
```

### 5. Run a Single Widget in Debug Mode

```bash
TEST_WIDGETS=button npx playwright test tests/token_slot_validation.spec.ts --headed --debug
```

---

## Configuration

### Playwright Config (`playwright.config.ts`)

Key settings:

```typescript
{
  testDir: './tests',
  fullyParallel: true,
  retries: process.env.CI ? 4 : 0,        // Retry on CI
  workers: 1,                               // Sequential execution
  timeout: 120000,                          // 2 minutes per test

  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    trace: 'on',
    screenshot: 'on',
    video: 'on',
    storageState: '.test-cache/auth.json',
  },

  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 100,
      maxDiffPixelRatio: 0.01,
      threshold: 0.2,
      animations: 'disabled',
    }
  },

  snapshotPathTemplate: 'screenshots/base-image/{arg}{ext}',
  outputDir: 'artifacts/test-results',
}
```

### Adjustable Settings

| Setting | Default | Purpose |
|---------|---------|---------|
| `workers` | 1 | Number of parallel workers |
| `timeout` | 120000 | Test timeout in ms |
| `retries` | 0 (local), 4 (CI) | Auto-retry count |
| `maxDiffPixels` | 100 | Allowed pixel difference |
| `threshold` | 0.2 | Per-pixel color threshold |

---

## Next Steps

- [Mobile Testing Guide](06-MOBILE-TESTING-GUIDE.md) -- For Android and iOS testing
- [Architecture Deep Dive](03-ARCHITECTURE-DEEP-DIVE.md) -- Understanding CSS verification internals
- [Troubleshooting and FAQ](08-TROUBLESHOOTING-AND-FAQ.md) -- Common issues and solutions

---

## 06-MOBILE-TESTING-GUIDE

# Mobile Testing Guide (WebDriverIO / Appium)

This guide covers everything you need to know about running, understanding, and debugging mobile tests. Mobile tests use WebDriverIO with Appium to validate token rendering on **Android** and **iOS** native apps built with React Native.

---

## Table of Contents

1. [Mobile Test Architecture](#mobile-test-architecture)
2. [The Two-App Strategy](#the-two-app-strategy)
3. [Global Setup Process](#global-setup-process)
4. [BrowserStack Cloud Execution](#browserstack-cloud-execution)
5. [Local Appium Execution](#local-appium-execution)
6. [Parallel Execution](#parallel-execution)
7. [Running Tests](#running-tests)
8. [Screenshot Comparison](#screenshot-comparison)
9. [Style Verification](#style-verification)
10. [Allure Reporting](#allure-reporting)
11. [Debugging Mobile Tests](#debugging-mobile-tests)
12. [Configuration Files](#configuration-files)

---

## Mobile Test Architecture

![Mobile Test Architecture](mobile-test-architecture.png)

### Detailed Mobile Runtime Automation Flow

![Mobile Runtime Automation Flow](mobile_runtime_flow.png)

---

## The Two-App Strategy

Instead of building a separate app for each token change, the framework builds exactly **two apps**:

### Baseline App

- Built with **default tokens** (no customizations)
- Represents the "before" state
- Used as the reference for visual comparison

### Actual App

- Built with **all tokens applied** (batch payload)
- Represents the "after" state
- Contains every token for every widget variant in a single build

### Why This Works

```
Traditional approach:
  Token 1 → Build App → Test → Token 2 → Build App → Test → ...
  N tokens × 5 min build = hours

Batch approach:
  Build Baseline (5 min) + Apply All Tokens + Build Actual (5 min) = 10 min total
  Speedup: 5-10x faster
```

---

## Global Setup Process

**File**: `wdio/specs/mobile.global.setup.ts`

The global setup is run explicitly before test execution:

```bash
npm run test:mobile:setup
```

### Phase 1: Build Baseline App

```
1. Login to WaveMaker Studio
2. Export the project (default state, no custom tokens)
3. Build the React Native app:
   - Android: Generate APK via Gradle
   - iOS: Generate IPA via Xcode
4. Save app to mobile-builds/baseline/
```

### Phase 2: Generate Batch Payload

```
1. Load widget-token-slots.json (source of truth)
2. Load global tokens from tokens/mobile/global/
3. For each widget → appearance → variant → state → token type → property:
   - Find a compatible token
   - Generate individual payload
   - Deep merge into the widget's batch payload
4. Save payloads to .test-cache/batch-payload-{widget}.json
```

### Phase 3: Apply and Build Actual App

```
1. Apply each widget's batch payload via Studio API
2. Publish and build the project
3. Export the project (with all tokens applied)
4. Build the React Native app
5. Save app to mobile-builds/actual/
```

### Phase 4: Upload to BrowserStack (If Cloud Testing)

```
1. Upload baseline APK/IPA to BrowserStack
2. Upload actual APK/IPA to BrowserStack
3. Save app URLs to .test-cache/browserstack-app-urls.json
```

---

## BrowserStack Cloud Execution

### Configuration

**File**: `wdio/config/wdio.browserstack.conf.ts`

BrowserStack execution requires:

```bash
# .env
BROWSERSTACK_USERNAME=your_username
BROWSERSTACK_ACCESS_KEY=your_access_key
BROWSERSTACK_ANDROID_DEVICE=Google Pixel 8 Pro
BROWSERSTACK_ANDROID_OS=14.0
BROWSERSTACK_IOS_DEVICE=iPhone 14
BROWSERSTACK_IOS_OS=16
BROWSERSTACK_MAX_INSTANCES=5
```

### How App URLs Are Resolved

After upload, the WDIO config dynamically reads app URLs:

```typescript
// wdio.browserstack.conf.ts
const appUrl = fs.readFileSync('.test-cache/browserstack-android-app-url.txt', 'utf8');
// or from environment: process.env.BROWSERSTACK_ANDROID_APP_URL
```

### Running on BrowserStack

```bash
# Android only
npm run test:mobile

# iOS only
npm run test:mobile:ios

# Both platforms (full suite)
npm run test:mobile:full
```

### Capabilities

```typescript
capabilities: [{
  platformName: 'Android',
  'appium:deviceName': process.env.BROWSERSTACK_ANDROID_DEVICE,
  'appium:platformVersion': process.env.BROWSERSTACK_ANDROID_OS,
  'appium:app': appUrl,
  'bstack:options': {
    userName: process.env.BROWSERSTACK_USERNAME,
    accessKey: process.env.BROWSERSTACK_ACCESS_KEY,
    projectName: 'Style Workspace Automation',
    buildName: `Token Validation - ${new Date().toISOString()}`,
  }
}]
```

---

## Local Appium Execution

### Prerequisites

1. **Appium installed**: `npm install -g appium`
2. **Appium drivers**: `appium driver install uiautomator2` (Android) or `appium driver install xcuitest` (iOS)
3. **Android emulator** running (via Android Studio) or **iOS simulator** (via Xcode)
4. **App built**: APKs/IPAs available in `mobile-builds/`

### Configuration

**File**: `wdio/config/wdio.local.conf.ts`

```bash
# .env
APPIUM_HOST=127.0.0.1
APPIUM_PORT=4723
APPIUM_PATH=/
LOCAL_DEVICE_NAME=Pixel 9 Pro
LOCAL_PLATFORM_VERSION=15.0
RUN_LOCAL=true
```

### Running Locally

```bash
# Start Appium server (in a separate terminal)
appium

# Start Android emulator (in a separate terminal)
emulator -avd Pixel_9_Pro

# Run tests
npm run test:mobile:android
```

---

## Parallel Execution

The framework supports running tests on multiple emulators simultaneously.

### Configuration

**File**: `wdio/config/wdio.local.parallel.conf.ts`

```bash
# .env
PARALLEL_EMULATORS=5   # Number of parallel emulators
```

### Setup Scripts

```bash
# Check parallel setup
npm run parallel:check

# Start multiple Appium servers (ports 4723, 4724, 4725, ...)
npm run parallel:start:appium

# Start multiple Android emulators
npm run parallel:start:emulators

# Run parallel tests
npm run test:mobile:android:parallel

# Cleanup
npm run parallel:stop:appium
npm run parallel:stop:emulators
```

### How Parallel Execution Works

![Parallel Execution](mobile-parallel-execution.png)

Each spec file is distributed to an available emulator. Specs run in parallel across emulators.

---

## Running Tests

### Complete Test Scripts

```bash
# === BrowserStack ===
npm run test:mobile                     # Android on BrowserStack
npm run test:mobile:ios                 # iOS on BrowserStack
npm run test:mobile:full                # Setup + Android + iOS
npm run test:mobile:setup               # Global setup only

# === Local ===
npm run test:mobile:android             # Local Android emulator
npm run test:mobile:android:parallel    # Parallel local Android

# === Widget-Specific ===
npm run test:mobile:button              # Button widget only
npm run test:mobile:calendar            # Calendar widget only
npm run test:mobile:icon                # Icon widget only
# ... (see package.json for all widget-specific scripts)

# === New Widget Batch ===
npm run test:mobile:new-widgets         # All newly added widgets
npm run test:mobile:new-widgets:android # Android only
npm run test:mobile:new-widgets:ios     # iOS only
```

### Platform Filtering

Use the `PLATFORM` or `MOBILE_PLATFORM` environment variable:

```bash
PLATFORM=android npm run test:mobile    # Android only
PLATFORM=ios npm run test:mobile        # iOS only
MOBILE_PLATFORM=both npm run test:mobile # Both platforms
```

---

## Screenshot Comparison

### How It Works

**File**: `wdio/helpers/screenshot.helpers.ts`

For each widget variant:

1. **Capture baseline screenshot** on the baseline app
2. **Capture actual screenshot** on the actual app (with tokens applied)
3. **Compare** using `pixelmatch` pixel-by-pixel comparison

### Comparison Parameters

```typescript
pixelmatch(baselineData, actualData, diffData, width, height, {
  threshold: 0.03   // 3% per-pixel color difference threshold
});
```

### Inverted Logic (Important)

Mobile screenshot comparison uses **inverted logic**:

| Condition | Standard Visual Regression | This Framework |
|-----------|--------------------------|----------------|
| Images identical | PASS | FAIL (token had no visual effect) |
| Images differ | FAIL | PASS (token visually changed the widget) |

This is because the test verifies that the token **actually causes a visual change**.

### Screenshot Directories

```
screenshots/
├── mobile-base/
│   ├── android/     # Baseline screenshots from default app
│   └── ios/
├── mobile-actual/
│   ├── android/     # Actual screenshots from token-applied app
│   └── ios/
└── mobile-diff/
    ├── android/     # Diff images showing changes
    └── ios/
```

### Comparison Result

```typescript
interface ComparisonResult {
  match: boolean;         // true if visual change detected (PASS)
  diffPixels: number;     // Number of different pixels
  diffPercentage: number; // Percentage of different pixels
  diffImagePath: string;  // Path to the diff image
}
```

---

## Style Verification

### How RN Style Extraction Works

Beyond visual comparison, each test also verifies the **actual style values** programmatically:

1. Type a RN style command into the app's debug input (`~exinput_i`)
2. Read the result from the output label (`~label2_caption`)
3. Parse the JSON response
4. Compare with the expected token value

### Command Format

```
App.appConfig.currentPage.Widgets.{studioWidgetName}._INSTANCE.styles.{rnStylePath}
```

For cards and formcontrols, use `calcStyles` instead of `styles`:

```
App.appConfig.currentPage.Widgets.{studioWidgetName}._INSTANCE.calcStyles.{rnStylePath}
```

### Style Artifacts

Extracted styles are saved to `artifacts/mobile-styles/` for debugging:

```json
// artifacts/mobile-styles/button-filled-primary-default.json
{
  "root": {
    "backgroundColor": "#6200EE",
    "borderRadius": 8,
    "paddingVertical": 12,
    "paddingHorizontal": 24
  },
  "text": {
    "color": "#FFFFFF",
    "fontSize": 16,
    "fontWeight": "700"
  }
}
```

---

## Allure Reporting

### Generate and View Reports

```bash
# Generate HTML report from results
npm run allure:generate

# Open in browser
npm run allure:open

# Upload to S3 (for CI)
npm run allure:upload
```

### Report Structure

```
allure-report/
├── index.html           # Main report page
├── data/
│   ├── suites.json      # Test suites
│   ├── timeline.json    # Execution timeline
│   └── packages.json    # Package breakdown
└── export/              # Exportable data
```

### Report Features

- **Suites view**: Tests grouped by widget and variant
- **Timeline**: Visual execution timeline across devices
- **Categories**: Failures categorized by type
- **Attachments**: Screenshots and style JSON for each test
- **History**: Trend over multiple runs (if history is preserved)

### Clean Reports by Widget

```bash
# Clean allure results for a specific widget before re-running
npm run allure:clean:widget -- button
```

---

## Debugging Mobile Tests

### 1. Check App Builds

Verify the APK/IPA files exist:

```bash
ls -la mobile-builds/baseline/build-out/android/app/build/outputs/apk/debug/
ls -la mobile-builds/actual/build-out/android/app/build/outputs/apk/debug/
```

### 2. Check Cached Data

```bash
# BrowserStack app URLs
cat .test-cache/browserstack-android-app-url.txt

# Batch payloads per widget
ls .test-cache/batch-payload-*.json
cat .test-cache/batch-payload-button.json | head -50
```

### 3. Common Failure Patterns

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| App not found | APK/IPA not built or not uploaded | Run `npm run test:mobile:setup` |
| Element not found | Wrong accessibility ID | Check mobileWidgetSelectors |
| Style command returns empty | Widget not on current page | Verify CSV studioWidgetName |
| Screenshot comparison always fails | Baseline not captured | Rebuild baseline app |
| BrowserStack timeout | Device queue full | Reduce `BROWSERSTACK_MAX_INSTANCES` |
| Appium connection refused | Server not running | Start Appium: `appium` |
| Build failure | Missing dependencies | Run `npm install` in exported project |

### 4. Run a Single Widget

```bash
# BrowserStack - single widget spec
wdio run wdio/config/wdio.browserstack.conf.ts --spec wdio/specs/mobile.button.token.validate.spec.ts

# Local - single widget spec
RUN_LOCAL=true PLATFORM=android wdio run wdio/config/wdio.local.conf.ts --spec wdio/specs/mobile.button.token.validate.spec.ts
```

### 5. Inspect Style Values Manually

On the running app, find the debug input field and type:

```
App.appConfig.currentPage.Widgets.button1._INSTANCE.styles
```

This returns the full styles object for the widget instance, useful for discovering the correct paths.

### 6. View WDIO Logs

Detailed logs are saved to the `logs/` directory:

```bash
ls logs/
# wdio-*.log files contain full session logs
```

---

## Configuration Files

### Shared Config (`wdio/config/wdio.shared.conf.ts`)

Base configuration shared across all execution modes:

```typescript
{
  framework: 'mocha',
  mochaOpts: { timeout: 600000 },  // 10 minutes per test
  reporters: ['spec', ['allure', { outputDir: 'allure-results' }]],
  autoCompileOpts: {
    tsNodeOpts: { project: './tsconfig.json' }
  },
  logLevel: 'info',
  logDir: 'logs',
}
```

### BrowserStack Config (`wdio/config/wdio.browserstack.conf.ts`)

Cloud execution settings:

- Extends shared config
- Adds BrowserStack capabilities and credentials
- Supports dynamic app URL resolution from cache
- Platform filtering via `PLATFORM` env var
- Max instances configurable via `BROWSERSTACK_MAX_INSTANCES`

### Local Config (`wdio/config/wdio.local.conf.ts`)

Single-device local execution:

- Extends shared config
- Uses local Appium server connection
- App path from cache or env vars
- Single emulator/simulator

### Parallel Config (`wdio/config/wdio.local.parallel.conf.ts`)

Multi-device parallel execution:

- Extends shared config
- Dynamic Appium port assignment (4723 + offset)
- Multiple emulator support via `PARALLEL_EMULATORS`
- Each spec gets its own emulator

---

## Next Steps

- [Web Testing Guide](05-WEB-TESTING-GUIDE.md) -- For Canvas and Preview testing
- [Adding New Widgets](04-ADDING-NEW-WIDGETS.md) -- Creating mobile specs for new widgets
- [Configuration Reference](07-CONFIGURATION-REFERENCE.md) -- All mobile-related env vars
- [Troubleshooting and FAQ](08-TROUBLESHOOTING-AND-FAQ.md) -- Common mobile issues

