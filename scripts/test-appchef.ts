/**
 * Smoke test for AppChefClient.
 * Usage:
 *   npx ts-node scripts/test-appchef.ts
 *
 * Tests (no full build triggered unless APPCHEF_TEST_ZIP is set):
 *   1. Login (3-step WMO → accountId → SESSION)
 *   2. iOS certificate fetch + unlock (id=1255)
 *   3. buildTasks for known app — confirms field names
 *   4. analyzeZip + uploadFile + saveApp (id:null) if APPCHEF_TEST_ZIP is set
 */
import * as dotenv from 'dotenv';
dotenv.config();
import * as fs from 'fs';
import { AppChefClient } from '../src/api/appChefClient';

const WMO_USER     = process.env.WMO_USERNAME     || 'jeevan.inaparti@wavemaker.com';
const WMO_PASS     = process.env.WMO_PASSWORD     || process.env.WM_WMO_STUDIO_PASSWORD || 'Wavemaker@123';
const KNOWN_APP_ID = 'App-89wCIVvZ';
const TEST_ZIP     = process.env.APPCHEF_TEST_ZIP; // optional: path to a real RN ZIP

async function main() {
  const client = new AppChefClient();

  // ── Step 1: Login ────────────────────────────────────────────────────────────
  console.log('\n[Test] Step 1: Login');
  await client.login(WMO_USER, WMO_PASS);
  console.log('[Test] ✅ Login OK');

  // ── Step 2: iOS certificate ──────────────────────────────────────────────────
  console.log('\n[Test] Step 2: iOS certificate (id=1255)');
  const cert = await (client as any).getIosCertificate(1255);
  console.log(`  name     : ${cert.name}`);
  console.log(`  locked   : ${cert.locked}`);
  console.log(`  cert file: ${cert.fileByCertificate?.name}`);
  console.log(`  profile  : ${cert.fileByProvisioningProfile?.name}`);
  await (client as any).unlockIosCertificate(1255, 'wavemaker123');
  console.log('[Test] ✅ iOS certificate OK');

  // ── Step 3: buildTasks — confirm field names ──────────────────────────────────
  console.log('\n[Test] Step 3: buildTasks for ' + KNOWN_APP_ID);
  const resp = await (client as any).http.get('/buildTasks', {
    params: { appId: KNOWN_APP_ID, platform: 'all', page: 1, size: 3 },
    headers: (client as any).authHeaders(),
  });
  const tasks: any[] = Array.isArray(resp.data) ? resp.data : (resp.data?.content ?? []);
  if (tasks.length === 0) {
    console.log('[Test] ℹ️  No build tasks found');
  } else {
    for (const t of tasks.slice(0, 2)) {
      console.log(`\n  externalId       : ${t.externalId}`);
      console.log(`  platform         : ${t.platform}`);
      console.log(`  buildTaskStatus  : ${JSON.stringify(t.buildTaskStatus)}`);
      console.log(`  androidOutput.url: ${t.fileByAndroidOutput?.url ?? 'null'}`);
      console.log(`  iosOutput.url    : ${t.fileByIosOutput?.url ?? 'null'}`);
    }
  }
  console.log('[Test] ✅ buildTasks OK');

  // ── Step 4: analyzeZip + uploadFile + saveApp (id:null) ──────────────────────
  if (TEST_ZIP && fs.existsSync(TEST_ZIP)) {
    console.log(`\n[Test] Step 4: analyzeZip + uploadFile + saveApp (ZIP: ${TEST_ZIP})`);

    const analyzed = await (client as any).analyzeZip(TEST_ZIP);
    console.log(`  bundleId   : ${analyzed.bundleId}`);
    console.log(`  displayName: ${analyzed.displayName}`);
    console.log(`  iconFileId : ${analyzed.iconFileId}`);

    const cordovaZipFileId = await (client as any).uploadFile(TEST_ZIP);
    console.log(`  cordovaZipFileId: ${cordovaZipFileId}`);

    const iosCert = await client.resolveIosCertificate({ certId: 1255, unlockPassword: 'wavemaker123' });
    console.log(`  resolved : id=${iosCert?.id} name="${iosCert?.name}"`);

    // Always create fresh (id:null, appId:null) — include iOS cert like the AppChef UI
    const appId = await client.saveApp({
      cordovaZipFileId,
      iconFileId: analyzed.iconFileId,
      iconFile: analyzed.iconFile,
      bundleId: analyzed.bundleId,
      displayName: analyzed.displayName,
      version: '0.0.1',
      existingId: null,
      existingAppId: null,
      platform: 'both',
      androidCertId: undefined,
      iosCertId: iosCert?.id,
      iosCertName: iosCert?.name,
    });
    console.log(`  appId returned: ${appId}`);
    console.log('[Test] ✅ saveApp (new record) OK');
  } else {
    console.log('\n[Test] Step 4: SKIPPED (set APPCHEF_TEST_ZIP=/path/to/zip to test saveApp)');
  }

  console.log('\n[Test] ✅ All checks passed');
}

main().catch((e) => {
  console.error('\n[Test] ❌ FAILED:', JSON.stringify(e?.response?.data ?? e?.message ?? e, null, 2));
  console.error('  status:', e?.response?.status);
  console.error('  headers:', JSON.stringify(e?.response?.headers, null, 2));
  process.exit(1);
});
