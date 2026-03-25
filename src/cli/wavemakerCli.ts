import * as path from 'path';
import * as fs from 'fs';
import { runCommand } from './commandRunner';

export interface BuildOptions {
  projectPath: string;
  destDir: string;
  timeout?: number;
}

export interface IOSBuildOptions extends BuildOptions {
  certificatePath?: string;
  certificatePassword?: string;
  provisioningProfilePath?: string;
}

export class WaveMakerCLI {
  /**
   * Build Android APK using WaveMaker CLI
   */
  async buildAndroid(options: BuildOptions): Promise<string> {
    const {
      projectPath,
      destDir,
      timeout = 45 * 60 * 1000 // 45 minutes default
    } = options;

    console.log('\n[WM CLI] 🔨 Starting Android APK build...\n');

    // Ensure dest directory exists
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const cmd = `npx @wavemaker/wm-reactnative-cli build android --projectPath "${projectPath}" --dest="${destDir}" --clean`;

    try {
      const override = parseInt(process.env.WM_BUILD_TIMEOUT_MINUTES || '', 10);
      const effTimeout = isNaN(override) ? timeout : override * 60 * 1000;

      const result = await runCommand(cmd, {
        cwd: projectPath,
        timeout: effTimeout,
        successPatterns: [
          'android BUILD SUCCEEDED',
          'Build successful! APK/IPA generated',
          'build completed',
          'BUILD SUCCEEDED'
        ]
      });

      // Attempt to parse APK path from logs first
      const combinedLogs = `${result.stdout}\n${result.stderr}`;
      const hintedMatch = combinedLogs.match(/check the file at\s*:\s*([^\s]+\.apk)/i);
      const hintedApk = hintedMatch?.[1];

      const androidOutputDir = path.join(destDir, 'output/android');
      const gradleOutputRoot = path.join(destDir, 'android', 'app', 'build', 'outputs', 'apk');

      const scanDirForApk = (dir: string, maxDepth: number = 3): string | undefined => {
        if (!fs.existsSync(dir) || maxDepth < 0) return undefined;

        const entries = fs.readdirSync(dir, { withFileTypes: true });

        // First, look for APK files in this directory
        const apkFile = entries
          .filter(e => e.isFile() && e.name.toLowerCase().endsWith('.apk'))
          .map(e => path.join(dir, e.name))[0];
        if (apkFile) {
          return apkFile;
        }

        // Then, recurse into subdirectories (bounded depth)
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const found = scanDirForApk(path.join(dir, entry.name), maxDepth - 1);
            if (found) return found;
          }
        }

        return undefined;
      };

      const scanForApk = (): string | undefined => {
        // 1) Prefer CLI-managed output directory, if it exists
        if (fs.existsSync(androidOutputDir)) {
          const directFiles = fs
            .readdirSync(androidOutputDir)
            .filter(f => f.toLowerCase().endsWith('.apk'));
          if (directFiles.length > 0) {
            return path.join(androidOutputDir, directFiles[0]);
          }
        }

        // 2) Fallback: search typical Gradle output tree
        if (fs.existsSync(gradleOutputRoot)) {
          const found = scanDirForApk(gradleOutputRoot, 4);
          if (found) return found;
        }

        // 3) Last resort: bounded recursive search from destDir (shallow)
        return scanDirForApk(destDir, 2);
      };

