import { MatrixItem } from '../../src/matrix/widgets';

export interface TokenVariantPair {
  tokenRef: string;
  item: MatrixItem;
  propertyPath: string[];
  tokenType: string;
}

/**
 * Batch Token Merger
 * Merges multiple token-variant payloads into a single API payload
 * for efficient building (build once with all tokens applied)
 */
export class BatchTokenMerger {
  
  /**
   * Merges multiple token-variant payloads into one consolidated payload
   * @param tokenVariantPairs Array of token-variant pairs to merge
   * @param generateVariantPayload Function that generates a single payload
   * @returns Merged payload with all tokens applied
   */
  mergePayloads(
    tokenVariantPairs: TokenVariantPair[],
    generateVariantPayload: (item: MatrixItem, propertyPath: string[], tokenRef: string) => Record<string, any>
  ): Record<string, any> {
    const mergedPayload: Record<string, any> = {};
    
    console.log(`\n🔄 Merging ${tokenVariantPairs.length} token-variant pairs...`);
    
    for (const pair of tokenVariantPairs) {
      const singlePayload = generateVariantPayload(pair.item, pair.propertyPath, pair.tokenRef);
      this.deepMerge(mergedPayload, singlePayload);
      
      console.log(`   ✓ Merged ${pair.tokenRef} → ${pair.item.widget}-${pair.item.appearance}-${pair.item.variant}-${pair.item.state}`);
    }
    
    console.log(`\n✅ Successfully merged ${tokenVariantPairs.length} payloads`);
    
    return mergedPayload;
  }
  
  /**
   * Deep merge utility that handles nested objects
   * Recursively merges source into target without overwriting existing values
   * @param target Target object to merge into
   * @param source Source object to merge from
   */
  private deepMerge(target: any, source: any): void {
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (this.isObject(source[key]) && !Array.isArray(source[key])) {
          // If source[key] is an object, recursively merge
          if (!target[key]) {
            target[key] = {};
          }
          this.deepMerge(target[key], source[key]);
        } else {
          // Otherwise, directly assign the value
          target[key] = source[key];
        }
      }
    }
  }
  
  /**
   * Checks if a value is a plain object
   * @param obj Value to check
   * @returns True if value is a plain object
   */
  private isObject(obj: any): boolean {
    return obj !== null && typeof obj === 'object' && obj.constructor === Object;
  }
  
  /**
   * Validates that merged payload has no conflicts
   * @param tokenVariantPairs Array of pairs to validate
   * @returns Array of potential conflicts
   */
  validateNoConflicts(tokenVariantPairs: TokenVariantPair[]): string[] {
    const conflicts: string[] = [];
    const pathMap = new Map<string, string>();
    
    for (const pair of tokenVariantPairs) {
      const pathKey = this.generatePathKey(pair.item, pair.propertyPath);
      
      if (pathMap.has(pathKey)) {
        const existingToken = pathMap.get(pathKey);
        conflicts.push(
          `Conflict detected: ${pair.tokenRef} and ${existingToken} both target ${pathKey}`
        );
      } else {
        pathMap.set(pathKey, pair.tokenRef);
      }
    }
    
    return conflicts;
  }
  
  /**
   * Generates a unique path key for conflict detection
   * @param item Matrix item
   * @param propertyPath Property path
   * @returns Unique path key
   */
  private generatePathKey(item: MatrixItem, propertyPath: string[]): string {
    return `${item.widget}.${item.appearance}.${item.variant}.${item.state}.${propertyPath.join('.')}`;
  }
  
  /**
   * Prints a summary of the merged payload structure
   * @param payload Merged payload
   */
  printPayloadSummary(payload: Record<string, any>): void {
    console.log('\n📦 Merged Payload Summary:');
    console.log(JSON.stringify(payload, null, 2));
    
    const stats = this.analyzePayload(payload);
    console.log('\n📊 Payload Statistics:');
    console.log(`   - Total widgets: ${stats.widgets}`);
    console.log(`   - Total appearances: ${stats.appearances}`);
    console.log(`   - Total variants: ${stats.variants}`);
    console.log(`   - Total token applications: ${stats.tokenApplications}`);
  }
  
  /**
   * Analyzes payload structure for statistics
   * @param payload Payload to analyze
   * @returns Statistics object
   */
  private analyzePayload(payload: Record<string, any>): {
    widgets: number;
    appearances: number;
    variants: number;
    tokenApplications: number;
  } {
    let widgets = 0;
    let appearances = 0;
    let variants = 0;
    let tokenApplications = 0;
    
    for (const widgetKey in payload) {
      widgets++;
      const widget = payload[widgetKey];
      
      if (widget.appearances) {
        for (const appearanceKey in widget.appearances) {
          appearances++;
          const appearance = widget.appearances[appearanceKey];
          
          if (appearance.variantGroups) {
            for (const groupKey in appearance.variantGroups) {
              const group = appearance.variantGroups[groupKey];
              
              for (const variantKey in group) {
                variants++;
                const variant = group[variantKey];
                
                // Count token applications (states with values)
                for (const stateKey in variant) {
                  if (variant[stateKey] && typeof variant[stateKey] === 'object') {
                    tokenApplications++;
                  }
                }
              }
            }
          }
        }
      }
    }
    
    return { widgets, appearances, variants, tokenApplications };
  }
}
