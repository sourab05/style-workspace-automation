import dotenv from 'dotenv';
import { applyWmEnvProfile } from './wm-env-profiles';

dotenv.config();

try {
  applyWmEnvProfile();
} catch (error) {
  if (process.env.WM_ENV?.trim()) {
    throw error;
  }
}
