/**
 * Builds S3 path prefix for Style Workspace reports:
 * releases/<version>/<projectname>/<platform>/<date-time>
 *
 * Example: wm-qa-automation/releases/12.0.0/Style Workspace/android/2025-02-24-14-30-45
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
const BASE_PATH = "releases";

function getVersion(options: S3PathOptions): string {
    if (options.version) return options.version;
    if (process.env.S3_REPORT_VERSION) return process.env.S3_REPORT_VERSION;
    return "12.0.0";
}

function getDateTime(): string {
    const d = new Date();
    return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, "0"),
        String(d.getDate()).padStart(2, "0"),
        String(d.getHours()).padStart(2, "0"),
        String(d.getMinutes()).padStart(2, "0"),
        String(d.getSeconds()).padStart(2, "0"),
    ].join("-");
}

/**
 * Builds the S3 path prefix from env vars or options.
 */
export function buildS3ReportPath(options: S3PathOptions = {}): string {
    const platform = options.platform || process.env.S3_REPORT_PLATFORM || process.env.PLATFORM || "canvas";
    const version = getVersion(options);
    const projectName = options.projectName || process.env.S3_REPORT_PROJECT || DEFAULT_PROJECT;
    const dateTime = process.env.S3_REPORT_DATETIME || getDateTime();

    return [BASE_PATH, version, projectName, platform, dateTime].filter(Boolean).join("/");
}
