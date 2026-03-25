import * as dotenv from 'dotenv';

// Ensure environment variables from .env are available
dotenv.config();

/**
 * Returns true when tests/builds should run against local emulators/devices
 * instead of BrowserStack. Controlled via RUN_LOCAL env var.
 */
export function isLocalEnv(): boolean {
  return process.env.RUN_LOCAL === 'true';
}
