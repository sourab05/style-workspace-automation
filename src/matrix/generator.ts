import { WIDGET_CONFIG, Widget, Appearance, Variant, State, TokenType, MatrixItem, } from './widgets';

const TOKEN_TYPES: TokenType[] = [
  'color',
  'font',
  'border-width',
  'border-style',
  'border-radius',
  'margin',
  'gap',
  'space',
  'elevation',
  'box-shadow',
  'opacity',
  'icon',
  'asterisk-color',
  'padding'
];

/**
 * Generates all valid 5-dimensional combinations for widgets, appearances, variants, states, and token types.
 * Yields only valid combinations based on WIDGET_CONFIG.
 */
export function* generateMatrix(): Generator<MatrixItem> {
  for (const widget of Object.keys(WIDGET_CONFIG) as Widget[]) {
    const config = WIDGET_CONFIG[widget];
    for (const appearance of config.appearances) {
      const variants = config.variants[appearance] || [];
      for (const variant of variants) {
        for (const state of config.states) {
          for (const tokenType of TOKEN_TYPES) {
            // Only yield if the tokenType is allowed for this widget
            if (config.allowedTokenTypes && config.allowedTokenTypes.includes(tokenType)) {
              yield {
                widget,
                appearance,
                variant,
                state,
                tokenType
              };
            }
          }
        }
      }
    }
  }
}

/**
 * Generates an orthogonal array of test combinations for efficient coverage.
 * Uses a balanced approach to ensure each dimension is tested with different values.
 * This dramatically reduces the number of test cases while maintaining coverage.
 * 
 * @param options - Configuration options:
 *   - shuffle: If true, randomizes the mapping between variants and token types (useful for mobile setup).
 */
export function* generateOrthogonalMatrix(options: { shuffle?: boolean } = {}): Generator<MatrixItem> {
  const widgets = Object.keys(WIDGET_CONFIG) as Widget[];

  for (const widget of widgets) {
    const config = WIDGET_CONFIG[widget];

    // Collect all valid combinations for this widget
    let combinations: Array<{ appearance: Appearance, variant: Variant, state: State }> = [];

    for (const appearance of config.appearances) {
      const variants = config.variants[appearance] || [];

      if (variants.length === 0) {
        continue;
      }

      for (const variant of variants) {
        for (const state of config.states) {
          combinations.push({ appearance, variant, state });
        }
      }
    }

    // Filter TOKEN_TYPES based on widget config
    let allowedTypes = TOKEN_TYPES.filter(t =>
      !config.allowedTokenTypes || config.allowedTokenTypes.includes(t)
    );

    if (allowedTypes.length === 0) continue;

    // Optional Shuffle: varies the mapping between (variant, state) and (tokenType)
    if (options.shuffle) {
      // Fisher-Yates shuffle for combinations
      for (let i = combinations.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [combinations[i], combinations[j]] = [combinations[j], combinations[i]];
      }
      // Shuffle allowedTypes too
      for (let i = allowedTypes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allowedTypes[i], allowedTypes[j]] = [allowedTypes[j], allowedTypes[i]];
      }
    }

    // For carousel/tabbar, we want full Cartesian mapping to cover all properties in all states
    if (widget === 'carousel' || widget === 'tabbar') {
      for (const combo of combinations) {
        for (const tokenType of allowedTypes) {
          yield {
            widget,
            appearance: combo.appearance,
            variant: combo.variant,
            state: combo.state,
            tokenType
          };
        }
      }
      continue;
    }

    // GUARANTEED COVERAGE (Orthogonal): Ensure every allowed token type gets at least one slot
    const itemsNeeded = Math.max(combinations.length, allowedTypes.length);

    for (let i = 0; i < itemsNeeded; i++) {
      const combo = combinations[i % combinations.length];
      const tokenType = allowedTypes[i % allowedTypes.length];

      yield {
        widget,
        appearance: combo.appearance,
        variant: combo.variant,
        state: combo.state,
        tokenType
      };
    }
  }
}

/**
 * Finds the group a given variant belongs to.
 * For button variants, they all belong to the "status" group.
 * @param variant The variant to find the group for.
 * @returns The name of the variant group.
 */
function getVariantGroup(variant: Variant): string {
  const sizeVariants = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'media-heading', 'p'];
  if (sizeVariants.includes(variant)) {
    return 'size';
  }
  const shapeVariants = ['circle', 'rounded'];
  if (shapeVariants.includes(variant)) {
    return 'shape';
  }
  return 'status';
}


