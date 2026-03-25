import { config as sharedConfig } from './wdio.shared.conf';
import type { Options } from '@wdio/types';
import path from 'path';
import fs from 'fs';

/**
 * Local WDIO config for running the mobile specs in this repo.
 *
 * IMPORTANT:
 * - The *specs themselves* (e.g. mobile.button.token.validate.spec.ts) create
 *   the real mobile sessions via `remote()` and `RUN_LOCAL=true`, pointing at
 *   your local Appium server and APK.
 * - This config primarily needs to start a WDIO worker and load the specs, but
 *   we still model the capabilities as real mobile Appium caps (not Chrome)
 *   so local runs are aligned with how mobile is executed elsewhere.
 *
 * Usage (from project root):
 *   RUN_LOCAL=true PLATFORM=android \
 *   npx wdio run wdio/config/wdio.local.conf.ts \
 *     --spec wdio/specs/mobile.button.token.validate.spec.ts
 */

// Load mobile app URLs from cache (prefer local sub-key, fall back to top-level)
const cacheDir = path.join(process.cwd(), '.test-cache');
let actualApps: { android: string; ios: string } = { android: '', ios: '' };

const actualAppsFile = path.join(cacheDir, 'mobile-actual-apps.json');
if (fs.existsSync(actualAppsFile)) {
  const cached = JSON.parse(fs.readFileSync(actualAppsFile, 'utf-8'));
  const local = cached.local || {};
  actualApps = { android: local.android || cached.android || '', ios: local.ios || cached.ios || '' };
}

// Derive the mobile platform and local app paths from environment variables
const platform = (process.env.MOBILE_PLATFORM || process.env.PLATFORM || 'android').toLowerCase();
const expopath = process.env.EXPO_APP_PATH || '';
// Local app path should point to the built mobile artifact (APK/IPA)
const apppath =
  platform === 'android'
    ? process.env.ANDROID_APK_PATH || actualApps.android
    : process.env.IOS_IPA_PATH || actualApps.ios;

// Create combined logs directory
const combinedLogsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(combinedLogsDir)) {
  fs.mkdirSync(combinedLogsDir, { recursive: true });
}

export const config: Options.Testrunner = {
  // Spread the shared WDIO settings (specs, reporters, mochaOpts, autoCompileOpts, etc.)
  ...(sharedConfig as Options.Testrunner),

  // Enable verbose logging to file
  logLevel: 'debug',

  // No BrowserStack or Appium service at the WDIO level; the spec's `remote()`
  // call handles connecting to local Appium when RUN_LOCAL=true.
  services: [],

  // Local capabilities (real mobile Appium caps, not Chrome)
  capabilities: [
    {
      platformName: platform,
      'appium:deviceName': process.env.LOCAL_DEVICE_NAME,
      'appium:platformVersion': process.env.LOCAL_PLATFORM_VERSION,
      'appium:automationName': platform === 'android' ? 'UiAutomator2' : 'XCUITest',
      // 'appium:app': process.env.EXPO_GO && process.env.EXPO_GO === 'true' ? expopath : apppath,
      'appium:autoGrantPermissions': true,
      'appium:locationServicesEnabled': true,
      'appium:locationServicesAuthorized': true,
      'appium:adbExecTimeout': 120000,
      'appium:androidInstallTimeout': 120000,
      port: 4723,
      'appium:newCommandTimeout': 120000
    },
  ],

  // Output hook to capture all console output to log files
  onComplete: async function (exitCode: any, config: any, capabilities: any, results: any) {
    const completedMsg = `\n✅ Test run completed with exit code: ${exitCode}\n`;
    console.log(completedMsg);

    // Log to combined file
    const combinedLogFile = path.join(combinedLogsDir, `wdio-combined-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);
    fs.appendFileSync(combinedLogFile, completedMsg);
  }
};
