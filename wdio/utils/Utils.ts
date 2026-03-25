
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import path from 'path';
import { exec, execSync } from 'child_process';

import * as dotenv from 'dotenv';

import fs from 'fs-extra';
import { parse } from 'csv-parse/sync';
import { createObjectCsvWriter as createCsvWriter } from 'csv-writer';
import * as os from 'os';
import { addAttachment, addFeature } from '@wdio/allure-reporter';

// Declare WebdriverIO globals
declare let driver: WebdriverIO.Browser;
declare let browser: WebdriverIO.Browser;
declare function expect(value: any): any;
declare function $(selector: string): any;

dotenv.config();
const platformName = process.env.PLATFORM_NAME || 'android';
const projectName = process.env.PROJECT_NAME;
const DEFAULT_TIMEOUT = 50000;
const MAX_TIMEOUT = 60000;
const SWIPE_DELAY = 1000;

const project = process.env.PROJECT_NAME;
import util from 'util';
import { existsSync } from 'fs';

const execPromise = util.promisify(exec);

// ==================== Mobile Screenshot Types & Interfaces ====================

/**
 * Platform selector type: can be a string selector or WebdriverIO element
 */
export type PlatformSelector = string;

/**
 * Type guard to determine if a value is a PlatformSelector (string selector).
 * Returns true when the provided value is a string (selector), false otherwise.
 */
export function isPlatformSelector(value: any): value is PlatformSelector {
    return typeof value === 'string';
}

/**
 * Result object from screenshot comparison operations
 */
export interface ScreenshotComparisonResult {
    /** Whether the screenshots match within the threshold */
    match: boolean;
    /** Number of pixels that differ between screenshots */
    diffPixels: number;
    /** Percentage of pixels that differ */
    diffPercentage: number;
    /** Path to the generated diff image (if differences found) */
    diffImagePath?: string;
    /** Path to the actual screenshot captured */
    actualImagePath?: string;
    /** Path to the baseline image used for comparison */
    baselineImagePath?: string;
}

/**
 * Options for screenshot comparison operations
 */
export interface ScreenshotDiffOptions {
    /** Pixel threshold for match detection (0-1, default: 0) */
    threshold?: number;
    /** Whether to auto-create baseline if it doesn't exist */
    autoCreateBaseline?: boolean;
    /** Whether to automatically update baseline if differences found */
    autoUpdateBaseline?: boolean;
}

// ==================== Mobile Screenshot Directory Management ====================

/**
 * Ensures all required mobile screenshot directories exist
 * Creates platform-specific subdirectories (android/ios) under each
 */
export async function ensureScreenshotDirs(): Promise<void> {
    const screenshotDir = path.join(process.cwd(), 'screenshots');
    const mobileBaselineDir = path.join(screenshotDir, 'mobile-baseline');
    const mobileActualDir = path.join(screenshotDir, 'mobile-actual');
    const mobileDiffDir = path.join(screenshotDir, 'mobile-diff');

    const platforms = ['android', 'ios'];
    const dirs = [
        screenshotDir,
        mobileBaselineDir,
        mobileActualDir,
        mobileDiffDir,
        ...platforms.map(p => path.join(mobileBaselineDir, p)),
        ...platforms.map(p => path.join(mobileActualDir, p)),
        ...platforms.map(p => path.join(mobileDiffDir, p)),
    ];

    for (const dir of dirs) {
        await fs.ensureDir(dir);
    }

    await log(`Mobile screenshot directories ensured at ${screenshotDir}`);
}

/**
 * Gets the platform-specific screenshot directory path
 * Automatically detects platform from PLATFORM_NAME or existing platformName variable
 */
function getScreenshotDirPath(type: 'baseline' | 'actual' | 'diff', platform?: string): string {
    const platform_name = platform || process.env.PLATFORM_NAME || platformName;
    const typeDir = `mobile-${type}`;
    return path.join(process.cwd(), 'screenshots', typeDir, platform_name);
}

/**
 * Gets normalized screenshot filename with platform suffix and .png extension
 */
function normalizeScreenshotFileName(name: string, platform?: string): string {
    const platform_name = platform || process.env.PLATFORM_NAME || platformName;
    const cleanName = name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
    return `${cleanName}_${platform_name}.png`;
}

// ==================== Mobile Screenshot Capture & Comparison ====================

/**
 * Captures a screenshot of a WebdriverIO element and saves it
 * Automatically detects platform and saves to mobile-actual directory
 * 
 * @param element WebdriverIO Element to capture
 * @param name Descriptive name for the screenshot
 * @param platform Optional platform override ('android' or 'ios')
 * @returns Path to the saved screenshot file
 */
export async function captureScreenshot(element: WebdriverIO.Element | PlatformSelector, name: string, platform?: string): Promise<string> {
    const elem = await getElement(element);
    const fileName = normalizeScreenshotFileName(name, platform);
    const dirPath = getScreenshotDirPath('actual', platform);
    const filePath = path.join(dirPath, fileName);

    await fs.ensureDir(dirPath);
    await elem.saveScreenshot(filePath);
    await log(`Screenshot captured for '${name}' at ${filePath}`);

    return filePath;
}

/**
 * Compares two screenshots using pixel-level matching with pixelmatch
 * Generates a visual diff PNG showing the differences
 * 
 * @param actualPath Path to the actual screenshot
 * @param baselinePath Path to the baseline screenshot
 * @param diffPath Path where the diff image will be saved
 * @param threshold Pixel difference threshold (0-1, default: 0 for exact match)
 * @returns ScreenshotComparisonResult with match status and pixel differences
 */
export async function compareScreenshots(actualPath: string, baselinePath: string, diffPath: string, threshold: number = 0): Promise<ScreenshotComparisonResult> {
    try {
        if (!fs.existsSync(actualPath)) {
            throw new Error(`Actual screenshot not found: ${actualPath}`);
        }

        if (!fs.existsSync(baselinePath)) {
            await log(`Baseline not found at ${baselinePath}. Creating baseline from actual screenshot.`);
            await fs.ensureDir(path.dirname(baselinePath));
            await fs.copy(actualPath, baselinePath);

            return {
                match: false,
                diffPixels: 0,
                diffPercentage: 0,
                actualImagePath: actualPath,
                baselineImagePath: baselinePath,
            };
        }

        const actualImage = PNG.sync.read(fs.readFileSync(actualPath));
        const baselineImage = PNG.sync.read(fs.readFileSync(baselinePath));

        // Ensure images have same dimensions
        if (actualImage.width !== baselineImage.width || actualImage.height !== baselineImage.height) {
            throw new Error(`Image dimensions mismatch: actual (${actualImage.width}x${actualImage.height}) vs baseline (${baselineImage.width}x${baselineImage.height})`);
        }

        const { width, height } = actualImage;
        const diff = new PNG({ width, height });
        const numDiffPixels = pixelmatch(actualImage.data, baselineImage.data, diff.data, width, height, { threshold });

        const totalPixels = width * height;
        const diffPercentage = (numDiffPixels / totalPixels) * 100;
        const isMatch = numDiffPixels === 0;

        // Save diff image only if there are differences
        if (numDiffPixels > 0) {
            await fs.ensureDir(path.dirname(diffPath));
            fs.writeFileSync(diffPath, PNG.sync.write(diff));
        }

        const result: ScreenshotComparisonResult = {
            match: isMatch,
            diffPixels: numDiffPixels,
            diffPercentage: parseFloat(diffPercentage.toFixed(2)),
            actualImagePath: actualPath,
            baselineImagePath: baselinePath,
            diffImagePath: numDiffPixels > 0 ? diffPath : undefined,
        };

        await log(`Screenshot comparison complete: ${isMatch ? 'MATCH' : 'MISMATCH'} (${numDiffPixels} pixels differ, ${diffPercentage.toFixed(2)}%)`);
        return result;
    } catch (error) {
        await log(`Error comparing screenshots: ${error}`);
        throw error;
    }
}

/**
 * Creates or updates a baseline screenshot from an actual screenshot
 * Used for establishing new baselines or updating existing ones
 * 
 * @param actualPath Path to the actual/current screenshot
 * @param baselinePath Path where baseline should be created/updated
 */
export async function createOrUpdateBaseline(actualPath: string, baselinePath: string): Promise<void> {
    try {
        if (!fs.existsSync(actualPath)) {
            throw new Error(`Source screenshot not found: ${actualPath}`);
        }

        await fs.ensureDir(path.dirname(baselinePath));
        await fs.copy(actualPath, baselinePath, { overwrite: true });
        await log(`Baseline created/updated at ${baselinePath}`);
    } catch (error) {
        await log(`Error updating baseline: ${error}`);
        throw error;
    }
}

/**
 * Comprehensive mobile screenshot capture, comparison, and diff generation
 * Automatically handles directory management and baseline creation
 * Integrates with Allure reporting for test attachments
 * 
 * @param element WebdriverIO Element to capture
 * @param name Descriptive name for the screenshot
 * @param options Additional comparison options
 * @returns ScreenshotComparisonResult with comparison details
 */
export async function captureCompareAndSaveDiffMobile(
    element: WebdriverIO.Element | PlatformSelector,
    name: string,
    options: ScreenshotDiffOptions = {}
): Promise<ScreenshotComparisonResult> {
    const {
        threshold = 0,
        autoCreateBaseline = true,
        autoUpdateBaseline = false,
    } = options;

    const platform = process.env.PLATFORM_NAME || platformName;

    try {
        // Ensure directories exist
        await ensureScreenshotDirs();

        // Generate file names and paths
        const fileName = normalizeScreenshotFileName(name, platform);
        const actualPath = path.join(getScreenshotDirPath('actual', platform), fileName);
        const baselinePath = path.join(getScreenshotDirPath('baseline', platform), fileName);
        const diffPath = path.join(getScreenshotDirPath('diff', platform), fileName);

        // Capture screenshot
        const capturedPath = await captureScreenshot(element, name, platform);

        // Compare with baseline
        const comparison = await compareScreenshots(capturedPath, baselinePath, diffPath, threshold);

        // Auto-update baseline if enabled
        if (autoUpdateBaseline && !comparison.match) {
            await createOrUpdateBaseline(capturedPath, baselinePath);
            await log(`Baseline automatically updated for '${name}'`);
        }

        // Add attachments to Allure report
        if (fs.existsSync(baselinePath)) {
            addAttachment('Baseline Image', fs.readFileSync(baselinePath), 'image/png');
        }
        addAttachment('Actual Image', fs.readFileSync(capturedPath), 'image/png');
        if (comparison.diffImagePath && fs.existsSync(comparison.diffImagePath)) {
            addAttachment('Difference Image', fs.readFileSync(comparison.diffImagePath), 'image/png');
        }

        // Add comparison summary to report
        const featureMsg = `Screenshot: ${name} | Match: ${comparison.match} | Diff Pixels: ${comparison.diffPixels} (${comparison.diffPercentage}%)`;
        addFeature(featureMsg);

        return comparison;
    } catch (error) {
        await log(`Error in mobile screenshot capture/compare: ${error}`);
        throw error;
    }
}