      const waitForFile = async (p: string, timeoutMs: number = 60_000, intervalMs: number = 2_000): Promise<boolean> => {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
          if (fs.existsSync(p)) return true;
          await new Promise(r => setTimeout(r, intervalMs));
        }
        return false;
      };

      // Poll for the APK to land on disk (race-proof)
      let apkPath: string | undefined;

      // 1. Priority: Check raw Gradle output (most reliable)
      // The CLI-managed output/android directory sometimes produces corrupted/truncated APKs
      if (fs.existsSync(gradleOutputRoot)) {
        const found = scanDirForApk(gradleOutputRoot, 4);
        if (found) {
          apkPath = found;
          console.log(`[WM CLI] ✅ Found APK in Gradle output: ${apkPath}`);
        }
      }

      // 2. Fallback: Parse path from logs
      if (!apkPath && hintedApk) {
        console.log(`[WM CLI] ℹ️ Detected APK path in logs: ${hintedApk}`);
        const ok = await waitForFile(hintedApk);
        if (ok) apkPath = hintedApk;
      }

      // 3. Check CLI-managed output directory (may be corrupted, so lower priority)
      if (!apkPath && fs.existsSync(androidOutputDir)) {
        const directFiles = fs
          .readdirSync(androidOutputDir)
          .filter(f => f.toLowerCase().endsWith('.apk'));
        if (directFiles.length > 0) {
          const candidate = path.join(androidOutputDir, directFiles[0]);
          // Verify it's not corrupted by checking size
          const size = fs.statSync(candidate).size;
          if (size > 20 * 1024 * 1024) { // At least 20MB
            apkPath = candidate;
            console.log(`[WM CLI] ✅ Found APK in CLI output dir: ${apkPath}`);
          } else {
            console.warn(`[WM CLI] ⚠️ APK in output dir appears corrupted (${(size / 1024 / 1024).toFixed(2)}MB), skipping`);
          }
        }
      }

      // 4. Last Resort: Scan other directories
      if (!apkPath) {
        console.log('[WM CLI] 🔎 Scanning for APK...');
        const start = Date.now();
        const timeoutMs = 60_000;
        while (Date.now() - start < timeoutMs && !apkPath) {
          const found = scanForApk();
          if (found) {
            apkPath = found;
            break;
          }
          await new Promise(r => setTimeout(r, 2_000));
        }
      }

      if (!apkPath) {
        throw new Error('No APK file found after build');
      }

      const fileSize = fs.statSync(apkPath).size;

      console.log(`\n[WM CLI] ✅ Android APK built successfully:`);
      console.log(`  Path: ${apkPath}`);
      console.log(`  Size: ${(fileSize / 1024 / 1024).toFixed(2)} MB\n`);

      return apkPath;
    } catch (error: any) {
      console.error('\n[WM CLI] ❌ Android build failed:', error.message);
      throw error;
    }
  }

  /**
   * Build iOS IPA using WaveMaker CLI
   */
  async buildIOS(options: IOSBuildOptions): Promise<string> {
    const {
      projectPath,
      destDir,
      certificatePath,
      certificatePassword,
      provisioningProfilePath,
      timeout = 45 * 60 * 1000 // 45 minutes default
    } = options;

    // Fallback to ENV if options are not provided
    const iCert = certificatePath || process.env.IOS_P12_CERT_PATH;
    const iCertPass = certificatePassword || process.env.IOS_P12_PASSWORD;
    const iProv = provisioningProfilePath || process.env.IOS_PROVISION_PROFILE_PATH;

    console.log('\n[WM CLI] 🔨 Starting iOS IPA build...\n');

    // Ensure dest directory exists
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // If Android build already wrote into the same destDir, its node_modules
    // folder can block the iOS CLI when it tries to clean the dest. Remove
    // it proactively to avoid ENOTEMPTY rmdir errors.
    const destNodeModules = path.join(destDir, 'node_modules');
    if (fs.existsSync(destNodeModules)) {
      try {
        fs.rmSync(destNodeModules, { recursive: true, force: true });
        console.log(`[WM CLI] 🧹 Removed dest node_modules before iOS build: ${destNodeModules}`);
      } catch (e: any) {
        console.warn(
          `[WM CLI] ⚠️ Failed to remove dest node_modules before iOS build: ${e?.message || e}`,
        );
      }
    }

    // Common iOS output locations
    const iosOutputDir = path.join(destDir, 'output/ios');
    const iosGradleRoot = path.join(destDir, 'ios');

    // Build command
    let cmd = `npx @wavemaker/wm-reactnative-cli build ios "${projectPath}" --dest="${destDir}" --auto-eject=true --clean`;

    // Enforce required iOS signing inputs from ENV/options
    if (!iCert || !iCertPass || !iProv) {
      throw new Error(
        'Missing iOS signing configuration. Please set IOS_P12_CERT_PATH, IOS_P12_PASSWORD, IOS_PROVISION_PROFILE_PATH in the environment or pass them via options.'
      );
    }

    console.log('[WM CLI] Using iOS certificate and provisioning profile from env/options');
    cmd += ` --iCertificate="${iCert}" --iCertificatePassword="${iCertPass}" --iProvisioningFile="${iProv}"`;

    const scanDirForIpa = (dir: string, maxDepth: number = 4): string | undefined => {
      if (!fs.existsSync(dir) || maxDepth < 0) return undefined;

      const entries = fs.readdirSync(dir, { withFileTypes: true });

      // Look for IPA files directly in this directory
      const ipaFile = entries
        .filter(e => e.isFile() && e.name.toLowerCase().endsWith('.ipa'))
        .map(e => path.join(dir, e.name))[0];
      if (ipaFile) {
        return ipaFile;
      }

      // Recurse into subdirectories
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const found = scanDirForIpa(path.join(dir, entry.name), maxDepth - 1);
          if (found) return found;
        }
      }

      return undefined;
    };

    const scanForIpa = (): string | undefined => {
      // 1) Prefer CLI-managed output directory (dest/output/ios)
      if (fs.existsSync(iosOutputDir)) {
        const directFiles = fs
          .readdirSync(iosOutputDir)
          .filter(f => f.toLowerCase().endsWith('.ipa'));
        if (directFiles.length > 0) {
          return path.join(iosOutputDir, directFiles[0]);
        }
      }

      // 2) Fallback: search under destDir/ios (common Xcode/Expo outputs)
      if (fs.existsSync(iosGradleRoot)) {
        const found = scanDirForIpa(iosGradleRoot, 6);
        if (found) return found;
      }

      // 3) Last resort: shallow recursive search from destDir
      return scanDirForIpa(destDir, 3);
    };

    try {
      const override = parseInt(process.env.WM_BUILD_TIMEOUT_MINUTES || '', 10);
      const effTimeout = isNaN(override) ? timeout : override * 60 * 1000;

      await runCommand(cmd, {
        cwd: projectPath,
        timeout: effTimeout,
        successPatterns: [
          'ios BUILD SUCCEEDED',
          'Build successful! APK/IPA generated',
          'build completed',
          'BUILD SUCCEEDED'
        ]
      });

      const ipaPath = scanForIpa();
      if (!ipaPath) {
        throw new Error('Build command finished but IPA file was not found');
      }

      const fileSize = fs.statSync(ipaPath).size;

      console.log(`\n[WM CLI] ✅ iOS IPA built successfully:`);
      console.log(`  Path: ${ipaPath}`);
      console.log(`  Size: ${(fileSize / 1024 / 1024).toFixed(2)} MB\n`);

      return ipaPath;
    } catch (error: any) {
      console.error('\n[WM CLI] ❌ iOS build failed:', error.message);
      throw error;
    }
  }

  /**
   * Build both Android and iOS
   */
  async buildBoth(options: IOSBuildOptions): Promise<{ android: string; ios: string }> {
    console.log('\n[WM CLI] 🚀 Building both Android and iOS...\n');

    try {
      // Build Android first
      const androidPath = await this.buildAndroid(options);

      // Then build iOS
      const iosPath = await this.buildIOS(options);

      console.log('\n[WM CLI] ✅ Both builds completed successfully!\n');

      return {
        android: androidPath,
        ios: iosPath
      };
    } catch (error) {
      console.error('\n[WM CLI] ❌ Build process failed\n');
      throw error;
    }
  }
}
