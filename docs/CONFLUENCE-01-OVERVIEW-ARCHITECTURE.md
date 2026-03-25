# Style Workspace Automation - Confluence

This is a split page version for stable Confluence rendering.

---

## README

# Style Workspace Automation

**Token-driven test automation framework for validating WaveMaker Studio's Style Workspace across Web (Canvas + Preview) and Mobile (Android + iOS) platforms.**

---

## Why This Framework Exists

WaveMaker Studio's Style Workspace allows designers to customize widget appearances using design tokens. With 44+ widgets, each having multiple appearances, variants, states, and 14 token types, the total number of possible combinations exceeds **25,000**. Manual testing is impractical.

This framework uses **orthogonal array testing** to reduce the test space by ~90%, achieving comprehensive pairwise coverage with only ~2,500 test cases while catching rendering regressions with 70-95% confidence.

---

## Key Features

- **Orthogonal Matrix Testing** -- Reduces 25,000+ combinations to ~250 tests using mathematical optimization
- **Dual-Platform Coverage** -- Validates tokens on Web (Playwright) and Mobile (WebDriverIO/Appium)
- **Four Runtime Targets** -- Canvas, Web Preview, Android, and iOS
- **Visual Regression** -- Screenshot comparison with `pixelmatch` and Playwright snapshots
- **Batch Build Strategy** -- Builds 2 mobile apps (baseline + actual) instead of N, achieving 5-10x speed improvement
- **Parallel Execution** -- Supports parallel emulators and BrowserStack cloud testing
- **Automated Reporting** -- Allure reports, Playwright HTML reports, and token coverage reports

---

## Architecture Overview

![Architecture Overview](readme-architecture.png)

---

## Quick Start

### 1. Install Dependencies

```bash
git clone <repository-url>
cd style-workspace-automation
npm install
npx playwright install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your Studio credentials and project details
```

### 3. Run Tests

```bash
# Web tests (Playwright)
npm test

# Mobile tests (WebDriverIO + BrowserStack)
npm run test:mobile

# Slot validation tests
npm run test:slots
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Web Testing | Playwright | Canvas and Preview validation |
| Mobile Testing | WebDriverIO + Appium | Android and iOS validation |
| Cloud Devices | BrowserStack | Remote mobile device execution |
| Visual Regression | pixelmatch + Playwright Snapshots | Screenshot comparison |
| Reporting | Allure + Playwright HTML | Test result reporting |
| API Client | Axios | WaveMaker Studio API interaction |
| Language | TypeScript | Type-safe test automation |
| Build Tools | ts-node | Direct TypeScript execution |
| Token Schema | Zod | Token file validation |
| Logging | Winston | Structured logging |
| CI Artifacts | AWS S3 | Report storage and distribution |

---

## Project Structure

```
style-workspace-automation/
├── src/                          # Core framework source code
│   ├── api/                      # Studio API client and RN project manager
│   ├── matrix/                   # Orthogonal matrix generator and widget configs
│   ├── playwright/               # Playwright helpers, reporters, slot generator
│   ├── tokens/                   # Token loader, mapping service, schema
│   └── utils/                    # Environment config, logger
├── tests/                        # Playwright test specs
│   ├── global-setup.ts           # Authentication, baselines, token selection
│   ├── token_apply_and_validate.spec.ts   # Main web validation suite
│   ├── token_slot_validation.spec.ts      # Slot-based validation
│   └── testdata/mobile/          # CSV test data for mobile widgets
├── wdio/                         # WebDriverIO mobile framework
│   ├── config/                   # WDIO configs (shared, BrowserStack, local)
│   ├── specs/                    # Mobile test specs (30+ widgets)
│   ├── components/               # Page Object Model components
│   ├── helpers/                  # Screenshot and verification helpers
│   └── utils/                    # Mobile mapper, test data loader
├── tokens/                       # Design token definitions
│   ├── web/                      # Web token files (per component)
│   └── mobile/                   # Mobile token files (global + component)
├── scripts/                      # Build, upload, and utility scripts
├── screenshots/                  # Baseline, actual, and diff images
├── artifacts/                    # Test results and reports
├── mobile-builds/                # Android APK and iOS IPA outputs
├── .test-cache/                  # Cached payloads, auth state, app URLs
├── playwright.config.ts          # Playwright configuration
├── .env.example                  # Environment variable template
└── package.json                  # Scripts and dependencies
```

---

## Available NPM Scripts

### Web Testing (Playwright)

| Script | Description |
|--------|-------------|
| `npm test` | Run all Playwright tests |
| `npm run test:headed` | Run with visible browser |
| `npm run test:slots` | Run token slot validation |
| `npm run test:canvas` | Validate Canvas only |
| `npm run test:preview` | Validate Preview only |

### Mobile Testing (WebDriverIO)

| Script | Description |
|--------|-------------|
| `npm run test:mobile` | Run mobile tests on BrowserStack (Android) |
| `npm run test:mobile:full` | Full suite: setup + Android + iOS |
| `npm run test:mobile:android` | Local Android emulator |
| `npm run test:mobile:ios` | BrowserStack iOS |
| `npm run test:mobile:setup` | Build and upload mobile apps |

### Utilities

| Script | Description |
|--------|-------------|
| `npm run build:token-map` | Generate token value mappings |
| `npm run build:mobile` | Build mobile apps locally |
| `npm run allure:generate` | Generate Allure HTML report |
| `npm run allure:open` | Open Allure report in browser |
| `npm run uploadS3` | Upload reports to S3 |

---

## Documentation

| Document | Description |
|----------|-------------|
| [Getting Started](docs/01-GETTING-STARTED.md) | Prerequisites, installation, first test run |
| [Framework Overview](docs/02-FRAMEWORK-OVERVIEW.md) | What this framework does and key concepts |
| [Architecture Deep Dive](docs/03-ARCHITECTURE-DEEP-DIVE.md) | Matrix generation, payloads, CSS verification |
| [Adding New Widgets](docs/04-ADDING-NEW-WIDGETS.md) | Step-by-step widget integration guide |
| [Web Testing Guide](docs/05-WEB-TESTING-GUIDE.md) | Playwright testing for Canvas and Preview |
| [Mobile Testing Guide](docs/06-MOBILE-TESTING-GUIDE.md) | WebDriverIO testing for Android and iOS |
| [Configuration Reference](docs/07-CONFIGURATION-REFERENCE.md) | All environment variables and config files |
| [Troubleshooting and FAQ](docs/08-TROUBLESHOOTING-AND-FAQ.md) | Common issues, debugging, and FAQ |

---

## Supported Widgets (44)

button, accordion, label, panel, cards, formcontrols, form-wrapper, navbar, picture, carousel, tabbar, bottomsheet, barcodescanner, tabs, list, chips, radioset, checkbox, checkboxset, toggle, switch, wizard, container, tile, button-group, anchor, webview, spinner, search, progress-bar, progress-circle, dropdown-menu, popover, login, calendar, slider, rating, icon, lottie, audio, message, modal-dialog, fileupload

---

## License

ISC

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

