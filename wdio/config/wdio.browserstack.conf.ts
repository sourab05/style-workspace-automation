import { config as sharedConfig } from './wdio.shared.conf';
import type { Options } from '@wdio/types';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { BrowserStackService } from '../services/browserstack.service';

// Load environment variables
dotenv.config();

// Load mobile app URLs from cache (prefer browserstack sub-key, fall back to top-level)
const cacheDir = path.join(process.cwd(), '.test-cache');
let modifiedApps: { android: string; ios: string; meta?: any } = { android: '', ios: '' };
let baselineApps: { android: string; ios: string; meta?: any } = { android: '', ios: '' };

function loadAppsForBrowserStack(filePath: string): { android: string; ios: string; meta?: any } {
  if (!fs.existsSync(filePath)) return { android: '', ios: '' };
  const cached = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const bs = cached.browserstack || {};
  return {
    android: bs.android || cached.android || '',
    ios: bs.ios || cached.ios || '',
    meta: cached.meta,
  };
}

modifiedApps = loadAppsForBrowserStack(path.join(cacheDir, 'mobile-actual-apps.json'));
baselineApps = loadAppsForBrowserStack(path.join(cacheDir, 'mobile-baseline-apps.json'));

const resolveCachedApp = (
  apps: { android: string; ios: string; meta?: any },
  platform: 'android' | 'ios'
): string => {
  const meta = apps?.meta?.[platform];
  if (meta?.app_url) {
    return meta.app_url;
  }
  if (meta?.shareable_id) {
    return `bs://${meta.shareable_id}`;
  }
  if (meta?.custom_id) {
    return meta.custom_id;
  }
  return apps[platform];
};

const resolveAppUrl = (platform: 'android' | 'ios'): string => {
  const cachedUrl = resolveCachedApp(modifiedApps, platform);
  if (cachedUrl) return cachedUrl;
  if (platform === 'android') {
    return process.env.BROWSERSTACK_ANDROID_APP_URL || '';
  }
  return process.env.BROWSERSTACK_IOS_APP_URL || '';
};

const normalizeAppId = (appUrl: string): string => {
  return appUrl.startsWith('bs://') ? appUrl.slice('bs://'.length) : appUrl;
};

const validateBrowserStackApp = async (label: string, appUrl: string): Promise<void> => {
  if (!appUrl) {
    console.warn(`⚠️  Warning: ${label} app URL is empty`);
    return;
  }
  if (appUrl.startsWith('/') || appUrl.startsWith('./')) {
    throw new Error(`Invalid BrowserStack app reference for ${label}: ${appUrl} (local paths are not supported).`);
  }
  if (!appUrl.startsWith('bs://')) {
    console.warn(`⚠️  Warning: ${label} app URL does not start with bs://: ${appUrl}`);
  }
  // Skip API validation - just check format
  console.log(`✓ ${label}: ${appUrl}`);
};

// Get platform filter from environment variable
const platformFilter = process.env.PLATFORM?.toLowerCase();

// All available capabilities
const androidAppUrl = resolveAppUrl('android');
const iosAppUrl = resolveAppUrl('ios');

const allCapabilities = [
  // Android configuration
  {
    platformName: 'Android',
    'appium:deviceName': process.env.BROWSERSTACK_ANDROID_DEVICE || 'Samsung Galaxy S23',
    'appium:platformVersion': process.env.BROWSERSTACK_ANDROID_OS || '13.0',
    'appium:automationName': 'UiAutomator2',
    'appium:app': androidAppUrl,
    'appium:autoGrantPermissions': true,
    'appium:noReset': false,
    'bstack:options': {
      projectName: 'Style Workspace Automation',
      buildName: 'Mobile Token Validation - Android',
      sessionName: 'Android Token Tests',
      debug: true,
      networkLogs: true,
      video: true,
      appiumVersion: '2.0.1',
      interactiveDebugging: true
    }
  },
  // iOS configuration
  {
    platformName: 'iOS',
    'appium:deviceName': process.env.BROWSERSTACK_IOS_DEVICE || 'iPhone 14',
    'appium:platformVersion': process.env.BROWSERSTACK_IOS_OS || '16',
    'appium:automationName': 'XCUITest',
    'appium:app': iosAppUrl,
    'appium:autoGrantPermissions': true,
    'appium:autoAcceptAlerts': true,
    'appium:noReset': false,
    'bstack:options': {
      projectName: 'Style Workspace Automation',
      buildName: 'Mobile Token Validation - iOS',
      sessionName: 'iOS Token Tests',
      debug: true,
      networkLogs: true,
      video: true,
      appiumVersion: '2.0.1',
      interactiveDebugging: true
    }
  }
];

