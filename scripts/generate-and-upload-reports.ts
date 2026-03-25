#!/usr/bin/env npx ts-node
/**
 * Generate reports from existing test results and upload to S3.
 * Uses path: releases/<version>/<projectname>/<platform>/<date-time>
 *
 * 1. Playwright: generates from logs/playwright-log.json → reports/playwright-report.html, then uploads
 * 2. Allure: generates from allure-results → allure-report, then uploads
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
    console.log("   Path: releases/<version>/Style Workspace/<platform>/<date-time>");

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

    // Allure: generate from allure-results if exists, then upload
    const allureResults = path.join(ROOT, "allure-results");
    const allureReport = path.join(ROOT, "allure-report");
    if (fs.existsSync(allureResults)) {
        run("allure generate --clean allure-results -o allure-report", "Generate Allure report");
    }
    if (fs.existsSync(allureReport)) {
        if (run("npx ts-node scripts/upload-allure-to-s3.ts", "Upload Allure report to S3")) {
            uploaded = true;
        }
    }

    if (!uploaded) {
        console.error("\n❌ No reports were uploaded. Ensure you have:");
        console.error("   - Playwright: logs/playwright-log.json or playwright-report/ or reports/");
        console.error("   - Allure: allure-results/ or allure-report/");
        process.exit(1);
    }

    console.log("\n✅ Done.");
}

main();
