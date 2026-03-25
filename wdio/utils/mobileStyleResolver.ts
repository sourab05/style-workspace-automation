import type { TokenVariantPair } from './batch-token-merger';

/**
 * Resolves which React Native style key to read from the styles JSON
 * based on tokenType and propertyPath from TokenVariantPair.
 *
 * Examples:
 *  - color + ['background']      → 'backgroundColor'
 *  - color + ['text']           → 'color'
 *  - border + ['border','color']→ 'borderColor'
 *  - opacity + ['opacity']      → 'opacity'
 */
export function resolveStyleKey(tokenType: string, propertyPath: string[]): string | null {
  const normalizedType = tokenType.toLowerCase();
  const pathKey = propertyPath.join('.').toLowerCase();

  if (normalizedType === 'color') {
    if (pathKey === 'background') {
      return 'backgroundColor';
    }
    if (pathKey === 'text') {
      return 'color';
    }
  }

  if (normalizedType === 'border') {
    if (pathKey === 'border.color' || pathKey === 'color') {
      return 'borderColor';
    }
    if (pathKey === 'border.width' || pathKey === 'width') {
      return 'borderWidth';
    }
    if (pathKey === 'border.style' || pathKey === 'style') {
      return 'borderStyle';
    }
  }

  if (normalizedType === 'opacity') {
    if (pathKey === 'opacity') {
      return 'opacity';
    }
  }

  if (normalizedType === 'box-shadow' || normalizedType === 'elevation') {
    // Framework exposes parsed shadow on parsedBoxShadow in your example JSON
    return 'parsedBoxShadow';
  }

  // Fallback: try direct match on last path segment
  const last = propertyPath[propertyPath.length - 1];
  if (last) {
    return last;
  }

  return null;
}

/**
 * Builds the variantName used in CSV from a TokenVariantPair's matrix item.
 * Format: `${widget}-${appearance}-${variant}-${state}`
 */
export function buildVariantName(pair: TokenVariantPair): string {
  const { widget, appearance, variant, state } = pair.item;
  return `${widget}-${appearance}-${variant}-${state}`;
}