/**
 * Assertion helper: Asserts that screenshots match
 * Throws error with detailed diff information if they don't match
 */
export async function assertScreenshotsMatch(result: ScreenshotComparisonResult): Promise<void> {
    if (!result.match) {
        const errorMsg = `Screenshots do not match! Difference: ${result.diffPixels} pixels (${result.diffPercentage}%)${result.diffImagePath ? ` Diff saved at: ${result.diffImagePath}` : ''}`;
        await log(errorMsg);
        throw new Error(errorMsg);
    }
    await log(`Screenshots match successfully!`);
}

/**
 * Assertion helper: Asserts that screenshots differ
 * Throws error if they match when they shouldn't
 */
export async function assertScreenshotsDiffer(result: ScreenshotComparisonResult): Promise<void> {
    if (result.match) {
        const errorMsg = `Screenshots match when they should differ!`;
        await log(errorMsg);
        throw new Error(errorMsg);
    }
    await log(`Screenshots differ as expected (${result.diffPixels} pixels, ${result.diffPercentage}%)`);
}

export async function log(testStep: string) {
    // Central logging helper used throughout the mobile utilities. In this
    // trimmed-down environment we just log to the console; Allure integration
    // is handled via optional addAttachment/addFeature above when available.
    console.log(testStep);
}

export async function getElement(elementOrSelector: WebdriverIO.Element | PlatformSelector): Promise<WebdriverIO.Element> {
    let element: WebdriverIO.Element;

    if (isPlatformSelector(elementOrSelector)) {
        // If a string selector is passed, use the WebdriverIO driver to resolve it
        element = await driver.$(elementOrSelector);
    } else {
        // If WebdriverIO.Element is passed directly
        element = elementOrSelector;
    }
    return element;
}

export async function getElements(elementOrSelector: PlatformSelector): Promise<WebdriverIO.ElementArray> {
    // If a string selector is passed, use the WebdriverIO driver to resolve all matching elements
    const elements = await driver.$$(elementOrSelector);
    return elements;
}

export async function waitForElementToBeDisplayed(elementOrSelector: WebdriverIO.Element | PlatformSelector, timeout?: number): Promise<void> {
    const element = await getElement(elementOrSelector);
    await log(`Waiting for element '${element.selector}' to display.`);
    try {
        await element.waitForDisplayed({ timeout });
    } catch (error) {
        throw new Error(`Element: '${element.selector}' not displayed`);
    }
}

async function waitForElementToBeClickable(element: WebdriverIO.Element, timeout: number = 10000): Promise<void> {
    await element.waitForClickable({ timeout });
}

async function waitForElementToExist(element: WebdriverIO.Element, timeout: number = 10000): Promise<void> {
    await element.waitForExist({ timeout });
}

export async function isElementExisting(element: WebdriverIO.Element) {
    await log(`Checking existence of element '${element.selector}'.`);
    return await element.isExisting();
}

export async function assertElementNotExists(elementOrSelector: WebdriverIO.Element) {
    await waitFor(1000);
    await log(`Asserting non-existence of element '${elementOrSelector}'.`);
    const exists = await elementOrSelector.isExisting();
    if (exists) {
        throw new Error(`Expected element '${elementOrSelector}' not to exist, but it does.`);
    }
}

export async function clickelement(elementOrSelector: WebdriverIO.Element | PlatformSelector) {
    const element = await getElement(elementOrSelector);
    await waitForElementToBeDisplayed(element, MAX_TIMEOUT);
    await log(`Clicking on element '${element.selector}'.`);
    await element.click();
    await waitFor(500);
}

export async function doubleClickElement(elementOrSelector: WebdriverIO.Element | PlatformSelector) {
    const element = await getElement(elementOrSelector);
    try {
        await element.waitForDisplayed({ timeout: MAX_TIMEOUT });
        await log(`Double Clicking on element '${element.selector}'.`);
        await element.doubleClick();
    } catch (error: any) {
        if (error.message.includes('This device does not support force press interactions')) {
            // Fallback to manual double click
            await log(`Falling back to manual double click on element '${element.selector}' due to device limitation.`);
            await element.click();
            await browser.pause(100); // Adding a short delay between clicks
            await element.click();
        } else {
            // Re-throw the error if it's not related to force press interactions
            throw error;
        }
    }
}

export async function longClickElement(elementOrSelector: WebdriverIO.Element | PlatformSelector, duration = 2000) {
    const element = await getElement(elementOrSelector);

    await log(`Long Clicking on element '${element.selector}'.`);

    if (isMobilePlatform()) {
        // Perform the long click action using touch actions for mobile platforms
        await browser.touchAction([{ action: 'press', element: element }, { action: 'wait', ms: duration }, { action: 'release' }]);
    } else {
        await element.waitForDisplayed({ timeout: MAX_TIMEOUT });
        await log(`Long Clicking on element '${element.selector}'.`);
        await browser.performActions([
            {
                type: 'pointer',
                id: 'mouse1',
                parameters: { pointerType: 'mouse' },
                actions: [
                    { type: 'pointerMove', duration: 0, origin: element, x: 0, y: 0 },
                    { type: 'pointerDown', button: 0 },
                    { type: 'pause', duration: duration },
                    { type: 'pointerUp', button: 0 },
                ],
            },
        ]);
        // Release all actions
        await browser.releaseActions();
    }
}

export async function getElementText(elementOrSelector: WebdriverIO.Element | PlatformSelector) {
    const element = await getElement(elementOrSelector);
    console.log(element.selector);
    await waitForElementToBeDisplayed(element, DEFAULT_TIMEOUT);
    const elementText = await element.getText();
    await log(`Retrieving text from ${element.selector}.`);
    return elementText;
}

export async function getValues(elementOrSelector: WebdriverIO.Element | PlatformSelector): Promise<string> {
    const element = await getElement(elementOrSelector);
    await waitFor(1000);
    await waitForElementToBeDisplayed(element, DEFAULT_TIMEOUT); // Wait for the element to be displayed
    await log(`Retrieving value from element '${element.selector}'.`);
    const value = await element.getValue(); // Retrieve the element's value
    return value; // Return the value
}

export async function isElementDisplayed(elementOrSelector: WebdriverIO.Element | PlatformSelector, timeout: number = 5000): Promise<boolean> {
    const element = await getElement(elementOrSelector);
    try {
        await waitForElementToBeDisplayed(element, timeout);
        console.log(`Element for ${element.selector} is displayed.`);
        return true;
    } catch (error) {
        console.log(`Element for ${element.selector} is not displayed.`);
        return false;
    }
}

export async function hideKeyboard() {
    if (platformName === 'android') {
        await log('Hiding keyboard.');
        await driver.hideKeyboard();
        await waitFor(1000);
    } else if (platformName === 'ios') {
        await log('Hiding keyboard on iOS.');
        // Strategy 1: Click the "Return" button if present
        try {
            const returnButton = await driver.$('~Return'); // Replace 'Return' with the actual accessibility ID of the button
            if (await returnButton.isDisplayed()) {
                await returnButton.click();
                await log('Clicked the Return button to hide the keyboard.');
            } else {
                throw new Error('Return button not found.');
            }
        }
        catch (error) {
            await log('Failed to click the Return button to hide the keyboard.');
            // Strategy 2: Tap at the center of the screen, avoiding elements
            await log('Attempting to tap at the center of the screen to hide the keyboard.');
            try {
                const screenSize = await driver.getWindowRect();
                const attempts = [
                    { x: screenSize.width / 2, y: screenSize.height / 2 },
                    { x: screenSize.width / 2 + 30, y: screenSize.height / 2 },
                    { x: screenSize.width / 2 - 30, y: screenSize.height / 2 },
                    { x: screenSize.width / 2, y: screenSize.height / 2 + 30 },
                    { x: screenSize.width / 2, y: screenSize.height / 2 - 30 },
                ];
                for (const attempt of attempts) {
                    const elementsAtTapLocation = await driver.$$('//*[@x="' + attempt.x + '" and @y="' + attempt.y + '"]');
                    if (elementsAtTapLocation.length === 0) {
                        await driver.touchPerform([
                            {
                                action: 'tap',
                                options: {
                                    x: attempt.x,
                                    y: attempt.y,
                                },
                            },
                        ]);
                        await log(`Tapped at coordinates (${attempt.x}, ${attempt.y}) to hide the keyboard.`);
                        return true;
                    }
                }
                await log('Failed to find a tap location without elements.');
                return false;
            } catch (error) {
                await log('Failed to hide keyboard by tapping outside.');
                return false;
            }
        }
    }
    else {
        await log('Unsupported platform. Cannot hide keyboard.');
        return false;
    }
}
export async function closeKeyboard() {
    await log('Closing keyboard.');
    await driver.pressKeyCode(66);
    await waitFor(1000);
}

export async function waitFor(milliSeconds: number) {
    await browser.pause(milliSeconds);
}

export async function beforeTest() {
    await log('Verifying app installation.');
    await driver.isAppInstalled('Mobile_Test');
}

