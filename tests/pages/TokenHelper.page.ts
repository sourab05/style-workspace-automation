import fs from 'fs';
import path from 'path';

/**
 * TokenHelper Page Object
 * Handles all token-related operations including:
 * - Token property path inference
 * - Token mapping building
 * - Token reference extraction
 * - Payload generation
 */
export class TokenHelper {
  private tokensDir: string;
  private tokenPropertyMapping: Record<string, string[]>;

  constructor(tokensDir?: string) {
    this.tokensDir = tokensDir || path.join(process.cwd(), 'Tokens');
    this.tokenPropertyMapping = this.buildTokenPropertyMapping();
  }

  /**
   * Infers the CSS property path for a given token reference
   * @param tokenRef - Token reference string (e.g., '{color.primary.@.value}')
   * @returns Array of CSS property names
   */
  inferPropertyPath(tokenRef: string): string[] {
    const { TokenMappingService } = require('../../src/tokens/mappingService');
    return TokenMappingService.inferPropertyPath(tokenRef);
  }

  /**
   * Recursively discovers all JSON files in a directory
   */
  private discoverJsonFiles(dir: string): string[] {
    let results: string[] = [];
    if (!fs.existsSync(dir)) return results;

    const list = fs.readdirSync(dir);
    for (const file of list) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        results = results.concat(this.discoverJsonFiles(fullPath));
      } else if (file.endsWith('.json')) {
        results.push(fullPath);
      }
    }
    return results;
  }

  /**
   * Builds a mapping of token references to CSS property paths
   * @returns Record mapping token references to property path arrays
   */
  buildTokenPropertyMapping(): Record<string, string[]> {
    const mapping: Record<string, string[]> = {};

    // Recursive search for all JSON files
    const files = this.discoverJsonFiles(this.tokensDir);

    console.log(`Loading token files from: ${this.tokensDir} (Found ${files.length} JSON files)`);

    for (const fullPath of files) {
      try {
        const raw = fs.readFileSync(fullPath, 'utf-8').trim();
        if (!raw) {
          console.warn(`Skipping empty token file: ${path.basename(fullPath)}`);
          continue;
        }

        const data = JSON.parse(raw);
        this.traverseTokens(data, [], mapping);
      } catch (err) {
        console.error(`Failed to parse token file ${path.basename(fullPath)}:`, err);
      }
    }

    return mapping;
  }

  /**
   * Recursively traverses token structure to extract references
   * @param obj - Token object to traverse
   * @param currentPath - Current path in the object tree
   * @param mapping - Mapping object to populate
   */
  private traverseTokens(obj: any, currentPath: string[], mapping: Record<string, string[]>): void {
    for (const key in obj) {
      const newPath = [...currentPath, key];

      if (obj[key] && typeof obj[key] === 'object' && 'value' in obj[key]) {
        const tokenRef = `{${newPath.join('.')}.value}`;
        mapping[tokenRef] = this.inferPropertyPath(tokenRef);
      } else if (typeof obj[key] === 'object') {
        this.traverseTokens(obj[key], newPath, mapping);
      }
    }
  }

  /**
   * Extracts all token references from a token file data object
   * @param obj - Token file data object
   * @param currentPath - Current path in the object tree
   * @returns Array of token reference strings
   */
  buildTokenReferences(obj: any, currentPath: string[] = []): string[] {
    const references: string[] = [];

    if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        const newPath = [...currentPath, key];

        // Check if this is a value node
        if (obj[key] && typeof obj[key] === 'object' && 'value' in obj[key]) {
          // Build the reference string
          const reference = `{${newPath.join('.')}.value}`;
          references.push(reference);
        } else {
          // Recurse deeper
          references.push(...this.buildTokenReferences(obj[key], newPath));
        }
      }
    }

    return references;
  }

  /**
   * Builds a nested payload structure for API submission
   * @param path - CSS property path array
   * @param ref - Token reference string
   * @param resolvedValue - Optional resolved value
   * @returns Nested payload object
   */
  buildNestedPayload(path: string[], ref: string, resolvedValue?: string): any {
    // Special handling: if mapping is just ['padding'] from space/spacer tokens,
    // expand into directional paddings (top, bottom, left, right)
    if (path.length === 1 && path[0] === 'padding') {
      return {
        padding: {
          top: { value: resolvedValue || ref },
          bottom: { value: resolvedValue || ref },
          left: { value: resolvedValue || ref },
          right: { value: resolvedValue || ref }
        }
      };
    }

    let obj: any = { value: resolvedValue || ref };
    for (let i = path.length - 1; i >= 0; i--) {
      obj = { [path[i]]: obj };
    }
    return obj;
  }

  /**
   * Gets the CSS property path for a token reference
   * @param tokenRef - Token reference string
   * @returns Array of CSS property names
   */
  getPropertyPath(tokenRef: string): string[] {
    return this.tokenPropertyMapping[tokenRef] || ['background'];
  }

  /**
   * Gets the token property mapping
   * @returns Token property mapping record
   */
  getTokenPropertyMapping(): Record<string, string[]> {
    return this.tokenPropertyMapping;
  }
}
