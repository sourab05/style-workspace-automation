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
const playwrightReportDir = path.join(process.cwd(), "playwright-report");
const reportsDir = path.join(process.cwd(), "reports");
// Prefer reports/ (custom single-file report) over playwright-report/ (thousands of artifacts) for faster uploads
const reportDir = fs.existsSync(reportsDir) ? reportsDir : playwrightReportDir;
const platform = process.env.SLOT_VERIFY_TARGET || process.env.VERIFY_TARGET || process.env.S3_REPORT_PLATFORM || "both";
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
    const sizeMB = (fs.statSync(filePath).size / (1024 * 1024)).toFixed(1);
    if (parseFloat(sizeMB) > 10) {
        console.log(`⏳ Uploading ${path.basename(filePath)} (${sizeMB} MB)...`);
    }
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

        upload.on("httpUploadProgress", (progress) => {
            // console.log(`Progress: ${progress.loaded}/${progress.total}`);
        });

        await upload.done();
        console.log(`✅ Uploaded: ${s3Key} (${sizeMB} MB)`);
    } catch (error) {
        console.error(`❌ Failed to upload ${filePath}:`, error);
    }
}

async function uploadDirectory(dirPath: string, s3PathPrefix: string, baseDir?: string) {
    const root = baseDir ?? dirPath;
    const files = fs.readdirSync(dirPath);

    for (const file of files) {
        const fullPath = path.join(dirPath, file);
        const relativePath = path.relative(root, fullPath);
        const s3Key = path.join(s3PathPrefix, relativePath).replace(/\\/g, "/");

        if (fs.statSync(fullPath).isDirectory()) {
            await uploadDirectory(fullPath, s3PathPrefix, root);
        } else {
            await uploadFile(fullPath, s3Key);
        }
    }
}

async function main() {
    if (!fs.existsSync(reportDir)) {
        console.error(`❌ No Playwright report found. Tried: ${playwrightReportDir} and ${reportsDir}`);
        console.error("   Run tests first: npm run test:slots && npm run report:generate");
        process.exit(1);
    }

    const reportLink =
        reportDir === reportsDir
            ? `${s3Prefix}/playwright-report.html`
            : `${s3Prefix}/index.html`;

    console.log(`🚀 Starting upload of ${reportDir} to s3://${bucketName}/${s3Prefix}`);

    try {
        await uploadDirectory(reportDir, s3Prefix);
        console.log("\n🎉 Upload completed successfully!");
        console.log(`🔗 Report Link: https://${bucketName}.s3.${region}.amazonaws.com/${reportLink}`);
    } catch (error) {
        console.error("❌ Error during upload:", error);
        process.exit(1);
    }
}

main();