export async function terminateApp(appId: string) {
    await log(`Terminating app '${appId}'.`);
    try {
        await (driver.terminateApp as (appId: string) => Promise<void>)(appId);
        await log(`App '${appId}' terminated successfully.`);
        await new Promise(resolve => setTimeout(resolve, 2500));
    } catch (error) {
        if (error instanceof Error) {
            await log(`Failed to terminate app '${appId}': ${error.message}`);
        } else {
            await log(`Failed to terminate app '${appId}': ${String(error)}`);
        }
        throw error;
    }
}

export async function activateApp(appId: string) {
    await log(`Activating app '${appId}'.`);
    try {
        await driver.activateApp(appId);
        await log(`App '${appId}' activated successfully.`);
        await new Promise(resolve => setTimeout(resolve, 2500));
    } catch (error) {
        if (error instanceof Error) {
            await log(`Failed to activate app '${appId}': ${error.message}`);
        } else {
            await log(`Failed to activate app '${appId}': ${String(error)}`);
        }
        throw error;
    }
}

export async function restartApp(appId: string) {
    await terminateApp(appId);
    await activateApp(appId);
}

export async function isAppInstalled(appId: string) {
    await log(`Checking if app '${appId}' is installed.`);
    const installed = await driver.isAppInstalled(appId);
    await log(`App installed status: ${installed}`);
    if (installed) {
        await log(`App '${appId}' is installed.`);
    } else {
        await log(`App '${appId}' is not installed.`);
    }
}

export async function navigateExpo() {
    const checkPortCmd = `lsof -i :8081 | grep LISTEN | awk '{print $2}'`;
    const portProcessId = execSync(checkPortCmd).toString().trim();

    if (portProcessId || process.env.EXPO_URL) {

        if (platformName === 'android') {
            await restartApp('host.exp.exponent');
            await clickelement(await driver.$('//android.widget.TextView[@text="Enter URL manually"]'));
            await clickelement(await driver.$('//android.widget.EditText[@text="exp://"]'));
            await clearField(await driver.$('//android.widget.EditText[@text="exp://"]'));
            await enterText(await driver.$('//android.widget.EditText[@text="exp://"]'), await expoUrl());
        } else if (platformName === 'ios') {
            await driver.execute('mobile: launchApp', { bundleId: 'com.apple.mobilesafari' });
            await clickelement(await driver.$('//XCUIElementTypeTextField[@name="TabBarItemTitle"]'));
            await clearField(await driver.$('//XCUIElementTypeTextField[@name="URL"]'));
            await enterText(await driver.$('//XCUIElementTypeTextField[@name="URL"]'), await expoUrl() + '/\uE007');
            await hideKeyboard();
            await clickelement(await driver.$('//XCUIElementTypeButton[@name="Open"]'));
        }
        await clickelement(await driver.$('~Continue'));
        await clickelement(await driver.$(platformName === 'ios' ? '~Reload' :
            '//android.widget.TextView[@text="Reload"]'));

    } else {
        console.error('No Expo server available.');
    }

}

// export async function verifyFirstScreen() {
//     await log(`Verifying first screen for project '${projectName}'.`);
//     await waitForElementToBeDisplayed(await getElement(appsConfig[getProjectName(projectName!)]?.firstScreenSelector), process.env.EXPO_GO === 'true' ? 120000 : MAX_TIMEOUT);
//     try {
//         await waitForElementToBeDisplayed(await getElement(CommonSelectors.toastHide), DEFAULT_TIMEOUT);
//         await commonScreen.clickHide();
//         await log(`Toast was successfully hidden.`);
//     } catch (error) {
//         await log(`Toast not found or could not be hidden`);
//     }
// }

export async function captureCompareAndSaveDiff(element: WebdriverIO.Element, screenshotSavePath: string, baselineImagePath: string, diffImagePath: string): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
        try {
            await log('Comparing images for differences.');
            await element.saveScreenshot(screenshotSavePath);
            if (!fs.existsSync(baselineImagePath)) {
                fs.copyFileSync(screenshotSavePath, baselineImagePath);
                await log('Baseline image not found. A new baseline has been established.');
                resolve(false);
                return;
            }
            const screenshotImage = PNG.sync.read(fs.readFileSync(screenshotSavePath));
            const baselineImage = PNG.sync.read(fs.readFileSync(baselineImagePath));
            const { width, height } = screenshotImage;
            const diff = new PNG({ width, height });
            const numDiffPixels = pixelmatch(screenshotImage.data, baselineImage.data, diff.data, width, height, { threshold: 0 });
            if (numDiffPixels > 1) {
                fs.writeFileSync(diffImagePath, PNG.sync.write(diff));
                addAttachment('BaseLine Image', fs.readFileSync(baselineImagePath), 'image/png');
                addAttachment('Actual Image', fs.readFileSync(screenshotSavePath), 'image/png');
                addAttachment('Difference in screen', fs.readFileSync(diffImagePath), 'image/png');
                await log('Differences found.');
                resolve(true);
            } else {
                await log('No differences found.');
                resolve(false);
            }
        } catch (error) {
            console.error('An error occurred:', error);
            reject(error);
        }
    });
}

export async function clearDirectory(baseDir: string, relativeDirectoryPath: string = '', excludeFolderNames: string[] = []): Promise<void> {
    const directoryPath = relativeDirectoryPath ? path.join(baseDir, relativeDirectoryPath) : baseDir;
    try {
        const files = await fs.readdir(directoryPath, { withFileTypes: true });
        for (const file of files) {
            if (excludeFolderNames.includes(file.name)) {
                await log(`Skipping excluded directory: ${file.name}`);
                continue; // Skip the excluded folder
            }

            const filePath = path.join(directoryPath, file.name);
            if (file.isDirectory()) {
                await clearDirectory(baseDir, path.join(relativeDirectoryPath, file.name), excludeFolderNames);
                await fs.rmdir(filePath);
            } else {
                await fs.unlink(filePath);
            }
        }
    } catch (error) {
        console.error(`Error clearing directory ${directoryPath}:`, error);
    }
}

export async function getWebScreenSize(): Promise<{ width: number; height: number }> {
    const { width, height } = await browser.execute(() => {
        return {
            width: window.innerWidth,
            height: window.innerHeight,
        };
    });
    await log('Retrieving web screen size: ' + width + 'x' + height);
    return { width, height };
}

export async function getScreenSize(): Promise<{ width: number; height: number }> {
    const { width, height } = await driver.getWindowRect();
    await log('Retrieving screen size.' + width + ':' + height);
    return { width, height };

}

export async function swipeToEndOfScreen() {
    if (isMobilePlatform()) {
        const { width, height } = await getScreenSize();
        await log(`Screen Size - Width: ${width}, Height: ${height}`);
        const startX = width / 2;
        const startY = height * 0.8;
        const endX = startX; // remains the same as startX in most swipe up actions
        const endY = height * 0.2; // Adjust according to how much of the screen you want to swipe through

        const driverAny = driver as any;
        await driverAny.performActions([
            {
                type: 'pointer',
                id: 'finger1',
                parameters: { pointerType: 'touch' },
                actions: [
                    { type: 'pointerMove', duration: 0, x: startX, y: startY },
                    { type: 'pointerDown', button: 0 },
                    { type: 'pause', duration: 100 }, // Small pause for the press to register
                    { type: 'pointerMove', duration: 1000, x: endX, y: endY }, // Smooth swipe to the end position
                    { type: 'pointerUp', button: 0 },
                ],
            },
        ]);
        await waitFor(SWIPE_DELAY);
        await log('Swiping to the end of the screen.');
    } else if (getPlatformName() === 'web') {
        const { width, height } = await getWebScreenSize();
        const startX = Math.floor(width / 2); // Ensure startX is an integer
        const startY = Math.floor(height * 0.8); // Ensure startY is an integer
        const endX = startX;
        const endY = Math.floor(height * 0.5); // Swipe to 50% of screen height

        const driverAny = driver as any;
        await driverAny.performActions([
            {
                type: 'pointer',
                id: 'finger1',
                parameters: { pointerType: 'mouse' },
                actions: [
                    { type: 'pointerMove', duration: 0, x: startX, y: startY },
                    { type: 'pointerDown', button: 0 },
                    { type: 'pause', duration: 100 },
                    { type: 'pointerMove', duration: 1000, x: endX, y: endY },
                    { type: 'pointerUp', button: 0 },
                ],
            },
        ]);
        await log('Swiping halfway down the screen.');
    } else {
        await log('Unsupported Platform');
    }
}

export async function swipeToTopOfScreen() {
    if (isMobilePlatform()) {
        const { width, height } = await getScreenSize();
        await log(`Screen Size - Width: ${width}, Height: ${height}`);
        // Swipe coordinates: swipe down from near the top (20%) of the screen to the bottom (80%)
        const startX = width / 2; // Middle of the screen horizontally
        const startY = height * 0.4; // Start near the top (20% from the top)
        const endY = height * 0.8; // End near the bottom (80% from the top)

        // Perform the swipe down action
        const driverAny = driver as any;
        await driverAny.performActions([
            {
                type: 'pointer',
                id: 'finger1',
                parameters: { pointerType: 'touch' }, // Touch action for mobile platforms
                actions: [
                    { type: 'pointerMove', duration: 0, x: startX, y: startY }, // Start swipe near the top
                    { type: 'pointerDown', button: 0 },
                    { type: 'pause', duration: 100 }, // Small pause to register press
                    { type: 'pointerMove', duration: 1000, x: startX, y: endY }, // Swipe down towards the bottom
                    { type: 'pointerUp', button: 0 },
                ],
            },
        ]);
        await waitFor(SWIPE_DELAY);
        await log('Swiped down from the top of the screen to the bottom.');
    } else if (getPlatformName() === 'web') {
        const { width, height } = await getWebScreenSize();

        // For web, swipe from near the top (20%) of the screen to the bottom (80%)
        const startX = Math.floor(width / 2); // Middle of the screen horizontally
        const startY = Math.floor(height * 0.2); // Start near the top (20%)
        const endY = Math.floor(height * 0.8); // End near the bottom (80%)

        // Perform the swipe down action
        const driverAny = driver as any;
        await driverAny.performActions([
            {
                type: 'pointer',
                id: 'finger1',
                parameters: { pointerType: 'mouse' }, // Mouse action for web platforms
                actions: [
                    { type: 'pointerMove', duration: 0, x: startX, y: startY }, // Start swipe near the top
                    { type: 'pointerDown', button: 0 },
                    { type: 'pause', duration: 100 }, // Small pause to register press
                    { type: 'pointerMove', duration: 1000, x: startX, y: endY }, // Swipe down towards the bottom
                    { type: 'pointerUp', button: 0 },
                ],
            },
        ]);

        await log('Swiped down from the top of the screen to the bottom (web).');
    } else {
        await log('Unsupported Platform');
    }
}

