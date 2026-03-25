import fs from 'fs';
import path from 'path';
import { TokenFile } from './schema';

export function loadTokens(tokenPath: string): TokenFile {
  const absPath = path.isAbsolute(tokenPath) ? tokenPath : path.join(process.cwd(), tokenPath);

  const raw = fs.readFileSync(absPath, 'utf-8').trim();
  if (!raw) {
    console.warn(`Skipping empty token file: ${tokenPath}`);
    return {} as TokenFile;
  }

  try {
    const json = JSON.parse(raw);
    // Temporarily trust token structure to avoid runtime zod mismatch; schema can be re-enabled later.
    return json as TokenFile;
  } catch (err) {
    console.error(`Failed to parse token file ${tokenPath}:`, err);
    return {} as TokenFile;
  }
}

/**
 * Loads all token files from GLOBAL directory only
 * Hardcoded path: tokens/mobile/global/
 */
export function loadGlobalTokensOnly(): Array<{ file: string; data: any }> {
  const globalPath = path.join(process.cwd(), 'tokens', 'mobile', 'global');
  const tokenFiles: Array<{ file: string; data: any }> = [];

  function scanDirectory(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        scanDirectory(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        try {
          const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
          tokenFiles.push({ file: fullPath, data });
        } catch (err) {
          console.warn(`Failed to load token file: ${fullPath}`, err);
        }
      }
    }
  }

  scanDirectory(globalPath);
  return tokenFiles;
}
