import fs from 'fs';
import path from 'path';

export type WmAuthMethod = 'platformdb' | 'google' | 'wavemaker' | 'auto';

export interface WmEnvProfile {
  label: string;
  studioBaseUrl: string;
  projectId: string;
  studioProjectId: string;
  studioUsername: string;
  authMethod?: WmAuthMethod;
  runtimeBaseUrl?: string;
  studioLoginPath?: string;
  studioDeployPath?: string;
  canvasPath?: string;
  previewPath?: string;
  studioOrigin?: string;
  studioReferer?: string;
  jenkinsCredentialsId?: string;
}

const PROFILES_PATH = path.join(process.cwd(), 'config', 'wm-env-profiles.json');

export function normalizeEnvKey(key: string): string {
  return key.toUpperCase().replace(/-/g, '_');
}

export function loadWmEnvProfiles(): Record<string, WmEnvProfile> {
  if (!fs.existsSync(PROFILES_PATH)) {
    throw new Error(`WM env profiles not found at ${PROFILES_PATH}`);
  }
  return JSON.parse(fs.readFileSync(PROFILES_PATH, 'utf8')) as Record<string, WmEnvProfile>;
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\$\{(\w+)\}/g, (_, name: string) => vars[name] ?? '');
}

function setIfUnset(key: string, value: string | undefined): void {
  if (value && !process.env[key]?.trim()) {
    process.env[key] = value;
  }
}

function resolvePassword(envKey: string): string | undefined {
  const envSpecific = process.env[`WM_${normalizeEnvKey(envKey)}_STUDIO_PASSWORD`]?.trim();
  if (envSpecific) return envSpecific;
  return process.env.STUDIO_PASSWORD?.trim() || undefined;
}

/**
 * Applies config/wm-env-profiles.json for WM_ENV.
 * Explicit process.env values always win (allows per-field overrides in .env).
 */
export function applyWmEnvProfile(wmEnv?: string): string | undefined {
  const envKey = (wmEnv || process.env.WM_ENV)?.trim();
  if (!envKey) return undefined;

  const profiles = loadWmEnvProfiles();
  const profile = profiles[envKey];
  if (!profile) {
    const available = Object.keys(profiles).sort().join(', ');
    throw new Error(`Unknown WM_ENV="${envKey}". Available profiles: ${available}`);
  }

  const vars = { PROJECT_ID: profile.projectId };

  setIfUnset('WM_ENV', envKey);
  setIfUnset('STUDIO_BASE_URL', profile.studioBaseUrl);
  setIfUnset('PROJECT_ID', profile.projectId);
  setIfUnset('STUDIO_PROJECT_ID', profile.studioProjectId);
  setIfUnset('STUDIO_USERNAME', profile.studioUsername);

  const password = resolvePassword(envKey);
  if (password) {
    setIfUnset('STUDIO_PASSWORD', password);
  }

  if (profile.authMethod && profile.authMethod !== 'auto') {
    setIfUnset('AUTH_METHOD', profile.authMethod);
  }

  if (profile.runtimeBaseUrl) setIfUnset('RUNTIME_BASE_URL', profile.runtimeBaseUrl);
  if (profile.studioLoginPath) setIfUnset('STUDIO_LOGIN_PATH', profile.studioLoginPath);
  if (profile.studioDeployPath) {
    setIfUnset('STUDIO_DEPLOY_PATH', interpolate(profile.studioDeployPath, vars));
  }
  if (profile.canvasPath) setIfUnset('CANVAS_PATH', interpolate(profile.canvasPath, vars));
  if (profile.previewPath) setIfUnset('PREVIEW_PATH', profile.previewPath);
  if (profile.studioOrigin) setIfUnset('STUDIO_ORIGIN', profile.studioOrigin);
  if (profile.studioReferer) setIfUnset('STUDIO_REFERER', profile.studioReferer);

  if (process.env.WM_ENV_DEBUG === 'true') {
    console.log(`✅ Applied WM_ENV=${envKey} (${profile.label})`);
    console.log(`   STUDIO_BASE_URL=${process.env.STUDIO_BASE_URL}`);
    console.log(`   PROJECT_ID=${process.env.PROJECT_ID}`);
    console.log(`   STUDIO_PROJECT_ID=${process.env.STUDIO_PROJECT_ID}`);
    console.log(`   STUDIO_USERNAME=${process.env.STUDIO_USERNAME}`);
    console.log(`   AUTH_METHOD=${process.env.AUTH_METHOD || '(auto-detect from URL)'}`);
  }

  return envKey;
}

export function listWmEnvProfiles(): void {
  const profiles = loadWmEnvProfiles();
  for (const [key, profile] of Object.entries(profiles).sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`${key}: ${profile.label}`);
    console.log(`  url=${profile.studioBaseUrl}`);
    console.log(`  projectId=${profile.projectId}`);
    console.log(`  studioProjectId=${profile.studioProjectId}`);
    console.log(`  username=${profile.studioUsername}`);
    console.log(`  auth=${profile.authMethod || 'auto'}`);
    console.log(`  jenkinsCredentialsId=${profile.jenkinsCredentialsId || `WM_${normalizeEnvKey(key)}_CREDS`}`);
    console.log(`  passwordEnv=WM_${normalizeEnvKey(key)}_STUDIO_PASSWORD`);
    console.log('');
  }
}
