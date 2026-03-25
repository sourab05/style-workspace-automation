import { TokenSlotGenerator } from '../src/playwright/tokenSlotGenerator';
import { WIDGET_CONFIG, Widget } from '../src/matrix/widgets';
import { loadGlobalTokenMap } from '../src/playwright/globalTokenLoader';
import path from 'path';

/**
 * Script to display all test cases for all widgets
 * Uses hardcoded path: tokens/mobile/global/
 */

async function main() {
  // Load GLOBAL token map (hardcoded path: tokens/mobile/global/ → token-values-mobile.json)
  const tokenMap = loadGlobalTokenMap();
  
  console.log(`Using ${Object.keys(tokenMap).length} GLOBAL tokens from tokens/mobile/global/`);

  // Create generator
  const generator = new TokenSlotGenerator();

  console.log('');
  console.log('='.repeat(120));
  console.log('ALL WIDGETS - COMPLETE TEST CASES LIST (100% SLOT COVERAGE)');
  console.log('='.repeat(120));
  console.log('');

  const widgets = Object.keys(WIDGET_CONFIG).sort() as Widget[];
  let grandTotal = 0;
  const widgetSummaries: Array<{
    widget: Widget;
    total: number;
    byTokenType: Record<string, number>;
  }> = [];

  for (const widget of widgets) {
    const testCases = generator.generateTestCasesForWidget(widget, tokenMap);
    grandTotal += testCases.length;

    // Group by token type
    const byTokenType: Record<string, number> = {};
    testCases.forEach((tc) => {
      byTokenType[tc.tokenType] = (byTokenType[tc.tokenType] || 0) + 1;
    });

    widgetSummaries.push({
      widget,
      total: testCases.length,
      byTokenType,
    });
  }

  // Print summary table
  console.log('WIDGET TEST CASE SUMMARY:');
  console.log('');
  console.log('| Widget           | Total Tests | Color | Font | Space | Border | Icon | Other |');
  console.log('|------------------|-------------|-------|------|-------|--------|------|-------|');

  widgetSummaries.forEach((ws) => {
    const colorCount = ws.byTokenType['color'] || 0;
    const fontCount = ws.byTokenType['font'] || 0;
    const spaceCount =
      (ws.byTokenType['space'] || 0) +
      (ws.byTokenType['gap'] || 0) +
      (ws.byTokenType['padding'] || 0) +
      (ws.byTokenType['margin'] || 0);
    const borderCount =
      (ws.byTokenType['border-width'] || 0) +
      (ws.byTokenType['border-style'] || 0) +
      (ws.byTokenType['border-radius'] || 0);
    const iconCount = ws.byTokenType['icon'] || 0;
    const otherCount = ws.total - colorCount - fontCount - spaceCount - borderCount - iconCount;

    console.log(
      '| ' +
        ws.widget.padEnd(16) +
        ' | ' +
        ws.total.toString().padStart(11) +
        ' | ' +
        colorCount.toString().padStart(5) +
        ' | ' +
        fontCount.toString().padStart(4) +
        ' | ' +
        spaceCount.toString().padStart(5) +
        ' | ' +
        borderCount.toString().padStart(6) +
        ' | ' +
        iconCount.toString().padStart(4) +
        ' | ' +
        otherCount.toString().padStart(5) +
        ' |'
    );
  });

  console.log('|------------------|-------------|-------|------|-------|--------|------|-------|');
  console.log('| TOTAL            | ' + grandTotal.toString().padStart(11) + ' |       |      |       |        |      |       |');
  console.log('');

  // Detailed breakdown per widget
  console.log('');
  console.log('='.repeat(120));
  console.log('DETAILED BREAKDOWN BY WIDGET');
  console.log('='.repeat(120));
  console.log('');

  for (const widget of widgets) {
    const testCases = generator.generateTestCasesForWidget(widget, tokenMap);

    console.log(`\n${widget.toUpperCase()} (${testCases.length} test cases):`);
    console.log('-'.repeat(120));

    // Group by appearance-variant-state
    const grouped: Record<string, typeof testCases> = {};
    testCases.forEach((tc) => {
      const key = `${tc.appearance}-${tc.variant}-${tc.state}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(tc);
    });

    // Sort and display
    Object.keys(grouped)
      .sort()
      .forEach((key) => {
        const cases = grouped[key];
        console.log(`  ${key} (${cases.length} properties):`);

        // Group by token type within this variant
        const byType: Record<string, typeof cases> = {};
        cases.forEach((tc) => {
          if (!byType[tc.tokenType]) byType[tc.tokenType] = [];
          byType[tc.tokenType].push(tc);
        });

        Object.keys(byType)
          .sort()
          .forEach((tokenType) => {
            const typeCases = byType[tokenType];
            typeCases.forEach((tc) => {
              const propPath = tc.propertyPath.join('.');
              console.log(`    • ${tc.tokenType.padEnd(15)} → ${propPath.padEnd(35)}`);
            });
          });
        console.log('');
      });
  }

  console.log('');
  console.log('='.repeat(120));
  console.log('GRAND TOTAL: ' + grandTotal + ' test cases across ' + widgets.length + ' widgets');
  console.log('='.repeat(120));
  console.log('');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
