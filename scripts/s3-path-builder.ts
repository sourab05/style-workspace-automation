/**
 * Builds S3 path prefix for Style Workspace reports:
 * react_native/releases/<version>/<projectname>/<platform>/SWS<PlatformName>
 *
 * Example: wm-qa-automation/react_native/releases/WM-AI-Beta-2/Style Workspace/android/SWSAndroid
 */

export interface S3PathOptions {
    /** Version: e.g. 12.0.0 */
    version?: string;
    /** Project name: e.g. Style Workspace */
    projectName?: string;
    /** Platform: canvas, preview, both (Playwright) or android, ios (Allure) */
    platform?: string;
}

const DEFAULT_PROJECT = "Style Workspace";
const BASE_PATH = process.env.S3_RELEASES_BASE || "react_native/releases";

function getVersion(options: S3PathOptions): string {
    if (options.version) return options.version;
    const fromEnv = process.env.S3_VERSION?.trim() || process.env.S3_REPORT_VERSION?.trim();
    if (fromEnv) return fromEnv;
    return "12.0.0";
}

function capitalizeFirst(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function buildReportName(platform: string): string {
    return `SWS${capitalizeFirst(platform)}`;
}

/**
 * Builds the S3 path prefix from env vars or options.
 */
export function buildS3ReportPath(options: S3PathOptions = {}): string {
    const platform = options.platform || process.env.S3_REPORT_PLATFORM || process.env.PLATFORM || "canvas";
    const version = getVersion(options);
    const projectName = options.projectName || process.env.S3_REPORT_PROJECT || DEFAULT_PROJECT;
    const reportName = process.env.S3_REPORT_NAME || buildReportName(platform);

    return [BASE_PATH, version, projectName, platform, reportName].filter(Boolean).join("/");
}
