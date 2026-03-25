import fs from 'fs';
import path from 'path';
import { TokenSlotGenerator } from '../src/playwright/tokenSlotGenerator';

/**
 * Script to generate token slot test cases
 * 
 * Usage:
 *   npm run build:token-map mobile     # First generate token values map
 *   npm run generate:slot-tests        # Then generate test cases
 * 
 * Output:
 *   - .test-cache/slot-test-cases.json  # All test cases
 *   - Console: Coverage report
 */

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('🎯 GENERATING SLOT-BASED TEST CASES');
  console.log('='.repeat(80));

  // Load GLOBAL token map (hardcoded path: tokens/mobile/global/)
  const { loadGlobalTokenMap } = require('../src/playwright/globalTokenLoader');
  const tokenMap = loadGlobalTokenMap();
  
  console.log(`✅ Loaded ${Object.keys(tokenMap).length} GLOBAL tokens from tokens/mobile/global/`);

  // Initialize generator
  const generator = new TokenSlotGenerator();

  // Generate test cases
  console.log('\n📋 Generating test cases from widget-token-slots.json...');
  const testCases = generator.generateAllTestCases(tokenMap);

  // Generate coverage report
  const coverageReport = generator.generateCoverageReport(testCases);
  console.log(coverageReport);

  // Save test cases
  const cacheDir = path.join(process.cwd(), '.test-cache');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  const outputPath = path.join(cacheDir, 'slot-test-cases.json');
  generator.saveTestCases(testCases, outputPath);

  // Generate summary by widget
  const testCasesByWidget = new Map<string, number>();
  const testCasesByTokenType = new Map<string, number>();

  for (const testCase of testCases) {
    testCasesByWidget.set(
      testCase.widget,
      (testCasesByWidget.get(testCase.widget) || 0) + 1
    );
    testCasesByTokenType.set(
      testCase.tokenType,
      (testCasesByTokenType.get(testCase.tokenType) || 0) + 1
    );
  }

  console.log('\n📊 Test Cases by Widget:');
  for (const [widget, count] of Array.from(testCasesByWidget.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${widget.padEnd(20)}: ${count.toString().padStart(4)} test cases`);
  }

  console.log('\n📊 Test Cases by Token Type:');
  for (const [tokenType, count] of Array.from(testCasesByTokenType.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${tokenType.padEnd(20)}: ${count.toString().padStart(4)} test cases`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ SLOT TEST CASES GENERATED SUCCESSFULLY!');
  console.log('='.repeat(80));
  console.log(`📁 Output: ${outputPath}`);
  console.log(`📊 Total test cases: ${testCases.length}`);
  console.log(`🎯 Widgets covered: ${testCasesByWidget.size}`);
  console.log(`🎨 Token types used: ${testCasesByTokenType.size}`);
  console.log('='.repeat(80) + '\n');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('\n❌ Failed to generate test cases:', error);
    process.exit(1);
  });
}
