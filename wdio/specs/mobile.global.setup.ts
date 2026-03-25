import * as fs from 'fs';
import * as path from 'path';
import { StudioClient } from '../../src/api/studioClient';
import { ENV } from '../../src/utils/env';
import { loadAllTokensForPlatform } from '../../src/tokens';
import { generateOrthogonalMatrix, generateTokenVariantMapping, generateVariantPayload, getWidgetKey } from '../../src/matrix/generator';
import { TokenHelper } from '../../tests/pages/TokenHelper.page';
import { BrowserStackService } from '../services/browserstack.service';
import type { BrowserStackAppUploadResponse } from '../services/browserstack.service';
import { BatchTokenMerger, TokenVariantPair } from '../utils/batch-token-merger';
import { RnProjectManager } from '../../src/api/rnProjectManager';
import { WaveMakerCLI } from '../../src/cli/wavemakerCli';
import { isLocalEnv } from '../utils/envFlags';
import { WIDGET_CONFIG } from '../../src/matrix/widgets';
import { getPropertyPathsForType } from '../utils/mobileTokenDistributor';
// Utility to ensure a build output directory is clean before each run
function ensureCleanDir(dir: string): void {
  if (fs.existsSync(dir)) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`🧹 Cleaned existing build directory: ${dir}`);
    } catch (e: any) {
      console.warn(`⚠️  Failed to clean build directory ${dir}: ${e?.message || e}`);
    }
  }
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created build directory: ${dir}`);
  }
}

/**
 * Mobile Global Setup
 * Runs once before all mobile tests to:
 * 1. Build baseline apps (default tokens)
 * 2. Apply all tokens in batch
 * 3. Build actual apps (with all tokens)
 * 4. Upload to BrowserStack
 */

// Group token references by logical token type (color, font, border-width, etc.)
function groupTokenRefsByType(tokenRefs: string[]): Record<string, string[]> {
  const byType: Record<string, string[]> = {};

  for (const ref of tokenRefs) {
    const match = ref.match(/^\{([^}]+)\}/);
    if (!match) continue;
    const parts = match[1].split('.');
    let tokenType = 'color';

    if (parts.length >= 2) {
      const firstTwo = `${parts[0]}-${parts[1]}`;
      if (['border-width', 'border-style', 'border-radius', 'box-shadow'].includes(firstTwo)) {
        tokenType = firstTwo;
      } else {
        tokenType = parts[0];
      }
    } else {
      tokenType = parts[0];
    }

    // Manual mapping for radius -> border-radius
    if (tokenType === 'radius') {
      tokenType = 'border-radius';
    }

    // Manual mapping for semantic typography -> font
    if (ref.includes('font-size') || ref.includes('font-weight') || ref.includes('font-family') || ref.includes('line-height') || ref.includes('letter-spacing')) {
      tokenType = 'font';
    }

    if (!byType[tokenType]) byType[tokenType] = [];
    byType[tokenType].push(ref);
  }

  return byType;
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Generic, discovery-based mapping support

type WidgetType = import('../../src/matrix/widgets').Widget;
type TokenTypeKey = string;

const widgetPropertyCandidates = new Map<WidgetType, Record<TokenTypeKey, string[][]>>();

// widget -> tokenTypeKey -> tokenRefs
const tokensByWidgetAndType = new Map<WidgetType, Record<TokenTypeKey, string[]>>();

function addWidgetToken(
  widget: WidgetType,
  tokenTypeKey: TokenTypeKey,
  tokenRef: string,
): void {
  let byType = tokensByWidgetAndType.get(widget);
  if (!byType) {
    byType = {};
    tokensByWidgetAndType.set(widget, byType);
  }
  const arr = byType[tokenTypeKey] || (byType[tokenTypeKey] = []);
  if (!arr.includes(tokenRef)) {
    arr.push(tokenRef);
  }
}

function normalizeTokenTypeFromJson(mainType: string, subtype?: string): TokenTypeKey {
  if (subtype === 'border-width') return 'border-width';
  if (subtype === 'border-style') return 'border-style';
  if (subtype === 'radius') return 'border-radius';
  if (subtype === 'elevation') return 'box-shadow';
  if (subtype === 'opacity') return 'opacity';
  if (subtype === 'icon-size') return 'icon';

  if (mainType === 'color') return 'color';
  if (mainType === 'font') return 'font';
  if (mainType === 'space') return 'space';

  return subtype || mainType;
}

function normalizeRequestedTokenType(tokenType: string): TokenTypeKey {
  // Keep as-is, but we use family fallbacks (gap/margin/spacer -> space, etc.)
  return tokenType;
}

function normalizeDiscoveredPath(raw: string[]): string[] {
  // Collapse padding.{top,bottom,left,right} to a single 'padding' logical slot
  if (raw.length >= 2) {
    const last = raw[raw.length - 1];
    const prev = raw[raw.length - 2];
    if (prev === 'padding' && ['top', 'bottom', 'left', 'right'].includes(last)) {
      return ['padding'];
    }
  }
  return raw;
}

function addCandidatePath(widget: WidgetType, tokenTypeKey: TokenTypeKey, path: string[]): void {
  const normalizedPath = normalizeDiscoveredPath(path);
  const key = normalizedPath.join('.');

  let byType = widgetPropertyCandidates.get(widget);
  if (!byType) {
    byType = {};
    widgetPropertyCandidates.set(widget, byType);
  }
  const arr = byType[tokenTypeKey] || (byType[tokenTypeKey] = []);
  if (!arr.some(p => p.join('.') === key)) {
    arr.push(normalizedPath);
  }
}

function discoverWidgetPropertyCandidates(widget: WidgetType, componentJson: any): void {
  if (widgetPropertyCandidates.has(widget)) return;

  const rootKeys = componentJson && typeof componentJson === 'object' ? Object.keys(componentJson) : [];
  if (!rootKeys.length) return;
  const root = componentJson[rootKeys[0]];

  const visit = (obj: any, path: string[] = []): void => {
    if (!obj || typeof obj !== 'object') return;

    // Leaf: has value + type -> potential candidate
    if (Object.prototype.hasOwnProperty.call(obj, 'value') && typeof obj.type === 'string') {
      const mainType = obj.type as string;
      const subtype = typeof obj.attributes?.subtype === 'string' ? (obj.attributes.subtype as string) : undefined;
      const tokenTypeKey = normalizeTokenTypeFromJson(mainType, subtype);
      addCandidatePath(widget, tokenTypeKey, path);
      return;
    }

    for (const key of Object.keys(obj)) {
      if (key === 'meta') continue;
      if (key === 'states') {
        // Skip 'states' and specific state names in the logical path; state is modeled separately in the matrix
        const statesObj = obj[key];
        if (statesObj && typeof statesObj === 'object') {
          for (const stateName of Object.keys(statesObj)) {
            visit(statesObj[stateName], path);
          }
        }
        continue;
      }
      visit(obj[key], [...path, key]);
    }
  };

  if (root && typeof root === 'object') {
    if (root.mapping) {
      visit(root.mapping, []);
    }
    if (root.appearances && typeof root.appearances === 'object') {
      for (const appearance of Object.values(root.appearances) as any[]) {
        if (appearance && appearance.mapping) {
          visit(appearance.mapping, []);
        }
      }
    }
  }
}

// Extract the actual token type from a token reference
// e.g., "{color.primary.@.value}" -> "color"
// e.g., "{space.4.value}" -> "space"
// e.g., "{font.weight.600.value}" -> "font"
function getTokenTypeFromRef(tokenRef: string): string {
  const match = tokenRef.match(/^\{([^.]+)\./);
  if (match) {
    const firstPart = match[1];
    // Map common token prefixes to types
    if (firstPart === 'color') return 'color';
    if (firstPart === 'space' || firstPart === 'gap' || firstPart === 'margin' || firstPart === 'spacer') return 'space';

    // Typography properties should always be treated as font tokens
    if (firstPart === 'font' || tokenRef.includes('font-size') || tokenRef.includes('font-weight') || tokenRef.includes('font-family') || tokenRef.includes('line-height') || tokenRef.includes('letter-spacing')) return 'font';

    if (firstPart === 'border') {
      // Check if it's border-width, border-style, or border-radius
      if (tokenRef.includes('.width.')) return 'border-width';
      if (tokenRef.includes('.style.')) return 'border-style';
      if (tokenRef.includes('.radius.')) return 'border-radius';
      return 'border-width'; // default
    }
    if (firstPart === 'box-shadow') return 'box-shadow';
    if (firstPart === 'elevation') return 'elevation';
    if (firstPart === 'opacity') return 'opacity';
    if (firstPart === 'icon') return 'icon'; // icon sizes are dimensions/spacing
    if (firstPart === 'gap') return 'gap';
    return firstPart;
  }
  return 'color'; // default fallback
}

// Check if a token type is compatible with a property path
function isTokenCompatibleWithProperty(tokenRef: string, propertyPath: string[]): boolean {
  const tokenType = getTokenTypeFromRef(tokenRef);
  const propertyName = propertyPath[propertyPath.length - 1] || propertyPath[0];
  const fullPathString = propertyPath.join('.');

  // Color tokens
  if (tokenType === 'color') {
    return propertyName === 'color' ||
      propertyName === 'background' ||
      propertyName === 'background-color' ||
      propertyName.includes('color') ||
      fullPathString.includes('background') ||
      fullPathString.includes('color') ||
      fullPathString.includes('stroke') ||
      ((propertyName === 'icon' || propertyName === 'text') && fullPathString.includes('heading'));
  }

  // Spacing tokens (space, gap, margin, spacer)
  if (tokenType === 'space') {
    return propertyName === 'padding' ||
      propertyName === 'margin' ||
      propertyName === 'gap' ||
      propertyName === 'size' ||
      propertyName === 'width' ||
      propertyName === 'height' ||
      propertyName === 'top' ||
      propertyName === 'bottom' ||
      propertyName === 'left' ||
      propertyName === 'right' ||
      propertyName === 'block' ||
      propertyName === 'inline' ||
      propertyName === 'horizontal' ||
      propertyName === 'vertical' ||
      propertyName.includes('size') ||
      propertyName.includes('width') ||
      propertyName.includes('height') ||
      (propertyName.endsWith('-width') && propertyPath.includes('border')) ||
      fullPathString.includes('margin') ||
      fullPathString.includes('padding') ||
      fullPathString.includes('gap');
  }

  // Font tokens
  if (tokenType === 'font') {
    // Check if token is specifically font-size, font-weight, font-family, or line-height
    const isFontSize = tokenRef.includes('.size.') || tokenRef.includes('.font-size.') || tokenRef.includes('font-size');
    const isFontWeight = tokenRef.includes('.weight.') || tokenRef.includes('.font-weight.') || tokenRef.includes('font-weight');
    const isFontFamily = tokenRef.includes('.family.') || tokenRef.includes('.font-family.') || tokenRef.includes('font-family');
    const isLineHeight = tokenRef.includes('.line-height') || tokenRef.includes('line_height');
    const isLetterSpacing = tokenRef.includes('.letter-spacing') || tokenRef.includes('letter-spacing');

    // Font-family tokens should ONLY be used for font-family or family
    if (isFontFamily && (propertyName !== 'font-family' && propertyName !== 'family')) return false;

    // Font-size tokens should ONLY be used for font-size or size
    if (isFontSize && (propertyName !== 'font-size' && propertyName !== 'size')) return false;

    // Font-weight tokens should ONLY be used for font-weight or weight
    if (isFontWeight && (propertyName !== 'font-weight' && propertyName !== 'weight')) return false;

    // Line-height tokens should ONLY be used for line-height
    if (isLineHeight && propertyName !== 'line-height') return false;

    // Letter-spacing tokens should ONLY be used for letter-spacing
    if (isLetterSpacing && propertyName !== 'letter-spacing') return false;

    // General fallback: if none of the above specific types matched, ensure we don't apply to known specific slots incorrectly
    // E.g. a generic 'font' token shouldn't go to 'font-weight' if it's meant for size, but usually tokens are specific.
    // If we have a generic "font" ref without subtype info, we might be more permissive, but usually our tokens are well-typed.

    // Ensure that if property IS font-family, we ONLY accept font-family tokens
    if ((propertyName === 'font-family' || propertyName === 'family') && !isFontFamily) return false;

    // Ensure that if property IS font-weight, we ONLY accept font-weight tokens
    if ((propertyName === 'font-weight' || propertyName === 'weight') && !isFontWeight) return false;

    // Ensure that if property IS font-size, we ONLY accept font-size tokens
    if ((propertyName === 'font-size' || propertyName === 'size') && !isFontSize) return false;

    // Ensure that if property IS line-height, we ONLY accept line-height tokens
    if (propertyName === 'line-height' && !isLineHeight) return false;

    // Ensure that if property IS letter-spacing, we ONLY accept letter-spacing tokens
    if (propertyName === 'letter-spacing' && !isLetterSpacing) return false;

    return true;
  }

  // Border tokens
  if (tokenType === 'border-width') {
    return propertyName === 'width' ||
      propertyName.endsWith('-width') ||
      fullPathString.includes('width');
  }

  if (tokenType === 'border-style') {
    return propertyName === 'style' ||
      propertyName.includes('style') ||
      fullPathString.includes('style');
  }

  if (tokenType === 'border-radius') {
    return (propertyName === 'radius' || propertyName.includes('radius')) && fullPathString.includes('border');
  }

  // Shadow tokens
  if (tokenType === 'box-shadow') {
    return propertyName === 'box-shadow' || propertyName === 'shadow' || fullPathString.includes('shadow');
  }

  // Elevation tokens
  if (tokenType === 'elevation') {
    return propertyName === 'elevation' ||
      propertyName === 'shadow' ||
      propertyName === 'z-index' ||
      fullPathString.includes('elevation') ||
      fullPathString.includes('shadow');
  }

  // Opacity tokens
  if (tokenType === 'opacity') {
    return propertyName === 'opacity' || fullPathString.includes('opacity');
  }

  // Default: allow if we're not sure
  return true;
}


export default async function mobileGlobalSetup() {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 MOBILE GLOBAL SETUP - BATCH BUILD STRATEGY');
  console.log('='.repeat(80));

  const startTime = Date.now();
  const cacheDir = path.join(process.cwd(), '.test-cache');

  // Determine which mobile platforms to build for
  const platformMode = (process.env.MOBILE_PLATFORM || 'both').toLowerCase();
  const runAndroid = platformMode === 'android' || platformMode === 'both';
  const runIOS = platformMode === 'ios' || platformMode === 'both';

  // Determine whether to use BrowserStack or local emulator/devices
  const runLocal = isLocalEnv();
  const useBrowserStack = !runLocal;

  const isBrowserStackAppId = (value?: string): boolean =>
    typeof value === 'string' && value.startsWith('bs://');

  console.log(`\n🎯 Mobile platforms selected for build: ${[
    runAndroid ? 'Android' : null,
    runIOS ? 'iOS' : null,
  ]
    .filter(Boolean)
    .join(' + ') || 'none (check MOBILE_PLATFORM env)'}`);
  console.log(`🔁 Execution mode: ${runLocal ? 'LOCAL (RUN_LOCAL=true)' : 'BrowserStack'}`);

  // Precomputed batch (generated at start)
  let preSelectedTokens: Array<{ file: string; tokenRef: string; tokenType: string }> = [];
  let preTokenVariantPairs: TokenVariantPair[] = [];
  let preBatchPayload: any = undefined;
  let preMatrix: Array<any> = [];

  // Ensure cache directory exists
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  // Print batch build payload at start if present
  try {
    const batchJsonPath = path.join(cacheDir, 'batch-build.json');
    if (fs.existsSync(batchJsonPath)) {
      console.log(`\n🧾 Existing batch-build.json found at: ${batchJsonPath}`);
    } else {
      console.log('\n🧾 No existing batch-build.json found to print at start.');
    }
  } catch (e: any) {
    console.warn('⚠️  Failed to load batch-build.json at start:', e?.message || e);
  }

  // Generate batch build at the start (before baseline build)
  try {
    console.log('\n🎛️  EARLY: Generating batch build payload...');
    // For mobile flows, revert to simple behavior: use only global tokens
    // tokens/mobile/global/** JSON files
    const allTokenFilesEarly = loadAllTokensForPlatform('mobile').filter((tf) =>
      tf.file.replace(/\\/g, '/').includes('/tokens/mobile/global/')
    );
    preMatrix = Array.from(generateOrthogonalMatrix({ shuffle: true }));
    const widgetsInMatrix = Array.from(new Set(preMatrix.map((m: any) => m.widget))) as WidgetType[];
    const tokenHelperEarly = new TokenHelper(path.join(process.cwd(), 'tokens/mobile'));

    // Select tokens per type within each file (widget JSON)
    for (const tokenFile of allTokenFilesEarly) {
      const tokenReferences = tokenHelperEarly.buildTokenReferences(tokenFile.data);
      if (tokenReferences.length === 0) continue;

      // Discover candidate property paths for this widget from its component JSON
      try {
        const filePath = tokenFile.file.replace(/\\/g, '/');
        const m = filePath.match(/components\/(.+?)\//);
        if (m && m[1]) {
          const widgetName = m[1] as WidgetType;
          // Only discover for widgets known in our matrix typing
          discoverWidgetPropertyCandidates(widgetName, tokenFile.data);
        }
      } catch (e) {
        console.warn('⚠️ Failed to discover widget property candidates for', tokenFile.file, e);
      }

      const byType = groupTokenRefsByType(tokenReferences);
      for (const [tokenType, refs] of Object.entries(byType)) {
        const list = refs as string[];
        if (!list.length) continue;

        // INCREASE VOLUME: Pick up to 25 random tokens per type from this file to ensure full coverage of slots
        const maxPerFile = 25;
        let selectedForFile: string[] = [];

        if (tokenType === 'font') {
          // Special logic for font: Ensure valid coverage across subtypes (size, weight, family, line-height)
          const subtypes: Record<string, string[]> = {};

          for (const ref of list) {
            const match = ref.match(/^\{font\.([^.]+)\./);
            let subtype = match ? match[1] : 'other';

            if (subtype === 'other') {
              if (ref.includes('line-height')) subtype = 'line-height';
              else if (ref.includes('letter-spacing')) subtype = 'letter-spacing';
              else if (ref.includes('font-size')) subtype = 'font-size';
              else if (ref.includes('font-weight')) subtype = 'font-weight';
              else if (ref.includes('font-family')) subtype = 'font-family';
            }

            if (!subtypes[subtype]) subtypes[subtype] = [];
            subtypes[subtype].push(ref);
          }

          // 1. Pick at least one from each subtype found
          Object.keys(subtypes).forEach(subtype => {
            const subList = subtypes[subtype];
            if (subList.length > 0) {
              // Pick random one from this subtype
              const random = subList[Math.floor(Math.random() * subList.length)];
              selectedForFile.push(random);
            }
          });

          // 2. Fill remaining slots with random other options if we haven't hit maxPerFile
          const remaining = list.filter(r => !selectedForFile.includes(r));
          if (selectedForFile.length < maxPerFile && remaining.length > 0) {
            const needed = maxPerFile - selectedForFile.length;
            const shuffledRemaining = remaining.sort(() => Math.random() - 0.5);
            selectedForFile.push(...shuffledRemaining.slice(0, needed));
          }
        } else {
          // Standard random logic for valid non-font types
          const shuffledRefs = [...list].sort(() => Math.random() - 0.5);
          selectedForFile = shuffledRefs.slice(0, maxPerFile);
        }

        for (const tokenRef of selectedForFile) {
          // Keep one token per file+type for logging and debug (unchanged behavior)
          preSelectedTokens.push({ file: tokenFile.file, tokenRef, tokenType });

          // Register this token ONLY for widgets that allow this token type
          // This ensures tokens are only applied to compatible widgets based on WIDGET_CONFIG[widget].allowedTokenTypes
          for (const widget of widgetsInMatrix) {
            const config = WIDGET_CONFIG[widget];
            const allowedTypes = config.allowedTokenTypes || [];

            // Only add token if widget allows this token type
            if (allowedTypes.includes(tokenType as any)) {
              addWidgetToken(widget as WidgetType, tokenType, tokenRef);
            } else {
              // Skip tokens that aren't allowed for this widget
            }
          }
        }
      }
    }

    // RANDOMIZE DISTRIBUTION: Shuffle the preSelectedTokens list
    // This ensures that even with the same tokens, they "land" on different properties each run.
    preSelectedTokens.sort(() => Math.random() - 0.5);

    // DEBUG: Log breakdown of selected tokens
    const countsByType: Record<string, number> = {};
    preSelectedTokens.forEach(t => {
      countsByType[t.tokenType] = (countsByType[t.tokenType] || 0) + 1;
    });
    console.log('DEBUG: Selected tokens by type:', JSON.stringify(countsByType, null, 2));
    console.log(`DEBUG: Total valid global tokens found: ${preSelectedTokens.length}`);

    // Build token-variant mappings per widget using that widget's own matrix rows.
    const perWidgetPairs: TokenVariantPair[] = [];

    for (const [widget, byType] of tokensByWidgetAndType.entries()) {
      const widgetMatrix = preMatrix.filter((m: any) => m.widget === widget);
      if (!widgetMatrix.length) continue;

      // Debug: Log token counts for the current widget's tokens
      console.log(`[TokenGlobalSetup] Widget ${widget}: Found ${Object.keys(byType['color'] || {}).length} color tokens`);
      console.log(`[TokenGlobalSetup] Widget ${widget}: Found ${Object.keys(byType['space'] || {}).length} space tokens`);
      console.log(`[TokenGlobalSetup] Widget ${widget}: Found ${Object.keys(byType['font'] || {}).length} font tokens`);
      console.log(`[TokenGlobalSetup] Widget ${widget}: Found ${Object.keys(byType['icon'] || {}).length} icon tokens`);

      const widgetTokens: string[] = [];
      const tokenTypeOf: Record<string, string> = {};

      for (const [tokenType, refs] of Object.entries(byType)) {
        for (const ref of refs) {
          widgetTokens.push(ref);
          tokenTypeOf[ref] = tokenType;
        }
      }

      if (!widgetTokens.length) continue;

      const widgetMappings = generateTokenVariantMapping(
        widgetTokens,
        widgetMatrix,
        (tokenRef) => tokenTypeOf[tokenRef] || 'color'
      );

      // Group mappings by MatrixItem (Variant) to handle distribution contextually
      // We rely on object reference equality for matrixItem keys, which is safe here as they come from the unique preMatrix list
      const mappingsByVariant = new Map<any, typeof widgetMappings>();
      for (const m of widgetMappings) {
        if (!mappingsByVariant.has(m.matrixItem)) mappingsByVariant.set(m.matrixItem, []);
        mappingsByVariant.get(m.matrixItem)!.push(m);
      }

      for (const [variant, mappings] of mappingsByVariant.entries()) {
        const tokenTypes = Array.from(new Set(mappings.map(m => m.tokenType)));

        for (const type of tokenTypes) {
          const typeTokens = mappings.filter(m => m.tokenType === type);
          // Sort tokens deterministically to ensure consistent assignment across runs
          typeTokens.sort((a, b) => a.tokenRef.localeCompare(b.tokenRef));

          const typeSlots = getPropertyPathsForType(
            widget,
            type,
            (w, t) => widgetPropertyCandidates.get(w)?.[t] || []
          );

          if (typeSlots.length === 0) continue;

          // SLOT-CENTRIC DISTRIBUTION:
          // Iterate through every available property slot and try to fill it with a compatible token.
          for (let i = 0; i < typeSlots.length; i++) {
            const slot = typeSlots[i];

            // Auto-derive CSS property from tokenRef patterns (legacy overrides) logic
            // is handled implicitly by compatibility check or by using the slot itself.
            // But we should ensure we match against the simplified slot path.

            const compatibleTokens = typeTokens.filter(m => {
              // Check standard compatibility
              return isTokenCompatibleWithProperty(m.tokenRef, slot);
            });

            if (compatibleTokens.length > 0) {
              // Deterministically pick one token for this slot.
              // Add state-based offset to ensure different states get different token values
              const slotPath = slot.join('.');
              let stateOffset = 0;

              // Detect state from slot path and assign unique offset
              if (slotPath.includes('states.focused') || slot.some(s => s === 'focused')) {
                stateOffset = 7; // Prime number to avoid collision
              } else if (slotPath.includes('states.disabled') || slot.some(s => 'disabled')) {
                stateOffset = 13; // Different prime number
              } else if (slotPath.includes('states.hover') || slot.some(s => s === 'hover')) {
                stateOffset = 17;
              }
              // Default state: offset = 0

              // Rotate through compatible tokens with state-aware offset
              const tokenIndex = (i + stateOffset) % compatibleTokens.length;
              const selected = compatibleTokens[tokenIndex];

              perWidgetPairs.push({
                tokenRef: selected.tokenRef,
                item: variant,
                propertyPath: slot,
                tokenType: type
              });
            }
          }
        }
      }
    }

    preTokenVariantPairs = perWidgetPairs;

    console.log(`✅ Validated ${preTokenVariantPairs.length} compatible token-property pairs`);

    const mergerEarly = new BatchTokenMerger();
    preBatchPayload = mergerEarly.mergePayloads(preTokenVariantPairs, generateVariantPayload);

    // At START: also generate per-widget payload JSON files for quick inspection
    const earlyPairsByWidget = new Map<import('../../src/matrix/widgets').Widget, TokenVariantPair[]>();
    for (const pair of preTokenVariantPairs) {
      const w = pair.item.widget;
      const arr = earlyPairsByWidget.get(w) || [];
      arr.push(pair);
      earlyPairsByWidget.set(w, arr);
    }
    const earlyPerWidgetMerger = new BatchTokenMerger();
    for (const [widget, pairsForWidget] of earlyPairsByWidget.entries()) {
      const widgetPayload = earlyPerWidgetMerger.mergePayloads(pairsForWidget, generateVariantPayload);
      const widgetPayloadPath = path.join(cacheDir, `batch-payload-${widget}.json`);
      fs.writeFileSync(widgetPayloadPath, JSON.stringify(widgetPayload, null, 2));
      console.log(`📝 Early per-widget payload JSON saved to ${widgetPayloadPath}`);
    }

    const runIdEarly = `batch-${Date.now()}`;
    const batchBuildInfoEarly = {
      runId: runIdEarly,
      timestamp: new Date().toISOString(),
      counts: {
        tokenFiles: allTokenFilesEarly.length,
        combinations: preMatrix.length,
        selectedTokens: preSelectedTokens.length,
        tokenVariantPairs: preTokenVariantPairs.length
      },
      selectedTokens: preSelectedTokens,
      tokenVariantPairs: preTokenVariantPairs,
      payload: preBatchPayload
    };

    const batchJsonPathEarly = path.join(cacheDir, 'batch-build.json');
    fs.writeFileSync(batchJsonPathEarly, JSON.stringify(batchBuildInfoEarly, null, 2));
    console.log(`📝 Early batch build JSON saved to ${batchJsonPathEarly}`);

    // Additionally save just the payload for quick inspection/debugging
    const payloadOnlyPath = path.join(cacheDir, 'batch-payload.json');
    fs.writeFileSync(payloadOnlyPath, JSON.stringify(preBatchPayload, null, 2));
    console.log(`📝 Batch payload JSON (payload only) saved to ${payloadOnlyPath}`);
  } catch (e: any) {
    console.warn('⚠️  Failed early batch generation:', e?.message || e);
  }

  // Check required environment variables
  const requiredEnv = ['STUDIO_BASE_URL', 'PROJECT_ID', 'STUDIO_PROJECT_ID'];
  if (ENV.isGoogleAuth) {
    if (!ENV.googleEmail || !ENV.googlePassword) {
      requiredEnv.push('GOOGLE_EMAIL', 'GOOGLE_PASSWORD');
    }
  } else {
    requiredEnv.push('STUDIO_USERNAME', 'STUDIO_PASSWORD');
  }
  const missingEnv = requiredEnv.filter(v => !process.env[v]);

  if (missingEnv.length > 0) {
    console.error(`❌ Missing required environment variables: ${missingEnv.join(', ')}`);
    throw new Error('Missing required environment variables');
  }
  console.log(`🔐 Auth method: ${ENV.isGoogleAuth ? 'Google OAuth' : 'WaveMaker form'}`);


  // Clean up old mobile test artifacts (Playwright Alignment)
  console.log('\n🧹 Cleaning up old mobile test artifacts...');
  const artifactDirs = [
    path.join(process.cwd(), 'debug', 'logs'),
    path.join(process.cwd(), 'artifacts', 'mobile-styles'),
    path.join(process.cwd(), 'artifacts', 'mobile-reports'),
    path.join(process.cwd(), 'screenshots', 'mobile-base'),
    path.join(process.cwd(), 'screenshots', 'mobile-actual'),
    path.join(process.cwd(), 'screenshots', 'mobile-diff'),
  ];
  for (const dir of artifactDirs) {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      files.forEach(file => {
        const filePath = path.join(dir, file);
        try {
          if (fs.statSync(filePath).isFile()) {
            fs.unlinkSync(filePath);
          }
        } catch (e) { }
      });
      console.log(`   ✅ Cleared ${path.relative(process.cwd(), dir)}`);
    }
  }

  try {
    // ========== PHASE 1: BASELINE BUILD ==========
    console.log('\n📸 PHASE 1: Building Baseline Apps (Default Tokens)');
    console.log('='.repeat(80));

    // 1.1 Authenticate with Studio API
    console.log('\n🔐 Step 1.1: Authenticating with Studio...');
    const client = new StudioClient({
      baseUrl: ENV.studioBaseUrl,
      projectId: ENV.projectId
    });

    let authCookie: string;
    if (ENV.isGoogleAuth) {
      authCookie = await client.loginWithGoogle();
    } else {
      authCookie = await client.login(
        ENV.studioUsername || '',
        ENV.studioPassword || ''
      );
    }

    console.log('✅ Authentication successful');

    // Save auth cookie to cache
    fs.writeFileSync(path.join(cacheDir, 'mobile-auth-cookie.txt'), authCookie);

    // Step 1.2: Global Rollback (Reset all widgets to valid Clean State - Playwright Logic)
    console.log('\n🔄 Step 1.2: Performing Global Styles Reset (Rollback)...');
    const widgetsToReset = Object.keys(WIDGET_CONFIG);
    console.log(`   Resetting overrides for ${widgetsToReset.length} widgets: ${widgetsToReset.join(', ')}`);

    for (const widget of widgetsToReset) {
      try {
        if (widget === 'formcontrols') {
          const studioKey = getWidgetKey(widget as any);
          await client.updateComponentOverride(studioKey, {});
          console.log(`   ✓ Reverted styles for ${widget} (Studio key: ${studioKey})`);
        } else {
          await client.updateComponentOverride(widget, {});
          console.log(`   ✓ Reverted styles for ${widget}`);
        }
      } catch (err: any) {
        console.warn(`   ⚠️ Failed to revert styles for ${widget}:`, err.message);
      }
    }

    try {
      await client.publishAndBuild();
      console.log('✅ Global Styles Revert completed successfully\n');
    } catch (err: any) {
      console.warn('⚠️ Failed to publish revert state:', err.message);
    }

    // Check if baseline apps already exist
    const baselineAppsPath = path.join(cacheDir, 'mobile-baseline-apps.json');
    let skipBaselineBuild = false;
    let baselineApps: { android?: string; ios?: string } = {};

    if (fs.existsSync(baselineAppsPath)) {
      try {
        const cached = JSON.parse(fs.readFileSync(baselineAppsPath, 'utf-8'));
        // Resolve from the mode-specific sub-key if available, else fall back to top-level
        const modeKey = useBrowserStack ? 'browserstack' : 'local';
        const modeApps = cached[modeKey] || {};
        const cachedAndroid = modeApps.android || cached.android as string | undefined;
        const cachedIOS = modeApps.ios || cached.ios as string | undefined;
        const hasAndroid = runAndroid && !!cachedAndroid;
        const hasIOS = runIOS && !!cachedIOS;
        const hasAndroidBs = runAndroid && isBrowserStackAppId(cachedAndroid);
        const hasIOSBs = runIOS && isBrowserStackAppId(cachedIOS);

        const cacheReady = useBrowserStack
          ? (!runAndroid || hasAndroidBs) && (!runIOS || hasIOSBs)
          : (!runAndroid || hasAndroid) && (!runIOS || hasIOS);

        if (cacheReady && (hasAndroid || hasIOS)) {
          console.log('\n✅ Found existing baseline apps in cache:');
          if (hasAndroid) console.log(`   Android (${modeKey}): ${cachedAndroid}`);
          if (hasIOS) console.log(`   iOS (${modeKey}): ${cachedIOS}`);
          console.log('⏭️  Skipping PHASE 1 (baseline build) - using cached baseline');

          baselineApps = { android: cachedAndroid, ios: cachedIOS };
          skipBaselineBuild = true;
        } else if (useBrowserStack && cached.local?.android) {
          console.log('\n♻️ Cached local baseline found but no BrowserStack IDs for current mode; rebuilding to upload.');
        }
      } catch (e) {
        console.warn('⚠️  Failed to read cached baseline apps, will rebuild');
      }
    }

    // Initialize RN Project Manager (needed for both baseline and actual builds)
    const baseUrl = ENV.studioBaseUrl.replace(/\/$/, ''); // Remove trailing slash
    const rnManager = new RnProjectManager({
      projectId: ENV.projectId,
      studioProjectId: ENV.studioProjectId,
      username: ENV.studioUsername || '',
      password: ENV.studioPassword || '',
      baseUrl: baseUrl,
      fileServiceUrl: `${baseUrl}/file-service`
    });

    // Initialize WaveMaker CLI (needed for both baseline and actual builds)
    const wmCli = new WaveMakerCLI();

    if (!skipBaselineBuild) {
      // 1.3 Download and build baseline APK and IPA
      console.log('\n📱 Step 1.3: Downloading RN project and building baseline apps...');

      // Download and prepare baseline project (allow override via *_BASELINE)
      const baselineDir = path.join(process.cwd(), process.env.MOBILE_BUILD_DIR || 'mobile-builds', 'baseline');
      
      // Clean entire baseline directory before building to ensure fresh start
      ensureCleanDir(baselineDir);
      
      // ALWAYS use fresh RN project (no ZIP download)
      const baselineProjectPath = await rnManager.prepareProject(baselineDir);
      console.log('🚫 Skipped ZIP download → Using fresh RN baseline project');

      // Use separate build-out directories for Android and iOS to prevent
      // the iOS CLI "empty dest folder" prompt from wiping the APK.
      const baselineAndroidBuildOutDir = path.join(baselineDir, 'build-out-android');
      const baselineIosBuildOutDir = path.join(baselineDir, 'build-out-ios');
      if (runAndroid) ensureCleanDir(baselineAndroidBuildOutDir);
      if (runIOS) ensureCleanDir(baselineIosBuildOutDir);

      // Initialize WaveMaker CLI
      const wmCli = new WaveMakerCLI();

      // Build baseline APK and IPA independently per platform
      let baselineApkPath: string | undefined;
      let baselineIpaPath: string | undefined;

      if (runAndroid) {
        try {
          baselineApkPath = await wmCli.buildAndroid({
            projectPath: baselineProjectPath,
            destDir: baselineAndroidBuildOutDir,
          });
        } catch (e: any) {
          console.error('❌ Baseline Android build failed:', e?.message || e);
        }
      }

      if (runIOS) {
        try {
          baselineIpaPath = await wmCli.buildIOS({
            projectPath: baselineProjectPath,
            destDir: baselineIosBuildOutDir,
            certificatePath: process.env.IOS_P12_CERT_PATH,
            certificatePassword: process.env.IOS_P12_PASSWORD,
            provisioningProfilePath: process.env.IOS_PROVISION_PROFILE_PATH,
          });
        } catch (e: any) {
          console.error('❌ Baseline iOS build failed:', e?.message || e);
        }
      }

      if (!baselineApkPath && !baselineIpaPath) {
        throw new Error('Baseline builds failed for all selected platforms.');
      }

      console.log('✅ Baseline apps built successfully (for available platforms)');

      // 1.4 Upload baseline apps to BrowserStack + save both local and BS paths
      console.log('\n☁️  Step 1.4: Processing baseline apps...');
      const baselineApps: { android: string; ios: string } = { android: '', ios: '' };
      const baselineLocal: { android: string; ios: string } = { android: '', ios: '' };
      const baselineBrowserStack: { android: string; ios: string } = { android: '', ios: '' };
      const baselineMeta: {
        android?: BrowserStackAppUploadResponse;
        ios?: BrowserStackAppUploadResponse;
      } = {};

      // Always store local paths
      if (baselineApkPath) baselineLocal.android = baselineApkPath;
      if (baselineIpaPath) baselineLocal.ios = baselineIpaPath;

      if (useBrowserStack) {
        const bsService = new BrowserStackService();

        if (baselineApkPath) {
          try {
            const upload = await bsService.uploadAppWithMeta('android', baselineApkPath);
            baselineBrowserStack.android = upload.app_url;
            baselineMeta.android = upload;
          } catch (e: any) {
            console.error('❌ Failed to upload baseline Android app to BrowserStack:', e?.message || e);
          }
        }

        if (baselineIpaPath) {
          try {
            const upload = await bsService.uploadAppWithMeta('ios', baselineIpaPath);
            baselineBrowserStack.ios = upload.app_url;
            baselineMeta.ios = upload;
          } catch (e: any) {
            console.error('❌ Failed to upload baseline iOS app to BrowserStack:', e?.message || e);
          }
        }

        if (!baselineBrowserStack.android && !baselineBrowserStack.ios) {
          throw new Error('Baseline BrowserStack upload failed for all selected platforms.');
        }

        baselineApps.android = baselineBrowserStack.android;
        baselineApps.ios = baselineBrowserStack.ios;
        console.log('✅ Baseline apps uploaded to BrowserStack (where available)');
      } else {
        baselineApps.android = baselineLocal.android;
        baselineApps.ios = baselineLocal.ios;
        console.log('ℹ️ RUN_LOCAL=true: using local baseline paths');
      }

      // Always save both local and browserstack paths
      fs.writeFileSync(
        path.join(cacheDir, 'mobile-baseline-apps.json'),
        JSON.stringify({
          android: baselineApps.android,
          ios: baselineApps.ios,
          local: baselineLocal,
          browserstack: baselineBrowserStack,
          meta: baselineMeta,
          timestamp: new Date().toISOString(),
        }, null, 2),
      );
      console.log('✅ Baseline app paths cached (local + browserstack)');
    } // End of if (!skipBaselineBuild)

    // ========== PHASE 2: BATCH TOKEN APPLICATION ==========
    console.log('\n🎨 PHASE 2: Applying ALL Tokens in Batch');
    console.log('='.repeat(80));

    // 2.1-2.4 Use early precomputed batch payload
    console.log('\n📋 Step 2: Using precomputed batch payload from start...');
    if (!preBatchPayload || preTokenVariantPairs.length === 0) {
      throw new Error('Precomputed batch payload not available.');
    }

    // Print summary
    console.log(`   Selected tokens: ${preSelectedTokens.length}`);
    console.log(`   Token-variant pairs: ${preTokenVariantPairs.length}`);
    console.log(`   Combinations (matrix size): ${preMatrix.length}`);

    // Save batch build info again (with project metadata) and print concise summary
    const runId = `batch-${Date.now()}`;
    const batchBuildInfo = {
      runId,
      timestamp: new Date().toISOString(),
      project: {
        projectId: ENV.projectId,
        studioProjectId: ENV.studioProjectId || ENV.projectId,
        baseUrl: ENV.studioBaseUrl
      },
      counts: {
        tokenFiles: preSelectedTokens.length,
        combinations: preMatrix.length,
        selectedTokens: preSelectedTokens.length,
        tokenVariantPairs: preTokenVariantPairs.length
      },
      selectedTokens: preSelectedTokens,
      tokenVariantPairs: preTokenVariantPairs,
      payload: preBatchPayload
    };
    const batchJsonPath = path.join(cacheDir, 'batch-build.json');
    fs.writeFileSync(batchJsonPath, JSON.stringify(batchBuildInfo, null, 2));
    console.log(`📝 Saved batch build JSON to ${batchJsonPath}`);
    console.log('🧾 Batch build summary (JSON):');
    console.log(JSON.stringify({
      runId: batchBuildInfo.runId,
      timestamp: batchBuildInfo.timestamp,
      counts: batchBuildInfo.counts,
      project: batchBuildInfo.project
    }, null, 2));

    const tokenVariantPairs: TokenVariantPair[] = preTokenVariantPairs;
    const batchPayload = preBatchPayload;

    // 2.5 Apply all tokens in ONE API call PER WIDGET
    console.log('\n🚀 Step 2.5: Applying all tokens via API (per widget)...');

    // Group token-variant pairs by widget
    const pairsByWidget = new Map<import('../../src/matrix/widgets').Widget, TokenVariantPair[]>();
    for (const pair of tokenVariantPairs) {
      const w = pair.item.widget;
      const arr = pairsByWidget.get(w) || [];
      arr.push(pair);
      pairsByWidget.set(w, arr);
    }

    const perWidgetMerger = new BatchTokenMerger();

    for (const [widget, pairsForWidget] of pairsByWidget.entries()) {
      console.log(`\n🧩 Applying tokens for widget: ${widget} (pairs: ${pairsForWidget.length})`);
      const widgetPayload = perWidgetMerger.mergePayloads(pairsForWidget, generateVariantPayload);

      // Persist per-widget payload for debugging/inspection
      const widgetPayloadPath = path.join(cacheDir, `batch-payload-${widget}.json`);
      fs.writeFileSync(widgetPayloadPath, JSON.stringify(widgetPayload, null, 2));
      console.log(`📝 Saved per-widget payload JSON to ${widgetPayloadPath}`);

      if (widget === 'formcontrols' as any) {
        const studioKey = getWidgetKey(widget as any);
        await client.updateComponentOverride(studioKey, widgetPayload);
        console.log(`✅ Tokens applied for widget: ${widget} (Studio key: ${studioKey})`);
      } else {
        await client.updateComponentOverride(widget, widgetPayload);
        console.log(`✅ Tokens applied for widget: ${widget}`);
      }
    }

    await client.publishAndBuild();
    console.log('✅ All tokens applied and published');

    // Save token-variant pairs for tests to use
    fs.writeFileSync(
      path.join(cacheDir, 'batch-token-pairs.json'),
      JSON.stringify({ pairs: tokenVariantPairs }, null, 2)
    );

    // ========== PHASE 3: actual BUILD ==========
    console.log('\n📱 PHASE 3: Building actual Apps (With ALL Tokens)');
    console.log('='.repeat(80));

    // 3.1 Download and build actual APK and IPA
    console.log('\n🔨 Step 3.1: Downloading RN project and building actual apps...');

    // Download and prepare actual project (correct ZIP download flow)
    const actualDir = path.join(process.cwd(), process.env.MOBILE_BUILD_DIR || 'mobile-builds', 'actual');
    
    // Clean entire actual directory before building to ensure fresh start
    ensureCleanDir(actualDir);
    
    // 1️⃣ Trigger and WAIT for buildNativeMobileApp to produce new RN ZIP
    console.log('🚀 Triggering and polling for new RN build (With Tokens)...');
    const zipReadyUrl = await rnManager.buildNativeMobileApp('development');
    const actualZipPath = await rnManager.downloadProject(zipReadyUrl, actualDir);
    // 3️⃣ Extract ZIP → <actualDir>/rn-project (clean, single extraction)
    const actualProjectPath = await rnManager.extractZip(actualZipPath, path.join(actualDir, 'rn-project'));
    console.log('📂 Extracted RN project with applied tokens:', actualProjectPath);

    // Use separate build-out directories for Android and iOS
    const actualAndroidBuildOutDir = path.join(actualDir, 'build-out-android');
    const actualIosBuildOutDir = path.join(actualDir, 'build-out-ios');
    if (runAndroid) ensureCleanDir(actualAndroidBuildOutDir);
    if (runIOS) ensureCleanDir(actualIosBuildOutDir);

    // Build actual APK and IPA independently per platform
    let actualApkPath: string | undefined;
    let actualIpaPath: string | undefined;

    if (runAndroid) {
      try {
        actualApkPath = await wmCli.buildAndroid({
          projectPath: actualProjectPath,
          destDir: actualAndroidBuildOutDir,
        });
      } catch (e: any) {
        console.error('❌ actual Android build failed:', e?.message || e);
      }
    }

    if (runIOS) {
      try {
        actualIpaPath = await wmCli.buildIOS({
          projectPath: actualProjectPath,
          destDir: actualIosBuildOutDir,
          certificatePath: process.env.IOS_P12_CERT_PATH,
          certificatePassword: process.env.IOS_P12_PASSWORD,
          provisioningProfilePath: process.env.IOS_PROVISION_PROFILE_PATH,
        });
      } catch (e: any) {
        console.error('❌ actual iOS build failed:', e?.message || e);
      }
    }

    if (!actualApkPath && !actualIpaPath) {
      throw new Error('actual builds failed for all selected platforms.');
    }

    console.log('✅ actual apps built successfully (for available platforms)');

    // 3.2 Upload actual apps to BrowserStack + save both local and BS paths
    console.log('\n☁️  Step 3.2: Processing actual apps...');
    const actualApps: { android: string; ios: string } = { android: '', ios: '' };
    const actualLocal: { android: string; ios: string } = { android: '', ios: '' };
    const actualBrowserStack: { android: string; ios: string } = { android: '', ios: '' };
    const actualMeta: {
      android?: BrowserStackAppUploadResponse;
      ios?: BrowserStackAppUploadResponse;
    } = {};

    // Always store local paths
    if (actualApkPath) actualLocal.android = actualApkPath;
    if (actualIpaPath) actualLocal.ios = actualIpaPath;

    if (useBrowserStack) {
      const bsService = new BrowserStackService();

      if (actualApkPath) {
        try {
          const upload = await bsService.uploadAppWithMeta('android', actualApkPath);
          actualBrowserStack.android = upload.app_url;
          actualMeta.android = upload;
        } catch (e: any) {
          console.error('❌ Failed to upload actual Android app to BrowserStack:', e?.message || e);
        }
      }

      if (actualIpaPath) {
        try {
          const upload = await bsService.uploadAppWithMeta('ios', actualIpaPath);
          actualBrowserStack.ios = upload.app_url;
          actualMeta.ios = upload;
        } catch (e: any) {
          console.error('❌ Failed to upload actual iOS app to BrowserStack:', e?.message || e);
        }
      }

      if (!actualBrowserStack.android && !actualBrowserStack.ios) {
        throw new Error('actual BrowserStack upload failed for all selected platforms.');
      }

      actualApps.android = actualBrowserStack.android;
      actualApps.ios = actualBrowserStack.ios;
      console.log('✅ actual apps uploaded to BrowserStack (where available)');
    } else {
      actualApps.android = actualLocal.android;
      actualApps.ios = actualLocal.ios;
      console.log('ℹ️ RUN_LOCAL=true: using local actual paths');
    }

    // Always save both local and browserstack paths
    fs.writeFileSync(
      path.join(cacheDir, 'mobile-actual-apps.json'),
      JSON.stringify({
        android: actualApps.android,
        ios: actualApps.ios,
        local: actualLocal,
        browserstack: actualBrowserStack,
        meta: actualMeta,
        timestamp: new Date().toISOString(),
      }, null, 2),
    );
    console.log('✅ actual app paths cached (local + browserstack)');

    // ========== SUMMARY ==========
    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
    const platformCount = (runAndroid ? 1 : 0) + (runIOS ? 1 : 0);
    const totalBuilds = platformCount * 2; // baseline + actual per platform

    console.log('\n' + '='.repeat(80));
    console.log('🎉 MOBILE GLOBAL SETUP COMPLETE!');
    console.log('='.repeat(80));
    console.log(`✅ Baseline apps: Built and uploaded (platforms: ${[
      runAndroid ? 'Android' : null,
      runIOS ? 'iOS' : null,
    ]
      .filter(Boolean)
      .join(' + ')})`);
    console.log(`✅ Token count: ${tokenVariantPairs.length} tokens applied`);
    console.log(`✅ actual apps: Built and uploaded`);
    console.log(`✅ Total builds: ${totalBuilds}`);
    console.log(`✅ Duration: ${duration} minutes`);
    console.log(`✅ Ready to run ${tokenVariantPairs.length * platformCount} parallel tests!`);
    console.log('='.repeat(80) + '\n');

  } catch (error: any) {
    console.error('\n❌ Mobile global setup failed:', error.message);
    console.error(error.stack);
    throw error;
  }
}

// Allow running standalone
if (require.main === module) {
  mobileGlobalSetup()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
