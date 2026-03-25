import { config as sharedConfig } from './wdio.shared.conf';
import type { Options } from '@wdio/types';
import path from 'path';
import fs from 'fs';

/**
 * Local WDIO config for running mobile specs in PARALLEL on local emulators.
 *
 * REQUIREMENTS:
 * 1. Multiple Android emulators/iOS simulators running
 * 2. Multiple Appium servers (one per emulator) on different ports
 * 3. Each emulator must have a unique device ID
 *
 * SETUP EXAMPLE (Android):
 *   # Terminal 1: Start Appium server 1
 *   appium -p 4723
 *
 *   # Terminal 2: Start Appium server 2
 *   appium -p 4724
 *
 *   # Terminal 3: Start emulator 1
 *   emulator -avd Pixel_8_API_34 -port 5554
 *
 *   # Terminal 4: Start emulator 2
 *   emulator -avd Pixel_7_API_33 -port 5556
 *
 * Usage:
 *   RUN_LOCAL=true PARALLEL_EMULATORS=2 \
 *   npx wdio run wdio/config/wdio.local.parallel.conf.ts
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

const platform = (process.env.MOBILE_PLATFORM || process.env.PLATFORM || 'android').toLowerCase();
const parallelCount = parseInt(process.env.PARALLEL_EMULATORS || '5', 10);

// Local app path
const apppath =
  platform === 'android'
    ? process.env.ANDROID_APK_PATH || actualApps.android
    : process.env.IOS_IPA_PATH || actualApps.ios;

// Generate capabilities for parallel emulators
const generateCapabilities = () => {
  if (parallelCount === 1) {
    // Single emulator (default)
    return [
      {
        platformName: platform,
        'appium:deviceName': process.env.LOCAL_DEVICE_NAME,
        'appium:platformVersion': process.env.LOCAL_PLATFORM_VERSION,
        'appium:automationName': platform === 'android' ? 'UiAutomator2' : 'XCUITest',
        'appium:autoGrantPermissions': true,
        'appium:locationServicesEnabled': true,
        'appium:locationServicesAuthorized': true,
        'appium:adbExecTimeout': 120000,
        'appium:androidInstallTimeout': 120000,
        port: 4723,
        'appium:newCommandTimeout': 120000
      }
    ];
  }

  // Multiple emulators
  const capabilities = [];
  for (let i = 0; i < parallelCount; i++) {
    const appiumPort = 4723 + i;
    
    if (platform === 'android') {
      // Android emulators
      const emulatorPort = 5554 + (i * 2); // Android emulators use even ports
      capabilities.push({
        platformName: 'Android',
        'appium:deviceName': process.env[`LOCAL_DEVICE_NAME_${i + 1}`] || `emulator-${emulatorPort}`,
        'appium:platformVersion': process.env.LOCAL_PLATFORM_VERSION || '13.0',
        'appium:automationName': 'UiAutomator2',
        'appium:autoGrantPermissions': true,
        'appium:adbExecTimeout': 120000,
        'appium:androidInstallTimeout': 120000,
        'appium:systemPort': 8200 + i, // Unique system port for each instance
        port: appiumPort,
        'appium:newCommandTimeout': 120000
      });
    } else {
      // iOS simulators
      capabilities.push({
        platformName: 'iOS',
        'appium:deviceName': process.env[`LOCAL_DEVICE_NAME_${i + 1}`] || 'iPhone 14',
        'appium:platformVersion': process.env.LOCAL_PLATFORM_VERSION || '16.0',
        'appium:automationName': 'XCUITest',
        'appium:autoGrantPermissions': true,
        'appium:autoAcceptAlerts': true,
        port: appiumPort,
        'appium:newCommandTimeout': 120000,
        'appium:wdaLocalPort': 8100 + i, // Unique WDA port for each instance
      });
    }
  }
  
  return capabilities;
};

// Create combined logs directory
const combinedLogsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(combinedLogsDir)) {
  fs.mkdirSync(combinedLogsDir, { recursive: true });
}

export const config: Options.Testrunner = {
  ...(sharedConfig as Options.Testrunner),

  logLevel: 'debug',

  // No services needed for local - specs handle session creation
  services: [],

  // Dynamic capabilities based on parallel count
  capabilities: generateCapabilities(),

  // Enable parallel execution
  maxInstances: parallelCount,

  // Override spec file loading if needed
  specs: [
    './wdio/specs/mobile.*.token.validate.spec.ts'
  ],

  onPrepare: async function (config, capabilities) {
    const prepareMsg = `🚀 [${new Date().toISOString()}] Starting local parallel test run\n` +
                      `📱 Platform: ${platform}\n` +
                      `🔢 Parallel Emulators: ${parallelCount}\n` +
                      `📦 App: ${apppath || 'Not configured'}\n\n`;
    console.log(prepareMsg);

    // Validate emulator setup
    if (parallelCount > 1) {
      console.log('⚠️  PARALLEL MODE REQUIREMENTS:');
      console.log(`   1. ${parallelCount} Appium servers running (ports 4723-${4723 + parallelCount - 1})`);
      console.log(`   2. ${parallelCount} emulators/simulators running`);
      console.log(`   3. Each emulator should be launched before tests\n`);
    }

    const combinedLogFile = path.join(combinedLogsDir, 'wdio-local-parallel.log');
    fs.appendFileSync(combinedLogFile, prepareMsg);
  },

  onComplete: async function (exitCode: any, config: any, capabilities: any, results: any) {
    const completedMsg = `\n✅ Parallel test run completed with exit code: ${exitCode}\n`;
    console.log(completedMsg);

    const combinedLogFile = path.join(combinedLogsDir, 'wdio-local-parallel.log');
    fs.appendFileSync(combinedLogFile, completedMsg);
  }
};
