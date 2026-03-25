// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true, // Enable parallel execution after global setup
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 4 : 0,
  workers: process.env.CI ? 1 : (parseInt(process.env.PW_WORKERS || '4', 10)),
  reporter: [
    ['line'],
    ['json', { outputFile: 'logs/playwright-log.json' }],
    ['html']
  ],

  // Global setup runs once before all workers start
  //
   globalSetup: require.resolve('./tests/global-setup.ts'),

  use: {
    trace: 'on',
    screenshot: 'on',
    video: 'on',
    headless: true,
    // Consistent viewport size across all browsers
    viewport: { width: 1280, height: 720 },

    // Ensure consistent rendering
    deviceScaleFactor: 1,
    hasTouch: false,
    isMobile: false,

    // Use cached authentication state from global setup
    storageState: '.test-cache/auth.json',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Override viewport to ensure consistency
        viewport: { width: 1280, height: 720 },
      },
    },
    // {
    //   name: 'firefox',
    //   use: { 
    //     ...devices['Desktop Firefox'],
    //     viewport: { width: 1280, height: 720 },
    //   },
    // },
    // {
    //   name: 'webkit',
    //   use: { 
    //     ...devices['Desktop Safari'],
    //     viewport: { width: 1280, height: 720 },
    //   },
    // },
  ],

  // Increase timeout for slower tests
  timeout: 120000,
  expect: {
    // Increase timeout for screenshot comparisons
    timeout: 10000,

    // Screenshot comparison options
    toHaveScreenshot: {
      // Allow small differences to handle anti-aliasing
      maxDiffPixels: 100,
      maxDiffPixelRatio: 0.01,
      threshold: 0.2,
      animations: 'disabled',
    },
  },

  // Custom path for snapshots - using base-image as the baseline location
  snapshotPathTemplate: 'screenshots/base-image/{arg}{ext}',
  outputDir: 'artifacts/test-results',
});

