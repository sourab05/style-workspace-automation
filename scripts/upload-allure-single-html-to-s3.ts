#!/usr/bin/env npx ts-node
/**
 * Upload only the single-file Allure HTML (reports/allure-single/index.html).
 * Does not upload or modify allure-report-stageai or other report folders.
 */

import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import fs from "fs";
import path from "path";
import mime from "mime-types";
import dotenv from "dotenv";
import { buildS3ReportPath } from "./s3-path-builder";

dotenv.config();

const region = process.env.AWS_REGION || "us-west-2";
const bucketName = process.env.S3_BUCKET_NAME || "wm-qa-automation";
const htmlPath = path.resolve(
  process.cwd(),
  process.env.ALLURE_SINGLE_HTML_PATH || "reports/allure-single/index.html"
);
const s3FileName = process.env.ALLURE_S3_HTML_NAME || "index.html";
const platform = process.env.PLATFORM || process.env.S3_REPORT_PLATFORM || "android";
const defaultPrefix = buildS3ReportPath({ platform });
const s3Prefix = (
  process.env.S3_REPORT_PREFIX ||
  process.env.S3_PATH_PREFIX ||
  defaultPrefix
).replace(/\\/g, "/").replace(/\/+$/, "");

const s3Client = new S3Client({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

async function main() {
  if (!bucketName) {
    console.error("❌ S3_BUCKET_NAME is not defined in .env");
    process.exit(1);
  }
  if (!fs.existsSync(htmlPath)) {
    console.error(`❌ Single-file report not found: ${htmlPath}`);
    console.error("   Run: pnpm run allure:generate:single");
    process.exit(1);
  }

  const s3Key = `${s3Prefix}/${s3FileName}`.replace(/\\/g, "/");
  const sizeMB = (fs.statSync(htmlPath).size / (1024 * 1024)).toFixed(1);

  console.log(`🚀 Uploading single HTML (${sizeMB} MB) to s3://${bucketName}/${s3Key}`);

  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: bucketName,
      Key: s3Key,
      Body: fs.createReadStream(htmlPath),
      ContentType: mime.lookup(htmlPath) || "text/html",
      ACL: "public-read",
    },
  });

  await upload.done();
  console.log("\n🎉 Upload completed!");
  console.log(`🔗 https://${bucketName}.s3.${region}.amazonaws.com/${s3Key}`);
}

main().catch((err) => {
  console.error("❌ Upload failed:", err);
  process.exit(1);
});
