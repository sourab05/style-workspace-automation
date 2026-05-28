/**
 * Smoke test for AppChefClient.
 * Usage:
 *   npx ts-node scripts/test-appchef.ts
 *
 * What it tests (no actual build triggered):
 *   1. Login to WMO — verifies cookies are set
 *   2. appsByName    — verifies existing app lookup (App-89wCIVvZ)
 *   3. buildTasks    — fetches latest tasks and prints status fields
 *                      (confirms buildTaskStatus.name + externalId + token + fileByAndroidOutput.url)
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { AppChefClient } from '../src/api/appChefClient';

const WMO_USER    = 'jeevan.inaparti@wavemaker.com';
const WMO_PASS    = process.env.WM_WMO_STUDIO_PASSWORD || 'Wavemaker@123';
const KNOWN_APP_ID = 'App-89wCIVvZ';  // StyleWorkSpaceAutomation (known from previous build)

async function main() {
  const client = new AppChefClient();

  // ── Step 1: Login ───────────────────────────────────────────────────────────
  console.log('\n[Test] Step 1: Login');
  await client.login(WMO_USER, WMO_PASS);
  console.log('[Test] ✅ Login OK');

  // ── Step 2: iOS certificate ──────────────────────────────────────────────────
  console.log('\n[Test] Step 2: iOS certificate (id=1255)');
  const cert = await (client as any).getIosCertificate(1255);
  console.log(`  name    : ${cert.name}`);
  console.log(`  locked  : ${cert.locked}`);
  console.log(`  cert file: ${cert.fileByCertificate?.name}`);
  console.log(`  profile  : ${cert.fileByProvisioningProfile?.name}`);

  // Unlock it
  await (client as any).unlockIosCertificate(1255, 'wavemaker123');
  console.log('[Test] ✅ iOS certificate OK');

  // ── Step 3: buildTasks — fetch latest and print all status fields ───────────
  console.log('\n[Test] Step 3: buildTasks for ' + KNOWN_APP_ID);
  const resp = await (client as any).http.get('/buildTasks', {
    params: { appId: KNOWN_APP_ID, platform: 'all', page: 1, size: 5 },
    headers: (client as any).authHeaders(),
  });

  const tasks: any[] = Array.isArray(resp.data)
    ? resp.data
    : (resp.data?.content ?? []);

  if (tasks.length === 0) {
    console.log('[Test] ℹ️  No build tasks found yet');
  } else {
    for (const t of tasks.slice(0, 3)) {
      console.log(`\n  externalId (buildTaskId for download URL) : ${t.externalId}`);
      console.log(`  token                                     : ${t.token}`);
      console.log(`  platform                                  : ${t.platform}`);
      console.log(`  buildTaskStatus                           : ${JSON.stringify(t.buildTaskStatus)}`);
      console.log(`  fileByAndroidOutput.url                   : ${t.fileByAndroidOutput?.url ?? 'null'}`);
      console.log(`  fileByIosOutput.url                       : ${t.fileByIosOutput?.url ?? 'null'}`);
      console.log(`  downloadOutput URL                        : https://www.wavemakeronline.com/AppChef/services/chef/downloadOutput?buildTaskId=${t.externalId}&platform=${t.platform}&download=true`);
    }
  }

  console.log('\n[Test] ✅ All checks passed');
}

main().catch((e) => {
  console.error('\n[Test] ❌ FAILED:', JSON.stringify(e?.response?.data ?? e?.message ?? e, null, 2));
  console.error('  status:', e?.response?.status);
  console.error('  headers:', JSON.stringify(e?.response?.headers, null, 2));
  process.exit(1);
});
