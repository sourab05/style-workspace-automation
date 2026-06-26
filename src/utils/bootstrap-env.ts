import dotenv from 'dotenv';
import { applyWmEnvProfile } from './wm-env-profiles';

dotenv.config();

try {
  const appliedEnv = applyWmEnvProfile();
  if (appliedEnv) {
    console.log(`✅ WM_ENV=${appliedEnv} | URL=${process.env.STUDIO_BASE_URL} | PROJECT=${process.env.PROJECT_ID} | AUTH=${process.env.AUTH_METHOD || 'auto'}`);
  }
} catch (error) {
  if (process.env.WM_ENV?.trim()) {
    throw error;
  }
}
