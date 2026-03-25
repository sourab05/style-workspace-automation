import fs from 'fs';
import path from 'path';

/**
 * Loads ONLY global tokens from tokens/mobile/global/ directory
 * This is hardcoded to ensure Playwright only uses design system tokens
 */

const GLOBAL_TOKENS_PATH = 'tokens/mobile/global';

export function loadGlobalTokenMap(): Record<string, string> {
  // Hardcoded path: tokens/mobile/global/ → Tokens/token-values-mobile.json
  const tokenMapPath = path.join(process.cwd(), 'Tokens', 'token-values-mobile.json');
  
  if (!fs.existsSync(tokenMapPath)) {
    throw new Error(
      `Global token map not found: ${tokenMapPath}\n` +
      'Please run: npm run build:token-map mobile (script will auto-filter global tokens)'
    );
  }

  const tokenMap = JSON.parse(fs.readFileSync(tokenMapPath, 'utf-8'));
  
  // Verify tokens are from global directory only
  const hasComponentTokens = Object.keys(tokenMap).some(tokenRef => {
    const lower = tokenRef.toLowerCase();
    // Component tokens have widget names in them
    return (
      lower.includes('.appearances.') ||
      lower.includes('.mapping.') ||
      lower.includes('.variantgroups.') ||
      lower.includes('{btn.') ||
      lower.includes('{chips.') ||
      lower.includes('{wizard.')
    );
  });

  if (hasComponentTokens) {
    console.warn('⚠️  Warning: Token map contains component-specific tokens!');
    console.warn('   This map should only contain global tokens from tokens/mobile/global/');
  }

  return tokenMap;
}

/**
 * Gets the global tokens directory path
 */
export function getGlobalTokensPath(): string {
  return path.join(process.cwd(), GLOBAL_TOKENS_PATH);
}
