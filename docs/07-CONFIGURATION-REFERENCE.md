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
