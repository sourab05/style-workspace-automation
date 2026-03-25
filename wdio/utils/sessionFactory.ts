import { remote } from 'webdriverio';

type Browser = WebdriverIO.Browser;

export type MobileSessionType = 'baseline' | 'actual';

export interface CreateSessionOptions {
  sessionName: string;
  type: MobileSessionType;
  runLocal: boolean;
  widgetKey: string;
  baselineApps: { android: string; ios: string };
  actualApps: { android: string; ios: string };
}

const resolveBrowserStackApp = (
  apps: { android: string; ios: string } & { meta?: any },
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

export async function createAndroidSession(options: CreateSessionOptions): Promise<Browser> {
  const { sessionName, type, runLocal, widgetKey, baselineApps, actualApps } = options;
  
  // For BrowserStack, ONLY use cached bs:// URLs, ignore env vars completely
  const appPath = runLocal
    ? (type === 'baseline'
        ? (process.env.ANDROID_BASELINE_APK_PATH || baselineApps.android)
        : (process.env.ANDROID_ACTUAL_APK_PATH || actualApps.android))
    : (type === 'baseline'
        ? resolveBrowserStackApp(baselineApps as any, 'android')
        : resolveBrowserStackApp(actualApps as any, 'android'));
  
  if (!runLocal && !appPath.startsWith('bs://')) {
    throw new Error(`BrowserStack requires a bs:// app URL. Got: ${appPath || '(empty)'}`);
  }

  const capabilities = runLocal
    ? {
      platformName: 'Android',
      'appium:deviceName': process.env.LOCAL_DEVICE_NAME || 'Android Emulator',
      'appium:platformVersion': process.env.LOCAL_PLATFORM_VERSION || '11',
      'appium:automationName': 'UiAutomator2',
      'appium:app': appPath,
      'appium:autoGrantPermissions': true,
      'appium:noReset': false,
      'appium:fullReset': true,
      'appium:newCommandTimeout': 6000,
    }
    : {
      platformName: 'Android',
      'appium:deviceName': process.env.BROWSERSTACK_ANDROID_DEVICE || 'Samsung Galaxy S23',
      'appium:platformVersion': process.env.BROWSERSTACK_ANDROID_OS || '13.0',
      'appium:automationName': 'UiAutomator2',
      'appium:app': appPath,
      'appium:autoGrantPermissions': true,
      'appium:noReset': false,
      'appium:fullReset': true,
      'appium:newCommandTimeout': 3600,
      'bstack:options': {
        projectName: 'Style Workspace Automation',
        buildName: `Mobile Token ${type === 'baseline' ? 'Baseline' : 'Validation'} - Android (${widgetKey})`,
        sessionName,
        debug: true,
        networkLogs: true,
        video: true,
        appiumVersion: '2.0.1',
        interactiveDebugging: true,
      },
    };

  const optionsToUse = runLocal
    ? {
      hostname: process.env.APPIUM_HOST || '127.0.0.1',
      port: Number(process.env.APPIUM_PORT || 4723),
      protocol: 'http',
      path: process.env.APPIUM_PATH || '/wd/hub',
      capabilities,
    }
    : {
      hostname: 'hub-cloud.browserstack.com',
      port: 443,
      protocol: 'https',
      user: process.env.BROWSERSTACK_USERNAME,
      key: process.env.BROWSERSTACK_ACCESS_KEY,
      capabilities,
    };

  return (await remote(optionsToUse as any)) as Browser;
}

export async function createIOSSession(options: CreateSessionOptions): Promise<Browser> {
  const { sessionName, type, runLocal, widgetKey, baselineApps, actualApps } = options;
  
  // For BrowserStack, ONLY use cached bs:// URLs, ignore env vars completely
  const appPath = runLocal
    ? (type === 'baseline'
        ? (process.env.IOS_BASELINE_IPA_PATH || baselineApps.ios)
        : (process.env.IOS_IPA_PATH || actualApps.ios))
    : (type === 'baseline'
        ? resolveBrowserStackApp(baselineApps as any, 'ios')
        : resolveBrowserStackApp(actualApps as any, 'ios'));
  
  if (!runLocal && !appPath.startsWith('bs://')) {
    throw new Error(`BrowserStack requires a bs:// app URL. Got: ${appPath || '(empty)'}`);
  }

  const capabilities = runLocal
    ? {
      platformName: 'iOS',
      'appium:deviceName': process.env.LOCAL_IOS_DEVICE_NAME || process.env.LOCAL_DEVICE_NAME || 'iPhone Simulator',
      'appium:platformVersion': process.env.LOCAL_IOS_PLATFORM_VERSION || process.env.LOCAL_PLATFORM_VERSION || '16',
      'appium:automationName': 'XCUITest',
      'appium:app': appPath,
      'appium:autoGrantPermissions': true,
      'appium:autoAcceptAlerts': true,
      'appium:noReset': false,
      'appium:fullReset': true,
      'appium:newCommandTimeout': 6000,
    }
    : {
      platformName: 'iOS',
      'appium:deviceName': process.env.BROWSERSTACK_IOS_DEVICE || 'iPhone 14',
      'appium:platformVersion': process.env.BROWSERSTACK_IOS_OS || '16',
      'appium:automationName': 'XCUITest',
      'appium:app': appPath,
      'appium:autoAcceptAlerts': true,
      'appium:noReset': false,
      'appium:fullReset': true,
      'appium:newCommandTimeout': 6000,
      'bstack:options': {
        projectName: 'Style Workspace Automation',
        buildName: `Mobile Token ${type === 'baseline' ? 'Baseline' : 'Validation'} - iOS (${widgetKey})`,
        sessionName,
        debug: true,
        networkLogs: true,
        video: true,
        appiumVersion: '2.0.1',
        interactiveDebugging: true,
      },
    };

  const optionsToUse = runLocal
    ? {
      hostname: process.env.APPIUM_HOST || '127.0.0.1',
      port: Number(process.env.APPIUM_PORT || 4723),
      protocol: 'http',
      path: process.env.APPIUM_PATH || '/wd/hub',
      capabilities,
    }
    : {
      hostname: 'hub-cloud.browserstack.com',
      port: 443,
      protocol: 'https',
      user: process.env.BROWSERSTACK_USERNAME,
      key: process.env.BROWSERSTACK_ACCESS_KEY,
      capabilities,
    };

  return (await remote(optionsToUse as any)) as Browser;
}
