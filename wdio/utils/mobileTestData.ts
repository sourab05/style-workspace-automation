import * as fs from 'fs';
import * as path from 'path';
import { loadAllTokens } from '../../src/tokens';
import { TokenVariantPair } from './batch-token-merger';
import { isLocalEnv } from './envFlags';

export interface MobileTestData {
  /** APK/IPA built from baseline tokens (no overrides applied). */
  baselineApps: { android: string; ios: string };
  /** APK/IPA built after applying all tokens (actual under test). */
  actualApps: { android: string; ios: string };
  tokenVariantPairs: TokenVariantPair[];
  allTokenFiles: any[];
}

/**
 * Resolves app paths from a cached JSON file. The file stores both `local` and
 * `browserstack` sub-objects so you can switch RUN_LOCAL without rebuilding.
 * Falls back to top-level `android`/`ios` for backward compatibility.
 */
function resolveAppsFromCache(filePath: string): { android: string; ios: string } | null {
  if (!fs.existsSync(filePath)) return null;

  const cached = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const modeKey = isLocalEnv() ? 'local' : 'browserstack';
  const modeApps = cached[modeKey];

  if (modeApps?.android || modeApps?.ios) {
    console.log(`📱 Resolved apps from cache (${modeKey}): android=${modeApps.android || '(none)'}, ios=${modeApps.ios || '(none)'}`);
    return { android: modeApps.android || '', ios: modeApps.ios || '' };
  }

  // Backward compatibility: fall back to top-level keys
  if (cached.android || cached.ios) {
    console.log(`📱 Resolved apps from cache (top-level fallback): android=${cached.android || '(none)'}, ios=${cached.ios || '(none)'}`);
    return { android: cached.android || '', ios: cached.ios || '' };
  }

  return null;
}

/**
 * Shared loader for mobile token validation data.
 *
 * - `baselineApps` comes from `mobile-baseline-apps.json` (PHASE 1 build)
 * - `actualApps`   comes from `mobile-actual-apps.json`   (PHASE 3 build)
 *
 * Both files are produced by `wdio/specs/mobile.global.setup.ts`.
 */
export function loadMobileTestData(): MobileTestData {
  const cacheDir = path.join(process.cwd(), '.test-cache');

  // Load baseline app URLs (Android / iOS)
  const baselineAppsFile = path.join(cacheDir, 'mobile-baseline-apps.json');
  let baselineApps = resolveAppsFromCache(baselineAppsFile);
  if (!baselineApps) {
    baselineApps = {
      android: process.env.ANDROID_BASELINE_APK_PATH || '',
      ios: process.env.IOS_BASELINE_IPA_PATH || ''
    };
    console.log('⚠️  Using fallback baseline APK from .env:', baselineApps.android);
  }

  // Load actual app URLs (Android / iOS)
  const actualAppsFile = path.join(cacheDir, 'mobile-actual-apps.json');
  let actualApps = resolveAppsFromCache(actualAppsFile);
  if (!actualApps) {
    actualApps = {
      android: process.env.ANDROID_ACTUAL_APK_PATH || '',
      ios: process.env.IOS_IPA_PATH || ''
    };
    console.log('⚠️  Using fallback ACTUAL APK from .env:', actualApps.android);
  }

  // Load token-variant pairs
  const pairsFile = path.join(cacheDir, 'batch-token-pairs.json');
  if (!fs.existsSync(pairsFile)) {
    throw new Error('Token-variant pairs not found. Run mobile global setup first.');
  }
  const pairsData = JSON.parse(fs.readFileSync(pairsFile, 'utf-8')) as {
    pairs: TokenVariantPair[];
  };
  const tokenVariantPairs = pairsData.pairs || [];

  // Load all token files for value extraction (web tokens)
  const allTokenFiles = loadAllTokens();

  // Load mobile token-values-mobile.json
  const mobileTokenFile = path.join(process.cwd(), 'tokens', 'token-values-mobile.json');
  if (fs.existsSync(mobileTokenFile)) {
    const mobileTokens = JSON.parse(fs.readFileSync(mobileTokenFile, 'utf-8'));
    allTokenFiles.push({ file: 'token-values-mobile.json', data: mobileTokens });
    console.log('📱 Loaded mobile token-values-mobile.json');
  } else {
    console.warn('⚠️ Mobile token-values-mobile.json not found');
  }

  return { baselineApps, actualApps, tokenVariantPairs, allTokenFiles };
}