export async function scrollToElementAndroid(elementSelector: string) {
    await log(`Scrolling to element with selector '${elementSelector}' on Android.`);
    const element = await driver.$(elementSelector);
    await driver.execute('mobile:scroll', { element: element.elementId, strategy: 'accessibility id', selector: elementSelector, direction: 'down' });
}

export async function enterText(elementOrSelector: WebdriverIO.Element | PlatformSelector, str: string): Promise<void> {
    const element = await getElement(elementOrSelector);
    await waitForElementToBeDisplayed(element, DEFAULT_TIMEOUT);
    await log(`Entering text into element '${element.selector}'.`);
    await element.click(); // Click the element to focus
    await element.setValue(str); // Set the input value
    // await driver.execute('mobile: performEditorAction', {'action': 'Done'});
    try {
        if (getPlatformName() === 'android') {
            // Try pressing the Enter key
            await driver.pressKeyCode(66); // 66 is the keycode for Enter
            await driver.pause(500);
        } else if (getPlatformName() === 'ios') {
            // For iOS, try tapping the 'Done' button if available
            const doneButton = await driver.$('~Done');
            if (await doneButton.isDisplayed()) {
                await doneButton.click();
            }
        }
    } catch (error) {
        await log(`Failed to dismiss keyboard: ${error}. Continuing...`);
    }

}

export function generateRandomEmail(): string {
    const randomString = Math.random().toString(36).substring(2, 12); // Generates a random string
    const domain = 'gmail.com'; // Using 'gmail.com' as the domain
    const randomEmail = `${randomString}@${domain}`;

    console.log(`Generated random email: ${randomEmail}`);
    return randomEmail;
}

export async function getKeyCodeForDigit(digit: string): Promise<number> {
    const keyCodeMap: { [key: string]: number } = {
        '0': 7,
        '1': 8,
        '2': 9,
        '3': 10,
        '4': 11,
        '5': 12,
        '6': 13,
        '7': 14,
        '8': 15,
        '9': 16,
    };
    return keyCodeMap[digit];
}

export async function enterOtpWithKeyCode(otp: string, elementOrSelector: WebdriverIO.Element | PlatformSelector) {
    const element = await getElement(elementOrSelector);

    // Loop through each digit of the OTP
    for (const digit of otp) {
        if (platformName === 'android' || platformName === 'ios') {
            // Android specific: press key code for the digit
            const keyCode = getKeyCodeForDigit(digit); // Map digit to Android key code
            await driver.pressKeyCode(await keyCode); // Simulate pressing the key code on Android
        } else if (platformName === 'web') {
            await element.addValue(digit); // Use the element to add the digit on web
        } else {
            throw new Error(`Unsupported platform: ${platformName}`);
        }

        // Small delay between entering digits (optional)
        await browser.pause(100);
    }
}

export async function clearField(elementOrSelector: WebdriverIO.Element | PlatformSelector): Promise<void> {
    const element = await getElement(elementOrSelector);

    if (getPlatformName() === 'web') {
        // For web: Select all text and clear the field using backspace
        await element.addValue('\u0001'); // Simulate Ctrl+A (Select All)
        await element.addValue('\u0008'); // Clear the field using backspace
    } else if (isMobilePlatform()) {
        await element.clearValue(); // Clears the field values on mobile platforms
    } else {
        throw new Error(`Unsupported platform: ${platformName}`);
    }

    // Verify the field is cleared
    const clearedValue = await element.getText();
    console.log(`Cleared text/value from element '${element.selector}': '${clearedValue}'`);
}

export async function waitForElementToBeDisplayedFromArray(element: WebdriverIO.ElementArray, num: number, timeout: number = 10000): Promise<void> {
    await log(`Element Display-${element[num].selector}`);
    await element[num].waitForDisplayed({ timeout });
}

export async function clickelementFromArray(element: WebdriverIO.ElementArray, num: number) {
    await waitForElementToBeDisplayedFromArray(element, num, 30000);
    await log(`Click on the element - ${element[num].selector}`);
    await element[num].click();
    await waitFor(1000);
}

export async function backupClearAndRestoreHistory(allureReportPath: string, allureResultsPath: string, tempHistoryPath: string): Promise<void> {
    try {
        // Backup the history folder
        const sourceHistoryPath = path.join(allureReportPath, 'history');
        const targetHistoryPath = path.join(tempHistoryPath, 'history');

        await fs.move(sourceHistoryPath, targetHistoryPath, { overwrite: true });
        await log('Allure report history backed up.');

        // Clear the allure-results directory
        await fs.emptyDir(allureResultsPath);
        await log('Allure results directory cleared.');

        // Verify the allure-results directory is cleared
        const files = await fs.readdir(allureResultsPath);
        if (files.length === 0 || (files.length === 1 && files[0] === '.gitkeep')) {
            // Restore the history folder to allure-results
            await fs.move(targetHistoryPath, `${allureResultsPath}/history`, { overwrite: true });
            await log('Allure report history restored.');
        } else {
            console.error('Allure results directory was not properly cleared. Restoration aborted.');
        }
    } catch (error) {
        console.error('Failed to backup, clear, and restore Allure report history:', error);
    }
}

export async function uninstallApp(appId: string) {
    if (getPlatformName() === 'android') {
        await log(`Uninstalling Android app with package name: ${appId}`);
        exec(`adb uninstall ${appId}`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error uninstalling Android app: ${error.message}`);
                return;
            }
            log(`Android app uninstalled successfully.`);
        });
    } else if (getPlatformName() === 'ios') {
        await log(`Uninstalling iOS app with bundle ID: ${appId}`);
        exec(`xcrun simctl uninstall booted ${appId}`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error uninstalling iOS app: ${error.message}`);
                return;
            }
            log(`iOS app uninstalled successfully.`);
        });
    } else {
        console.error(`Unsupported platform or missing package name/bundle ID.`);
    }
}

export async function extractTagsFromTestTitle(text: string): Promise<string[]> {
    // Insert a space between adjacent tags to ensure they are matched individually
    const preprocessedText = text.replace(/(@)(?=@)/g, '$1 ');
    const tagPattern: RegExp = /@\w+/g;
    const matches = preprocessedText.match(tagPattern);
    return matches || [];
}

export async function addReportFeature(title: string): Promise<void> {
    let tags = await extractTagsFromTestTitle(title);
    tags.forEach((tag: string) => {
        if (tag === '@positive') {
            addFeature('Positive Testcases');
            log('Found a positive tag.');
        } else if (tag === '@negative') {
            addFeature('Negative Testcases');
            log('Found a negative tag.');
        } else if (tag === '@visual') {
            addFeature('Visual Testcases');
            log('Found a visual tag.');
        } else {
            log(`No Tags Found or unrecognized tag:, ${tag}`);
        }
    });
}

const STATE: Map<string, any> = new Map();

export function setState(key: string, value: string | boolean | number) {
    log(`[setState] set state ${key}`);
    STATE.set(key, value);
}

export function hasState(key: string) {
    return STATE.has(key);
}

export function getState(key: string) {
    if (!STATE.has(key)) {
        throw new Error(`Cannot find state ${key}`);
    }
    log(`[getState] get state ${key}`);
    return STATE.get(key);
}

export function clearState() {
    log(`[clearState] clear state`);
    STATE.clear();
}

const getValueFromPath = (obj: any, path: string): any => {
    const keys = path.split('.');
    let current = obj;
    for (const key of keys) {
        if (current[key] === undefined) {
            return undefined;
        }
        current = current[key];
    }
    return current;
};

//Unsupported/Deprecated
// export function getSelector(baseIdentifier: string) {
//     if (!projectName) {
//         throw new Error('PROJECT_NAME environment variable is not set.');
//     }

//     const effectivePlatformName = platformName === 'local' ? 'android' : platformName;
//     let projectData: any;

//     try {
//         // Load the common configuration file
//         const configPath = path.resolve(__dirname, '../config/projects.json');
//         log(`Loading config from: ${configPath}`);
//         const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

//         // Get the project data file path from the configuration
//         const projectConfig = config.projects[projectName];
//         if (!projectConfig) {
//             throw new Error(`No configuration found for project: ${projectName}`);
//         }

//         const projectDataPath = projectConfig.filePath;
//         if (!projectDataPath) {
//             throw new Error(`No data path found for project: ${projectName}`);
//         }

//         // Load the project data file
//         const absoluteProjectDataPath = path.resolve(__dirname, `../${projectDataPath}`);
//         log(`Loading project data from: ${absoluteProjectDataPath}`);
//         projectData = JSON.parse(fs.readFileSync(absoluteProjectDataPath, 'utf8'));
//     } catch (error: any) {
//         throw new Error(`Failed to load project data for project: ${projectName}. Error: ${error.message}`);
//     }

//     let identifier = getValueFromPath(projectData, `${baseIdentifier}.${effectivePlatformName}`);
//     if (identifier && identifier.startsWith('cust=')) {
//         let customXPath = identifier.substring(5);
//         customXPath = customXPath.replace(/"/g, '');
//         log(`Using custom XPath for ${baseIdentifier}: ${customXPath}`);
//         return customXPath;
//     }
//     if (!identifier) {
//         throw new Error(`Identifier not found for ${baseIdentifier} on ${platformName}.`);
//     }

//     switch (effectivePlatformName) {
//         case 'web':
//             return `[data-testid='${identifier}']`;
//         case 'ios':
//             return `//XCUIElementTypeAny[@name='${identifier}']`;
//         case 'android':
//             return `accessibility id:${identifier}`;
//         default:
//             throw new Error(`Unsupported platform: ${platformName}`);
//     }
// }


