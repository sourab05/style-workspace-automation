/**
 * Builds S3 path prefix for Style Workspace reports:
 * react_native/releases/<version>/<projectname>/<platform>/SWS<PlatformName>
 *
 * Example: wm-qa-automation/react_native/releases/WM-AI-Beta-2/Style Workspace/android/SWSAndroid
 * Combined mobile: .../both/SWSBoth
 */

export interface S3PathOptions {
    /** Version: e.g. 12.0.0 */
    version?: string;
    /** Project name: e.g. Style Workspace */
    projectName?: string;
    /** Platform: canvas, preview, both (Playwright) or android, ios, both (Allure) */
    platform?: string;
    /** mobile = Allure path; web = Playwright path (when platform not explicit) */
    kind?: "mobile" | "web";
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
 * Resolves S3 path segment for platform (android | ios | both | canvas | preview).
 * Mobile Allure uploads prefer MOBILE_PLATFORM; Playwright uploads prefer SLOT_VERIFY_TARGET.
 */
export function resolveS3ReportPlatform(
    options: { platform?: string; kind?: "mobile" | "web" } = {},
): string {
    if (options.platform?.trim()) {
        return options.platform.trim().toLowerCase();
    }
    const explicit = process.env.S3_REPORT_PLATFORM?.trim();
    if (explicit) {
        return explicit.toLowerCase();
    }
    if (options.kind === "mobile") {
        const mobile = process.env.MOBILE_PLATFORM?.trim();
        if (mobile) return mobile.toLowerCase();
        const platform = process.env.PLATFORM?.trim();
        if (platform) return platform.toLowerCase();
        return "android";
    }
    const slot =
        process.env.SLOT_VERIFY_TARGET?.trim() ||
        process.env.VERIFY_TARGET?.trim();
    if (slot) return slot.toLowerCase();
    const mobile = process.env.MOBILE_PLATFORM?.trim();
    if (mobile) return mobile.toLowerCase();
    const platform = process.env.PLATFORM?.trim();
    if (platform) return platform.toLowerCase();
    return "canvas";
}

/**
 * Builds the S3 path prefix from env vars or options.
 */
export function buildS3ReportPath(options: S3PathOptions = {}): string {
    const platform = resolveS3ReportPlatform({
        platform: options.platform,
        kind: options.kind,
    });
    const version = getVersion(options);
    const projectName = options.projectName || process.env.S3_REPORT_PROJECT || DEFAULT_PROJECT;
    const reportName = process.env.S3_REPORT_NAME || buildReportName(platform);

    return [BASE_PATH, version, projectName, platform, reportName].filter(Boolean).join("/");
}
