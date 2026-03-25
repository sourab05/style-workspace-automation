import * as fs from 'fs';
import * as path from 'path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

export interface ScreenshotComparisonResult {
  match: boolean;
  diffPixels: number;
  diffPercentage: number;
  diffImagePath?: string;
}

/**
 * Screenshot Helper Utilities
 * Handles screenshot capture, comparison, and baseline management for mobile tests
 */
export class ScreenshotHelpers {
  private baselineDir: string;
  private actualDir: string;
  private diffDir: string;

  constructor() {
    this.baselineDir = path.join(process.cwd(), 'screenshots', 'mobile-base');
    this.actualDir = path.join(process.cwd(), 'screenshots', 'mobile-actual');
    this.diffDir = path.join(process.cwd(), 'screenshots', 'mobile-diff');

    this.ensureDirectories();
  }

  /**
   * Ensures all screenshot directories exist
   */
  private ensureDirectories(): void {
    const dirs = [
      this.baselineDir,
      path.join(this.baselineDir, 'android'),
      path.join(this.baselineDir, 'ios'),
      this.actualDir,
      path.join(this.actualDir, 'android'),
      path.join(this.actualDir, 'ios'),
      this.diffDir,
      path.join(this.diffDir, 'android'),
      path.join(this.diffDir, 'ios')
    ];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Saves a baseline screenshot
   * @param screenshotBuffer Screenshot buffer from browser
   * @param platform Platform (android/ios)
   * @param name Screenshot name
   */
  async saveBaseline(screenshotBuffer: Buffer, platform: 'android' | 'ios', name: string): Promise<string> {
    const filename = `${name}.png`;
    const filepath = path.join(this.baselineDir, platform, filename);

    fs.writeFileSync(filepath, screenshotBuffer);
    console.log(`✓ Saved baseline: ${filepath}`);

    return filepath;
  }

  /**
   * Saves an actual test screenshot
   * @param screenshotBuffer Screenshot buffer from browser
   * @param platform Platform (android/ios)
   * @param name Screenshot name
   */
  async saveActual(screenshotBuffer: Buffer, platform: 'android' | 'ios', name: string): Promise<string> {
    const filename = `${name}.png`;
    const filepath = path.join(this.actualDir, platform, filename);

    fs.writeFileSync(filepath, screenshotBuffer);
    console.log(`✓ Saved actual: ${filepath}`);

    return filepath;
  }

  /**
   * Compares actual screenshot with baseline
   * @param actualPath Path to actual screenshot
   * @param platform Platform (android/ios)
   * @param name Screenshot name
   * @param threshold Difference threshold (0-1, default 0.1 = 10%)
   * @returns Comparison result
   */
  async compareWithBaseline(
    actualPath: string,
    platform: 'android' | 'ios',
    baselineName: string, // Name of the baseline file (e.g. 'button1')
    threshold: number = 0.03
  ): Promise<ScreenshotComparisonResult> {
    const baselinePath = path.join(this.baselineDir, platform, `${baselineName}.png`);
    const actualName = path.basename(actualPath, '.png');

    // Print paths before comparison
    console.log(`\n🔍 [Screenshot Comparison]`);
    console.log(`   📁 Actual:   ${actualPath}`);
    console.log(`   📁 Baseline: ${baselinePath}`);

    // Check if baseline exists
    if (!fs.existsSync(baselinePath)) {
      console.warn(`⚠️  Baseline not found: ${baselinePath}`);
      return {
        match: false,
        diffPixels: 0,
        diffPercentage: 100
      };
    }

    // Load images
    const baseline = PNG.sync.read(fs.readFileSync(baselinePath));
    const actual = PNG.sync.read(fs.readFileSync(actualPath));

    // Check dimensions match
    if (baseline.width !== actual.width || baseline.height !== actual.height) {
      console.error('Image dimensions do not match');
      return {
        match: false,
        diffPixels: baseline.width * baseline.height,
        diffPercentage: 100
      };
    }

    // Create diff image
    const { width, height } = baseline;
    const diff = new PNG({ width, height });

    // Compare images
    const diffPixels = pixelmatch(
      baseline.data,
      actual.data,
      diff.data,
      width,
      height,
      { threshold }
    );

    const totalPixels = width * height;
    const diffPercentage = (diffPixels / totalPixels) * 100;
    // Inverted logic: PASS if difference is >= threshold, FAIL if < threshold
    const match = diffPercentage >= (threshold * 100);

    // Always save diff image for traceability (using actualName to keep it unique)
    const diffImagePath = path.join(this.diffDir, platform, `${actualName}.png`);
    fs.writeFileSync(diffImagePath, PNG.sync.write(diff));

    console.log(`📊 Comparison Result for [${actualName}]:`);
    console.log(`   Actual Path:   ${actualPath}`);
    console.log(`   Baseline Path: ${baselinePath}`);
    console.log(`   Diff Pixels: ${diffPixels} / ${totalPixels}`);
    console.log(`   Diff Percentage: ${diffPercentage.toFixed(2)}%`);
    console.log(`   Match: ${match ? '✅' : '❌'} (requires: >=${threshold * 100}% difference)`);
    console.log(`   Diff Saved: ${diffImagePath}`);

    return {
      match,
      diffPixels,
      diffPercentage,
      diffImagePath
    };
  }

  /**
   * Captures and compares screenshot in one call
   * @param browser WebDriver browser instance
   * @param platform Platform (android/ios)
   * @param name Screenshot name
   * @param threshold Difference threshold
   */
  async captureAndCompare(
    browser: WebdriverIO.Browser,
    platform: 'android' | 'ios',
    name: string,
    threshold: number = 0.1
  ): Promise<ScreenshotComparisonResult> {
    // Capture screenshot
    const screenshotBuffer = Buffer.from(await browser.takeScreenshot(), 'base64');

    // Save actual
    const actualPath = await this.saveActual(screenshotBuffer, platform, name);

    // Compare with baseline
    return await this.compareWithBaseline(actualPath, platform, name, threshold);
  }

  /**
   * Gets baseline screenshot path
   * @param platform Platform (android/ios)
   * @param name Screenshot name
   */
  getBaselinePath(platform: 'android' | 'ios', name: string): string {
    return path.join(this.baselineDir, platform, `${name}.png`);
  }

  /**
   * Gets actual screenshot path
   * @param platform Platform (android/ios)
   * @param name Screenshot name
   */
  getActualPath(platform: 'android' | 'ios', name: string): string {
    return path.join(this.actualDir, platform, `${name}.png`);
  }

  /**
   * Gets diff screenshot path
   * @param platform Platform (android/ios)
   * @param name Screenshot name
   */
  getDiffPath(platform: 'android' | 'ios', name: string): string {
    return path.join(this.diffDir, platform, `${name}.png`);
  }

  /**
   * Clears all actual screenshots
   */
  clearActual(): void {
    const platforms = ['android', 'ios'];
    platforms.forEach(platform => {
      const dir = path.join(this.actualDir, platform);
      if (fs.existsSync(dir)) {
        fs.readdirSync(dir).forEach(file => {
          fs.unlinkSync(path.join(dir, file));
        });
      }
    });
    console.log('✓ Cleared actual screenshots');
  }

  /**
   * Clears all diff screenshots
   */
  clearDiff(): void {
    const platforms = ['android', 'ios'];
    platforms.forEach(platform => {
      const dir = path.join(this.diffDir, platform);
      if (fs.existsSync(dir)) {
        fs.readdirSync(dir).forEach(file => {
          fs.unlinkSync(path.join(dir, file));
        });
      }
    });
    console.log('✓ Cleared diff screenshots');
  }
}