/**
 * Creates a shortened, key-friendly version of a widget name.
 * @param widget The widget name.
 * @returns A shortened key (e.g., 'button' -> 'btn').
 */
export function getWidgetKey(widget: Widget): string {
  const keyMap: Partial<Record<Widget, string>> = {
    button: 'btn',
    cards: 'card',
    formcontrols: 'form-controls',
    'form-wrapper': 'form',
    radioset: 'radiobutton',
    'dropdown-menu': 'dropdown'
  };
  return keyMap[widget] || widget;
}

/**
 * Computes the final flattened property path for a given matrix item and token.
 * This replicates the transformation logic from generateVariantPayload to determine
 * the actual CSS property that will be modified, for use in test naming and reporting.
 * 
 * @param item The matrix item containing widget, appearance, variant, state, and tokenType
 * @param initialPropertyPath The initial property path from the token
 * @param tokenRef The token reference being applied
 * @returns The final flattened property path as a string (e.g., 'header.background-color')
 */
export function computeFinalPropertyPath(
  item: MatrixItem,
  initialPropertyPath: string[],
  tokenRef: string
): string {
  // Create a copy to avoid mutating the input
  let propertyPath = [...initialPropertyPath];

  // Apply the same transformations as generateVariantPayload
  // CRITICAL FIX: Enforce correct property path for special token types
  if (item.tokenType === 'asterisk-color') {
    propertyPath = ['asterisk', 'color'];
  } else if (item.tokenType === 'margin') {
    propertyPath = ['margin'];
  } else if (['padding', 'space', 'spacer'].includes(item.tokenType)) {
    propertyPath = ['padding'];
  }

  // Determine property slots using centralized distributor
  const { getPropertyPathsForType } = require('../../wdio/utils/mobileTokenDistributor');
  const slots = getPropertyPathsForType(item.widget, item.tokenType);

  // Check if token's initial property path explicitly matches one of the valid slots
  const initialJoined = initialPropertyPath.join('.');
  let isExplicitSlot = false;

  // Flatten slots for comparison
  const flatSlots = slots.map((s: string[]) => s.join('.'));

  if (flatSlots.includes(initialJoined)) {
    isExplicitSlot = true;
  }

  // Special handling for partial matches (like button colors) if exact match fails
  if (!isExplicitSlot && item.widget === 'button' && item.tokenType === 'color') {
    // Button color slots are simple ['background'], ['color'], ['border.color']
    // Sometimes input path is 'background.color' which maps to 'background'
    // We rely on hashing for non-explicit matches generally.
  }

  // Cards font mapping: collapse to title/subtitle only
  if (item.widget === 'cards' && item.tokenType === 'font') {
    const fontSlots = ['title', 'subtitle'];
    const matched = fontSlots.find(slot => initialJoined.startsWith(slot));
    if (matched) {
      return matched;
    }
    // Fallback to round robin
    const hash = tokenRef.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const subSlot = fontSlots[hash % fontSlots.length];
    return subSlot;
  }

  // Cards box-shadow mapping: align to configured "shadow" slot
  if (item.widget === 'cards' && item.tokenType === 'box-shadow') {
    return 'shadow';
  }

  if (isExplicitSlot) {
    return initialJoined;
  } else {
    // Round-robin selection based on token hash
    const hash = tokenRef.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const selectedSlot = flatSlots[hash % flatSlots.length];
    return selectedSlot;
  }
}


/**
 * Generates a payload structure for a specific matrix item (widget-appearance-variant-state combination).
 * This creates the nested structure needed to apply tokens to a specific widget variant.
 * 
 * Supports three widget structure types:
 * 1. direct-mapping: { widget: { mapping: {...} } } - for widgets like accordion, anchor
 * 2. appearance-mapping: { widget: { appearances: { [appearance]: { mapping: {...} } } } } - for card
 * 3. variant-groups: { widget: { appearances: { [appearance]: { variantGroups: {...} } } } } - for btn, checkbox (default)
 * 
 * @param item The matrix item containing widget, appearance, variant, and state
 * @param propertyPath The CSS property path (e.g., ['background'], ['color', '@'], ['border', 'color'])
 * @param tokenRef The token reference to apply (e.g., '{color.background.btn.primary.default.value}')
 * @returns A nested payload object with the correct structure
 */
