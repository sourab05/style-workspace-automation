import fs from 'fs';
import path from 'path';
import { loadTokens } from './loader';
import { ENV } from '../utils/env';

export function discoverTokenFiles(dir: string = ENV.tokensDir): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...discoverTokenFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.json')) files.push(full);
  }
  return files;
}

export function loadAllTokens(): Array<{ file: string; data: ReturnType<typeof loadTokens> }> {
  const files = discoverTokenFiles();
  return files.map((file) => ({ file, data: loadTokens(file) }));
}

/**
 * Platform-aware token loading helpers for new `tokens/` structure.
 *
 * Expected layout:
 *   tokens/
 *     web/
 *       global/...
 *       components/<widget>/<widget>.json
 *     mobile/
 *       global/...
 *       components/<widget>/<widget>.json
 */
export type TokenPlatform = 'web' | 'mobile';

export function discoverTokenFilesForPlatform(platform: TokenPlatform, baseDir: string = path.join(process.cwd(), 'tokens')): string[] {
  const platformDir = path.join(baseDir, platform);
  if (!fs.existsSync(platformDir)) {
    console.warn(`Token platform directory not found: ${platformDir}`);
    return [];
  }
  return discoverTokenFiles(platformDir);
}

export function loadAllTokensForPlatform(platform: TokenPlatform): Array<{ file: string; data: ReturnType<typeof loadTokens> }> {
  const files = discoverTokenFilesForPlatform(platform);
  return files.map((file) => ({ file, data: loadTokens(file) }));
}

export { loadGlobalTokensOnly } from './loader';
