#!/usr/bin/env npx ts-node
/**
 * Prepare mobile apps for Jenkins manual upload mode.
 * Uploads APK/IPA to BrowserStack and writes .test-cache/*-apps.json for WDIO.
 *
 * When SKIP_VISUAL_VERIFICATION=true, baseline uploads are ignored (actual only).
 */

import fs from 'fs';
import path from 'path';
import '../src/utils/bootstrap-env';
import { BrowserStackService, BrowserStackAppUploadResponse } from '../wdio/services/browserstack.service';

type Platform = 'android' | 'ios';

interface CacheEntry {
  android: string;
  ios: string;
  local: { android: string; ios: string };
  browserstack: { android: string; ios: string };
  meta: { android?: BrowserStackAppUploadResponse; ios?: BrowserStackAppUploadResponse };
  timestamp: string;
  source: 'jenkins-upload';
}

function isTruthy(name: string): boolean {
  return process.env[name] === 'true' || process.env[name] === '1';
}

function envPath(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v || undefined;
}

async function resolveBsApp(
  platform: Platform,
  localPath: string | undefined,
  label: string,
  bsService: BrowserStackService,
): Promise<{ bsUrl: string; local: string; meta?: BrowserStackAppUploadResponse } | null> {
  if (!localPath) return null;
  if (!fs.existsSync(localPath)) {
    throw new Error(`${label}: file not found at ${localPath}`);
  }

  if (isTruthy('JENKINS_DRY_RUN')) {
    const fakeUrl = `bs://dry-run-${platform}-${path.basename(localPath)}`;
    console.log(`🧪 ${label}: DRY_RUN — skipping BrowserStack upload (${localPath})`);
    return { bsUrl: fakeUrl, local: localPath };
  }

  console.log(`☁️  ${label}: uploading ${localPath} to BrowserStack...`);
  const upload = await bsService.uploadAppWithMeta(platform, localPath);
  console.log(`✅ ${label}: ${upload.app_url}`);
  return { bsUrl: upload.app_url, local: localPath, meta: upload };
}

async function main() {
  const skipVisual = isTruthy('SKIP_VISUAL_VERIFICATION');
  const requireBaseline = isTruthy('JENKINS_REQUIRE_BASELINE_UPLOAD') || !skipVisual;

  const cacheDir = path.join(process.cwd(), '.test-cache');
  fs.mkdirSync(cacheDir, { recursive: true });

  const bsService = new BrowserStackService();

  const androidActual = await resolveBsApp(
    'android',
    envPath('JENKINS_UPLOAD_ANDROID_ACTUAL'),
    'Android actual',
    bsService,
  );
  const iosActual = await resolveBsApp(
    'ios',
    envPath('JENKINS_UPLOAD_IOS_ACTUAL'),
    'iOS actual',
    bsService,
  );

  let androidBaseline = null as Awaited<ReturnType<typeof resolveBsApp>>;
  let iosBaseline = null as Awaited<ReturnType<typeof resolveBsApp>>;

  if (requireBaseline) {
    androidBaseline = await resolveBsApp(
      'android',
      envPath('JENKINS_UPLOAD_ANDROID_BASELINE'),
      'Android baseline',
      bsService,
    );
    iosBaseline = await resolveBsApp(
      'ios',
      envPath('JENKINS_UPLOAD_IOS_BASELINE'),
      'iOS baseline',
      bsService,
    );
  } else {
    console.log('⏭ SKIP_VISUAL_VERIFICATION=true — baseline APK/IPA upload skipped');
  }

  if (!androidActual && !iosActual) {
    throw new Error('At least one actual app (Android APK or iOS IPA) must be uploaded.');
  }

  if (requireBaseline) {
    if (androidActual && !androidBaseline) {
      throw new Error('Visual verification enabled: upload UPLOAD_ANDROID_BASELINE_APK.');
    }
    if (iosActual && !iosBaseline) {
      throw new Error('Visual verification enabled: upload UPLOAD_IOS_BASELINE_IPA.');
    }
  }

  let baselineAndroid = androidBaseline;
  let baselineIos = iosBaseline;
  if (skipVisual) {
    if (!baselineAndroid && androidActual) {
      console.warn('⚠️  Android baseline reused from actual (SKIP_VISUAL_VERIFICATION=true)');
      baselineAndroid = androidActual;
    }
    if (!baselineIos && iosActual) {
      console.warn('⚠️  iOS baseline reused from actual (SKIP_VISUAL_VERIFICATION=true)');
      baselineIos = iosActual;
    }
  }

  const writeCache = (
    fileName: string,
    android: typeof androidActual,
    ios: typeof iosActual,
  ) => {
    const entry: CacheEntry = {
      android: android?.bsUrl || '',
      ios: ios?.bsUrl || '',
      local: { android: android?.local || '', ios: ios?.local || '' },
      browserstack: { android: android?.bsUrl || '', ios: ios?.bsUrl || '' },
      meta: {
        ...(android?.meta ? { android: android.meta } : {}),
        ...(ios?.meta ? { ios: ios.meta } : {}),
      },
      timestamp: new Date().toISOString(),
      source: 'jenkins-upload',
    };
    const out = path.join(cacheDir, fileName);
    fs.writeFileSync(out, JSON.stringify(entry, null, 2));
    console.log(`📝 Wrote ${out}`);
  };

  writeCache('mobile-baseline-apps.json', baselineAndroid, baselineIos);
  writeCache('mobile-actual-apps.json', androidActual, iosActual);

  console.log('\n✅ Manual mobile apps uploaded to BrowserStack from mobile-builds/ — CLI build skipped.');
}

main().catch(err => {
  console.error('❌', err?.message || err);
  process.exit(1);
});