export function generateVariantPayload(
  item: MatrixItem,
  propertyPath: string[],
  tokenRef: string,
  existingPayload: Record<string, any> = {}
): Record<string, any> {
  const widgetKey = getWidgetKey(item.widget);
  const { getWidgetStructureType } = require('./widgets');
  let structureType = getWidgetStructureType(item.widget);

  // Special Case: Elevated button uses appearance-mapping, others use variantGroups
  if (item.widget === 'button' && item.appearance === 'elevated') {
    structureType = 'appearance-mapping';
  }
  // Special Case: Picture thumbnail uses appearance-mapping, default uses variantGroups
  if (item.widget === 'picture' && item.appearance === 'thumbnail') {
    structureType = 'appearance-mapping';
  }

  const groupName = getVariantGroup(item.variant);

  // Use computeFinalPropertyPath to get the transformed property path
  // This eliminates code duplication and ensures consistency
  // Skip margin tokens for tabs to avoid unexpected padding entries
  if (item.widget === 'tabs' && item.tokenType === 'margin') {
    return existingPayload;
  }

  const finalPath = computeFinalPropertyPath(item, propertyPath, tokenRef);
  propertyPath = finalPath.split('.');

  // Widgets that support directional padding/margin (top, bottom, left, right)
  const expandedWidgets = [''];
  const supportsExpansion = expandedWidgets.includes(item.widget);

  // Build the nested value structure from property path
  const buildNestedValue = (path: string[], tokenValue: string): any => {
    if (path.length === 0) {
      return { value: tokenValue };
    }

    // Handle @ as a literal key in the path
    if (path[0] === '@') {
      if (path.length === 1) {
        return { '@': { value: tokenValue } };
      }
      return { '@': buildNestedValue(path.slice(1), tokenValue) };
    }

    // Handle padding/margin expansion into directional properties for supported widgets
    if (path.length === 1 && (path[0] === 'padding' || path[0] === 'margin') && supportsExpansion) {
      const prop = path[0];
      return {
        [prop]: {
          top: { value: tokenValue },
          bottom: { value: tokenValue },
          left: { value: tokenValue },
          right: { value: tokenValue },
        },
      };
    }

    // Bottomsheet margin: emit left/right and scalar margin
    if (item.widget === 'bottomsheet' && path.length === 1 && path[0] === 'margin') {
      return {
        margin: {
          left: { value: tokenValue },
          right: { value: tokenValue },
          value: tokenValue,
        },
      };
    }

    // Single path element
    if (path.length === 1) {
      return { [path[0]]: { value: tokenValue } };
    }

    // Recursive nesting for multi-level paths
    return { [path[0]]: buildNestedValue(path.slice(1), tokenValue) };
  };

  const nestedValue = buildNestedValue(propertyPath, tokenRef);

  let payload: Record<string, any>;

  // Structure type 1: Direct mapping (anchor)
  // Format: { widget: { mapping: { property: { value: token } } } }
  if (structureType === 'direct-mapping') {
    payload = {
      [widgetKey]: {
        mapping: nestedValue
      }
    };
  }
  // Structure type 2: Hybrid mapping (accordion)
  // Supports both appearance-specific mapping AND root-level mapping
  // - Custom appearances (not in standard set): { widget: { appearances: { [appearance]: { mapping: {...} } } } }
  // - Standard appearances (filled, outlined, standard, etc.): { widget: { mapping: {...} } }
  // - States are nested under mapping.states.{state} for non-default states
  else if (structureType === 'hybrid-mapping') {
    const appearanceStr = String(item.appearance);
    // Standard appearance types that should use root-level mapping
    const standardAppearances = ['default', 'filled', 'outlined', 'standard', 'text', 'fab', 'icon'];
    let isCustomAppearance = !standardAppearances.includes(appearanceStr);

    // Special Case: formcontrols treats ALL appearances except 'standard' as custom (nested)
    // even though 'text', 'number' etc might be in standardAppearances list.
    if (item.widget === 'formcontrols' && appearanceStr !== 'standard') {
      isCustomAppearance = true;
    }

    // Handle states for hybrid-mapping
    let mappingContent: any;
    if (item.state !== 'default') {
      // Non-default state: nest under states
      mappingContent = {
        states: {
          [item.state]: nestedValue
        }
      };
    } else {
      // Default state: use nestedValue directly
      mappingContent = nestedValue;
    }

    if (isCustomAppearance) {
      // Appearance-specific mapping (for custom appearances like 'test')
      payload = {
        [widgetKey]: {
          appearances: {
            [item.appearance]: {
              mapping: mappingContent
            }
          }
        }
      };
    } else {
      // Root-level mapping (for standard appearances)
      payload = {
        [widgetKey]: {
          mapping: mappingContent
        }
      };
    }
  }
  // Structure type 3: Appearance-based mapping (card)
  // Format: { widget: { appearances: { [appearance]: { mapping: { property: { value: token } } } } } }
  else if (structureType === 'appearance-mapping') {
    payload = {
      [widgetKey]: {
        appearances: {
          [item.appearance]: {
            mapping: nestedValue
          }
        }
      }
    };
  }
  // Structure type 4: Variant groups (btn, checkbox, radio - default)
  // Format: { widget: { appearances: { [appearance]: { variantGroups: { [group]: { [variant]: {...} } } } } } }
  else {
    // Build the variant node structure
    // - For "default" state: properties go directly under variant
    // - For other states (hover, disabled, etc.): properties go under variant → states → stateName
    let variantNode: Record<string, any>;

    if (item.state === 'default') {
      // Default state: properties directly under variant
      variantNode = nestedValue;
    } else {
      // Non-default state: nest under "states"
      variantNode = {
        states: {
          [item.state]: nestedValue
        }
      };
    }

    payload = {
      [widgetKey]: {
        appearances: {
          [item.appearance]: {
            variantGroups: {
              [groupName]: {
                [item.variant]: variantNode
              }
            }
          }
        }
      }
    };
  }

  // Deep merge into existingPayload
  const deepMerge = (target: any, source: any): any => {
    for (const key of Object.keys(source)) {
      if (source[key] instanceof Object) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        deepMerge(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
    return target;
  };

  const merged = deepMerge(existingPayload, payload);

  // Metadata is not attached to payload to avoid interfering with API calls
  // Instead, it's stored separately in the test pairs
  return { ...merged };
}

/**
 * Generates a mapping of all token-variant combinations.
 * This creates a comprehensive mapping showing which tokens should be tested with which variants.
 * @param tokens Array of token references to map
 * @param matrix Array of matrix items (widget combinations)
 * @param getTokenTypeFromToken Function to determine token type from token reference
 * @returns Array of token-variant pair mappings
 */
export function generateTokenVariantMapping(
  tokens: string[],
  matrix: MatrixItem[],
  getTokenTypeFromToken: (tokenRef: string) => string
): Array<{ tokenRef: string, matrixItem: MatrixItem, tokenType: string }> {
  const mappings: Array<{ tokenRef: string, matrixItem: MatrixItem, tokenType: string }> = [];

  // 1. Group tokens by tokenType for efficient lookup
  const tokensByType: Record<string, string[]> = {};
  for (const tokenRef of tokens) {
    const tokenType = getTokenTypeFromToken(tokenRef);
    if (!tokensByType[tokenType]) {
      tokensByType[tokenType] = [];
    }
    tokensByType[tokenType].push(tokenRef);
  }

  // 2. EXHAUSTIVE MAPPING: Map every token to EVERY matching matrix slot
  // This ensures 100% coverage for every selected token across various appearances/variants/states.
  const matchedTypes = new Set<string>();
  const availableTypes = new Set(Object.keys(tokensByType));

  for (const item of matrix) {
    const tokenType = item.tokenType;
    const tokensOfType = tokensByType[tokenType];

    if (tokensOfType && tokensOfType.length > 0) {
      matchedTypes.add(tokenType);
      // Map EACH token of this type to this matrix slot
      for (const tokenRef of tokensOfType) {
        mappings.push({
          tokenRef,
          matrixItem: item,
          tokenType
        });
      }
    }
  }

  // Log coverage summary
  const missedTypes = Array.from(availableTypes).filter(t => !matchedTypes.has(t));
  if (missedTypes.length > 0) {
    console.log(`⚠️  Selected tokens of types [${missedTypes.join(', ')}] could not be matched to any matrix slots (check widget configs).`);
  }

  console.log(`✓ Generated ${mappings.length} exhaustive mappings from ${tokens.length} tokens and ${matrix.length} matrix items`);
  return mappings;
}

/**
 * Distributes selected tokens to widgets based on their allowed token types.
 * For each widget:
 * 1. Finds which token types the widget allows (from WIDGET_CONFIG[widget].allowedTokenTypes)
 * 2. Filters selected tokens to keep only those with allowed types
 * 3. Applies all allowed tokens to that widget using round-robin assignment to matrix items
 * 
 * @param selectedTokens Array of selected tokens with their metadata
 * @param getTokenTypeFromToken Function to determine token type from token reference
 * @returns Array of token-widget-matrixItem mappings
 */
export function distributeTokensToWidgets(
  selectedTokens: Array<{ tokenRef: string; tokenType: string; file: string }>,
  getTokenTypeFromToken: (tokenRef: string) => string
): Array<{ tokenRef: string, matrixItem: MatrixItem, tokenType: string, widget: Widget }> {
  const mappings: Array<{ tokenRef: string, matrixItem: MatrixItem, tokenType: string, widget: Widget }> = [];

  // For each widget in the system
  const widgets = Object.keys(WIDGET_CONFIG) as Widget[];

  for (const widget of widgets) {
    const config = WIDGET_CONFIG[widget];
    const allowedTokenTypes = config.allowedTokenTypes || [];

    // Filter selected tokens to keep only those with allowed types for this widget
    const allowedTokens = selectedTokens.filter(token =>
      allowedTokenTypes.includes(token.tokenType as TokenType)
    );

    if (allowedTokens.length === 0) {
      console.log(`No allowed tokens for widget: ${widget}`);
      continue;
    }

    // Generate matrix items for this widget only
    const widgetMatrixItems: MatrixItem[] = [];

    for (const appearance of config.appearances) {
      const variants = config.variants[appearance] || [];
      for (const variant of variants) {
        for (const state of config.states) {
          for (const tokenType of allowedTokenTypes) {
            widgetMatrixItems.push({
              widget,
              appearance,
              variant,
              state,
              tokenType
            });
          }
        }
      }
    }

    // Apply all matrix items for this widget, picking tokens in round-robin fashion
    const tokenIndicesByType: Record<string, number> = {};

    for (const item of widgetMatrixItems) {
      const targetType = item.tokenType;

      // Find eligible tokens for this matrix slot
      const eligibleTokens = allowedTokens.filter(token => {
        // Allow 'space' and 'spacer' tokens to match various spacing slots
        if (token.tokenType === 'space' || token.tokenType === 'spacer') {
          return ['space', 'spacer', 'margin', 'padding'].includes(targetType);
        }
        return token.tokenType === targetType;
      });

      if (eligibleTokens.length === 0) {
        // No tokens for this specific slot type, skip this matrix item
        continue;
      }

      // Round-robin selection of tokens for this matrix item
      const currentIndex = tokenIndicesByType[targetType] || 0;
      const token = eligibleTokens[currentIndex % eligibleTokens.length];
      tokenIndicesByType[targetType] = currentIndex + 1;

      mappings.push({
        tokenRef: token.tokenRef,
        matrixItem: item,
        tokenType: token.tokenType,
        widget
      });
    }

    console.log(`✓ Widget ${widget}: Assigned ${widgetMatrixItems.length} matrix items using ${allowedTokens.length} tokens`);
  }

  return mappings;
}

// Define types for the nested payload structure for better type safety
type TokenValue = { value: string };
type StateNode = Record<State, { background: TokenValue; textColor: TokenValue }>;
type VariantNode = Record<Variant, StateNode>;
type GroupNode = Record<string, VariantNode>;
type AppearanceNode = Record<Appearance, { variantGroups: GroupNode }>;

/**
 * Generates a single, nested JSON payload for all widget combinations.
 * This structure is suitable for defining design tokens.
 */
export function generatePayload(): Record<string, any> {
  const payload: Record<string, any> = {};

  for (const widget of Object.keys(WIDGET_CONFIG) as Widget[]) {
    const config = WIDGET_CONFIG[widget];
    const widgetKey = getWidgetKey(widget);
    payload[widgetKey] = { appearances: {} };

    for (const appearance of config.appearances) {
      const appearanceNode: { variantGroups: Record<string, any> } = { variantGroups: {} };
      payload[widgetKey].appearances[appearance] = appearanceNode;

      const variants: string[] = config.variants[appearance] || [];
      for (const variant of variants) {
        // Get the group name from the widget config if available, otherwise fallback to getVariantGroup
        const groupName =
          (config.variants &&
            config.variants[appearance] &&
            (config.variants[appearance] as Record<string, any>)[variant]) ||
          getVariantGroup(variant as Variant);

        // Initialize the group if it doesn't exist
        if (!appearanceNode.variantGroups[groupName]) {
          appearanceNode.variantGroups[groupName] = {};
        }
        const groupNode = appearanceNode.variantGroups[groupName];

        // Initialize the variant object within the group
        const variantNode: Record<string, any> = {};
        groupNode[variant] = variantNode;

        for (const state of config.states) {
          // Create the final leaf node with a placeholder token value
          variantNode[state] = {
            background: {
              // This format mimics the example provided.
              value: `{color.background.${widgetKey}.${variant}.${state}.value}`,
            },
            textColor: {
              value: `{color.text.${widgetKey}.${variant}.${state}.value}`,
            },
          };
        }
      }
    }
  }
  return payload;
}
