import { TokenSlotGenerator } from '../src/playwright/tokenSlotGenerator';
import { loadGlobalTokenMap } from '../src/playwright/globalTokenLoader';
import path from 'path';

/**
 * Script to display all button test cases
 * Uses hardcoded path: tokens/mobile/global/
 */

async function main() {
  // Load GLOBAL token map (hardcoded path: tokens/mobile/global/ → token-values-mobile.json)
  const tokenMap = loadGlobalTokenMap();
  
  console.log(`Using ${Object.keys(tokenMap).length} GLOBAL tokens from tokens/mobile/global/`);

  // Create generator
  const generator = new TokenSlotGenerator();

  // Generate test cases for button widget
  const buttonTestCases = generator.generateTestCasesForWidget('button', tokenMap);

  console.log('');
  console.log('='.repeat(120));
  console.log('BUTTON WIDGET - ALL TEST CASES (100% SLOT COVERAGE)');
  console.log('='.repeat(120));
  console.log('');
  console.log(`Total Test Cases: ${buttonTestCases.length}`);
  console.log('');

  // Group by appearance-variant-state for better readability
  const grouped: Record<string, typeof buttonTestCases> = {};
  buttonTestCases.forEach((tc) => {
    const key = `${tc.appearance}-${tc.variant}-${tc.state}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(tc);
  });

  console.log('Test Cases by Appearance-Variant-State:');
  console.log('');

  // Sort keys and display
  Object.keys(grouped)
    .sort()
    .forEach((key) => {
      const cases = grouped[key];
      console.log(`${key} (${cases.length} properties):`);
      cases.forEach((tc) => {
        const propPath = tc.propertyPath.join('.');
        const tokenShort = tc.tokenRef.substring(0, 60);
        console.log(
          `  • ${tc.tokenType.padEnd(15)} → ${propPath.padEnd(30)} | Token: ${tokenShort}`
        );
      });
      console.log('');
    });

  // Summary by token type
  const byTokenType: Record<string, number> = {};
  buttonTestCases.forEach((tc) => {
    byTokenType[tc.tokenType] = (byTokenType[tc.tokenType] || 0) + 1;
  });

  console.log('='.repeat(120));
  console.log('SUMMARY BY TOKEN TYPE:');
  console.log('');
  Object.entries(byTokenType)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`  ${type.padEnd(20)}: ${count.toString().padStart(3)} test cases`);
    });
  console.log('');
  console.log('='.repeat(120));
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
