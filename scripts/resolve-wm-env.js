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

const pid = p.projectId;
const interp = (s) => (s || '').replace(/\$\{PROJECT_ID\}/g, pid);

const lines = [
  `STUDIO_BASE_URL=${p.studioBaseUrl}`,
  `PROJECT_ID=${pid}`,
  `STUDIO_PROJECT_ID=${p.studioProjectId}`,
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
