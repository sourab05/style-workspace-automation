# Style Workspace Automation - Full Documentation (Deduplicated Confluence Edition)

This version removes repeated overview content and keeps each topic once using docs 01 to 08 as the source of truth.

## Required image attachments
- arch-canvas-sequence.png
- arch-mobile-sequence.png
- arch-preview-sequence.png
- arch-structure-decision.png
- mobile-parallel-execution.png
- mobile-test-architecture.png
- overview-data-flow.png
- overview-platform-coverage.png
- readme-architecture.png
- web-test-architecture.png
- mobile_runtime_flow.png
- studio_web_preview_flow.png

---

## 01-GETTING-STARTED

# Getting Started

This guide walks you through setting up the Style Workspace Automation framework from scratch. By the end, you will have a fully configured environment capable of running both web and mobile token validation tests.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Environment Configuration](#environment-configuration)
4. [Running Your First Web Test](#running-your-first-web-test)
5. [Running Your First Mobile Test](#running-your-first-mobile-test)
6. [Verifying the Setup](#verifying-the-setup)
7. [IDE Recommendations](#ide-recommendations)

---

## Prerequisites

### Required Software

| Software | Version | Purpose | Install Command |
|----------|---------|---------|----------------|
| Node.js | >= 18.x | Runtime environment | [nodejs.org](https://nodejs.org) |
| npm | >= 9.x | Package manager | Included with Node.js |
| TypeScript | >= 5.x | Language (installed via npm) | `npm install` |
| Git | Any recent | Version control | `brew install git` (macOS) |

### For Web Testing (Playwright)

| Software | Version | Purpose |
|----------|---------|---------|
| Playwright Browsers | Latest | Chromium for Canvas/Preview testing |

### For Mobile Testing (WebDriverIO)

| Software | Version | Purpose |
|----------|---------|---------|
| Java JDK | >= 11 | Required by Android SDK and Appium |
| Android Studio | Latest | Android SDK, emulators, platform tools |
| Appium | >= 2.x | Mobile automation server (local testing) |
| Xcode | Latest (macOS only) | iOS simulator and build tools |

### For Cloud Testing (BrowserStack)

| Requirement | Details |
|-------------|---------|
| BrowserStack Account | [browserstack.com](https://www.browserstack.com) |
| BrowserStack Username | Found in Account Settings |
| BrowserStack Access Key | Found in Account Settings |

### For Report Upload (Optional)

| Requirement | Details |
|-------------|---------|
| AWS Account | S3 access for report storage |
| AWS CLI | Configured with access keys |

---

## Installation

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd style-workspace-automation
```

### Step 2: Install Node Dependencies

```bash
npm install
```

This installs all dependencies including Playwright, WebDriverIO, TypeScript, and supporting libraries.

### Step 3: Install Playwright Browsers

```bash
npx playwright install
```

This downloads the Chromium browser binaries required for web testing.

### Step 4: Generate Token Value Map

```bash
npm run build:token-map
```

This reads token JSON files from `tokens/mobile/global/` and generates a lookup map at `tokens/token-values-mobile.json`. This map is used by both web and mobile tests to resolve token references to their actual CSS values.

---

## Environment Configuration

### Step 1: Create Your Environment File

```bash
cp .env.example .env
```

### Step 2: Configure Required Variables

Open `.env` in your editor and fill in the required values:

```bash
# === REQUIRED: Studio Configuration ===
STUDIO_BASE_URL=https://stage-studio.wavemakeronline.com/
PROJECT_ID=your-project-id-here
STUDIO_PROJECT_ID=your-studio-project-id-here

# === REQUIRED: Authentication ===
STUDIO_USERNAME=your-email@wavemaker.com
STUDIO_PASSWORD=your-password-here
```

### Step 3: Configure Mobile Testing (If Needed)

For BrowserStack cloud testing:

```bash
# === BrowserStack Credentials ===
BROWSERSTACK_USERNAME=your_browserstack_username
BROWSERSTACK_ACCESS_KEY=your_browserstack_access_key

# === Device Configuration ===
BROWSERSTACK_ANDROID_DEVICE=Google Pixel 8 Pro
BROWSERSTACK_ANDROID_OS=14.0
BROWSERSTACK_IOS_DEVICE=iPhone 14
BROWSERSTACK_IOS_OS=16
```

For local Appium testing:

```bash
# === Local Appium ===
APPIUM_HOST=127.0.0.1
APPIUM_PORT=4723
LOCAL_DEVICE_NAME=Pixel 9 Pro
LOCAL_PLATFORM_VERSION=15.0
```

> For a complete reference of all 60+ environment variables, see [Configuration Reference](07-CONFIGURATION-REFERENCE.md).

---

## Running Your First Web Test

Web tests use Playwright to validate token application on the Studio Canvas and Web Preview.

### Step 1: Verify Environment

Ensure your `.env` file has the Studio URL, credentials, and project ID configured.

### Step 2: Run the Test Suite

```bash
# Run all web tests
npm test

# Or run with a visible browser for debugging
npm run test:headed
```

### Step 3: Run Slot Validation Tests

Slot validation tests check that tokens are correctly applied to specific widget properties:

```bash
# Run slot validation (both canvas and preview)
npm run test

# Canvas only
npm run test:canvas

# Preview only (with visible browser)
npm run test:preview
```

### What Happens During a Web Test Run

1. **Global Setup** (`tests/global-setup.ts`):
   - Authenticates with WaveMaker Studio
   - Saves authentication state to `.test-cache/auth.json`
   - Loads and selects tokens from `tokens/mobile/global/`
   - Captures baseline screenshots

2. **Test Execution**:
   - Generates orthogonal matrix of widget-token combinations
   - For each test case: applies token via Studio API, validates CSS value
   - Compares screenshots for visual regression

3. **Reports**:
   - Playwright HTML report: `npx playwright show-report`
   - JSON log: `logs/playwright-log.json`

---

## Running Your First Mobile Test

Mobile tests use WebDriverIO with Appium to validate tokens on real Android/iOS devices.

### Option A: BrowserStack (Recommended for First Run)

#### Step 1: Run Global Setup

This builds the baseline and actual mobile apps, then uploads them to BrowserStack:

```bash
npm run test:mobile:setup
```

This process:
- Builds a **baseline app** with default tokens
- Applies all tokens as a batch payload
- Builds an **actual app** with the applied tokens
- Uploads both APKs/IPAs to BrowserStack
- Saves app URLs to `.test-cache/`

#### Step 2: Run Tests

```bash
# Android tests on BrowserStack
npm run test:mobile

# iOS tests on BrowserStack
npm run test:mobile:ios

# Full suite (setup + Android + iOS)
npm run test:mobile:full
```

### Option B: Local Emulator

#### Prerequisites

1. Start an Android emulator via Android Studio
2. Start Appium server: `appium`

#### Run Tests

```bash
npm run test:mobile:android
```

### What Happens During a Mobile Test Run

1. **Setup Phase**: Builds two apps (baseline + actual with all tokens applied)
2. **Baseline Capture**: Screenshots of each widget variant on the baseline app
3. **Actual Capture**: Screenshots of the same variants on the token-applied app
4. **Comparison**: Pixel-level comparison using `pixelmatch`
5. **Style Verification**: Extracts React Native styles and compares against expected token values

### View Mobile Test Reports

```bash
# Generate Allure report
npm run allure:generate

# Open in browser
npm run allure:open
```

---

## Verifying the Setup

### Quick Verification Checklist

1. **Dependencies installed**: `node_modules/` exists and is populated
2. **Playwright browsers**: Run `npx playwright --version` to confirm installation
3. **Environment**: Required variables set in `.env`
4. **Token map**: `tokens/token-values-mobile.json` exists (run `npm run build:token-map` if not)
5. **Authentication**: Run a quick test to verify Studio login works

### Smoke Test

Run a quick targeted test to verify everything works:

```bash
# Test a single widget (e.g., button) on canvas
TEST_WIDGETS=button npm run test:slots:canvas
```

If this passes, your web testing setup is correctly configured.

---

## IDE Recommendations

### VS Code / Cursor

Install these extensions for the best development experience:

- **Playwright Test for VS Code** -- Run and debug Playwright tests from the editor
- **TypeScript** -- Syntax highlighting and IntelliSense
- **ESLint** -- Code quality checks
- **Allure Report** -- View test reports inline

### Recommended Settings

```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "editor.formatOnSave": true,
  "files.exclude": {
    "node_modules": true,
    "allure-results": true,
    "allure-report": true
  }
}
```

---

## Next Steps

- Read the [Framework Overview](02-FRAMEWORK-OVERVIEW.md) to understand the architecture
- Explore the [Architecture Deep Dive](03-ARCHITECTURE-DEEP-DIVE.md) for detailed technical documentation
- Learn how to [Add New Widgets](04-ADDING-NEW-WIDGETS.md) to the framework
- Check the [Configuration Reference](07-CONFIGURATION-REFERENCE.md) for all available settings

---

## 02-FRAMEWORK-OVERVIEW

# Framework Overview

This document explains what the Style Workspace Automation framework is, the problem it solves, and the key concepts you need to understand before working with it.

---

## Table of Contents

1. [What Is This Framework](#what-is-this-framework)
2. [The Problem](#the-problem)
3. [The Solution](#the-solution)
4. [Key Concepts](#key-concepts)
5. [Platform Coverage](#platform-coverage)
6. [End-to-End Data Flow](#end-to-end-data-flow)
7. [Test Execution Strategies](#test-execution-strategies)

---

## What Is This Framework

Style Workspace Automation is a **token-driven test automation framework** built to validate WaveMaker Studio's Style Workspace. It ensures that design tokens (colors, fonts, borders, spacing, etc.) are correctly applied and rendered across all supported platforms.

The framework is built on two testing pillars:

- **Playwright** for web validation (Studio Canvas and Web Preview)
- **WebDriverIO + Appium** for mobile validation (Android and iOS native apps)

---

## The Problem

WaveMaker Studio's Style Workspace allows users to customize widget appearances through design tokens. The challenge is the **combinatorial explosion** of test cases:

```
44 widgets
  x 2-5 appearances per widget
  x 2-12 variants per appearance
  x 2-3 states per widget
  x 14 token types
  = 25,000+ unique combinations
```

Manual testing of 25,000+ combinations is:

- **Time-prohibitive**: Days or weeks per release cycle
- **Error-prone**: Human reviewers miss subtle rendering differences
- **Incomplete**: Usually only a subset of widgets gets tested
- **Inconsistent**: Different testers evaluate rendering differently

---

## The Solution

This framework applies three strategies to make comprehensive testing practical:

### 1. Orthogonal Array Testing

Instead of testing every combination (full Cartesian product), the framework uses **orthogonal arrays** to select a mathematically optimal subset that guarantees **pairwise coverage** -- every pair of parameter values appears in at least one test case.

```
Full Cartesian:     25,000+ test cases
Orthogonal Array:   ~2500 test cases
Reduction:          ~90%
Confidence:         80-95% defect detection
```

### 2. Batch Build Strategy (Mobile)

Instead of building a separate mobile app for each token change:

```
Naive approach:     N builds (one per token) = hours of build time
Batch approach:     2 builds (baseline + actual) = minutes
Speedup:            5-10x faster
```

The framework merges all token changes into a single batch payload, applies them all at once, and builds one "actual" app with all tokens applied.

### 3. Automated Visual Regression

Rather than relying on human judgment, the framework uses pixel-level comparison:

- **Web**: Playwright's built-in `toHaveScreenshot()` with configurable thresholds
- **Mobile**: Custom `pixelmatch` comparison with diff image generation

---

## Key Concepts

Understanding these concepts is essential for working with the framework.

### Widgets

A **widget** is a UI component in WaveMaker Studio (e.g., button, accordion, label, panel). The framework supports 44 widgets, each defined in `src/matrix/widgets.ts`.

### Appearances

An **appearance** is a visual style variant of a widget. For example, a button has four appearances:

- `filled` -- Solid background color
- `outlined` -- Border only, transparent background
- `text` -- Text only, no background or border
- `elevated` -- Raised with shadow

### Variants

A **variant** is a sub-style within an appearance. For example, under the `filled` appearance, a button can have variants like `primary`, `secondary`, `success`, `warning`, `error`.

### States

A **state** represents an interactive condition of the widget. Common states include:

- `default` -- Normal resting state
- `disabled` -- Non-interactive state
- `hover` -- Mouse hover (web only)
- `focused` -- Keyboard focus
- `active` -- Currently selected/pressed

### Token Types

A **token type** represents a category of CSS property that can be customized. The framework supports 14 token types.

**Where token types are defined:**

- **Type definition**: `src/matrix/widgets.ts` -- the `TokenType` union type lists all available types
- **Active list**: `src/matrix/generator.ts` -- the `TOKEN_TYPES` array lists the types used by the matrix generator
- **Token files**: `tokens/web/components/` and `tokens/mobile/global/` -- the actual token JSON files whose file names and content reflect the available categories

| Token Type | CSS Properties | Example Token Reference |
|-----------|---------------|---------|
| `color` | background-color, color, border-color | `{color.background.btn.primary.default.value}` |
| `font` | font-size, font-family, font-weight, line-height | `{font.body.fontSize.value}` |
| `border-width` | border-width | `{border-width.sm.value}` |
| `border-style` | border-style | `{border-style.solid.value}` |
| `border-radius` | border-radius | `{border-radius.md.value}` |
| `margin` | margin | `{margin.md.value}` |
| `padding` / `space` / `spacer` | padding, height, width | `{space.md.value}` |
| `gap` | gap | `{gap.sm.value}` |
| `elevation` / `box-shadow` | box-shadow | `{elevation.md.value}` |
| `opacity` | opacity | `{opacity.50.value}` |
| `icon` | icon-size | `{icon.size.md.value}` |
| `asterisk-color` | asterisk color in form fields | `{color.asterisk.value}` |

Each widget declares which token types it supports via the `allowedTokenTypes` array in its config (`src/matrix/widgets.ts`). The matrix generator only produces test combinations for allowed types. See the [Adding New Widgets guide](04-ADDING-NEW-WIDGETS.md#where-to-find-available-token-types) for details on how to determine which types a widget supports.

### Token Slots

A **token slot** is a specific property on a specific widget that accepts a token. Token slots are defined in `wdio/config/widget-token-slots.json` and serve as the **source of truth** for what properties each widget supports.

Example token slot definition:

```json
{
  "button": {
    "tokenSlots": [
      { "tokenType": "color", "properties": ["background", "color", "border.color"] },
      { "tokenType": "font", "properties": ["font-size", "font-weight", "line-height", "letter-spacing", "font-family"] },
      { "tokenType": "border-radius", "properties": ["radius"] },
      { "tokenType": "border-width", "properties": ["border.width"] },
      { "tokenType": "space", "properties": ["padding.top", "padding.bottom", "padding.left", "padding.right", "height", "min-width"] },
      { "tokenType": "elevation", "properties": ["shadow"] },
      { "tokenType": "opacity", "properties": ["opacity"] },
      { "tokenType": "gap", "properties": ["gap"] },
      { "tokenType": "icon", "properties": ["icon-size"] }
    ]
  }
}
```

### Matrix Items

A **matrix item** represents one test case -- a specific combination of widget, appearance, variant, state, and token type:

```typescript
interface MatrixItem {
  widget: Widget;        // e.g., 'button'
  appearance: Appearance; // e.g., 'filled'
  variant: Variant;      // e.g., 'primary'
  state: State;          // e.g., 'default'
  tokenType: TokenType;  // e.g., 'color'
}
```

### Payloads

A **payload** is the JSON data structure sent to the Studio API to apply a token. Different widgets use different payload structures:

| Structure Type | Widgets | Format |
|---------------|---------|--------|
| `direct-mapping` | accordion, anchor, webview | `{ widget: { mapping: {...} } }` |
| `hybrid-mapping` | navbar | Both root-level and appearance-specific mappings |
| `appearance-mapping` | cards | `{ widget: { appearances: { [app]: { mapping: {...} } } } }` |
| `variant-groups` | button, panel, and most others | `{ widget: { appearances: { [app]: { variantGroups: {...} } } } }` |

---

## Platform Coverage

The framework validates token rendering across four distinct runtime environments:

![Platform Coverage](overview-platform-coverage.png)

### Canvas (Web - Design Time)

- **Tool**: Playwright
- **Environment**: WaveMaker Studio's design canvas
- **Verification Method**: `getComputedStyle()` via `page.$eval()`
- **Selectors**: XPath selectors from `src/matrix/widget-xpaths.ts`

### Preview (Web - React Native Web)

- **Tool**: Playwright
- **Environment**: Studio's preview mode (React Native Web runtime)
- **Verification Method**: RN style commands via style inspector
- **Command Format**: `App.appConfig.currentPage.Widgets.{name}._INSTANCE.styles.{path}`

### Android (Mobile - React Native)

- **Tool**: WebDriverIO + Appium (UiAutomator2)
- **Environment**: Native Android app on emulator or BrowserStack device
- **Verification Method**: RN style commands via accessibility IDs + screenshot comparison

### iOS (Mobile - React Native)

- **Tool**: WebDriverIO + Appium (XCUITest)
- **Environment**: Native iOS app on simulator or BrowserStack device
- **Verification Method**: RN style commands via accessibility IDs + screenshot comparison

---

## End-to-End Data Flow

This diagram shows how data flows from token files to test validation:

![End-to-End Data Flow](overview-data-flow.png)

---

## Test Execution Strategies

### Web Tests: One-at-a-Time Strategy

For web tests (Playwright), tokens are applied **individually**:

1. Select a token from the global token pool
2. Generate a payload for one widget-variant-token combination
3. Apply the token via Studio API
4. Publish and deploy
5. Navigate to the widget on Canvas or Preview
6. Extract the CSS value and compare with expected
7. Rollback the token
8. Repeat for the next test case

This approach is slower but provides **precise per-token validation**.

### Mobile Tests: Batch Build Strategy

For mobile tests (WebDriverIO), tokens are applied **in bulk**:

1. Build a **baseline app** with default (no custom) tokens
2. Generate a **batch payload** merging all tokens for all widgets
3. Apply the batch payload via Studio API
4. Build an **actual app** with all tokens applied
5. Upload both apps to BrowserStack (or install on local emulator)
6. For each widget variant:
   - Capture screenshot on baseline app
   - Capture screenshot on actual app
   - Compare screenshots (pixelmatch)
   - Extract RN styles and verify values

This approach is **5-10x faster** because it avoids rebuilding the app for each token.

---

## Next Steps

- [Architecture Deep Dive](03-ARCHITECTURE-DEEP-DIVE.md) -- Detailed technical documentation of matrix generation, payload creation, and CSS verification
- [Adding New Widgets](04-ADDING-NEW-WIDGETS.md) -- How to integrate new widgets into the framework
- [Web Testing Guide](05-WEB-TESTING-GUIDE.md) -- Running and debugging Playwright tests
- [Mobile Testing Guide](06-MOBILE-TESTING-GUIDE.md) -- Running and debugging WebDriverIO tests

---

## 03-ARCHITECTURE-DEEP-DIVE

# Architecture Deep Dive

This document provides detailed technical documentation of the framework's core systems: matrix generation, payload creation, CSS verification across all platforms, and visual regression testing.

---

## Table of Contents

1. [Orthogonal Matrix Generation](#1-orthogonal-matrix-generation)
2. [Token Loading and Resolution](#2-token-loading-and-resolution)
3. [Payload Generation](#3-payload-generation)
4. [CSS Verification -- Web Canvas](#4-css-verification--web-canvas)
5. [CSS Verification -- Web Preview](#5-css-verification--web-preview)
6. [CSS Verification -- Mobile (Android and iOS)](#6-css-verification--mobile-android-and-ios)
7. [Visual Regression Testing](#7-visual-regression-testing)
8. [Token Distribution Algorithm](#8-token-distribution-algorithm)
9. [Widget Structure Types](#9-widget-structure-types)

---

## 1. Orthogonal Matrix Generation

### Source Files

- `src/matrix/generator.ts` -- Matrix generation algorithms
- `src/matrix/widgets.ts` -- Widget configuration definitions

### Overview

The matrix generator produces test combinations that cover all pairwise interactions between five dimensions: widget, appearance, variant, state, and token type.

### Full Cartesian Generator

The `generateMatrix()` function produces every valid combination:

```typescript
// src/matrix/generator.ts
function* generateMatrix(): Generator<MatrixItem> {
  for (const widget of Object.keys(WIDGET_CONFIG) as Widget[]) {
    const config = WIDGET_CONFIG[widget];
    for (const appearance of config.appearances) {
      const variants = config.variants[appearance] || [];
      for (const variant of variants) {
        for (const state of config.states) {
          for (const tokenType of TOKEN_TYPES) {
            if (config.allowedTokenTypes.includes(tokenType)) {
              yield { widget, appearance, variant, state, tokenType };
            }
          }
        }
      }
    }
  }
}
```

This produces 25,000+ items. It is useful for understanding total coverage but impractical for execution.

### Orthogonal Matrix Generator

The `generateOrthogonalMatrix()` function uses **modulo-based indexing** to ensure every token type is tested with every combination dimension:

```typescript
// src/matrix/generator.ts (simplified)
function* generateOrthogonalMatrix(options?: { shuffle?: boolean }): Generator<MatrixItem> {
  for (const widget of widgets) {
    const config = WIDGET_CONFIG[widget];
    let combinations = []; // All valid (appearance, variant, state) tuples

    // Collect all valid combinations for this widget
    for (const appearance of config.appearances) {
      const variants = config.variants[appearance] || [];
      for (const variant of variants) {
        for (const state of config.states) {
          combinations.push({ appearance, variant, state });
        }
      }
    }

    // Filter to allowed token types
    let allowedTypes = TOKEN_TYPES.filter(t => config.allowedTokenTypes.includes(t));

    // Optional Fisher-Yates shuffle for randomization
    if (options.shuffle) { /* shuffle combinations and allowedTypes */ }

    // MODULO INDEXING: Map combinations to token types
    const itemsNeeded = Math.max(combinations.length, allowedTypes.length);
    for (let i = 0; i < itemsNeeded; i++) {
      const combo = combinations[i % combinations.length];
      const tokenType = allowedTypes[i % allowedTypes.length];
      yield { widget, ...combo, tokenType };
    }
  }
}
```

### How Modulo Indexing Works

Given a button with 8 combinations and 10 allowed token types:

```
i=0:  combo[0] + tokenType[0]   (filled-primary-default + color)
i=1:  combo[1] + tokenType[1]   (filled-primary-disabled + font)
i=2:  combo[2] + tokenType[2]   (outlined-primary-default + border-width)
...
i=7:  combo[7] + tokenType[7]   (elevated-primary-disabled + elevation)
i=8:  combo[0] + tokenType[8]   (filled-primary-default + opacity)    <-- wraps around
i=9:  combo[1] + tokenType[9]   (filled-primary-disabled + icon)      <-- wraps around
```

The larger array drives the count, and the smaller wraps. This guarantees:

- Every combination is tested with at least one token type
- Every token type is tested with at least one combination
- **Pairwise coverage** is achieved with minimal tests

### Special Case: Full Cartesian for Carousel and Tabbar

Some widgets (carousel, tabbar) have state-dependent properties (e.g., `active` state has different styling). These use full Cartesian instead of orthogonal:

```typescript
if (widget === 'carousel' || widget === 'tabbar') {
  for (const combo of combinations) {
    for (const tokenType of allowedTypes) {
      yield { widget, ...combo, tokenType };
    }
  }
  continue;
}
```

### Reduction Math Example

For the `button` widget:

```
Appearances: 4 (filled, outlined, text, elevated)
Variants per appearance: 1 (primary)
States: 2 (default, disabled)
Combinations: 4 x 1 x 2 = 8

Allowed token types: 10 (color, font, border-radius, border-style, 
                         border-width, elevation, gap, icon, space, opacity)

Full Cartesian: 8 x 10 = 80 tests
Orthogonal:     max(8, 10) = 10 tests
Reduction:      87.5%
```

---

## 2. Token Loading and Resolution

### Source Files

- `src/tokens/loader.ts` -- Reads token JSON files from disk
- `src/tokens/mappingService.ts` -- Maps token references to CSS properties and values
- `src/tokens/schema.ts` -- Zod schemas for token file validation
- `tokens/mobile/global/` -- Source token JSON files
- `tokens/token-values-mobile.json` -- Generated token value lookup map

### Token File Structure

Token files are JSON files organized by category. Example (`tokens/mobile/global/color.json`):

```json
{
  "color": {
    "background": {
      "btn": {
        "primary": {
          "default": {
            "value": "#6200EE",
            "type": "color",
            "description": "Primary button background"
          }
        }
      }
    }
  }
}
```

### Token Value Map Generation

The `build:token-map` script (`scripts/generate-token-values.ts`) scans all global token files and produces a flat lookup map:

```json
{
  "{color.background.btn.primary.default.value}": "#6200EE",
  "{font.body.fontSize.value}": "16",
  "{border-radius.md.value}": "8"
}
```

This map is used at test time to resolve token references to actual CSS values.

### Token Mapping Service

The `TokenMappingService` (`src/tokens/mappingService.ts`) is responsible for:

1. **Type Inference** (`inferPropertyPath()`): Determines the CSS property from a token reference using keyword matching

   ```
   Token: {color.background.btn.primary.default.value}
   Inferred: type=color, property=background-color
   ```

2. **Value Normalization** (`normalizeValue()`): Ensures consistent comparison across platforms

   ```
   rgb(98, 0, 238)  -->  #6200ee     (RGB to hex)
   "16px"           -->  "16"         (strip units)
   "bold"           -->  "700"        (font-weight keywords)
   "transparent"    -->  "rgba(0,0,0,0)"
   ```

3. **Computed Property Mapping** (`mapToComputedProperty()`): Converts logical properties to JavaScript computed style names

   ```
   background-color  -->  backgroundColor
   border-radius     -->  borderRadius
   font-size         -->  fontSize
   ```

---

## 3. Payload Generation

### Source Files

- `src/matrix/generator.ts` -- `generateVariantPayload()` function
- `src/playwright/tokenSlotGenerator.ts` -- Slot-based test case generator
- `wdio/config/widget-token-slots.json` -- Token slot definitions (source of truth)

### Token Slot Definitions

The `widget-token-slots.json` file defines which properties each widget supports using a flat `tokenSlots` array per widget. Each entry specifies a token type and its applicable CSS properties:

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

### Slot-Based Test Case Generation

The `tokenSlotGenerator.ts` generates test cases that achieve 100% slot coverage by iterating over each widget's `tokenSlots` array and combining them with the widget's matrix items (appearance/variant/state):

```typescript
// For each widget -> tokenSlot -> property, combined with matrix items
function generateTestCasesForWidget(widget: string, config: object): TestCase[] {
  const testCases = [];
  const matrixItems = generateOrthogonalMatrix(); // widget's appearance-variant-state combos

  for (const slot of config.tokenSlots) {
    for (const property of slot.properties) {
      for (const matrixItem of matrixItems) {
        const token = findCompatibleToken(slot.tokenType, property);
        testCases.push({
          widget,
          appearance: matrixItem.appearance,
          variant: matrixItem.variant,
          state: matrixItem.state,
          tokenType: slot.tokenType,
          property,
          tokenRef: token.ref,
          expectedValue: token.value
        });
      }
    }
  }
  return testCases;
}
```

### Token Selection Strategy

The `findCompatibleToken()` function uses **hash-based selection** to ensure:

- Different variants get different tokens (avoiding false positives)
- Token type matches the slot's expected type
- Selection is deterministic (same inputs produce same token)

```typescript
function findCompatibleToken(tokenType, property, variant): Token {
  const compatibleTokens = globalTokens.filter(t => t.type === tokenType);
  const hash = hashString(`${variant}-${property}`);
  return compatibleTokens[hash % compatibleTokens.length];
}
```

### Payload Structure Types

The `generateVariantPayload()` function builds the correct JSON structure based on the widget type. There are four structures:

#### Type 1: `direct-mapping`

Used by: accordion, anchor, webview, and other simple widgets

```json
{
  "accordion": {
    "mapping": {
      "header": {
        "background-color": "{color.surface.accordion.value}"
      }
    }
  }
}
```

#### Type 2: `hybrid-mapping`

Used by: navbar

Supports both root-level and appearance-specific mappings:

```json
{
  "navbar": {
    "mapping": {
      "background-color": "{color.background.navbar.value}"
    },
    "appearances": {
      "standard": {
        "mapping": {
          "title": {
            "font-size": "{font.heading.fontSize.value}"
          }
        }
      }
    }
  }
}
```

#### Type 3: `appearance-mapping`

Used by: cards

```json
{
  "card": {
    "appearances": {
      "default": {
        "mapping": {
          "title": {
            "font-size": "{font.heading.fontSize.value}"
          }
        }
      }
    }
  }
}
```

#### Type 4: `variant-groups` (Default)

Used by: button, panel, label, and most other widgets

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
                  "background": "{color.background.btn.primary.default.value}"
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

### Batch Payload Merging (Mobile)

For mobile testing, all individual payloads are **deep-merged** into a single batch payload per widget:

```typescript
// Mobile global setup merges all token-variant pairs into one payload
const batchPayload = {};
for (const testCase of allTestCases) {
  const individualPayload = generateVariantPayload(testCase.item, testCase.property, testCase.tokenRef);
  deepMerge(batchPayload, individualPayload);
}
// Saved to .test-cache/batch-payload-{widget}.json
```

This batch payload is applied once via the Studio API before building the mobile app.

---

## 4. CSS Verification -- Web Canvas

### Source Files

- `tests/token_slot_validation.spec.ts` -- Main validation logic
- `src/matrix/widget-xpaths.ts` -- XPath selectors (332 entries across 35+ widgets)
- `src/tokens/mappingService.ts` -- Value normalization

### How Canvas CSS Extraction Works

Canvas validation uses Playwright's `page.$eval()` to extract computed CSS values from the Studio's design canvas:

![Canvas CSS Extraction Sequence](arch-canvas-sequence.png)

### XPath Resolution

XPaths follow the pattern `{widget}-{appearance}-{variant}-{state}`:

```typescript
// src/matrix/widget-xpaths.ts
export const widgetXPaths = {
  canvas: {
    'button-filled-primary-default': '//div[contains(@class, "btn-filled")]//button[contains(@class, "primary")]',
    'button-filled-primary-disabled': '//div[contains(@class, "btn-filled")]//button[@disabled]',
    'accordion-standard-standard-default': '//div[contains(@class, "panel-group")]',
    // ... 332 entries
  }
};
```

### Property-Specific Element Selection

Some CSS properties apply to sub-elements (e.g., a button's text `color` is on an inner `span`, not the outer `button`). The `getElementSuffixFromPropertyPath()` function maps property paths to element suffixes:

```typescript
// Maps property paths to the correct sub-element
// "header.background-color" → look for the header sub-element
// "title.font-size" → look for the title sub-element
// "border.color" → look at the root element border

const elementSuffix = getElementSuffixFromPropertyPath(propertyPath);
const fullXPath = baseXPath + (elementSuffix ? `-${elementSuffix}` : '');
```

### CSS Value Extraction

```typescript
// Actual CSS extraction in test
const actualValue = await page.$eval(
  xpath,
  (el, prop) => window.getComputedStyle(el).getPropertyValue(prop),
  cssProperty  // e.g., 'background-color'
);
```

### Value Normalization

Before comparison, both expected and actual values are normalized:

```typescript
// src/tokens/mappingService.ts
static normalizeValue(value: string): string {
  // RGB to hex: rgb(98, 0, 238) → #6200ee
  // Strip units: "16px" → "16"
  // Font-weight keywords: "bold" → "700", "normal" → "400"
  // Transparent: "transparent" → "rgba(0,0,0,0)"
  // Trim whitespace and lowercase
}
```

---

## 5. CSS Verification -- Web Preview

### Source Files

- `tests/token_slot_validation.spec.ts` (Preview section, lines ~636-704)
- `wdio/utils/mobileMapper.ts` -- RN style path mapping
- `src/matrix/widget-xpaths.ts` -- Preview inspector selectors

### How Preview Verification Works

The Web Preview runs a React Native Web build. Instead of `getComputedStyle()`, the framework uses **React Native style commands** injected through a style inspector:

![Preview Verification Sequence](arch-preview-sequence.png)

### React Native Style Commands

The command format accesses the widget's internal React Native style tree:

```
App.appConfig.currentPage.Widgets.{studioWidgetName}._INSTANCE.styles.{rnStylePath}
```

Example commands:

```
# Get button background color
App.appConfig.currentPage.Widgets.button1._INSTANCE.styles.root.backgroundColor

# Get label font size
App.appConfig.currentPage.Widgets.label1._INSTANCE.styles.text.fontSize

# Get accordion header color
App.appConfig.currentPage.Widgets.accordion1._INSTANCE.styles.header.backgroundColor
```

### MobileMapper: CSS to RN Style Path Conversion

The `MobileMapper` class (`wdio/utils/mobileMapper.ts`) converts logical CSS property paths to React Native style paths:

```
CSS: background-color → RN: root.backgroundColor
CSS: font-size → RN: text.fontSize
CSS: border-radius → RN: root.borderRadius
CSS: padding → RN: root.paddingTop (or specific direction)
```

Each widget has specific mappings because the RN component tree differs from the CSS DOM tree.

### Inspector Element Selectors

```typescript
// src/matrix/widget-xpaths.ts
export const widgetXPaths = {
  previewInspector: {
    styleCommandInput: '//input[@data-testid="style-command-input"]',
    styleOutputLabel: '//label[@data-testid="style-output-label"]'
  }
};
```

---

## 6. CSS Verification -- Mobile (Android and iOS)

### Source Files

- `wdio/helpers/mobileVerification.helper.ts` -- Verification logic
- `wdio/pages/MobileWidget.page.ts` -- Page Object Model
- `wdio/utils/mobileMapper.ts` -- Style path mapping
- `wdio/utils/mobileTestData.ts` -- Test data loader

### How Mobile Verification Works

Mobile tests use the same RN style command approach as Preview, but executed through Appium accessibility IDs instead of Playwright:

![Mobile Verification Sequence](arch-mobile-sequence.png)

### Accessibility ID Elements

The mobile app includes a debugging interface with two elements:

- `~exinput_i` -- Text input field for entering RN style commands
- `~label2_caption` -- Label that displays the command result (JSON)

### Style Extraction Flow

```typescript
// wdio/pages/MobileWidget.page.ts (simplified)
class MobileWidgetPage {
  async getStyleValue(widgetName: string, rnPath: string): Promise<string> {
    const command = `App.appConfig.currentPage.Widgets.${widgetName}._INSTANCE.styles.${rnPath}`;

    // Enter command into input field
    const input = await $('~exinput_i');
    await input.setValue(command);

    // Read result from output label
    const output = await $('~label2_caption');
    const result = await output.getText();

    return JSON.parse(result);
  }
}
```

### Platform-Specific Selectors

While the RN style commands are identical across platforms, the Appium selectors differ:

```typescript
// Android: UiAutomator2
const element = await $('android=new UiSelector().resourceId("exinput_i")');

// iOS: XCUITest
const element = await $('~exinput_i'); // Accessibility ID
```

### Widget Name Mapping (CSV Files)

Mobile tests use CSV files to map matrix variant names to Studio widget instance names:

```csv
# tests/testdata/mobile/button-widget-variants.csv
variantName,studioWidgetName
button-filled-primary-default,button1
button-filled-primary-disabled,button2
button-outlined-primary-default,button3
button-outlined-primary-disabled,button4
button-text-primary-default,button5
```

These CSV files are loaded by `wdio/utils/mobileTestData.ts` at test runtime.

---

## 7. Visual Regression Testing

### Web Visual Regression (Playwright)

**Configuration** (`playwright.config.ts`):

```typescript
expect: {
  toHaveScreenshot: {
    maxDiffPixels: 100,        // Allow up to 100 pixels difference
    maxDiffPixelRatio: 0.01,   // Allow up to 1% pixel difference
    threshold: 0.2,            // Per-pixel color threshold (0-1)
    animations: 'disabled',    // Disable animations for consistency
  }
}
```

**Directories**:

- Baselines: `screenshots/base-image/`
- Actuals: `screenshots/actual-image/` (generated during tests)
- Diffs: `screenshots/difference-image/` (generated on failure)

**Usage in tests**:

```typescript
await expect(page).toHaveScreenshot('button-filled-primary-default.png');
```

### Mobile Visual Regression (pixelmatch)

**Source File**: `wdio/helpers/screenshot.helpers.ts`

Mobile visual regression uses a custom implementation with the `pixelmatch` library:

```typescript
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

function compareScreenshots(baselinePath: string, actualPath: string): ComparisonResult {
  const baseline = PNG.sync.read(fs.readFileSync(baselinePath));
  const actual = PNG.sync.read(fs.readFileSync(actualPath));
  const diff = new PNG({ width: baseline.width, height: baseline.height });

  const diffPixels = pixelmatch(
    baseline.data, actual.data, diff.data,
    baseline.width, baseline.height,
    { threshold: 0.03 }  // 3% color difference threshold
  );

  const totalPixels = baseline.width * baseline.height;
  const diffPercentage = diffPixels / totalPixels;

  return {
    match: diffPercentage >= 0.03,  // INVERTED: PASS if visual change detected
    diffPixels,
    diffPercentage,
    diffImagePath: saveDiffImage(diff)
  };
}
```

**Important: Inverted Logic**

Mobile screenshot comparison uses **inverted logic** compared to typical visual regression:

- Standard visual regression: **PASS** if images are identical
- This framework: **PASS** if images are **different** (meaning the token visually changed the widget)

This makes sense because the test is verifying that applying a token **actually changes** the widget's appearance.

**Directories**:

- Baselines: `screenshots/mobile-base/{platform}/` (from baseline app)
- Actuals: `screenshots/mobile-actual/{platform}/` (from actual app)
- Diffs: `screenshots/mobile-diff/{platform}/` (generated during comparison)

---

## 8. Token Distribution Algorithm

### Source Files

- `src/matrix/generator.ts` -- `distributeTokensToWidgets()` and `generateTokenVariantMapping()`

### How Tokens Are Distributed

The framework selects tokens from the global token pool and distributes them to widgets:

1. **Token Selection** (during global setup):
   - Scans `tokens/mobile/global/` directory
   - Picks 1-2 random tokens per file
   - Infers token type using `TokenMappingService.getMetadata()`
   - Saves selected tokens to `.test-cache/selected-tokens.json`

2. **Token-Variant Pairing** (`generateTokenVariantMapping()`):
   - Pairs selected tokens with matrix items
   - Filters by widget's `allowedTokenTypes`
   - Creates exhaustive mappings ensuring all tokens are used

3. **Round-Robin Distribution** (`distributeTokensToWidgets()`):
   - Distributes tokens evenly across widgets
   - Each widget gets at least one token per allowed type
   - Hash-based slot selection ensures variety

### Property Path Computation

The `computeFinalPropertyPath()` function determines which CSS property a token will modify:

```typescript
function computeFinalPropertyPath(item: MatrixItem, propertyPath: string[], tokenRef: string): string {
  // Special token type overrides
  if (item.tokenType === 'asterisk-color') return 'asterisk.color';
  if (item.tokenType === 'margin') return 'margin';
  if (['padding', 'space', 'spacer'].includes(item.tokenType)) return 'padding';

  // Check if token's property path matches a valid slot
  const slots = getPropertyPathsForType(item.widget, item.tokenType);
  const flatSlots = slots.map(s => s.join('.'));

  if (flatSlots.includes(propertyPath.join('.'))) {
    return propertyPath.join('.');  // Exact match
  } else {
    // Round-robin based on token hash
    const hash = tokenRef.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return flatSlots[hash % flatSlots.length];
  }
}
```

---

## 9. Widget Structure Types

### Source Files

- `src/matrix/widgets.ts` -- `WIDGET_STRUCTURE_MAP`

### Structure Type Map

Each widget is assigned a structure type that determines how its payload is formatted:

```typescript
export const WIDGET_STRUCTURE_MAP: Record<Widget, StructureType> = {
  // direct-mapping: Simple flat mapping
  accordion: 'direct-mapping',
  anchor: 'direct-mapping',
  webview: 'direct-mapping',
  bottomsheet: 'direct-mapping',
  barcodescanner: 'direct-mapping',

  // hybrid-mapping: Root + appearance-specific
  navbar: 'hybrid-mapping',

  // appearance-mapping: Per-appearance mapping
  cards: 'appearance-mapping',
  formcontrols: 'appearance-mapping',

  // variant-groups: Full variant group nesting (default for most widgets)
  button: 'variant-groups',
  label: 'variant-groups',
  panel: 'variant-groups',
  picture: 'variant-groups',
  // ... and most other widgets
};
```

### Decision Tree for Structure Type

![Structure Type Decision Tree](arch-structure-decision.png)

### Widget Key Shortening

Some widgets use shortened keys in payloads:

```typescript
const keyMap = {
  button: 'btn',
  cards: 'card',
  formcontrols: 'form-controls',
  'form-wrapper': 'form',
  radioset: 'radiobutton',
  'dropdown-menu': 'dropdown'
};
```

---

## Next Steps

- [Adding New Widgets](04-ADDING-NEW-WIDGETS.md) -- How to integrate a new widget using these systems
- [Web Testing Guide](05-WEB-TESTING-GUIDE.md) -- Running and understanding Playwright tests
- [Mobile Testing Guide](06-MOBILE-TESTING-GUIDE.md) -- Running and understanding WebDriverIO tests

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

---

## 07-CONFIGURATION-REFERENCE

# Configuration Reference

This document provides a complete reference for all environment variables and configuration files used by the framework.

---

## Table of Contents

1. [Environment Variables](#environment-variables)
2. [Playwright Configuration](#playwright-configuration)
3. [WDIO Configuration Files](#wdio-configuration-files)
4. [Widget Token Slots](#widget-token-slots)
5. [TypeScript Configuration](#typescript-configuration)

---

## Environment Variables

All environment variables are configured in the `.env` file. Copy `.env.example` to `.env` and fill in your values.

### Studio Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STUDIO_BASE_URL` | Yes | -- | WaveMaker Studio base URL (e.g., `https://stage-studio.wavemakeronline.com/`) |
| `PROJECT_ID` | Yes | -- | WaveMaker project ID (e.g., `WMPRJ2c9180879b8c2464019b8ca78bde000e`) |
| `STUDIO_PROJECT_ID` | Yes | Falls back to `PROJECT_ID` | Studio-specific project ID (e.g., `proj-71823062-f485-4f48-8b76-8227cd1a991d`) |
| `RUNTIME_BASE_URL` | No | Falls back to `BASE_URL` | Runtime preview base URL |
| `BASE_URL` | No | -- | Alternative base URL (used by Playwright config) |
| `TOKENS_DIR` | No | `<repo>/Tokens` | Path to the tokens directory |

### Authentication

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STUDIO_USERNAME` | Yes | -- | WaveMaker Studio login email |
| `STUDIO_PASSWORD` | Yes | -- | WaveMaker Studio login password |
| `STUDIO_COOKIE` | No | Set dynamically | Full Cookie header from authenticated session (alternative to username/password) |
| `STUDIO_API_KEY` | No | -- | API key for Studio (alternative auth) |
| `STUDIO_ORIGIN` | No | -- | Origin header for Studio API requests |
| `STUDIO_REFERER` | No | -- | Referer header for Studio API requests |

### API Paths

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STUDIO_LOGIN_PATH` | No | `/login/authenticate` | Studio login endpoint path |
| `STUDIO_DEPLOY_PATH` | No | `/studio/services/projects/${PROJECT_ID}/inplace-deploy` | In-place deploy endpoint path |
| `STUDIO_PUBLISH_PATH` | No | `/projects/${PROJECT_ID}/style/publish` | Style publish endpoint path |
| `CANVAS_PATH` | No | `s/page/Main?project-id=${PROJECT_ID}` | Canvas page URL path |
| `PREVIEW_PATH` | No | `/preview` | Preview URL path |

### Mobile Platform

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MOBILE_PLATFORM` | No | `android` | Target mobile platform: `android`, `ios`, or `both` |
| `PLATFORM` | No | -- | Alternative to MOBILE_PLATFORM (used in some scripts) |
| `RUN_LOCAL` | No | `false` | Set to `true` for local Appium execution, `false` for BrowserStack |

### Mobile Build

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MOBILE_BUILD_DIR` | No | `./mobile-builds` | Base directory for mobile build artifacts |
| `ANDROID_BASELINE_APK_PATH` | No | Auto-resolved | Path to baseline APK |
| `ANDROID_ACTUAL_APK_PATH` | No | Auto-resolved | Path to actual (token-applied) APK |
| `ANDROID_APK_PATH` | No | -- | Generic APK path (used in parallel config) |
| `IOS_IPA_PATH` | No | -- | Path to iOS IPA file |
| `IOS_BASELINE_IPA_PATH` | No | -- | Path to baseline iOS IPA |
| `MOBILE_BUILD_COMMAND_ANDROID` | No | -- | Custom Android build command override |
| `MOBILE_BUILD_COMMAND_IOS` | No | -- | Custom iOS build command override |

### iOS Certificates

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `IOS_P12_CERT_PATH` | For iOS | -- | Path to .p12 certificate file |
| `IOS_PROVISION_PROFILE_PATH` | For iOS | -- | Path to .mobileprovision file |
| `IOS_P12_PASSWORD` | For iOS | -- | Password for the .p12 certificate |

### BrowserStack

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BROWSERSTACK_USERNAME` | For cloud | -- | BrowserStack account username |
| `BROWSERSTACK_ACCESS_KEY` | For cloud | -- | BrowserStack access key |
| `BROWSERSTACK_ANDROID_DEVICE` | No | `Samsung Galaxy S23` | Android device name |
| `BROWSERSTACK_ANDROID_OS` | No | `13.0` | Android OS version |
| `BROWSERSTACK_IOS_DEVICE` | No | `iPhone 14` | iOS device name |
| `BROWSERSTACK_IOS_OS` | No | `16` | iOS version |
| `BROWSERSTACK_MAX_INSTANCES` | No | `5` | Max parallel BrowserStack sessions |
| `BROWSERSTACK_ANDROID_APP_URL` | No | Auto-resolved | BrowserStack Android app URL (bs://...) |
| `BROWSERSTACK_IOS_APP_URL` | No | Auto-resolved | BrowserStack iOS app URL (bs://...) |

### Local Appium

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `APPIUM_HOST` | For local | `127.0.0.1` | Appium server host |
| `APPIUM_PORT` | For local | `4723` | Appium server port |
| `APPIUM_PATH` | For local | `/` | Appium base path |
| `LOCAL_DEVICE_NAME` | For local | -- | Android emulator name (e.g., `Pixel 9 Pro`) |
| `LOCAL_PLATFORM_VERSION` | For local | -- | Android emulator OS version (e.g., `15.0`) |
| `LOCAL_IOS_DEVICE_NAME` | For local iOS | Falls back to `LOCAL_DEVICE_NAME` | iOS simulator name |
| `LOCAL_IOS_PLATFORM_VERSION` | For local iOS | Falls back to `LOCAL_PLATFORM_VERSION` | iOS simulator OS version |

### Parallel Execution

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PARALLEL_EMULATORS` | No | `5` | Number of parallel Android emulators |

### Test Filters

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TEST_WIDGETS` | No | All widgets | Comma-separated widget filter (e.g., `button,accordion,label`) |
| `SLOT_VERIFY_TARGET` | No | `both` | Slot verification target: `canvas`, `preview`, or `both` |

### AWS / S3 (Report Upload)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AWS_ACCESS_KEY_ID` | For S3 | -- | AWS access key ID |
| `AWS_SECRET_ACCESS_KEY` | For S3 | -- | AWS secret access key |
| `AWS_REGION` | For S3 | `us-west-2` | AWS region |
| `S3_BUCKET_NAME` | For S3 | `wm-qa-automation` | S3 bucket name for reports |
| `S3_PATH_PREFIX` | For S3 | -- | S3 path prefix for organizing reports |

### CI / CD

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CI` | No | -- | Set automatically in CI environments. Enables retries and conservative workers. |

---

## Playwright Configuration

**File**: `playwright.config.ts`

### Key Settings

| Setting | Value | Description |
|---------|-------|-------------|
| `testDir` | `./tests` | Directory containing test specs |
| `fullyParallel` | `true` | Enable parallel test execution |
| `retries` | `0` (local) / `4` (CI) | Number of automatic retries |
| `workers` | `1` | Number of parallel workers |
| `timeout` | `120000` (2 min) | Per-test timeout |
| `headless` | `true` | Run browsers without UI |
| `viewport` | `1280x720` | Browser viewport size |
| `trace` | `on` | Capture execution traces |
| `screenshot` | `on` | Capture screenshots |
| `video` | `on` | Record video |

### Screenshot Comparison

| Setting | Value | Description |
|---------|-------|-------------|
| `maxDiffPixels` | `100` | Maximum allowed pixel difference |
| `maxDiffPixelRatio` | `0.01` | Maximum allowed pixel ratio difference (1%) |
| `threshold` | `0.2` | Per-pixel color threshold (0-1 scale) |
| `animations` | `disabled` | Disable animations during screenshot |

### Directories

| Purpose | Path |
|---------|------|
| Test specs | `tests/` |
| Baseline snapshots | `screenshots/base-image/` |
| Test output | `artifacts/test-results/` |
| Auth state | `.test-cache/auth.json` |

---

## WDIO Configuration Files

All WDIO configuration files are in `wdio/config/`.

### `wdio.shared.conf.ts` -- Base Configuration

Shared across all execution modes:

| Setting | Value | Description |
|---------|-------|-------------|
| `framework` | `mocha` | Test framework |
| `mochaOpts.timeout` | `600000` (10 min) | Per-test timeout |
| `reporters` | `spec`, `allure` | Test reporters |
| `logLevel` | `info` | Log verbosity |
| `logDir` | `logs/` | Log directory |

### `wdio.browserstack.conf.ts` -- Cloud Testing

| Setting | Description |
|---------|-------------|
| Extends `wdio.shared.conf.ts` | Inherits all shared settings |
| Dynamic capabilities | Reads from env vars and cache |
| Platform filtering | Uses `PLATFORM` env var |
| Max instances | Configurable via `BROWSERSTACK_MAX_INSTANCES` |

### `wdio.local.conf.ts` -- Single Local Device

| Setting | Description |
|---------|-------------|
| Extends `wdio.shared.conf.ts` | Inherits all shared settings |
| Connection | `APPIUM_HOST:APPIUM_PORT` |
| App path | From cache or env vars |
| Single device | One emulator/simulator |

### `wdio.local.parallel.conf.ts` -- Parallel Local Devices

| Setting | Description |
|---------|-------------|
| Extends `wdio.shared.conf.ts` | Inherits all shared settings |
| Multiple ports | `4723` + offset for each emulator |
| Emulator count | `PARALLEL_EMULATORS` env var |
| Dynamic distribution | Specs distributed across emulators |

---

## Widget Token Slots

**File**: `wdio/config/widget-token-slots.json`

This is the **source of truth** for which properties each widget variant supports. The structure is:

```
{
  "<widget>": {
    "<appearance>": {
      "<variant>": {
        "<state>": {
          "<tokenType>": ["<property1>", "<property2>", ...]
        }
      }
    }
  }
}
```

### How It Is Used

- **Slot Validation Tests**: Generates test cases for 100% slot coverage
- **Batch Payload Generation**: Determines which properties to include
- **Coverage Reports**: Compares configured slots vs. actual payloads

### Adding or Modifying Slots

When adding a new property slot:

1. Add the property to the appropriate widget-appearance-variant-state-tokenType array
2. Ensure the property has a corresponding RN style mapping in `mobileMapper.ts`
3. Ensure the property has a corresponding XPath selector (with element suffix) in `widget-xpaths.ts`

---

## TypeScript Configuration

**File**: `tsconfig.json`

| Setting | Value | Description |
|---------|-------|-------------|
| `target` | `ES2020` | ECMAScript target |
| `module` | `CommonJS` | Module system |
| `strict` | `true` | Strict type checking |
| `esModuleInterop` | `true` | CommonJS/ESM interop |
| `resolveJsonModule` | `true` | Import JSON files |

### Included Paths

- `src/` -- Core framework source
- `tests/` -- Playwright test specs
- `wdio/**/*.ts` -- WebDriverIO files
- `playwright.config.ts` -- Playwright config

### Type Definitions

- `@types/node`
- `@playwright/test`
- `@types/mocha`
- `webdriverio`

---

## Next Steps

- [Getting Started](01-GETTING-STARTED.md) -- Setting up your environment
- [Troubleshooting and FAQ](08-TROUBLESHOOTING-AND-FAQ.md) -- Common configuration issues

---

## 08-TROUBLESHOOTING-AND-FAQ

# Troubleshooting and FAQ

This document covers common issues, debugging techniques, and frequently asked questions about the Style Workspace Automation framework.

---

## Table of Contents

1. [Setup Issues](#setup-issues)
2. [Web Test Failures (Playwright)](#web-test-failures-playwright)
3. [Mobile Test Failures (WebDriverIO)](#mobile-test-failures-webdriverio)
4. [Build Failures](#build-failures)
5. [BrowserStack Issues](#browserstack-issues)
6. [Screenshot and Visual Regression Issues](#screenshot-and-visual-regression-issues)
7. [Token and Payload Issues](#token-and-payload-issues)
8. [Performance Issues](#performance-issues)
9. [FAQ](#faq)

---

## Setup Issues

### Node.js version mismatch

**Symptom**: `SyntaxError: Unexpected token` or module resolution errors

**Fix**: Ensure you are running Node.js >= 18.x:

```bash
node --version   # Should be >= 18.x
nvm use 18       # If using nvm
```

### Playwright browsers not installed

**Symptom**: `Error: browserType.launch: Executable doesn't exist`

**Fix**:

```bash
npx playwright install
npx playwright install-deps   # Install system dependencies (Linux)
```

### Missing token value map

**Symptom**: `Error: Cannot find tokens/token-values-mobile.json` or empty token resolutions

**Fix**:

```bash
npm run build:token-map
```

This generates the token value map from `tokens/mobile/global/`. You need to run this whenever token files are updated.

### Environment validation failure

**Symptom**: `Missing required environment variables: STUDIO_BASE_URL, PROJECT_ID...`

**Fix**: Ensure your `.env` file exists and has the required values:

```bash
cp .env.example .env
# Edit .env with your actual values
```

Required variables: `STUDIO_BASE_URL`, `PROJECT_ID`, `STUDIO_USERNAME`, `STUDIO_PASSWORD`

### npm install fails

**Symptom**: Dependency resolution errors

**Fix**:

```bash
rm -rf node_modules package-lock.json
npm install
```

If specific packages fail, check that your npm registry is accessible:

```bash
npm config get registry
# Should be: https://registry.npmjs.org/
```

---

## Web Test Failures (Playwright)

### Authentication failure (401)

**Symptom**: `Error: Studio API returned 401 Unauthorized`

**Causes and fixes**:

1. **Wrong credentials**: Verify `STUDIO_USERNAME` and `STUDIO_PASSWORD` in `.env`
2. **Session expired**: The framework auto-retries with re-authentication, but if persistent, clear cached auth:
   ```bash
   rm .test-cache/auth.json
   ```
3. **URL mismatch**: Ensure `STUDIO_BASE_URL` points to the correct environment (stage, dev, WMO)

### Element not found (XPath)

**Symptom**: `Error: Element not found for xpath: //div[contains(@class, ...)]`

**Causes and fixes**:

1. **Widget not on page**: Ensure the widget instance exists on the Studio page
2. **XPath changed**: The Studio DOM may have changed. Inspect the element in Chrome DevTools and update `src/matrix/widget-xpaths.ts`
3. **Page not loaded**: Increase navigation timeout or add explicit wait

### CSS value mismatch

**Symptom**: `Expected "rgb(98, 0, 238)" to equal "#6200ee"`

**Causes and fixes**:

1. **Normalization issue**: The value normalization in `TokenMappingService.normalizeValue()` may not handle a specific format. Check and add the missing normalization rule.
2. **Token not applied**: The token may not have been applied or published. Check the Studio API response.
3. **Wrong property extracted**: Verify the CSS property name matches what `getComputedStyle()` returns.

### Timeout errors

**Symptom**: `Test timeout of 120000ms exceeded`

**Causes and fixes**:

1. **Slow deploy**: Studio publish/deploy can take time. Increase timeout in `playwright.config.ts`:
   ```typescript
   timeout: 180000,  // 3 minutes
   ```
2. **Slow page load**: Add explicit waits before extraction:
   ```typescript
   await page.waitForLoadState('networkidle');
   ```
3. **CI environment**: CI environments may be slower. Set `retries: 4` for CI.

---

## Mobile Test Failures (WebDriverIO)

### App not found

**Symptom**: `Error: The app was not found` or `Invalid app URL`

**Causes and fixes**:

1. **Apps not built**: Run the global setup first:
   ```bash
   npm run test:mobile:setup
   ```
2. **BrowserStack upload failed**: Check `.test-cache/browserstack-android-app-url.txt` for a valid `bs://` URL
3. **Local APK path wrong**: Check `ANDROID_BASELINE_APK_PATH` and `ANDROID_ACTUAL_APK_PATH` in `.env`

### Appium connection refused

**Symptom**: `Error: connect ECONNREFUSED 127.0.0.1:4723`

**Fix**:

1. Start the Appium server:
   ```bash
   appium
   ```
2. Verify it is running:
   ```bash
   curl http://127.0.0.1:4723/status
   ```
3. Check that `APPIUM_HOST` and `APPIUM_PORT` in `.env` match the running server

### Emulator not found

**Symptom**: `Error: Device not found` or `Could not find a connected Android device`

**Fix**:

1. Start the emulator:
   ```bash
   emulator -avd <avd-name>
   ```
2. Verify it is running:
   ```bash
   adb devices
   ```
3. Check that `LOCAL_DEVICE_NAME` matches the emulator name

### Style command returns empty or null

**Symptom**: Style extraction returns `null`, `undefined`, or empty string

**Causes and fixes**:

1. **Wrong widget name**: Verify the `studioWidgetName` in the CSV file matches the actual widget instance in the Studio project
2. **Wrong style path**: The RN style path may be incorrect. Use the debug inspector to explore:
   ```
   App.appConfig.currentPage.Widgets.button1._INSTANCE.styles
   ```
   This returns the full styles object, showing all available paths.
3. **Widget not rendered**: The widget may not be on the current page or may not have rendered yet. Add a wait.

### Element not interactable

**Symptom**: `Error: element not interactable` for the style command input

**Fix**: The input field may be hidden or require scrolling. Ensure the debug panel is visible on the test page. The input field has accessibility ID `exinput_i`.

---

## Build Failures

### Android APK build failure

**Symptom**: Gradle build fails during `test:mobile:setup`

**Causes and fixes**:

1. **Java version**: Ensure Java JDK >= 11 is installed
   ```bash
   java -version
   ```
2. **Android SDK**: Ensure `ANDROID_HOME` is set
   ```bash
   echo $ANDROID_HOME
   ```
3. **Gradle daemon**: Kill stale Gradle daemons
   ```bash
   ./gradlew --stop
   ```
4. **Dependencies**: Run in the exported project directory:
   ```bash
   npm install
   ```

### iOS IPA build failure

**Symptom**: Xcode build fails during setup

**Causes and fixes**:

1. **Xcode not installed**: Install Xcode from the App Store (macOS only)
2. **Certificate issues**: Verify certificate paths in `.env`:
   ```bash
   ls $IOS_P12_CERT_PATH
   ls $IOS_PROVISION_PROFILE_PATH
   ```
3. **CocoaPods**: Install and update pods:
   ```bash
   cd ios && pod install
   ```

### RN Project export failure

**Symptom**: Project export or download fails

**Causes and fixes**:

1. **Network timeout**: The export/build API may take time. The framework polls every 5 seconds with a 5-minute timeout.
2. **Studio session expired**: Re-authenticate by clearing cache and re-running
3. **Disk space**: Ensure sufficient disk space for project export

---

## BrowserStack Issues

### Device queue timeout

**Symptom**: `Error: All parallel tests are being used` or long queue times

**Fix**: Reduce parallel instances:

```bash
BROWSERSTACK_MAX_INSTANCES=2 npm run test:mobile
```

### App upload failure

**Symptom**: `Error: Failed to upload app to BrowserStack`

**Causes and fixes**:

1. **Invalid credentials**: Verify `BROWSERSTACK_USERNAME` and `BROWSERSTACK_ACCESS_KEY`
2. **File too large**: BrowserStack has a 200MB limit for app uploads
3. **Network issue**: Check internet connectivity

### Device not available

**Symptom**: `Error: Device Samsung Galaxy S23 with os 13.0 not available`

**Fix**: Check available devices on [BrowserStack device list](https://www.browserstack.com/list-of-browsers-and-platforms/app_automate) and update:

```bash
BROWSERSTACK_ANDROID_DEVICE=Google Pixel 8 Pro
BROWSERSTACK_ANDROID_OS=14.0
```

---

## Screenshot and Visual Regression Issues

### All screenshots are different (false positives)

**Symptom**: Every screenshot comparison shows differences, even without token changes

**Causes and fixes**:

1. **Timing issue**: Widget may still be animating. Add wait before screenshot capture.
2. **Font rendering**: Different device/OS versions render fonts differently. Use the same device model and OS for baseline and actual.
3. **Screen size mismatch**: Ensure baseline and actual use the same device dimensions.

### No visual difference detected (false negatives)

**Symptom**: Tokens are applied but screenshot comparison shows no difference

**Causes and fixes**:

1. **Token too subtle**: Small color changes may fall below the 3% threshold. Check the actual diff percentage in the test output.
2. **Wrong element captured**: The screenshot may not include the widget. Verify the element selector.
3. **Token not applied**: Check the batch payload to verify the token is included.

### Baseline screenshots missing

**Symptom**: `Error: Baseline image not found`

**Fix**: Re-run the global setup to capture baselines:

```bash
# For mobile
npm run test:mobile:setup

# For web
npm run test:update
```

---

## Token and Payload Issues

### Token not applied to the widget

**Symptom**: Studio API returns success but the widget appearance does not change

**Causes and fixes**:

1. **Wrong structure type**: Check `WIDGET_STRUCTURE_MAP` matches the widget's expected payload format
2. **Wrong widget key**: Some widgets have shortened keys (e.g., `button` -> `btn`). Check `getWidgetKey()`.
3. **Publish not triggered**: Ensure publish is called after applying the token
4. **Cached state**: Clear cached payloads:
   ```bash
   rm .test-cache/payloads/*.json
   rm .test-cache/batch-payload-*.json
   ```

### Payload structure mismatch

**Symptom**: Studio API returns error or token has no effect

**Debug**: Compare your generated payload with a known-working payload:

```bash
# View the generated payload
cat .test-cache/payloads/button.json | python3 -m json.tool

# Compare with expected structure from Studio
# (Use browser DevTools to capture a manual token application)
```

### Token value not resolved

**Symptom**: Expected value shows `{color.background.btn.primary.default.value}` instead of a hex color

**Fix**: The token reference was not resolved. Regenerate the token value map:

```bash
npm run build:token-map
```

Then verify the token exists in the map:

```bash
cat tokens/token-values-mobile.json | grep "color.background.btn"
```

---

## Performance Issues

### Tests are very slow

**Optimization strategies**:

1. **Filter widgets**: Only test the widgets you are working on:
   ```bash
   TEST_WIDGETS=button,label npm run test:slots
   ```

2. **Single target**: Test canvas or preview individually:
   ```bash
   npm run test:slots:canvas   # Skip preview
   ```

3. **Parallel execution (mobile)**: Use multiple emulators:
   ```bash
   npm run test:mobile:android:parallel
   ```

4. **BrowserStack max instances**: Increase parallel sessions:
   ```bash
   BROWSERSTACK_MAX_INSTANCES=5 npm run test:mobile
   ```

### Mobile build takes too long

The batch build strategy already minimizes build time (2 builds instead of N). If builds are still slow:

1. **Use debug builds**: Debug builds are faster than release
2. **Cache build artifacts**: The framework caches built APKs/IPAs
3. **Skip rebuilding**: If apps are already built, skip the setup step

---

## FAQ

### Q: How many widgets does the framework support?

**A**: 44 widgets as of the current version. See the `Widget` type in `src/matrix/widgets.ts` for the full list.

### Q: How does the orthogonal matrix reduce test cases?

**A**: It uses modulo-based indexing to ensure every token type is tested with every combination dimension (pairwise coverage) without testing every possible permutation. This reduces ~25,000 combinations to ~250 tests while maintaining 70-95% defect detection confidence.

### Q: What is the difference between canvas and preview testing?

**A**: 
- **Canvas**: Tests the Studio's design-time view. Uses `getComputedStyle()` to extract CSS values from the rendered DOM.
- **Preview**: Tests the React Native Web runtime. Uses RN style commands (`App.appConfig...styles`) to extract values from the RN style tree.

Both validate the same tokens but through different rendering engines.

### Q: Why does mobile use batch builds instead of individual token application?

**A**: Building a mobile app takes ~5 minutes. Testing N tokens individually would require N builds. The batch strategy applies all tokens at once and builds just 2 apps (baseline + actual), reducing total build time from hours to ~10 minutes.

### Q: How do I add support for a new token type?

**A**: 
1. Add the type to the `TokenType` union in `src/matrix/widgets.ts`
2. Add it to the `TOKEN_TYPES` array in `src/matrix/generator.ts`
3. Add normalization rules in `src/tokens/mappingService.ts` if needed
4. Add it to relevant widgets' `allowedTokenTypes` arrays
5. Define slots in `widget-token-slots.json`

### Q: Can I run tests against production (WMO)?

**A**: Yes. Update the `.env` file to point to the WMO environment:

```bash
STUDIO_BASE_URL=https://www.wavemakeronline.com/
PROJECT_ID=<your-wmo-project-id>
STUDIO_PROJECT_ID=<your-wmo-studio-project-id>
```

### Q: How do I update baseline screenshots?

**A**:

For web:
```bash
npm run test:update
```

For mobile: Re-run the global setup which rebuilds the baseline app:
```bash
npm run test:mobile:setup
```

### Q: What happens if a test fails on CI?

**A**: On CI (`CI=true`), Playwright automatically retries failed tests up to 4 times. If the test still fails after retries, it is marked as failed in the report. Check the HTML report and trace files for debugging.

### Q: How do I run tests for only one widget?

**A**:

For web:
```bash
TEST_WIDGETS=button npm run test:slots
```

For mobile (if a dedicated script exists):
```bash
npm run test:mobile:button
```

Or run a specific spec file:
```bash
wdio run wdio/config/wdio.browserstack.conf.ts --spec wdio/specs/mobile.button.token.validate.spec.ts
```

### Q: Where are test artifacts stored?

**A**:

| Artifact | Location |
|----------|----------|
| Playwright HTML report | `playwright-report/` |
| Playwright traces | `artifacts/test-results/` |
| JSON logs | `logs/playwright-log.json` |
| Token validation reports | `artifacts/playwright-token-reports/` |
| Slot test results | `artifacts/slot-test-results/` |
| Allure results | `allure-results/` |
| Allure HTML report | `allure-report/` |
| WDIO logs | `logs/wdio-*.log` |
| Mobile screenshots | `screenshots/mobile-*/` |
| Mobile styles | `artifacts/mobile-styles/` |
| Cached data | `.test-cache/` |

### Q: How do I clean up test artifacts?

**A**:

```bash
# Clean Allure results
rm -rf allure-results allure-report

# Clean screenshots
rm -rf screenshots/mobile-actual screenshots/mobile-diff

# Clean cached data
rm -rf .test-cache/payloads .test-cache/batch-payload-*.json

# Clean all artifacts
rm -rf artifacts logs allure-results allure-report
```

---

## Getting Help

If you encounter an issue not covered here:

1. Check the [Configuration Reference](07-CONFIGURATION-REFERENCE.md) for correct env var setup
2. Review the [Architecture Deep Dive](03-ARCHITECTURE-DEEP-DIVE.md) to understand the failing component
3. Check WDIO/Playwright logs in the `logs/` directory
4. Inspect cached data in `.test-cache/` for payload and token issues

