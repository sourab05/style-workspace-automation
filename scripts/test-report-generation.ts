import { PlaywrightTokenTestReporter } from '../src/playwright/tokenTestReporter';
import fs from 'fs';
import path from 'path';

/**
 * Test script to verify report generation works correctly
 */

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 TESTING PLAYWRIGHT REPORT GENERATION');
  console.log('='.repeat(80) + '\n');

  // Create mock test cases
  const mockTestCases = [
    {
      widget: 'button' as any,
      tokenType: 'color' as any,
      propertyPath: ['background'],
      appearance: 'filled',
      variant: 'primary',
      state: 'default',
      tokenRef: '{color.primary.@.value}',
      testId: 'test1'
    },
    {
      widget: 'button' as any,
      tokenType: 'font' as any,
      propertyPath: ['font-size'],
      appearance: 'filled',
      variant: 'primary',
      state: 'default',
      tokenRef: '{font.size.14.value}',
      testId: 'test2'
    },
  ];

  // Create reporter
  const reporter = new PlaywrightTokenTestReporter(mockTestCases);
  console.log('✅ Reporter created with', mockTestCases.length, 'test cases');

  // Record mock PASS result
  reporter.recordResult({
    testId: 'button-filled-primary-default-color-background',
    widget: 'button' as any,
    appearance: 'filled',
    variant: 'primary',
    state: 'default',
    tokenType: 'color' as any,
    propertyPath: 'background',
    tokenRef: '{color.primary.@.value}',
    expectedValue: '#FF7250',
    canvas: {
      status: 'PASS',
      actualValue: '#FF7250',
      error: null,
      visualChange: true,
      diffPixels: 100,
    },
    preview: {
      status: 'PASS',
      actualValue: '#FF7250',
      error: null,
      visualChange: true,
      diffPixels: 95,
    },
    overallStatus: 'PASS',
    timestamp: new Date().toISOString(),
  });

  // Record mock FAIL result
  reporter.recordResult({
    testId: 'button-filled-primary-default-font-font-size',
    widget: 'button' as any,
    appearance: 'filled',
    variant: 'primary',
    state: 'default',
    tokenType: 'font' as any,
    propertyPath: 'font-size',
    tokenRef: '{font.size.14.value}',
    expectedValue: '14px',
    canvas: {
      status: 'FAIL',
      actualValue: '16px',
      error: 'Expected: 14px, Got: 16px',
      visualChange: true,
      diffPixels: 50,
    },
    preview: {
      status: 'PASS',
      actualValue: '14px',
      error: null,
      visualChange: true,
      diffPixels: 45,
    },
    overallStatus: 'FAIL',
    timestamp: new Date().toISOString(),
  });

  console.log('✅ Recorded 2 test results (1 PASS, 1 FAIL)');

  // Create output directory
  const outputDir = path.join(process.cwd(), 'artifacts', 'test-playwright-reports');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('\n📊 Generating reports to:', outputDir);
  console.log('-'.repeat(80));

  // Generate comparison table
  reporter.saveComparisonTable('button' as any, outputDir);

  // Generate overall summary
  reporter.saveOverallSummary(outputDir);

  // Export JSON
  reporter.exportToJson(outputDir);

  console.log('\n✅ All reports generated successfully!');

  // List generated files
  const files = fs.readdirSync(outputDir);
  console.log('\n📋 Generated files:');
  files.forEach((f: string) => {
    const filePath = path.join(outputDir, f);
    const stat = fs.statSync(filePath);
    console.log(`  - ${f} (${stat.size} bytes)`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('✅ REPORT GENERATION TEST COMPLETE');
  console.log('='.repeat(80) + '\n');

  // Show sample report content
  const comparisonTablePath = path.join(outputDir, 'button-playwright-token-validation.txt');
  if (fs.existsSync(comparisonTablePath)) {
    console.log('\n📄 SAMPLE REPORT CONTENT:');
    console.log('-'.repeat(80));
    const content = fs.readFileSync(comparisonTablePath, 'utf-8');
    console.log(content);
  }
}

main().catch((error) => {
  console.error('\n❌ Report generation test failed:', error);
  process.exit(1);
});
