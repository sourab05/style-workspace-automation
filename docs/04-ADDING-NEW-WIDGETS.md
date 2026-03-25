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
