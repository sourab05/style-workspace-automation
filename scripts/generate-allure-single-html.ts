#!/usr/bin/env npx ts-node
/**
 * Build a self-contained single-file Allure HTML report.
 * Writes to reports/allure-single/ — does NOT modify allure-report, allure-report-stageai, etc.
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const resultsDir = path.resolve(ROOT, process.env.ALLURE_RESULTS_DIR || "allure-results");
const outputDir = path.resolve(ROOT, process.env.ALLURE_SINGLE_OUTPUT_DIR || path.join("reports", "allure-single"));

function main() {
  if (!fs.existsSync(resultsDir)) {
    console.error(`❌ allure-results not found: ${resultsDir}`);
    process.exit(1);
  }

  fs.mkdirSync(path.join(ROOT, "reports"), { recursive: true });
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }

  console.log("📦 Generating single-file Allure report (existing reports untouched)...");
  execSync(
    `npx allure generate "${resultsDir}" --config scripts/allurerc.single.mjs -o "${outputDir}"`,
    { cwd: ROOT, stdio: "inherit" }
  );

  const indexHtml = path.join(outputDir, "index.html");
  if (!fs.existsSync(indexHtml)) {
    console.error(`❌ Expected ${indexHtml} after generate`);
    process.exit(1);
  }

  const sizeMB = (fs.statSync(indexHtml).size / (1024 * 1024)).toFixed(1);
  console.log(`\n✅ Single-file report: ${indexHtml} (${sizeMB} MB)`);
  console.log(`   Open locally: open ${path.relative(ROOT, indexHtml)}`);
}

main();
