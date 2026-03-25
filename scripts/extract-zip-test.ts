import path from 'path';
import fs from 'fs';
import { RnProjectManager } from '../src/api/rnProjectManager';

async function main() {
  const cwd = process.cwd();
  const zipPath = path.join(cwd, 'test-download', 'WMPRJ2c9180879ab8d6e2019aba7277d40055.zip');
  const outputBaseDir = path.join(cwd, 'mobile-builds', 'baseline');
  const extractTo = path.join(outputBaseDir, 'rn-project');

  if (!fs.existsSync(zipPath)) {
    console.error(`Zip not found at ${zipPath}`);
    process.exit(1);
  }

  fs.mkdirSync(outputBaseDir, { recursive: true });

  // Dummy config; extractZip doesn't rely on it
  const rn = new RnProjectManager({
    projectId: 'dummy',
    username: 'dummy',
    password: 'dummy',
    baseUrl: 'https://example.com',
    fileServiceUrl: 'https://example.com/file-service'
  });

  console.log('\n=== First extraction (fresh) ===');
  await rn.extractZip(zipPath, extractTo);
  console.log('First extract OK');

  console.log('\n=== Second extraction (should clean existing dir robustly) ===');
  await rn.extractZip(zipPath, extractTo);
  console.log('Second extract OK');

  console.log('\nListing top-level of extracted project:');
  const items = fs.readdirSync(extractTo);
  console.log(items.slice(0, 20));
}

main().catch((e) => {
  console.error('Test failed:', e);
  process.exit(1);
});
