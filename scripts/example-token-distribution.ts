import { distributeTokensToWidgets } from '../src/matrix/generator';
import fs from 'fs';
import path from 'path';

/**
 * Example script demonstrating token distribution to widgets
 * 
 * This shows how to:
 * 1. Read selected tokens from global setup (selectedTokensData.tokens)
 * 2. Distribute tokens to widgets based on WIDGET_CONFIG[widget].allowedTokenTypes
 * 3. Apply all allowed tokens to each widget using round-robin assignment
 */

async function main() {
  console.log('🚀 Token Distribution Example\n');

  // Step 1: Read selected tokens from global setup
  const cacheDir = path.join(process.cwd(), '.test-cache');
  const selectedTokensFile = path.join(cacheDir, 'selected-tokens.json');

  if (!fs.existsSync(selectedTokensFile)) {
    console.error('❌ Selected tokens file not found. Run global setup first.');
    process.exit(1);
  }

  const selectedTokensData = JSON.parse(fs.readFileSync(selectedTokensFile, 'utf-8'));
  const selectedTokens = selectedTokensData.tokens;

  console.log(`📋 Loaded ${selectedTokens.length} selected tokens from global setup\n`);

  // Step 2: Helper function to get token type from token reference
  const getTokenTypeFromToken = (tokenRef: string): string => {
    const tokenMatch = tokenRef.match(/^\{([^}]+)\}/);
    if (!tokenMatch) return 'color';

    const parts = tokenMatch[1].split('.');
    if (parts.length >= 2) {
      const firstTwo = `${parts[0]}-${parts[1]}`;
      if (['border-width', 'border-style', 'border-radius', 'box-shadow'].includes(firstTwo)) {
        return firstTwo;
      }
      return parts[0];
    }
    return parts[0];
  };

  // Step 3: Distribute tokens to widgets
  console.log('📊 Distributing tokens to widgets...\n');
  
  const mappings = distributeTokensToWidgets(selectedTokens, getTokenTypeFromToken);

  console.log(`\n✅ Distribution complete: ${mappings.length} token-widget mappings created\n`);

  // Step 4: Display results grouped by widget
  console.log('📈 Distribution Summary by Widget:\n');
  
  const byWidget = mappings.reduce((acc, mapping) => {
    if (!acc[mapping.widget]) {
      acc[mapping.widget] = [];
    }
    acc[mapping.widget].push(mapping);
    return acc;
  }, {} as Record<string, typeof mappings>);

  for (const widget in byWidget) {
    const widgetMappings = byWidget[widget];
    console.log(`\n🎨 ${widget.toUpperCase()}`);
    console.log(`   Total tokens: ${widgetMappings.length}`);
    
    // Group by token type
    const byType = widgetMappings.reduce((acc, m) => {
      if (!acc[m.tokenType]) acc[m.tokenType] = 0;
      acc[m.tokenType]++;
      return acc;
    }, {} as Record<string, number>);
    
    console.log(`   Token types:`);
    for (const tokenType in byType) {
      console.log(`      - ${tokenType}: ${byType[tokenType]} tokens`);
    }
    
    // Show first 3 examples
    console.log(`   Examples:`);
    widgetMappings.slice(0, 3).forEach((m, idx) => {
      const matrixKey = `${m.matrixItem.appearance}-${m.matrixItem.variant}-${m.matrixItem.state}`;
      console.log(`      ${idx + 1}. ${m.tokenRef} → ${matrixKey} (${m.tokenType})`);
    });
    
    if (widgetMappings.length > 3) {
      console.log(`      ... and ${widgetMappings.length - 3} more`);
    }
  }

  // Step 5: Save detailed mappings to file
  const outputDir = path.join(process.cwd(), 'debug');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputFile = path.join(outputDir, 'token-widget-distribution.json');
  fs.writeFileSync(outputFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    totalMappings: mappings.length,
    byWidget: Object.keys(byWidget).map(widget => ({
      widget,
      tokenCount: byWidget[widget].length,
      tokenTypes: Object.keys(byWidget[widget].reduce((acc, m) => {
        acc[m.tokenType] = true;
        return acc;
      }, {} as Record<string, boolean>))
    })),
    mappings: mappings.map(m => ({
      tokenRef: m.tokenRef,
      tokenType: m.tokenType,
      widget: m.widget,
      matrixItem: {
        widget: m.matrixItem.widget,
        appearance: m.matrixItem.appearance,
        variant: m.matrixItem.variant,
        state: m.matrixItem.state,
        tokenType: m.matrixItem.tokenType
      }
    }))
  }, null, 2));

  console.log(`\n\n💾 Detailed mappings saved to: ${path.relative(process.cwd(), outputFile)}`);
  console.log('\n✅ Token distribution example complete!');
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
