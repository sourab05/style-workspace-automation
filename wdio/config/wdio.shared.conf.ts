import type { Options } from '@wdio/types';
import path from 'path';
import fs from 'fs';
// Fix TS: declare global WDIO browser object
declare const browser: WebdriverIO.Browser;

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Generate unique log file for each worker using worker ID and timestamp
const getWorkerLogFile = (workerId: string): string => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFile = path.join(logsDir, `wdio-worker-${workerId || 'default'}-${timestamp}.log`);
  return logFile;
};

// Store worker-specific log file path
let workerLogFile: string;

export const config: Partial<Options.Testrunner> = {
  // Test files
  specs: [path.join(process.cwd(), 'wdio/specs/**/*.spec.ts')],

  // Patterns to exclude
  exclude: [],

  // Maximum instances to run in parallel
  maxInstances: 1,

  // Test framework
  framework: 'mocha',

  // Mocha options
  mochaOpts: {
    ui: 'bdd',
    timeout: 600000, // 10 minutes per test
  },

  // Reporters - spec reporter for console output + Allure for rich HTML reports
  reporters: [
    'spec',
    [
      'allure',
      {
        outputDir: 'allure-results',
        disableWebdriverStepsReporting: false,
        disableWebdriverScreenshotsReporting: true, // Disable auto screenshots since session may terminate
      },
    ],
  ],

  // Test compilation
  autoCompileOpts: {
    autoCompile: true,
    tsNodeOpts: {
      project: './tsconfig.json',
      transpileOnly: true,
    },
  },

  // Connection options
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,

  // Logging
  logLevel: 'info',

  // Write full WDIO logs (webdriver commands, hooks, etc.) to per-worker log files.
  // WDIO will create files like logs/wdio-0-0.log where `0-0` is the worker id (cid).
  outputDir: logsDir,

  // Base URL for the application
  baseUrl: process.env.MOBILE_APP_URL || 'http://localhost',

  // Wait timeout
  waitforTimeout: 30000,

  // On worker start - initialize custom human-readable log file
  onWorkerStart: async function (cid: string, caps: any, specs: any[], args: any) {
    workerLogFile = getWorkerLogFile(cid);
    const header = `🚀 Worker ${cid} started at ${new Date().toISOString()}\n`;
    fs.writeFileSync(workerLogFile, header);
    console.log(`📝 Logging to: ${workerLogFile}`);
  },

  // Before test hooks
  beforeTest: async function (test: any, context: any) {
    const msg = `\n🧪 [${new Date().toISOString()}] Starting test: ${test.title}\n`;
    console.log(msg);
    if (workerLogFile) {
      fs.appendFileSync(workerLogFile, msg);
    }
  },

  // After test hooks
  afterTest: async function (
    test: any,
    context: any,
    { error, result, duration, passed, retries }: any,
  ) {
    let msg = '';
    if (passed) {
      msg = `✅ [${new Date().toISOString()}] Test passed: ${test.title} (${duration}ms)\n`;
      console.log(msg);
    } else {
      msg = `❌ [${new Date().toISOString()}] Test failed: ${test.title}\n`;
      if (error) {
        msg += `   Error: ${error.message}\n`;
        console.error(msg);
      }
    }
    if (workerLogFile) {
      fs.appendFileSync(workerLogFile, msg);
    }

    // Attach Base + Actual + Diff images for comparison
    // Wrapped in try-catch to handle session termination gracefully
    try {
      const allure = require('@wdio/allure-reporter').default;
      const baseDir = path.join(process.cwd(), 'screenshots', 'mobile-base', 'android');
      const actualDir = path.join(process.cwd(), 'screenshots', 'mobile-actual', 'android');
      const diffDir = path.join(process.cwd(), 'screenshots', 'mobile-diff', 'android');

      const snapshotName = test.title.includes('→')
        ? test.title.split('→').pop().trim()
        : test.title.replace(/[^a-zA-Z0-9-_]/g, '-');

      const baseFile = path.join(baseDir, `${snapshotName}.png`);
      const actualFile = path.join(actualDir, `${snapshotName}.png`);
      const diffFile = path.join(diffDir, `${snapshotName}.png`);

      try {
        if (fs.existsSync(baseFile)) {
          allure.addAttachment('Base Image', fs.readFileSync(baseFile), 'image/png');
        }
      } catch (attachErr) {
        console.warn(`⚠️ Failed to attach Base Image: ${(attachErr as Error).message}`);
      }

      try {
        if (fs.existsSync(actualFile)) {
          allure.addAttachment('Actual Image', fs.readFileSync(actualFile), 'image/png');
        }
      } catch (attachErr) {
        console.warn(`⚠️ Failed to attach Actual Image: ${(attachErr as Error).message}`);
      }

      try {
        if (fs.existsSync(diffFile)) {
          allure.addAttachment('Diff Image', fs.readFileSync(diffFile), 'image/png');
        }
      } catch (attachErr) {
        console.warn(`⚠️ Failed to attach Diff Image: ${(attachErr as Error).message}`);
      }
    } catch (err) {
      console.warn(`⚠️ Allure reporter unavailable or session terminated: ${(err as Error).message}`);
    }
  },

  // afterStep removed because Mocha runner does not support it

  // On worker end - finalize log
  onWorkerEnd: async function (cid: string, exitCode: number, specs: any[], args: any) {
    const msg = `\n🏁 Worker ${cid} ended with exit code ${exitCode} at ${new Date().toISOString()}\n`;
    console.log(msg);
    if (workerLogFile) {
      fs.appendFileSync(workerLogFile, msg);
    }
  },
};
