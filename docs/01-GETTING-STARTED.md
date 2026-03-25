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
