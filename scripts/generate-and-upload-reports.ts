#!/usr/bin/env npx ts-node
/**
 * Generate reports from existing test results and upload to S3.
 * Uses path: releases/<version>/<projectname>/<platform>/<date-time>
 *
 * 1. Playwright: generates from logs/playwright-log.json → reports/playwright-report.html, then uploads
 * 2. Allure: android and ios results are never merged. Each platform gets its own single-file
 *    report (allure generate --single-file) and its own S3 upload under SWSAndroid / SWSIos.
 *
 * Skips generation/upload if source data doesn't exist.
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();

function run(cmd: string, desc: string): boolean {
    try {
        console.log(`\n📦 ${desc}...`);
        execSync(cmd, { cwd: ROOT, stdio: "inherit" });
        return true;
    } catch (e) {
        console.warn(`⚠️  ${desc} failed or skipped`);
        return false;
    }
}

function main() {
    console.log("🚀 Generate and upload reports to S3 (latest path)");
    console.log("   Path: releases/<version>/Style Workspace/<platform>/SWS<PlatformName>");

    let uploaded = false;

    // Playwright: generate from logs if exists, then upload
    const playwrightLog = path.join(ROOT, "logs", "playwright-log.json");
    if (fs.existsSync(playwrightLog)) {
        run("npx ts-node scripts/generate-playwright-report.ts", "Generate Playwright report");
        if (fs.existsSync(path.join(ROOT, "reports", "playwright-report.html"))) {
            if (run("npx ts-node scripts/upload-to-s3.ts", "Upload Playwright report to S3")) {
                uploaded = true;
            }
        }
    } else {
        // Try uploading existing playwright-report or reports/ folder
        const pwReport = path.join(ROOT, "playwright-report");
        const reportsDir = path.join(ROOT, "reports");
        if (fs.existsSync(pwReport) || fs.existsSync(reportsDir)) {
            if (run("npx ts-node scripts/upload-to-s3.ts", "Upload existing Playwright report to S3")) {
                uploaded = true;
            }
        }
    }

    // Allure: generate a self-contained single-file report per platform, uploaded to its own
    // S3 path. Android and iOS are never merged — each platform gets its own report + upload.
    const allureResults = path.join(ROOT, "allure-results");
    const allureResultsAndroid = path.join(ROOT, "allure-results-android");
    const allureResultsIos = path.join(ROOT, "allure-results-ios");
    const hasAndroidResults =
        fs.existsSync(allureResultsAndroid) &&
        fs.readdirSync(allureResultsAndroid).length > 0;
    const hasIosResults =
        fs.existsSync(allureResultsIos) &&
        fs.readdirSync(allureResultsIos).length > 0;

    function generateAndUploadSingleFile(resultsDir: string, platform?: "android" | "ios"): boolean {
        const suffix = platform ? `-${platform}` : "";
        const label = platform ? ` (${platform})` : "";
        const outputDir = path.join(ROOT, "reports", `allure-single${suffix}`);
        const indexHtml = path.join(outputDir, "index.html");
        const relResultsDir = path.relative(ROOT, resultsDir);
        const relOutputDir = path.relative(ROOT, outputDir);
        const platformEnv = platform ? `S3_REPORT_PLATFORM=${platform} ` : "";

        run(
            `ALLURE_RESULTS_DIR=${relResultsDir} ALLURE_SINGLE_OUTPUT_DIR=${relOutputDir} npx ts-node scripts/generate-allure-single-html.ts`,
            `Generate single-file Allure report${label}`,
        );
        if (!fs.existsSync(indexHtml)) {
            return false;
        }
        return run(
            `ALLURE_SINGLE_HTML_PATH=${relOutputDir}/index.html ${platformEnv}npx ts-node scripts/upload-allure-single-html-to-s3.ts`,
            `Upload single-file Allure report to S3${label}`,
        );
    }

    if (hasAndroidResults && generateAndUploadSingleFile(allureResultsAndroid, "android")) {
        uploaded = true;
    }
    if (hasIosResults && generateAndUploadSingleFile(allureResultsIos, "ios")) {
        uploaded = true;
    }
    if (
        !hasAndroidResults &&
        !hasIosResults &&
        fs.existsSync(allureResults) &&
        fs.readdirSync(allureResults).length > 0 &&
        generateAndUploadSingleFile(allureResults)
    ) {
        uploaded = true;
    }

    const hadReportSources =
        fs.existsSync(playwrightLog) ||
        fs.existsSync(path.join(ROOT, "playwright-report")) ||
        fs.existsSync(path.join(ROOT, "reports", "playwright-report.html")) ||
        hasAndroidResults ||
        hasIosResults ||
        fs.existsSync(allureResults);

    if (!uploaded) {
        if (hadReportSources) {
            console.error("\n❌ Report data was present but nothing was uploaded (generation or S3 errors).");
            process.exit(1);
        }
        console.warn("\n⚠️ No report sources on disk; skipping S3 upload.");
        process.exit(0);
    }

    console.log("\n✅ Done.");
}

main();
