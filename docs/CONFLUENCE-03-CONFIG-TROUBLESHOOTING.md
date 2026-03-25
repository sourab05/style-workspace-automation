# Style Workspace Automation - Confluence

This is a split page version for stable Confluence rendering.

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

