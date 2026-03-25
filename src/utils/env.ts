import 'dotenv/config';

const GOOGLE_AUTH_DOMAINS = ['stage-platform.wavemaker.ai'];

function detectGoogleAuth(baseUrl: string): boolean {
  if (process.env.AUTH_METHOD === 'google') return true;
  if (process.env.AUTH_METHOD === 'wavemaker') return false;
  try {
    const hostname = new URL(baseUrl).hostname;
    return GOOGLE_AUTH_DOMAINS.some(d => hostname === d || hostname.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

export const ENV = {
  studioBaseUrl: process.env.STUDIO_BASE_URL || '',
  runtimeBaseUrl: process.env.RUNTIME_BASE_URL || process.env.BASE_URL || '',
  projectId: process.env.PROJECT_ID || '',
  studioProjectId: process.env.STUDIO_PROJECT_ID || process.env.PROJECT_ID || '',
  studioUsername: process.env.STUDIO_USERNAME || '',
  studioPassword: process.env.STUDIO_PASSWORD || '',
  googleEmail: process.env.GOOGLE_EMAIL || process.env.STUDIO_USERNAME || '',
  googlePassword: process.env.GOOGLE_PASSWORD || '',
  googleTotpSecret: process.env.GOOGLE_TOTP_SECRET || '',
  apiKey: process.env.STUDIO_API_KEY,
  get studioCookie(): string | undefined {
    return process.env.STUDIO_COOKIE;
  },
  studioOrigin: process.env.STUDIO_ORIGIN,
  studioReferer: process.env.STUDIO_REFERER,
  studioPublishPath: process.env.STUDIO_PUBLISH_PATH || '/projects/${PROJECT_ID}/style/publish',
  canvasPath: process.env.CANVAS_PATH || 's/page/Main?project-id=${PROJECT_ID}',
  previewPath: process.env.PREVIEW_PATH || '/preview',
  studioLoginPath: process.env.STUDIO_LOGIN_PATH || '/login/authenticate',
  studioDeployPath: process.env.STUDIO_DEPLOY_PATH || '/studio/services/projects/${PROJECT_ID}/inplace-deploy',
  tokensDir: process.env.TOKENS_DIR || `${process.cwd()}/Tokens`,

  get isGoogleAuth(): boolean {
    return detectGoogleAuth(this.studioBaseUrl);
  },

  validate(): void {
    const isGoogle = detectGoogleAuth(process.env.STUDIO_BASE_URL || '');
    const required: string[] = ['studioBaseUrl', 'projectId'];

    if (isGoogle) {
      required.push('googleEmail', 'googlePassword');
    } else {
      required.push('studioUsername', 'studioPassword');
    }

    const missing = required.filter(key => !(ENV as any)[key]);

    if (missing.length > 0) {
      throw new Error(
        `❌ Missing required environment variables:\n` +
        missing.map(m => `   - ${m}`).join('\n') +
        `\nPlease check your .env file or environment configuration.` +
        (isGoogle ? '\n   (Google auth detected for stage-platform.wavemaker.ai)' : '')
      );
    }

    console.log(`✅ Environment validation passed (auth: ${isGoogle ? 'Google OAuth' : 'WaveMaker form'})`);
  }
};
