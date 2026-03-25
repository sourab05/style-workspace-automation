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
const reportDir = path.join(process.cwd(), "allure-report");
const platform = process.env.PLATFORM || process.env.S3_REPORT_PLATFORM || "android";
const defaultPrefix = buildS3ReportPath({ platform });
const s3Prefix = process.env.S3_PATH_PREFIX || defaultPrefix;

if (!bucketName) {
    console.error("❌ S3_BUCKET_NAME is not defined in .env");
    process.exit(1);
}

const s3Client = new S3Client({
    region,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
});

async function uploadFile(filePath: string, s3Key: string) {
    const fileStream = fs.createReadStream(filePath);
    const contentType = mime.lookup(filePath) || "application/octet-stream";

    try {
        const upload = new Upload({
            client: s3Client,
            params: {
                Bucket: bucketName,
                Key: s3Key,
                Body: fileStream,
                ContentType: contentType,
                ACL: "public-read",
            },
        });

        await upload.done();
        console.log(`✅ Uploaded: ${s3Key}`);
    } catch (error) {
        console.error(`❌ Failed to upload ${filePath}:`, error);
    }
}

async function uploadDirectory(dirPath: string, s3PathPrefix: string) {
    const files = fs.readdirSync(dirPath);

    for (const file of files) {
        const fullPath = path.join(dirPath, file);
        const relativePath = path.relative(reportDir, fullPath);
        const s3Key = path.join(s3PathPrefix, relativePath).replace(/\\/g, "/");

        if (fs.statSync(fullPath).isDirectory()) {
            await uploadDirectory(fullPath, s3PathPrefix);
        } else {
            await uploadFile(fullPath, s3Key);
        }
    }
}

async function main() {
    if (!fs.existsSync(reportDir)) {
        console.error(`❌ Allure report directory not found: ${reportDir}`);
        process.exit(1);
    }

    console.log(`🚀 Uploading Allure report to s3://${bucketName}/${s3Prefix}`);

    try {
        await uploadDirectory(reportDir, s3Prefix);
        console.log("\n🎉 Allure report upload completed!");
        console.log(`🔗 Report Link: https://${bucketName}.s3.${region}.amazonaws.com/${s3Prefix}/index.html`);
    } catch (error) {
        console.error("❌ Error during Allure upload:", error);
        process.exit(1);
    }
}

main();