// Filter capabilities based on platform environment variable
const platformFilteredCapabilities = platformFilter
  ? allCapabilities.filter(cap => cap.platformName.toLowerCase() === platformFilter)
  : allCapabilities;

if (platformFilter && platformFilteredCapabilities.length === 0) {
  console.warn(`⚠️  Warning: Platform filter "${platformFilter}" did not match any capabilities`);
}

const filteredCapabilities = platformFilteredCapabilities.filter((cap) => {
  const appUrl = cap['appium:app'] as string;
  if (appUrl) return true;
  const platform = cap.platformName.toLowerCase();
  const message = `No app URL found for ${platform}. Set ${platform === 'android' ? 'BROWSERSTACK_ANDROID_APP_URL' : 'BROWSERSTACK_IOS_APP_URL'} or run mobile global setup.`;
  if (platformFilter) {
    throw new Error(message);
  }
  console.warn(`⚠️  ${message} Capability removed.`);
  return false;
});

export const config: Options.Testrunner = {
  ...sharedConfig,

  // BrowserStack specific settings
  user: process.env.BROWSERSTACK_USERNAME,
  key: process.env.BROWSERSTACK_ACCESS_KEY,

  // Enable verbose logging for BrowserStack
  logLevel: 'debug',

  // BrowserStack service
  services: [
    ['browserstack', {
      browserstackLocal: false,
      buildIdentifier: `Mobile-Token-Validation-${Date.now()}`,
      testObservability: true,
      testObservabilityOptions: {
        projectName: 'Style Workspace Automation',
        buildName: `Mobile Build ${new Date().toISOString()}`
      }
    }]
  ],

  // Capabilities - filtered based on PLATFORM environment variable
  capabilities: filteredCapabilities,

  // Override max instances for BrowserStack (respect RUN_LOCAL to prevent crashes)
  maxInstances: process.env.RUN_LOCAL === 'true'
    ? 1
    : parseInt(process.env.BROWSERSTACK_MAX_INSTANCES || '5', 10),

  // BrowserStack specific hooks
  onPrepare: async function (config, capabilities) {
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    const prepareMsg = `🌐 [${new Date().toISOString()}] Connecting to BrowserStack...\n`;
    console.log(prepareMsg);
    console.log(`📱 Android App: ${modifiedApps.android || 'Not loaded'}`);
    console.log(`🍎 iOS App: ${modifiedApps.ios || 'Not loaded'}`);

    // Log to combined file
    const combinedLogFile = path.join(logsDir, 'wdio-browserstack-combined.log');
    fs.appendFileSync(combinedLogFile, prepareMsg);

    const platform = platformFilter === 'ios' ? 'ios' : platformFilter === 'android' ? 'android' : 'both';
    if (platform === 'android' || platform === 'both') {
      const actualAndroid = resolveAppUrl('android');
      const baselineAndroid = resolveCachedApp(baselineApps, 'android');
      await validateBrowserStackApp('Android actual', actualAndroid);
      await validateBrowserStackApp('Android baseline', baselineAndroid);
    }
    if (platform === 'ios' || platform === 'both') {
      const actualIOS = resolveAppUrl('ios');
      const baselineIOS = resolveCachedApp(baselineApps, 'ios');
      await validateBrowserStackApp('iOS actual', actualIOS);
      await validateBrowserStackApp('iOS baseline', baselineIOS);
    }
  },

  onComplete: function (exitCode, config, capabilities, results) {
    const logsDir = path.join(process.cwd(), 'logs');
    const completedMsg = `🏁 [${new Date().toISOString()}] BrowserStack tests completed with exit code: ${exitCode}\n`;
    console.log(completedMsg);

    // Log to combined file
    const combinedLogFile = path.join(logsDir, 'wdio-browserstack-combined.log');
    fs.appendFileSync(combinedLogFile, completedMsg);
  }
};
