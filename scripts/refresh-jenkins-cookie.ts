/**
 * Refreshes the STUDIO_COOKIE on Jenkins by:
 * 1. Logging into WaveMaker Studio locally (Google OAuth with your browser)
 * 2. Extracting the session cookie
 * 3. Updating the Jenkins credential via Jenkins REST API
 *
 * Usage:
 *   npx ts-node scripts/refresh-jenkins-cookie.ts
 *
 * Requires: JENKINS_URL and JENKINS_API_TOKEN in .env
 */

import 'dotenv/config';
import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const CACHE_DIR = path.join(process.cwd(), '.test-cache');
const COOKIE_FILE = path.join(CACHE_DIR, 'auth-cookie.txt');

async function getStudioCookie(): Promise<string> {
  // Try cached cookie first
  if (fs.existsSync(COOKIE_FILE)) {
    const cached = fs.readFileSync(COOKIE_FILE, 'utf-8').trim();
    if (cached) {
      const baseUrl = (process.env.STUDIO_BASE_URL || '').replace(/\/$/, '');
      try {
        const resp = await fetch(`${baseUrl}/studio/services/projects`, {
          headers: { Cookie: cached },
          redirect: 'manual',
        });
        if (resp.status >= 200 && resp.status < 400) {
          console.log('✅ Existing cached cookie is still valid');
          return cached;
        }
      } catch {}
      console.log('⚠️  Cached cookie expired, performing fresh login...');
    }
  }

  // Fresh login via browser
  console.log('🔐 Opening browser for Google OAuth login...');
  console.log('   Complete the login (including any 2FA) in the browser window.');

  const { googleBrowserLogin } = await import('../src/auth/googleAuth');
  const result = await googleBrowserLogin();

  // Save for future use
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(COOKIE_FILE, result.cookieHeader);

  console.log(`✅ Got fresh cookie (length: ${result.cookieHeader.length})`);
  return result.cookieHeader;
}

async function updateJenkinsCredential(cookieValue: string): Promise<void> {
  const jenkinsUrl = (process.env.JENKINS_URL || '').replace(/\/$/, '');
  const jenkinsUser = process.env.JENKINS_USER || '';
  const jenkinsToken = process.env.JENKINS_API_TOKEN || '';

  if (!jenkinsUrl || !jenkinsUser || !jenkinsToken) {
    console.log('\n⚠️  Jenkins credentials not configured in .env');
    console.log('   Add these to your .env file:');
    console.log('     JENKINS_URL=http://34.27.46.55:8080');
    console.log('     JENKINS_USER=qajenkins');
    console.log('     JENKINS_API_TOKEN=your-api-token');
    console.log('\n   Get your API token from: Jenkins → Your Profile → Configure → API Token → Add New Token');
    console.log('\n📋 Cookie value (copy to Jenkins manually):');
    console.log(`   ${cookieValue}`);
    return;
  }

  const credentialId = 'STUDIO_COOKIE';
  const auth = Buffer.from(`${jenkinsUser}:${jenkinsToken}`).toString('base64');

  // Get crumb for CSRF protection
  const crumbResp = await fetch(`${jenkinsUrl}/crumbIssuer/api/json`, {
    headers: { Authorization: `Basic ${auth}` },
  });

  let crumbHeader: Record<string, string> = {};
  if (crumbResp.ok) {
    const crumb = await crumbResp.json() as { crumbRequestField: string; crumb: string };
    crumbHeader = { [crumb.crumbRequestField]: crumb.crumb };
  }

  // Update the credential via Jenkins API
  const xml = `
<org.jenkinsci.plugins.plaincredentials.impl.StringCredentialsImpl>
  <scope>GLOBAL</scope>
  <id>${credentialId}</id>
  <description>Studio session cookie (auto-refreshed)</description>
  <secret>${escapeXml(cookieValue)}</secret>
</org.jenkinsci.plugins.plaincredentials.impl.StringCredentialsImpl>`.trim();

  // Try update first
  const updateUrl = `${jenkinsUrl}/credentials/store/system/domain/_/credential/${credentialId}/config.xml`;
  const updateResp = await fetch(updateUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/xml',
      ...crumbHeader,
    },
    body: xml,
  });

  if (updateResp.ok) {
    console.log(`✅ Updated Jenkins credential '${credentialId}' successfully`);
    return;
  }

  // If update failed (credential doesn't exist), create it
  const createUrl = `${jenkinsUrl}/credentials/store/system/domain/_/createCredentials`;
  const createResp = await fetch(createUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/xml',
      ...crumbHeader,
    },
    body: xml,
  });

  if (createResp.ok) {
    console.log(`✅ Created Jenkins credential '${credentialId}' successfully`);
  } else {
    console.error(`❌ Failed to update Jenkins credential: ${createResp.status} ${createResp.statusText}`);
    console.log('\n📋 Cookie value (copy to Jenkins manually):');
    console.log(`   ${cookieValue}`);
  }
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function main() {
  console.log('🔄 Refreshing Jenkins STUDIO_COOKIE...\n');

  const cookie = await getStudioCookie();
  await updateJenkinsCredential(cookie);

  console.log('\n✅ Done! Jenkins will use the new cookie on next build.');
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