interface CsvRecord {
    IDENTIFIER: string;
    web: string;
    android: string;
    ios: string;
}

export function csvToJson(inputFilePath: string, outputFilePath: string): void {
    try {
        const csvData = fs.readFileSync(inputFilePath, 'utf-8');
        const records: CsvRecord[] = parse(csvData, {
            columns: true,
            skip_empty_lines: true,
        });
        const jsonOutput: { [key: string]: { web: string; android: string; ios: string } } = {};
        records.forEach(record => {
            jsonOutput[record.IDENTIFIER] = {
                web: record.web,
                android: record.android,
                ios: record.ios,
            };
        });
        const jsonString = JSON.stringify(jsonOutput, null, 2); // Pretty-print JSON with 2 spaces
        fs.writeFileSync(outputFilePath, jsonString, 'utf8');
        log('JSON file has been saved to ' + outputFilePath);
    } catch (error) {
        console.error('Error processing CSV file:', error);
    }
}

// export async function clickOnHide() {
//     try {
//         // Get the text of the toast
//         const toastText = await commonScreen.getToastHideText();

//         // Wait for the toast element to be displayed
//         await waitForElementToBeDisplayed(await getElement(CommonSelectors.toastHide), DEFAULT_TIMEOUT);

//         // Check if the toast text is "service is not reachable"
//         if (toastText === 'Service is not reachable') {
//             await commonScreen.clickHide();
//             await log(`Service is not reachable Toast was successfully hidden.`);

//             // Wait for the next toast element to be displayed and check its text
//             await waitForElementToBeDisplayed(await getElement(CommonSelectors.toastHide), DEFAULT_TIMEOUT);
//             const nextToastText = await commonScreen.getToastHideText();
//             await expect(nextToastText).toEqual(testdata.ToastHide.Online);
//             await commonScreen.clickHide();
//             await log(`You are online Toast was successfully hidden.`);
//         }
//         // Check if the toast text is "you are online"
//         else if (toastText === 'you are online') {
//             await commonScreen.clickHide();
//             await log(`Toast was successfully hidden.`);
//         }
//     } catch (error) {
//         await log(`Toast not found or could not be hidden`);
//     }
// }

export async function actionHandler(elementOrSelector: WebdriverIO.Element | PlatformSelector, action: string, value?: string) {
    const element = await getElement(elementOrSelector);

    switch (action) {
        case 'getText':
            return await getElementText(await element);
        case 'click':
            await clickelement(await element);
            break;
        case 'enterValue':
            await clickelement(await element);
            await enterText(await element, value || '');
            break;
        case 'isSelected':
            await clickelement(await element);
            return await isChecked(await element);
        case 'getValue':
            return getValues(await element);
        case 'isEnabled':
            return isEnabled(await element);
        case 'isDisabled':
            const ele = isEnabled(await element);
            return ele;
        default:
            throw new Error(`Unsupported action ${action} for element ${elementOrSelector}`);
    }
}

export async function updateAllureReportName(newReportName: string): Promise<void> {
    try {
        // Define the path to the summary.json file inside the widget folder
        const summaryFilePath = path.resolve(__dirname, '..', './reports/allure-report', `${projectName}`, `${platformName}`, 'widgets', 'summary.json');
        // Read the JSON file
        const data = await fs.promises.readFile(summaryFilePath, 'utf8');
        const summary = JSON.parse(data);

        // Update the reportName field
        summary.reportName = newReportName;

        // Write the updated JSON back to the file
        await fs.promises.writeFile(summaryFilePath, JSON.stringify(summary, null, 2), 'utf8');

        log('Allure report name updated successfully.');
    } catch (error) {
        console.error('Error updating Allure report name:', error);
        throw error;
    }
}

export async function createEnvironmentPropertiesFile(outputDir: string): Promise<void> {
    try {
        const env: string = process.env.ENV_URL || 'Unknown Environment';

        let environmentProperties: string = `Platform=${platformName}\n`;
        environmentProperties += `Environment=${env}\n`;
        // Add platform-specific properties
        if (!isLocalEnv()) {
            switch (platformName.toLowerCase()) {
                case 'android':
                    environmentProperties += `Android_Device=${process.env.ANDROID_DEVICE_NAME || 'Unknown Android Device'}\n`;
                    environmentProperties += `Android_Version=${process.env.ANDROID_PLATFORM_VERSION || 'Unknown Android Version'}\n`;
                    break;
                case 'ios':
                    environmentProperties += `iOS_Device=${process.env.IOS_DEVICE_NAME || 'Unknown iOS Device'}\n`;
                    environmentProperties += `iOS_Version=${process.env.IOS_PLATFORM_VERSION || 'Unknown iOS Version'}\n`;
                    break;
                case 'web':
                    environmentProperties += `Browser=chrome\n`;
                    break;
                default:
                    log(`Unknown platform: ${platformName}.`);
            }
        } else {
            environmentProperties += `Local_Device=${process.env.LOCAL_DEVICE_NAME || 'Unknown Local Device'}\n`;
            environmentProperties += `Local_Platform_Version=${process.env.LOCAL_PLATFORM_VERSION || 'Unknown Local Platform Version'}\n`;
        }

        // Create the full path for the environment.properties file
        const filePath: string = path.join(outputDir, 'environment.properties');

        console.log('Writing to file:', filePath);
        console.log('Content:', environmentProperties);

        // Write to environment.properties file
        await fs.promises.writeFile(filePath, environmentProperties.trim());

        log(`environment.properties file has been created successfully at ${filePath}`);
    } catch (error) {
        console.error('Error creating environment.properties file:', error);
        throw error;
    }
}

export function updateXPathFromSelector(selector: string, day: string | number): string {
    const dayNumber = typeof day === 'string' ? parseInt(day, 10) : day;

    if (isNaN(dayNumber) || dayNumber < 1 || dayNumber > 31) {
        throw new Error('Invalid day number');
    }

    // Extract year, day of week, and index from the old selector
    const yearMatch = selector.match(/null_(\d{4})_/);
    const dayOfWeekMatch = selector.match(/null_\d{4}_00_(\w{2})/);
    const indexMatch = selector.match(/\[(\d+)\]/);

    if (!yearMatch || !dayOfWeekMatch || !indexMatch) {
        throw new Error('Selector format is incorrect.');
    }

    // Get the current date and calculate the new values
    const date = new Date();
    const year = date.getFullYear(); // Update year to current year
    const currentMonth = date.getMonth(); // Current month
    const firstDayOfMonth = new Date(year, currentMonth, 1);
    const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    const startDayOfWeek = firstDayOfMonth.getDay();
    const dayOfWeek = days[new Date(year, currentMonth, dayNumber).getDay()];
    // Calculate the new index
    const index = Math.ceil((dayNumber + startDayOfWeek) / 7);
    const updatedXPath = `(//XCUIElementTypeOther[@name="null_${year}_00_${dayOfWeek}"])` + `[${index}]`; // Generate the updated XPath with the new year

    return updatedXPath;
}

export async function deleteFile(relativePath: string): Promise<void> {
    const filePath = path.resolve(__dirname, '..', relativePath);

    try {
        await fs.unlink(filePath);
        console.log(`File at ${filePath} deleted successfully.`);
    } catch (err) {
        console.error(`Error deleting file at ${filePath}:`, err);
    }
}

export async function deleteFolder(relativePath: string): Promise<void> {
    const folderPath = path.join(__dirname, '..', relativePath);

    try {
        await fs.remove(folderPath);
        console.log(`Folder at ${folderPath} deleted successfully.`);
    } catch (err) {
        console.error(`Error deleting folder at ${folderPath}:`, err);
    }
}

export async function getFileExtensionByPlatform(platform: string): Promise<string> {
    let defaultExtension = '.apk'; // Default to Android APK

    if (platform.toLowerCase() === 'ios') {
        defaultExtension = '.ipa'; // iOS app extension
    }

    return defaultExtension;
}

// Helper function to extract the issue key from the test description
function extractIssueKey(description: string): string | null {
    const issueKeyPattern = /([A-Z]+-\d+)/; // Matches JIRA keys like "WMS-12345"
    const match = description.match(issueKeyPattern);
    return match ? match[1] : null; // Return the first match, or null if no match
}

// Helper function to decide whether to skip or run the test based on the issue key
// export function conditionalIt(testName: string, testFn: () => Promise<void>): void {
//     const issueKey = extractIssueKey(testName); // Extract the issue key from the test name
//     if (!issueKey) {
//         it(testName, testFn);
//         return;
//     }
//     it(testName, async function () {
//         if (issueKey) {
//             try {
//                 // Fetch both the platform and status from the CSV
//                 const platformFromCsv = await getValueFromCsv(issueKey, 'Platform', platformName); // This function should fetch platform from CSV
//                 const status = await getValueFromCsv(issueKey, 'Status', platformName);

//                 // Check if the current platform matches the platform in CSV
//                 if (platformFromCsv === platformName || platformFromCsv === 'all') {
//                     // Check if the status is not 'Resolved' or 'Verified', and skip if so
//                     if (status !== 'Resolved' && status !== 'Verified') {
//                         log(`Skipping test: ${testName} (JIRA issue ${issueKey} is ${status})`);
//                         this.skip(); // Skip if the status is neither Resolved nor Verified
//                     } else {
//                         await testFn();
//                     }
//                 } else {
//                     await testFn();
//                 }
//             } catch (error) {
//                 console.error(`Error fetching status for JIRA issue ${issueKey}:`, error);
//             }
//         }
//     });
// }

// export function conditionalBefore(description: string, beforeFn: () => Promise<void>): void {
//     const issueKey = extractIssueKey(description); // Extract the issue key from the test name
//     if (!issueKey) {
//         before(description, beforeFn);
//         return;
//     }
//     before(description, async function () {
//         if (issueKey) {
//             try {
//                 // Fetch both the platform and status from the CSV
//                 const platformFromCsv = await getValueFromCsv(issueKey, 'Platform', platformName); // This function should fetch platform from CSV
//                 const status = await getValueFromCsv(issueKey, 'Status', platformName);

