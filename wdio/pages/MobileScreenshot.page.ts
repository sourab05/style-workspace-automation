import * as path from 'path';
import {
  captureCompareAndSaveDiffMobile,
  captureScreenshot,
  compareScreenshots,
  createOrUpdateBaseline,
  ScreenshotComparisonResult,
  ScreenshotDiffOptions,
} from '../utils/Utils';

// Declare WebdriverIO global
declare let driver: WebdriverIO.Browser;

/**
 * Mobile Screenshot Testing Page Object
 * Provides high-level methods for screenshot capture, comparison, and assertion
 * Integrates with the mobile screenshot utilities
 */
export class MobileScreenshotPage {

  /**
   * Captures screenshot of element and compares with baseline
   * @param element WebdriverIO Element to capture
   * @param screenshotName Descriptive name for the screenshot
   * @param options Optional configuration for comparison
   * @returns Comparison result
   */
  async captureAndCompare(
    element: WebdriverIO.Element,
    screenshotName: string,
    options?: ScreenshotDiffOptions
  ): Promise<ScreenshotComparisonResult> {
    console.log(`\n📸 Capturing: ${screenshotName}`);

    const result = await captureCompareAndSaveDiffMobile(
      element,
      screenshotName,
      options
    );

    this.logComparisonResult(result);
    return result;
  }

  /**
   * Captures screenshot without comparison (first-run baseline)
   * @param element WebdriverIO Element to capture
   * @param screenshotName Descriptive name for the screenshot
   * @returns Path to saved screenshot
   */
  async captureBaseline(
    element: WebdriverIO.Element,
    screenshotName: string
  ): Promise<string> {
    console.log(`\n📸 Capturing Baseline: ${screenshotName}`);

    const screenshotPath = await captureScreenshot(element, screenshotName);
    console.log(`   ✅ Saved to: ${screenshotPath}`);

    return screenshotPath;
  }

  /**
   * Compares two existing screenshots
   * @param actualPath Path to actual screenshot
   * @param baselinePath Path to baseline screenshot
   * @param diffPath Path where diff will be saved
   * @param threshold Pixel difference threshold
   * @returns Comparison result
   */
  async compareScreenshots(
    actualPath: string,
    baselinePath: string,
    diffPath: string,
    threshold?: number
  ): Promise<ScreenshotComparisonResult> {
    console.log(`\n🔍 Comparing Screenshots`);
    console.log(`   Actual: ${actualPath}`);
    console.log(`   Baseline: ${baselinePath}`);

    const result = await compareScreenshots(
      actualPath,
      baselinePath,
      diffPath,
      threshold
    );

    this.logComparisonResult(result);
    return result;
  }

  /**
   * Updates baseline screenshot
   * @param actualPath Path to actual screenshot
   * @param baselinePath Path where baseline should be updated
   */
  async updateBaseline(
    actualPath: string,
    baselinePath: string
  ): Promise<void> {
    console.log(`\n🔄 Updating Baseline`);
    console.log(`   From: ${actualPath}`);
    console.log(`   To: ${baselinePath}`);

    await createOrUpdateBaseline(actualPath, baselinePath);
    console.log(`   ✅ Baseline updated`);
  }

  /**
   * Validates screenshot matches baseline
   * @param element Element to capture
   * @param screenshotName Screenshot name
   * @param options Optional configuration
   * @returns True if match
   */
  async isScreenshotValid(
    element: WebdriverIO.Element,
    screenshotName: string,
    options?: ScreenshotDiffOptions
  ): Promise<boolean> {
    const result = await this.captureAndCompare(element, screenshotName, options);
    return result.match;
  }

  /**
   * Captures screenshots of multiple elements for batch comparison
   * @param elements Array of elements to capture
   * @param names Array of screenshot names (must match elements length)
   * @param options Optional configuration
   * @returns Array of comparison results
   */
  async batchCaptureAndCompare(
    elements: WebdriverIO.Element[],
    names: string[],
    options?: ScreenshotDiffOptions
  ): Promise<ScreenshotComparisonResult[]> {
    console.log(`\n📸 Batch Capture: ${names.length} screenshots`);

    const results: ScreenshotComparisonResult[] = [];

    for (let i = 0; i < elements.length; i++) {
      try {
        const result = await this.captureAndCompare(
          elements[i],
          names[i],
          options
        );
        results.push(result);
        console.log(`   ✅ ${names[i]}: ${result.match ? 'PASS' : 'MISMATCH'}`);
      } catch (error: any) {
        console.error(`   ❌ ${names[i]}: ${error.message}`);
      }
    }

    this.logBatchSummary(results, names);
    return results;
  }

