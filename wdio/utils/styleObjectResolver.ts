import { TokenMappingService } from '../../src/tokens/mappingService';

/**
 * Resolve a dot-separated path in a nested styles object.
 */
export function resolveDotPath(obj: unknown, dotPath: string): unknown {
  if (!dotPath) return obj;
  const segments = dotPath.split('.');
  let current: unknown = obj;
  for (const seg of segments) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
}

/**
 * Resolve an RN style value from a cached styles object.
 * Falls back to longhand keys when shorthand is absent (padding → paddingTop).
 */
export function resolveStyleValue(
  stylesObj: unknown,
  mappedPath: string,
): { value: unknown; resolvedPath: string } {
  const direct = resolveDotPath(stylesObj, mappedPath);
  if (direct !== undefined) {
    return { value: direct, resolvedPath: mappedPath };
  }

  const lastDot = mappedPath.lastIndexOf('.');
  if (lastDot === -1) {
    if (stylesObj != null && typeof stylesObj === 'object') {
      const root = stylesObj as Record<string, unknown>;
      for (const longhand of TokenMappingService.getLonghandProperties(mappedPath)) {
        if (root[longhand] !== undefined) {
          return { value: root[longhand], resolvedPath: longhand };
        }
      }
    }
    return { value: undefined, resolvedPath: mappedPath };
  }

  const prefix = mappedPath.slice(0, lastDot);
  const property = mappedPath.slice(lastDot + 1);
  const parent = resolveDotPath(stylesObj, prefix);
  if (parent != null && typeof parent === 'object') {
    const parentObj = parent as Record<string, unknown>;
    if (parentObj[property] !== undefined) {
      return { value: parentObj[property], resolvedPath: mappedPath };
    }
    for (const longhand of TokenMappingService.getLonghandProperties(property)) {
      if (parentObj[longhand] !== undefined) {
        return { value: parentObj[longhand], resolvedPath: `${prefix}.${longhand}` };
      }
    }
  }

  return { value: undefined, resolvedPath: mappedPath };
}

export function formatResolvedValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}
