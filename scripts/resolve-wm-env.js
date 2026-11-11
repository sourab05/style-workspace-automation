#!/usr/bin/env node
// Resolves WM_ENV profile from config/wm-env-profiles.json
// Outputs KEY=VALUE lines for Jenkins to parse
const envKey = process.argv[2];
if (!envKey) {
  console.error('Usage: node scripts/resolve-wm-env.js <WM_ENV>');
  process.exit(1);
}

const profiles = require('../config/wm-env-profiles.json');
const p = profiles[envKey];
if (!p) {
  console.error(`Unknown WM_ENV: ${envKey}. Available: ${Object.keys(profiles).sort().join(', ')}`);
  process.exit(1);
}

// Jenkins passes only non-secret overrides under a dedicated prefix.
const override = (key, fallback) => {
  const value = process.env[`SWS_${key}`] || '';
  if (/[\r\n]/.test(value)) {
    throw new Error(`${key} must be a single line`);
  }
  return value.trim() || fallback;
};
const baseUrl = override('STUDIO_BASE_URL', p.studioBaseUrl);
const parsedUrl = new URL(baseUrl);
if (!['http:', 'https:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
  throw new Error('STUDIO_BASE_URL must be an HTTP(S) URL without embedded credentials');
}
const pid = override('PROJECT_ID', p.projectId);
const studioProjectId = override('STUDIO_PROJECT_ID', p.studioProjectId);
const interp = (s) => (s || '').replace(/\$\{PROJECT_ID\}/g, () => pid);

const lines = [
  `STUDIO_BASE_URL=${baseUrl}`,
  `PROJECT_ID=${pid}`,
  `STUDIO_PROJECT_ID=${studioProjectId}`,
  `STUDIO_USERNAME=${p.studioUsername}`,
  `AUTH_METHOD=${p.authMethod && p.authMethod !== 'auto' ? p.authMethod : ''}`,
  `STUDIO_LOGIN_PATH=${p.studioLoginPath || '/login/authenticate'}`,
  `STUDIO_DEPLOY_PATH=${interp(p.studioDeployPath || 'studio/services/projects/${PROJECT_ID}/deployment/inplaceDeploy')}`,
  `CANVAS_PATH=${interp(p.canvasPath || 's/page/Main?project-id=${PROJECT_ID}')}`,
  `PREVIEW_PATH=${p.previewPath || '/preview'}`,
  `RUNTIME_BASE_URL=${p.runtimeBaseUrl || ''}`,
  `JENKINS_CRED_ID=${p.jenkinsCredentialsId || ''}`,
  `PROFILE_LABEL=${p.label}`,
];

console.log(lines.join('\n'));
