import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const execAsync = promisify(exec);

/**
 * Mobile App Builder
 * Handles building Android APK and iOS IPA via CLI commands
 */
export class MobileAppBuilder {
  private androidBuildCommand: string;
  private iosBuildCommand: string;
  private androidApkPath: string;
  private iosIpaPath: string;
  
  constructor() {
    this.androidBuildCommand = process.env.MOBILE_BUILD_COMMAND_ANDROID || 'wavemaker build android';
    this.iosBuildCommand = process.env.MOBILE_BUILD_COMMAND_IOS || 'wavemaker build ios';
    this.androidApkPath = process.env.ANDROID_APK_PATH || 'apps/android/app-release.apk';
    this.iosIpaPath = process.env.IOS_IPA_PATH || 'apps/ios/app-release.ipa';
  }
  
  /**
   * Builds Android APK via CLI command
   * @returns Path to the generated APK file
   */
  async buildAndroidApp(): Promise<string> {
    console.log('\n📱 Building Android APK...');
    console.log(`   Command: ${this.androidBuildCommand}`);
    
    try {
      const startTime = Date.now();
      
      // Execute build command
      const { stdout, stderr } = await execAsync(this.androidBuildCommand, {
        cwd: process.cwd(),
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });
      
      if (stdout) {
        console.log('Build output:', stdout);
      }
      
      if (stderr) {
        console.warn('Build warnings:', stderr);
      }
      
      // Verify APK was created
      const apkPath = path.join(process.cwd(), this.androidApkPath);
      if (!fs.existsSync(apkPath)) {
        throw new Error(`APK not found at expected path: ${apkPath}`);
      }
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      const fileSize = (fs.statSync(apkPath).size / (1024 * 1024)).toFixed(2);
      
      console.log(`✅ Android APK built successfully`);
      console.log(`   Path: ${apkPath}`);
      console.log(`   Size: ${fileSize} MB`);
      console.log(`   Duration: ${duration}s`);
      
      return apkPath;
    } catch (error: any) {
      console.error('❌ Android build failed:', error.message);
      throw new Error(`Android build failed: ${error.message}`);
    }
  }
  
  /**
   * Builds iOS IPA via CLI command
   * @returns Path to the generated IPA file
   */
  async buildIOSApp(): Promise<string> {
    console.log('\n🍎 Building iOS IPA...');
    console.log(`   Command: ${this.iosBuildCommand}`);
    
    try {
      const startTime = Date.now();
      
      // Execute build command
      const { stdout, stderr } = await execAsync(this.iosBuildCommand, {
        cwd: process.cwd(),
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });
      
      if (stdout) {
        console.log('Build output:', stdout);
      }
      
      if (stderr) {
        console.warn('Build warnings:', stderr);
      }
      
      // Verify IPA was created
      const ipaPath = path.join(process.cwd(), this.iosIpaPath);
      if (!fs.existsSync(ipaPath)) {
        throw new Error(`IPA not found at expected path: ${ipaPath}`);
      }
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      const fileSize = (fs.statSync(ipaPath).size / (1024 * 1024)).toFixed(2);
      
      console.log(`✅ iOS IPA built successfully`);
      console.log(`   Path: ${ipaPath}`);
      console.log(`   Size: ${fileSize} MB`);
      console.log(`   Duration: ${duration}s`);
      
      return ipaPath;
    } catch (error: any) {
      console.error('❌ iOS build failed:', error.message);
      throw new Error(`iOS build failed: ${error.message}`);
    }
  }
  
  /**
   * Builds both Android and iOS apps in parallel
   * @returns Paths to both APK and IPA files
   */
  async buildBothApps(): Promise<{ android: string; ios: string }> {
    console.log('\n🚀 Building both Android and iOS apps in parallel...');
    
    const startTime = Date.now();
    
    try {
      const [androidPath, iosPath] = await Promise.all([
        this.buildAndroidApp(),
        this.buildIOSApp()
      ]);
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      console.log(`\n✅ Both apps built successfully in ${duration}s`);
      
      return {
        android: androidPath,
        ios: iosPath
      };
    } catch (error: any) {
      console.error('❌ Build failed:', error.message);
      throw error;
    }
  }
  
  /**
   * Ensures output directories exist
   */
  ensureOutputDirectories(): void {
    const androidDir = path.dirname(path.join(process.cwd(), this.androidApkPath));
    const iosDir = path.dirname(path.join(process.cwd(), this.iosIpaPath));
    
    if (!fs.existsSync(androidDir)) {
      fs.mkdirSync(androidDir, { recursive: true });
      console.log(`✓ Created directory: ${androidDir}`);
    }
    
    if (!fs.existsSync(iosDir)) {
      fs.mkdirSync(iosDir, { recursive: true });
      console.log(`✓ Created directory: ${iosDir}`);
    }
  }
}

// Export convenience functions
export async function buildAndroidApp(): Promise<string> {
  const builder = new MobileAppBuilder();
  builder.ensureOutputDirectories();
  return await builder.buildAndroidApp();
}

export async function buildIOSApp(): Promise<string> {
  const builder = new MobileAppBuilder();
  builder.ensureOutputDirectories();
  return await builder.buildIOSApp();
}

export async function buildBothApps(): Promise<{ android: string; ios: string }> {
  const builder = new MobileAppBuilder();
  builder.ensureOutputDirectories();
  return await builder.buildBothApps();
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const platform = args[0] || 'both';
  
  (async () => {
    const builder = new MobileAppBuilder();
    builder.ensureOutputDirectories();
    
    switch (platform.toLowerCase()) {
      case 'android':
        await builder.buildAndroidApp();
        break;
      case 'ios':
        await builder.buildIOSApp();
        break;
      case 'both':
      default:
        await builder.buildBothApps();
        break;
    }
  })().catch(error => {
    console.error('Build script failed:', error);
    process.exit(1);
  });
}