//                 // Check if the current platform matches the platform in CSV
//                 if (platformFromCsv === platformName || platformFromCsv === 'all') {
//                     // Check if the status is not 'Resolved' or 'Verified', and skip if so
//                     if (status !== 'Resolved' && status !== 'Verified') {
//                         log(`Skipping test: ${description} (JIRA issue ${issueKey} is ${status})`);
//                         this.skip(); // Skip if the status is neither Resolved nor Verified
//                     } else {
//                         await beforeFn();
//                     }
//                 } else {
//                     await beforeFn();
//                 }
//             } catch (error) {
//                 console.error(`Error fetching status for JIRA issue ${issueKey}:`, error);
//             }
//         }
//     });
// }

// export async function conditionOpen(issueKey: string, rtl?: boolean): Promise<boolean> {

//     if (extractIssueKey(issueKey)) {

//         log(`Checking status for conditional issue ${issueKey}`)
//         try {
//             // Fetch both the platform and status from the CSV
//             const platformFromCsv = await getValueFromCsv(issueKey, 'Platform', platformName); // This function should fetch platform from CSV
//             const status = await getValueFromCsv(issueKey, 'Status', platformName);




//             // Check if the current platform matches the platform in CSV
//             if (platformFromCsv === platformName || platformFromCsv === 'all') {
//                 if (status !== 'Resolved' && status !== 'Verified') {
//                     log(`JIRA issue ${issueKey} is ${status}`);
//                     return true;
//                 } else {
//                     return false;
//                 }
//             } else {
//                 log(`Platform ${platformName} not applicable`)
//                 return false;
//             }

//         } catch (error) {
//             console.error(`Error fetching status for JIRA issue ${issueKey}:`, error);
//             return false;
//         }

//     } else {
//         log(`Issue key ${issueKey} not found in CSV`)
//         return false;
//     }
// }

// // Function to read the CSV file and add JIRA ticket status
// export async function updateCsvWithTicketStatus(): Promise<void> {
//     const tickets: { issueKey: string; status: string; platform: string }[] = [];
//     const inputCsvPath = path.join(__dirname, '..', 'resources', 'csv', 'jira_tickets.csv');

//     // Read CSV file
//     await new Promise<void>((resolve, reject) => {
//         fs.createReadStream(inputCsvPath)
//             .pipe(csv())
//             .on('data', (row: { [key: string]: any }) => {
//                 // Push the existing fields from the CSV, ensuring Platform is retained (even if empty)
//                 tickets.push({
//                     platform: row['Platform'],
//                     issueKey: row['Issue Key'], // Keep Issue Key unchanged
//                     status: row['Status'], // This will be updated later
//                 });
//             })
//             .on('end', () => resolve())
//             .on('error', (err: any) => reject(err));
//     });

//     // Fetch the new status for each ticket and update only the status field

//     // Re-write the original CSV with the status column updated
//     const csvWriter = createCsvWriter({
//         path: inputCsvPath, // Overwrite the same file
//         header: [
//             { id: 'platform', title: 'Platform' }, // Retain Platform column
//             { id: 'issueKey', title: 'Issue Key' }, // Retain Issue Key
//             { id: 'status', title: 'Status' }, // Update Status column
//         ],
//     });

//     // Write the records back to the CSV, ensuring Platform values remain intact
//     await csvWriter.writeRecords(
//         tickets.map(ticket => ({
//             platform: ticket.platform,
//             issueKey: ticket.issueKey,
//             status: ticket.status,
//         })),
//     );

//     console.log(`CSV file updated with JIRA statuses: ${inputCsvPath}`);
// }

// async function getValueFromCsv(issueKey: string, field: 'Status' | 'Platform', platformName: string): Promise<string | null> {
//     const inputCsvPath = path.join(__dirname, '..', '/resources/csv/jira_tickets.csv');

//     return new Promise((resolve, reject) => {
//         let foundValue: string | null = null;

//         fs.createReadStream(inputCsvPath)
//             .pipe(csv())
//             .on('data', (row: { [key: string]: any }) => {
//                 // Check if both the issue key and platform match
//                 if (row['Issue Key'] === issueKey && (row['Platform'] === platformName || row['Platform'] === 'all')) {
//                     foundValue = row[field]; // Use the provided field to get the value
//                 }
//             })
//             .on('end', () => {
//                 if (foundValue) {
//                     resolve(foundValue);
//                 } else {
//                     resolve(null); // Return null if no matching issue key and platform are found
//                 }
//             })
//             .on('error', (err: any) => reject(err));
//     });
// }

export async function waitForImagesToBeDisplayed(elements: (WebdriverIO.Element | PlatformSelector)[], timeout: number = 30000) {
    const interval = 3000; // Check every 3 seconds

    for (let i = 0; i < elements.length; i++) {
        const elementOrSelector = elements[i];
        console.log(elementOrSelector);
        // Wait for the current element to be displayed
        const startTime = Date.now();
        let isDisplayed = false; // Flag to check if element is displayed

        while (Date.now() - startTime < timeout) {
            try {
                const element = await getElement(elementOrSelector); // Get the element

                // Log the element being checked
                console.log(`Checking visibility for: ${elementOrSelector}`);

                await element.waitForDisplayed({ timeout }); // Wait for the element to be displayed
                console.log(`${element.selector} is displayed.`); // Log the element's selector
                isDisplayed = true; // Set flag to true if displayed
                break; // Exit the loop if the current element is displayed
            } catch (error) {
                // Use custom type guard to check if error is an instance of Error
                const typedError = error as Error; // Type assertion
                console.error(`Error checking ${elementOrSelector}: ${typedError.message}`);
                console.log(`${elementOrSelector} is not displayed yet. Checking again...`);
            }

            // Wait for the interval before the next check
            await new Promise(resolve => setTimeout(resolve, interval));
        }

        // After the loop, check if the element was displayed
        if (!isDisplayed) {
            throw new Error(`Element '${elementOrSelector}' was not displayed after ${timeout} milliseconds.`); // Throw an error
        }
    }
}

export async function assertElementIsVisible(
    elementOrSelector: WebdriverIO.Element | PlatformSelector,
    timeout?: number
) {
    const element = await getElement(elementOrSelector);
    await log(`Asserting visibility of element '${element.selector}'.`);
    try {
        await waitForElementToBeDisplayed(element, timeout);
    } catch (error) {
        const message = `❌ Element '${element.selector}' was NOT visible after ${timeout ?? 'default'} ms.`;
        await log(message);
        throw new Error(message + (error instanceof Error ? `\nOriginal error: ${error.message}` : ''));
    }
}
export async function assertElementTextMatchesRegex(regex: RegExp, elementOrSelector: WebdriverIO.Element | PlatformSelector) {
    const element = await getElement(elementOrSelector);
    await assertElementIsVisible(element);
    const actualText = await getElementText(element);
    const isRegexMatching = regex.test(actualText);
    expect(isRegexMatching).toBeTruthy();
}

const isMobile = ['android', 'ios'].includes(platformName);
export function isMobilePlatform() {
    return isMobile;
}

export function getPlatformName() {
    return platformName;
}

export function isLocalEnv() {
    return process.env.RUN_LOCAL && process.env.RUN_LOCAL === 'true';
}

export function getCurrentFormattedDate(): string {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    };
    return now.toLocaleDateString('en-US', options);
}

export function getCurrentFormattedTime(): string {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: true,
        // Force lowercase AM/PM
        hourCycle: 'h12',
        localeMatcher: 'best fit',
    };
    return now.toLocaleTimeString('en-US', options).toLowerCase();
}

export function getCurrentFormattedDateTime(): string {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true,
        timeZone: 'Asia/Kolkata',
    };
    let formattedDateTime = now.toLocaleString('en-US', options).replace(/,/, '');
    // Convert AM/PM to lowercase am/pm
    formattedDateTime = formattedDateTime.replace(' PM', ' pm').replace(' AM', ' am');
    return formattedDateTime;
}

export function isTimeCloseEnough(expected: string, actual: string, toleranceSeconds: number = 5): boolean {
    const expectedDate = new Date(expected);
    const actualDate = new Date(actual);
    return Math.abs((expectedDate.getTime() - actualDate.getTime()) / 1000) <= toleranceSeconds;
}

export function isTimeCloseEnoughIgnoreSeconds(expected: string, actual: string, toleranceMinutes: number = 3): boolean {
    const [expectedTime, expectedPeriod] = expected.split(' ');
    const [actualTime, actualPeriod] = actual.split(' ');

    const [expectedHours, expectedMinutes] = expectedTime.split(':').map(Number);
    const [actualHours, actualMinutes] = actualTime.split(':').map(Number);

    const expectedHours24 = expectedHours === 12 ? (expectedPeriod === 'am' ? 0 : 12) : expectedPeriod === 'am' ? expectedHours : expectedHours + 12;
    const actualHours24 = actualHours === 12 ? (actualPeriod === 'am' ? 0 : 12) : actualPeriod === 'am' ? actualHours : actualHours + 12;

    const diffInMinutes = Math.abs(expectedHours24 * 60 + expectedMinutes - (actualHours24 * 60 + actualMinutes));

    return diffInMinutes <= toleranceMinutes;
}

export async function isChecked(elementOrSelector: WebdriverIO.Element | PlatformSelector): Promise<void> {
    const element = await getElement(elementOrSelector);


    try {
        if (isMobilePlatform()) {
            // For native mobile apps (Android/iOS)
            const checkbox = element;

            // Check if element is a checkbox and try using getAttribute or isSelected, depending on the platform
            let isChecked;

            if (platformName === 'android') {
                // For Android, use 'checked' attribute if possible
                isChecked = (await checkbox.getAttribute('checked')) === 'true';
            } else if (platformName === 'ios') {
                // For iOS, use 'isSelected' method
                isChecked = await checkbox.isSelected();
            }

            if (isChecked) {
                console.log('The checkbox is checked');
            } else {
                console.log('The checkbox is not checked');
            }
        } else {
            const backgroundColor = await element.getCSSProperty('background-color');
            const color = await element.getCSSProperty('color');

            const expectedColor1 = '#4263eb'; // Blue
            const expectedColor2 = '#ffffff'; // White

            const actualBackgroundColorHex = backgroundColor?.parsed?.hex?.toLowerCase();
            const actualColorHex = color?.parsed?.hex?.toLowerCase();

            console.log('Actual background color:', actualBackgroundColorHex);
            console.log('Actual color:', actualColorHex);

            const isBackgroundColorMatched = actualBackgroundColorHex ? [expectedColor1, expectedColor2].includes(actualBackgroundColorHex) : false;
            const isColorMatched = actualColorHex ? [expectedColor1, expectedColor2].includes(actualColorHex) : false;

            expect(isBackgroundColorMatched || isColorMatched).toBe(true);
        }
    } catch (error) {
        console.error('Error in isChecked function:', error);
        throw error;
    }
}

