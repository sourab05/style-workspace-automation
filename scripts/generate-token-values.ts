import fs from 'fs';
import path from 'path';
import { loadAllTokensForPlatform, loadGlobalTokensOnly, type TokenPlatform } from '../src/tokens';

/**
 * Generates a global token → value map from all design token JSON files.
 *
 * Output file: Tokens/token-values-{platform}.json
 * Format:
 * {
 *   "{color.primary.@.value}": "#FF7250",
 *   "{color.secondary.@.value}": "#656DF9",
 *   ...
 * }
 * 
 * Token references are recursively resolved to their final values.
 */

function collectTokens(
  obj: any,
  prefix: string[] = [],
  acc: Record<string, string>
): void {
  if (!obj || typeof obj !== 'object') return;

  for (const [key, val] of Object.entries(obj)) {
    if (key === 'value' && (typeof val === 'string' || typeof val === 'number')) {
      const tokenPath = [...prefix, key].join('.'); // e.g. "color.secondary.@.value"
      const tokenRef = `{${tokenPath}}`; // e.g. "{color.secondary.@.value}"
      acc[tokenRef] = String(val);
    } else if (val && typeof val === 'object') {
      collectTokens(val, [...prefix, key], acc);
    }
  }
}

/**
 * Recursively resolves token references to their final values.
 * For example: "{space.0.value}" -> "0px"
 * Also handles references without .value suffix: "{border.style.solid}" -> "solid"
 */
function resolveTokenReferences(map: Record<string, string>): Record<string, string> {
  const resolved: Record<string, string> = {};
  const maxDepth = 10; // Prevent infinite loops

  function resolve(val: string, depth: number = 0): string {
    if (depth > maxDepth) {
      console.warn(`⚠️  Max resolution depth reached for ${val}`);
      return val;
    }

    // Handle full reference: "{path.to.token}"
    if (val.startsWith('{') && val.endsWith('}') && !val.includes(' ')) {
      const resolved = map[val];
      if (!resolved) {
        // Try adding .value if not present
        if (!val.endsWith('.value}')) {
          const withValue = val.slice(0, -1) + '.value}';
          const valResolved = map[withValue];
          if (valResolved) return resolve(valResolved, depth + 1);
        }
        return val;
      }
      return resolve(resolved, depth + 1);
    }

    // Handle partial references in strings: "0px 4px {color.shadow.@.value}"
    if (val.includes('{')) {
      return val.replace(/\{[^{}]+\}/g, (match) => {
        return resolve(match, depth + 1);
      });
    }

    return val;
  }

  // Resolve all token references
  for (const [tokenRef, value] of Object.entries(map)) {
    let resolvedValue = resolve(tokenRef);

    // Transform shadow/elevation tokens to include specific dimensions
    // BUT exclude the base color token itself
    const lowerRef = tokenRef.toLowerCase();
    const isShadowOrElevation = lowerRef.includes('shadow') || lowerRef.includes('elevation') || lowerRef.includes('box-shadow');
    const isBaseColorToken = lowerRef.includes('color.shadow');

    if (isShadowOrElevation && !isBaseColorToken) {
      // Check if the resolved value is JUST a color (hex or rgb)
      // If it's already a complex string (has 'px' or multiple values), just resolve colors inside it
      const isRawColor = /^#[0-9a-fA-F]{3,8}$/.test(resolvedValue.trim()) || /^rgba?\(.*?\)$/.test(resolvedValue.trim());

      if (isRawColor) {
        // Force to user's requested format for raw colors used as shadows
        resolvedValue = `0px 4px 8px 3px ${resolvedValue.trim()}`;
      } else {
        // It's a complex string, normal resolution (which happened in resolve()) is enough.
        // But let's ENSURE the first color's dimensions are forced if that's what was REALLY intended?
        // Actually, the user's failure showed they were surprised by the second layer.
        // The most robust way to match the app is to NOT force dimensions if they already exist.
      }
    }

    resolved[tokenRef] = resolvedValue;
  }

  return resolved;
}

function generateTokenValueMap(platform: TokenPlatform): Record<string, string> {
  // Hardcoded: Load ONLY from tokens/mobile/global/ for Playwright tests
  const allTokens = loadGlobalTokensOnly();
  console.log(`✅ Loading tokens from: tokens/mobile/global/ (${allTokens.length} files)`);
  
  const map: Record<string, string> = {};

  for (const { file, data } of allTokens) {
    console.log(`🔍 Processing token file: ${path.basename(file)}`);
    collectTokens(data, [], map);
  }

  console.log(`\n🔗 Resolving token references...`);
  const resolved = resolveTokenReferences(map);

  // Count how many were resolved
  const resolvedCount = Object.entries(resolved).filter(([key, val]) =>
    map[key] !== val && !val.startsWith('{')
  ).length;

  console.log(`✅ Resolved ${resolvedCount} token references`);

  return resolved;
}

function main() {
  // Get platform from command line args or default to 'mobile'
  const platform = (process.argv[2] as TokenPlatform) || 'mobile';

  if (platform !== 'web' && platform !== 'mobile') {
    console.error(`❌ Invalid platform: ${platform}. Must be 'web' or 'mobile'`);
    process.exit(1);
  }

  console.log(`🧩 Generating global token → value map for platform: ${platform}...`);

  const map = generateTokenValueMap(platform);

  const outDir = path.join(process.cwd(), 'Tokens');
  const outFile = path.join(outDir, `token-values-${platform}.json`);

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(outFile, JSON.stringify(map, null, 2), 'utf-8');

  console.log(`✅ Wrote ${Object.keys(map).length} entries to ${outFile}`);
}

if (require.main === module) {
  main();
}
