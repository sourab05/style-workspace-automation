import { skipBaselineScreenshot } from './envFlags';

type MochaIt = typeof it;

function shouldRunPlatform(platform: 'android' | 'ios'): boolean {
  const mode = (process.env.MOBILE_PLATFORM || 'both').toLowerCase();
  if (platform === 'android') {
    return mode === 'android' || mode === 'both';
  }
  return mode === 'ios' || mode === 'both';
}

/**
 * Registers a baseline screenshot test only when the platform is active and
 * baseline visual verification is enabled. Otherwise the test is omitted
 * entirely (avoids Mocha `this.skip()` → "sync skip; aborting execution" on Jenkins).
 */
export function baselineScreenshotIt(platform: 'android' | 'ios'): MochaIt {
  if (!shouldRunPlatform(platform)) {
    return ((title: string) => {
      console.log(
        `⏭ Skipping ${platform} baseline screenshot (MOBILE_PLATFORM excludes ${platform}): ${title}`,
      );
    }) as MochaIt;
  }

  if (skipBaselineScreenshot()) {
    return ((title: string) => {
      console.log(
        `⏭ Skipping ${platform} baseline screenshot (SKIP_VISUAL_VERIFICATION or SKIP_BASELINE_SCREENSHOT): ${title}`,
      );
    }) as MochaIt;
  }

  return it;
}