export async function enterDataForWidgets(Widgets: string, elementOrSelector: WebdriverIO.Element | PlatformSelector, value?: string, otherElementOrSelector?: WebdriverIO.Element | PlatformSelector, otherElementOrSelector1?: WebdriverIO.Element | PlatformSelector) {
    switch (Widgets) {
        case 'radioset':
        case 'switch':
        case 'checkbox':
        case 'toggle':
        case 'chips':
            await actionHandler(elementOrSelector, 'isSelected');
            break;
        case 'number':
        case 'currency':
        case 'text':
            await actionHandler(elementOrSelector, 'enterValue', value);
            const enteredValue = await actionHandler(elementOrSelector, 'getValue');
            expect(enteredValue).toEqual(value); // Compare entered value with expected value
            break;
        case 'select':
            await actionHandler(elementOrSelector, 'click');
            if (otherElementOrSelector) {
                // Check if otherSelector is provided
                await actionHandler(otherElementOrSelector, 'click'); // Click the secondary element (e.g., dropdown option)
            }
            const getValue = await actionHandler(elementOrSelector, 'getText');
            expect(getValue).toEqual(value); // Compare selected value with expected value
            break;
        case 'autocomplete':
            await actionHandler(elementOrSelector, 'click');
            if (otherElementOrSelector) {
                // Check if otherSelector is provided
                await actionHandler(otherElementOrSelector, 'click'); // Click the secondary element (e.g., dropdown option)
            }
            const selectedValue = await actionHandler(elementOrSelector, 'getValue');
            expect(selectedValue).toEqual(value); // Compare selected value with expected value
            break;
        case 'textarea':
            const inputNumber = '1'.repeat(501);
            console.log('Generated input number:', inputNumber); // Log the input number for debugging
            await actionHandler(elementOrSelector, 'enterValue', inputNumber); // Enter the generated input number into the field
            await browser.pause(1000); // Wait for a moment to ensure the value is entered
            const textAreaValue = await actionHandler(elementOrSelector, 'getValue');
            expect(textAreaValue).toEqual(inputNumber); // Compare textarea value with expected value
            break;
        case 'date':
            await actionHandler(elementOrSelector, 'click');
            if (otherElementOrSelector) {
                await actionHandler(otherElementOrSelector, 'click');
            }
            const datecolResult = await actionHandler(elementOrSelector, 'getText');
            expect(datecolResult).toEqual(getCurrentFormattedDate());
            break;
        case 'time':
            await actionHandler(elementOrSelector, 'click');
            if (otherElementOrSelector) {
                await actionHandler(otherElementOrSelector, 'click');
            }
            const timecolResult = await actionHandler(elementOrSelector, 'getText'); // Default to an empty string if undefined
            const formattedTime = getCurrentFormattedTime();
            console.log(`Expected time: ${formattedTime}`);
            console.log(`Received time: ${timecolResult}`);
            if (typeof timecolResult !== 'string') {
                throw new Error('Expected timecolResult to be a string');
            }
            expect(isTimeCloseEnoughIgnoreSeconds(formattedTime, timecolResult, 5)).toBe(true);
            break;
        case 'datetime':
        case 'timestamp':
            await actionHandler(elementOrSelector, 'click');
            if (otherElementOrSelector) {
                await actionHandler(otherElementOrSelector, 'click');
            }
            if (otherElementOrSelector1) {
                await actionHandler(otherElementOrSelector1, 'click');
            }
            const datetimecolResult = await actionHandler(elementOrSelector, 'getText'); // Default to an empty string if undefined
            const formattedDateTime = getCurrentFormattedDateTime();
            // Console the expected and received values
            console.log(`Expected datetime: ${formattedDateTime}`);
            console.log(`Received datetime: ${datetimecolResult}`);
            if (typeof datetimecolResult !== 'string') {
                throw new Error('Expected datetimecolResult to be a string');
            }
            expect(isTimeCloseEnough(formattedDateTime, datetimecolResult, 5)).toBe(true);
            break;
        default:
            throw new Error(`Unsupported action ${Widgets} for element ${elementOrSelector}`);
    }
}

interface TestData {
    [key: string]: string;
}

// export async function titleVerification(elementOrSelector: WebdriverIO.Element | PlatformSelector, expectedValue: string) {
//     const testData: TestData = testDataFormApp.AllDataTypeScreen;
//     const actualValue = await actionHandler(elementOrSelector, 'getText');
//     expect(actualValue).toEqual(testData[expectedValue as keyof TestData]);
// }

export async function isAutoFocus(element: WebdriverIO.Element) {
    await waitForElementToBeDisplayed(element);
    const isFocused = await element.getAttribute('focused');
    await log(`Check the focus: ${isFocused}`);
    return isFocused === 'true';
}

export async function isEnabled(element: WebdriverIO.Element) {
    try {
        await waitForElementToBeDisplayed(element);
        const ele = await element.isEnabled();
        await log(`Check element is enabled: ${ele}`);
        return ele;
    } catch (error) {
        await log(`Element is not enabled or not displayed: ${error}`);
        return false;
    }
}

export async function onKeyPress(elementOrSelector1: WebdriverIO.Element | PlatformSelector, elementOrSelector2: WebdriverIO.Element | PlatformSelector, textToType: string) {
    const element1 = await getElement(elementOrSelector1);
    const element2 = await getElement(elementOrSelector2);

    let accumulatedText = '';
    for (let char of textToType) {
        accumulatedText += char;

        if (platformName === 'web') {
            await element1.addValue(char);
        } else if (platformName === 'android' || platformName === 'ios') {
            await clearField(element1);
            await element1.setValue(accumulatedText);
        }
        let text = await getElementText(element2);
        console.log(`Expected value: ${accumulatedText}`);
        console.log(`Actual value: ${text}`);
        expect(text).toEqual(accumulatedText);
    }
}

export function getFormattedDateWithConstantDay(day: string): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    return `${day}-${month}-${year}`;
}

export async function isDisplayed(elementOrSelector: WebdriverIO.Element | PlatformSelector, timeout: number = 5000): Promise<boolean> {
    const emp = await getElement(elementOrSelector);
    try {
        await waitForElementToBeDisplayed(emp, timeout);
        console.log(`Element for ${emp.selector} is displayed.`);
        return true;
    } catch (error) {
        console.log(`Element for ${emp.selector} is not displayed.`);
        return false;
    }
}

export function isvalidDateTimeFormat(datetime: string): boolean {
    const currentFormattedDateTime = getCurrentFormattedDateTime();
    const [currentDatePart, currentTimePart] = currentFormattedDateTime.split(' ');
    const [inputDatePart, inputTimePart] = datetime.split(' ');

    return (
        currentDatePart.split(',').length === inputDatePart.split(',').length &&
        currentTimePart.split(':').length === inputTimePart.split(':').length &&
        Boolean(/am|pm$/.exec(currentTimePart)) === Boolean(/am|pm$/.exec(inputTimePart))
    );
}

export async function performAction(elementOrSelector: WebdriverIO.Element | PlatformSelector, action: string, value?: string) {
    const element = await getElement(elementOrSelector);

    switch (action) {
        case 'getText':
            await element.waitForDisplayed();
            return await getElementText(element);
        case 'click':
            await element.waitForClickable();
            await clickelement(element);
            break;
        case 'enterValue':
            await element.waitForClickable();
            await element.click();
            await enterText(element, value || '');
            break;
        case 'enablecheck':
            await element.isEnabled();
            break;
        case 'getValue':
            await element.waitForDisplayed();
            return await element.getValue();
        default:
            throw new Error(`Unsupported action ${action} for element ${element.selector}`);
    }
}

export async function assertElementTextMatchesAll(elementOrSelector: WebdriverIO.Element | PlatformSelector, expectedSelectors: string[]): Promise<void> {
    const elementText = await getElementText(elementOrSelector);
    for (const expectedSelector of expectedSelectors) {
        const expectedText = await getElementText(await $(expectedSelector)); // Get text of each expected selector
        expect(elementText).toEqual(expectedText); // Compare with each text value
    }
    console.log(`All comparisons passed for element '${elementOrSelector}' with expected selectors.`);
}

export async function isElementNotDisplayed(elementOrSelector: WebdriverIO.Element | PlatformSelector) {
    const element = await getElement(elementOrSelector);
    const result = await element.isExisting();
    if (!result) {
        expect(result).toBe(false);
    } else {
        expect(result).toBe(true);
    }
}

export async function verifyActualVsExpected(
    elementOrSelector: WebdriverIO.Element | PlatformSelector,
    expected: string
) {
    try {
        const actualData = await getElementText(elementOrSelector);
        await log(
            `Verifying actual vs expected: "${actualData}" === "${expected}"`
        );
        expect(actualData).toEqual(expected);
        await log(
            `✅ Assertion passed: Actual value "${actualData}" matches expected "${expected}"`
        );
    } catch (error) {
        const actualData = await getElementText(elementOrSelector);
        await log(
            `❌ Assertion failed: Actual value "${actualData}" does not match expected "${expected}"`
        );
        throw error;
    }
}
export function assertStringsAreSame(actual: string, expected: string) {
    expect(actual).toEqual(expected);
}

export function assertStringsAreNotSame(actual: string, expected: string) {
    expect(actual).not.toEqual(expected);
}

export function ensureDirectoryExists(dirPath: any) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`Directory created: ${dirPath}`);
    } else {
        console.log(`Directory already exists: ${dirPath}`);
    }
}