  /**
   * Captures screenshots of components by selector pattern
   * @param selectors Array of WebdriverIO selectors
   * @param names Array of screenshot names
   * @param options Optional configuration
   * @returns Array of comparison results
   */
  async batchCaptureBySelectors(
    selectors: string[],
    names: string[],
    options?: ScreenshotDiffOptions
  ): Promise<ScreenshotComparisonResult[]> {
    console.log(`\n📸 Batch Capture by Selectors: ${selectors.length} screenshots`);

    const results: ScreenshotComparisonResult[] = [];

    for (let i = 0; i < selectors.length; i++) {
      try {
        const element = await driver.$(selectors[i]);
        const result = await this.captureAndCompare(element, names[i], options);
        results.push(result);
        console.log(`   ✅ ${names[i]}: ${result.match ? 'PASS' : 'MISMATCH'}`);
      } catch (error: any) {
        console.error(`   ❌ ${names[i]}: ${error.message}`);
      }
    }

    this.logBatchSummary(results, names);
    return results;
  }

  /**
   * Validates a component state matches expected screenshot
   * @param element Element to validate
   * @param screenshotName Screenshot name
   * @param shouldMatch Whether screenshot should match (default: true)
   * @param threshold Optional pixel threshold
   * @returns True if validation passes
   */
  async validateComponentState(
    element: WebdriverIO.Element,
    screenshotName: string,
    shouldMatch: boolean = true,
    threshold?: number
  ): Promise<boolean> {
    const result = await this.captureAndCompare(element, screenshotName, { threshold });

    const isValid = result.match === shouldMatch;

    if (isValid) {
      console.log(`   ✅ Component state is ${shouldMatch ? 'valid' : 'expected to differ'}`);
    } else {
      console.log(`   ❌ Component state validation failed`);
      console.log(`      Expected match: ${shouldMatch}, Actual: ${result.match}`);
    }

    return isValid;
  }

  /**
   * Compares two component states and verifies they differ
   * @param element1 First element
   * @param element2 Second element
   * @param name1 First screenshot name
   * @param name2 Second screenshot name
   * @returns True if states differ as expected
   */
  async validateStateDifference(
    element1: WebdriverIO.Element,
    element2: WebdriverIO.Element,
    name1: string,
    name2: string
  ): Promise<boolean> {
    console.log(`\n📸 Validating State Difference`);
    console.log(`   State 1: ${name1}`);
    console.log(`   State 2: ${name2}`);

    // Capture both states
    const path1 = await captureScreenshot(element1, `${name1}_for_comparison`);
    const path2 = await captureScreenshot(element2, `${name2}_for_comparison`);

    // Compare
    const platform = process.env.PLATFORM_NAME || 'android';
    const diffPath = path.join(
      process.cwd(),
      'screenshots/mobile-diff',
      platform,
      `${name1}_vs_${name2}_${platform}.png`
    );

    const result = await compareScreenshots(path2, path1, diffPath);

    const isDifferent = result.diffPixels > 0;

    if (isDifferent) {
      console.log(`   ✅ States differ as expected`);
      console.log(`      Diff Pixels: ${result.diffPixels} (${result.diffPercentage}%)`);
    } else {
      console.log(`   ❌ States are identical when they should differ`);
    }

    return isDifferent;
  }

  /**
   * Validates responsive design by capturing at different viewport sizes
   * @param element Element to capture
   * @param screenshotBaseName Base name for screenshots
   * @param viewportSizes Array of viewport sizes to test
   * @returns Results for each viewport
   */
  async validateResponsiveDesign(
    element: WebdriverIO.Element,
    screenshotBaseName: string,
    viewportSizes: { width: number; height: number }[]
  ): Promise<{ size: string; result: ScreenshotComparisonResult }[]> {
    console.log(`\n📱 Validating Responsive Design: ${screenshotBaseName}`);
    console.log(`   Viewport Sizes: ${viewportSizes.length}`);

    const results: { size: string; result: ScreenshotComparisonResult }[] = [];

    for (const size of viewportSizes) {
      try {
        // Set viewport size
        await driver.setWindowSize(size.width, size.height);
        console.log(`   Testing: ${size.width}x${size.height}`);

        // Capture screenshot
        const sizeName = `${size.width}x${size.height}`;
        const result = await this.captureAndCompare(
          element,
          `${screenshotBaseName}_${sizeName}`
        );

        results.push({ size: sizeName, result });
        console.log(`      ${result.match ? '✅' : '⚠️ '} ${sizeName}: ${result.match ? 'PASS' : 'MISMATCH'}`);
      } catch (error: any) {
        console.error(`   ❌ ${size.width}x${size.height}: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Validates design token application through screenshot
   * @param element Element with token-based styling
   * @param screenshotName Screenshot name
   * @param tokenName Token name for reference
   * @param expectedValue Expected token value (optional)
   * @returns Comparison result
   */
  async validateTokenApplication(
    element: WebdriverIO.Element,
    screenshotName: string,
    tokenName: string,
    expectedValue?: string
  ): Promise<ScreenshotComparisonResult> {
    console.log(`\n🎨 Validating Token Application`);
    console.log(`   Token: ${tokenName}`);
    console.log(`   Screenshot: ${screenshotName}`);
    if (expectedValue) {
      console.log(`   Expected Value: ${expectedValue}`);
    }

    const result = await this.captureAndCompare(element, screenshotName);

    if (result.match) {
      console.log(`   ✅ Token '${tokenName}' applied correctly`);
    } else {
      console.log(`   ⚠️  Token '${tokenName}' may have visual differences`);
    }

    return result;
  }

  /**
   * Generates HTML report of screenshot comparisons
   * @param results Array of comparison results
   * @param outputPath Path to save HTML report
   */
  generateReport(
    results: (ScreenshotComparisonResult & { name: string })[],
    outputPath: string
  ): void {
    console.log(`\n📊 Generating Screenshot Report`);

    const passed = results.filter(r => r.match).length;
    const failed = results.filter(r => !r.match).length;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Mobile Screenshot Regression Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .header { background: #333; color: white; padding: 20px; border-radius: 5px; }
    .summary { margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 5px; }
    .result { margin: 20px 0; padding: 15px; border-left: 4px solid #ddd; }
    .result.pass { border-left-color: #4CAF50; background: #f1f8f6; }
    .result.fail { border-left-color: #f44336; background: #fdf1f0; }
    .screenshot { max-width: 100%; margin: 10px 0; border: 1px solid #ddd; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f5f5f5; font-weight: bold; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📱 Mobile Screenshot Regression Report</h1>
    <p>Generated: ${new Date().toISOString()}</p>
  </div>
  
  <div class="summary">
    <h2>Summary</h2>
    <p><strong>Total Tests:</strong> ${results.length}</p>
    <p style="color: #4CAF50;"><strong>Passed:</strong> ${passed}</p>
    <p style="color: #f44336;"><strong>Failed:</strong> ${failed}</p>
    <p><strong>Pass Rate:</strong> ${((passed / results.length) * 100).toFixed(2)}%</p>
  </div>
  
  <h2>Detailed Results</h2>
  <table>
    <tr>
      <th>Component</th>
      <th>Status</th>
      <th>Diff Pixels</th>
      <th>Diff %</th>
    </tr>
    ${results.map(r => `
    <tr>
      <td>${r.name}</td>
      <td style="color: ${r.match ? '#4CAF50' : '#f44336'}">${r.match ? '✅ PASS' : '❌ FAIL'}</td>
      <td>${r.diffPixels}</td>
      <td>${r.diffPercentage.toFixed(2)}%</td>
    </tr>
    `).join('')}
  </table>
  
  <h2>Failures</h2>
  ${failed > 0 ? `
    ${results.filter(r => !r.match).map(r => `
    <div class="result fail">
      <h3>❌ ${r.name}</h3>
      <p><strong>Diff Pixels:</strong> ${r.diffPixels}</p>
      <p><strong>Diff Percentage:</strong> ${r.diffPercentage.toFixed(2)}%</p>
      ${r.actualImagePath ? `<p><strong>Actual:</strong> ${r.actualImagePath}</p>` : ''}
      ${r.baselineImagePath ? `<p><strong>Baseline:</strong> ${r.baselineImagePath}</p>` : ''}
      ${r.diffImagePath ? `<p><strong>Diff Image:</strong> ${r.diffImagePath}</p>` : ''}
    </div>
    `).join('')}
  ` : '<p>✅ No failures!</p>'}
  
</body>
</html>
    `.trim();

    const fs = require('fs');
    fs.writeFileSync(outputPath, html);
    console.log(`   ✅ Report saved to: ${outputPath}`);
  }

  /**
   * Logs comparison result
   */
  private logComparisonResult(result: ScreenshotComparisonResult): void {
    console.log(`   Result: ${result.match ? '✅ MATCH' : '⚠️  MISMATCH'}`);
    console.log(`   Diff Pixels: ${result.diffPixels}`);
    console.log(`   Diff Percentage: ${result.diffPercentage}%`);
  }

  /**
   * Logs batch summary
   */
  private logBatchSummary(
    results: ScreenshotComparisonResult[],
    names: string[]
  ): void {
    const passed = results.filter(r => r.match).length;
    const failed = results.filter(r => !r.match).length;

    console.log(`\n   📊 Batch Summary:`);
    console.log(`      Total: ${results.length}`);
    console.log(`      Passed: ${passed} (${((passed / results.length) * 100).toFixed(1)}%)`);
    console.log(`      Failed: ${failed} (${((failed / results.length) * 100).toFixed(1)}%)`);

    if (failed > 0) {
      console.log(`\n   ⚠️  Mismatches:`);
      results.forEach((r, i) => {
        if (!r.match) {
          console.log(`      - ${names[i]}: ${r.diffPixels} pixels differ (${r.diffPercentage}%)`);
        }
      });
    }
  }
}