export async function generateAllureReport(projectName: string = "defaultProject", platform: string = "defaultPlatform") {
    const resultsPath = path.join(__dirname, `../reports/${projectName}/${platform}/allure-results`);
    const reportPath = path.join(__dirname, `../reports/allure-report/${projectName}/${platform}`);

    // ✅ Check if allure-results directory exists
    if (!fs.existsSync(resultsPath)) {
        console.error(`❌ ERROR: Allure results directory does not exist: ${resultsPath}`);
        return;
    }

    try {
        // ✅ Execute command & capture output
        const { stdout, stderr } = await execPromise(
            `rm -rf ${reportPath} && allure generate ${resultsPath} -o ${reportPath}`
        );

        if (stderr) {
            console.warn(`⚠️ Warning: ${stderr.trim()}`); // Capture non-critical warnings
        }

        console.log(`✅ Allure report successfully generated at: ${reportPath}`);
    } catch (error: any) {
        console.error(`❌ ERROR: Failed to generate Allure report: ${error.message}`);
        console.error(`🔍 Full Error Details:`, error);
    }
}

export async function removeFile(path: string) {
    if (existsSync(path)) {
        await clearDirectory(path);
        console.log(`Cleared Directory: ${path}`);
    } else {
        console.log(`File not deleted: ${path}`)
    }
}


function expoUrl(): string | PromiseLike<string> {

    if (!process.env.EXPO_URL) {
        const networkInterfaces = os.networkInterfaces();

        for (const interfaceName in networkInterfaces) {
            const interfaces = networkInterfaces[interfaceName];
            if (!interfaces) continue;
            for (const details of interfaces) {
                if (details.family === 'IPv4' && !details.internal) {
                    const ip = details.address;
                    return `exp://${ip}:8081`;
                }
            }
        }
    }

    return process.env.EXPO_URL || 'undefined';

}

export async function getCenterCoordinates(): Promise<{ x: number; y: number }> {
    const { width, height } = await driver.getWindowRect();
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    console.log(`Center coordinates: (${centerX}, ${centerY})`);
    return { x: centerX, y: centerY };
}

export async function swipeToElement(
    elementOrSelector: WebdriverIO.Element | PlatformSelector,
    direction: 'up' | 'down' = 'down',
    maxSwipes: number = 10
): Promise<void> {
    const selector = isPlatformSelector(elementOrSelector) ? elementOrSelector : (elementOrSelector as any).selector;
    await log(`Swiping to element: ${selector} in direction: ${direction}`);
    
    // Helper function to check if element exists and is visible
    const checkElementVisibility = async (): Promise<boolean> => {
        try {
            const element = await getElement(elementOrSelector);
            const elementAny = element as any;
            return await elementAny.isDisplayed();
        } catch (error) {
            return false;
        }
    };
    
    // Check if element is already visible
    let isVisible = await checkElementVisibility();
    if (isVisible) {
        await log(`Element is already visible, no swiping needed`);
        return;
    }
    
    let swipes = 0;
    const driverAny = driver as any;
    
    // Try to get screen size with fallback to default values
    let width = 1080; // Default Android screen width
    let height = 1920; // Default Android screen height
    
    try {
        const screenSize = await getScreenSize();
        width = screenSize.width;
        height = screenSize.height;
    } catch (error: any) {
        await log(`Warning: Could not get screen size, using defaults (${width}x${height}). Error: ${error?.message || error}`);
        // Continue with default values
    }

    while (!isVisible && swipes < maxSwipes) {
        try {
            const startX = Math.floor(width / 3);
            let startY, endY;

            if (direction === 'down') {
                // Swipe down: start from bottom (80%) and swipe up to top (20%)
                startY = Math.floor(height * 0.8);
                endY = Math.floor(height * 0.2);
            } else {
                // Swipe up: start from top (40%) and swipe down to bottom (80%)
                startY = Math.floor(height * 0.4);
                endY = Math.floor(height * 0.8);
            }

            await driverAny.performActions([
                {
                    type: 'pointer',
                    id: 'finger1',
                    parameters: { pointerType: 'touch' },
                    actions: [
                        { type: 'pointerMove', duration: 0, x: startX, y: startY },
                        { type: 'pointerDown', button: 0 },
                        { type: 'pause', duration: 100 },
                        { type: 'pointerMove', duration: 1000, x: startX, y: endY },
                        { type: 'pointerUp', button: 0 },
                    ],
                },
            ]);

            await waitFor(SWIPE_DELAY);
            
            // Check if element is now visible after swipe
            isVisible = await checkElementVisibility();
            swipes++;
            
            if (isVisible) {
                await log(`Element found and visible after ${swipes} swipe(s)`);
                break;
            }
        } catch (error: any) {
            await log(`Error during swipe attempt ${swipes + 1}: ${error?.message || error}`);
            // If it's a critical error that suggests the session is broken, throw it
            if (error?.message?.includes('instrumentation process') || 
                error?.message?.includes('UiAutomator2') ||
                error?.message?.includes('session') ||
                error?.message?.includes('crashed')) {
                throw new Error(`Failed to swipe: ${error.message}. Selector: ${selector}`);
            }
            // Otherwise, continue with next swipe attempt
            swipes++;
            await waitFor(500); // Wait a bit before retrying
        }
    }

    if (!isVisible) {
        throw new Error(`Element not visible after ${maxSwipes} swipes. Selector: ${selector}`);
    }
}

export async function setOrientation(orientation: 'PORTRAIT' | 'LANDSCAPE'): Promise<void> {
    try {

        if (isMobile) {
            await driver.setOrientation(orientation);
        }

        else {
            await driver.executeScript(`screen.orientation.lock('${orientation.toLowerCase()}')`, []);
        }

        console.log(`Orientation set to ${orientation}`);
    } catch (error) {
        console.error(`Failed to set orientation: ${error}`);
    }


}
export async function tapAtCoordinates(x: number, y: number): Promise<void> {
    try {
        // Get screen dimensions
        const { width, height } = await driver.getWindowRect();

        // Validate coordinates are within screen bounds
        if (x < 0 || x > width || y < 0 || y > height) {
            throw new Error(
                `Coordinates (${x}, ${y}) are outside screen bounds (${width}x${height})`
            );
        }

        await log(`Tapping at coordinates (${x}, ${y})`);

        // Execute tap action using W3C Actions API
        const driverAny = driver as any;
        await driverAny.performActions([
            {
                type: 'pointer',
                id: 'finger1',
                parameters: { pointerType: 'touch' },
                actions: [
                    { type: 'pointerMove', duration: 0, x: Math.floor(x), y: Math.floor(y) },
                    { type: 'pointerDown', button: 0 },
                    { type: 'pause', duration: 100 },
                    { type: 'pointerUp', button: 0 }
                ]
            }
        ]);

        // Add small wait after tap
        await waitFor(500);
    } catch (error) {
        if (error instanceof Error) {
            await log(`Failed to tap at coordinates (${x}, ${y}): ${error.message}`);
        } else {
            await log(`Failed to tap at coordinates (${x}, ${y}): ${String(error)}`);
        }
        throw error;
    }
}

export async function swipeToElementHorizontally(
    locationElementOrSelector: WebdriverIO.Element | PlatformSelector,
    targetElementOrSelector: WebdriverIO.Element | PlatformSelector,
    direction: 'left' | 'right' = 'right',
    maxSwipes: number = 10
): Promise<void> {
    const locationElement = await getElement(locationElementOrSelector);
    const targetElement = await getElement(targetElementOrSelector);

    await log(`Swiping to element: ${targetElement.selector} in direction: ${direction}`);
    let isVisible = await targetElement.isDisplayed();
    let swipes = 0;

    try {
        // Get the Y coordinate from the location element
        const location = await locationElement.getLocation();
        const elementY = location.y;
        await log(`Swiping at Y coordinate: ${elementY}`);

        while (!isVisible && swipes < maxSwipes) {
            const { width } = await driver.getWindowRect();
            let startX, endX;

            if (direction === 'right') {
                startX = Math.floor(width * 0.2);
                endX = Math.floor(width * 0.8);
            } else {
                startX = Math.floor(width * 0.8);
                endX = Math.floor(width * 0.2);
            }

            const driverAny = driver as any;
            await driverAny.performActions([
                {
                    type: 'pointer',
                    id: 'finger1',
                    parameters: { pointerType: 'touch' },
                    actions: [
                        { type: 'pointerMove', duration: 0, x: startX, y: elementY },
                        { type: 'pointerDown', button: 0 },
                        { type: 'pause', duration: 100 },
                        { type: 'pointerMove', duration: 1000, x: endX, y: elementY },
                        { type: 'pointerUp', button: 0 },
                    ],
                },
            ]);

            await waitFor(SWIPE_DELAY);
            isVisible = await targetElement.isDisplayed();
            swipes++;
        }

        if (!isVisible) {
            throw new Error(`Target element not visible after ${maxSwipes} swipes`);
        }
    } catch (error) {
        throw new Error(`Failed to swipe to element: ${error}`);
    }
}
export async function getCurrentAppIdentifier() {
    if (driver.isAndroid) {
        try {
            const currentPackage = await driver.getCurrentPackage();
            console.log('Android Package:', currentPackage);
            return currentPackage;
        }
        catch (error) {
            console.error('Error getting Android package:', error);
            throw new Error('Failed to get Android package');
        }
    }

    else if (driver.isIOS) {
        // On iOS, we can try getting the bundleId using mobile:activeAppInfo

        try {
            const appInfo = await driver.execute('mobile: activeAppInfo');
            const bundleId = (appInfo as { bundleId?: string })?.bundleId || 'Unknown';
            console.log('iOS Bundle ID:', bundleId);
            return bundleId;
        }
        catch (error) {
            console.error('Error getting iOS bundle ID:', error);
            throw new Error('Failed to get iOS bundle ID');
        }
    }

    else if (driver.isMobile === false) {
        try {
            // For web, return the current hostname or URL
            const url = await browser.getUrl();
            const hostname = new URL(url).hostname;
            console.log('Web Hostname:', hostname);
            return hostname;
        }
        catch (error) {
            console.error('Error getting web hostname:', error);
            throw new Error('Failed to get web hostname');
        }
    }

    throw new Error('Unsupported platform');
}
