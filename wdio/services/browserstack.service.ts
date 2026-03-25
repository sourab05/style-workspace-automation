import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import FormData from 'form-data';
import * as dotenv from 'dotenv';

dotenv.config();

export interface BrowserStackAppUploadResponse {
  app_url: string;
  custom_id: string;
  shareable_id: string;
}

export interface BrowserStackDevice {
  device: string;
  os: string;
  os_version: string;
}

/**
 * BrowserStack Service
 * Handles app upload, management, and device queries for BrowserStack
 */
export class BrowserStackService {
  private client: AxiosInstance;
  private username: string;
  private accessKey: string;
  
  constructor() {
    this.username = process.env.BROWSERSTACK_USERNAME || '';
    this.accessKey = process.env.BROWSERSTACK_ACCESS_KEY || '';
    
    if (!this.username || !this.accessKey) {
      throw new Error('BrowserStack credentials not found. Please set BROWSERSTACK_USERNAME and BROWSERSTACK_ACCESS_KEY environment variables.');
    }
    
    this.client = axios.create({
      baseURL: 'https://api-cloud.browserstack.com',
      auth: {
        username: this.username,
        password: this.accessKey
      },
      headers: {
        'Accept': 'application/json'
      },
      timeout: 300000 // 5 minutes for uploads
    });
  }
  
  /**
   * Uploads a mobile app to BrowserStack and returns full metadata.
   * @param platform Platform type ('android' or 'ios')
   * @param appPath Local path to the APK or IPA file
   * @returns BrowserStack upload response (app_url, custom_id, shareable_id)
   */
  async uploadAppWithMeta(
    platform: 'android' | 'ios',
    appPath: string
  ): Promise<BrowserStackAppUploadResponse> {
    console.log(`\n☁️  Uploading ${platform} app to BrowserStack...`);
    console.log(`   File: ${appPath}`);
    
    try {
      // Verify file exists
      if (!fs.existsSync(appPath)) {
        throw new Error(`App file not found: ${appPath}`);
      }
      
      const fileSize = (fs.statSync(appPath).size / (1024 * 1024)).toFixed(2);
      console.log(`   Size: ${fileSize} MB`);
      
      const startTime = Date.now();
      
      // Create form data
      const form = new FormData();
      form.append('file', fs.createReadStream(appPath));
      form.append('custom_id', `${platform}-${Date.now()}`);
      
      // Upload to BrowserStack
      const response = await this.client.post<BrowserStackAppUploadResponse>(
        '/app-automate/upload',
        form,
        {
          headers: {
            ...form.getHeaders()
          }
        }
      );
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      console.log(`✅ App uploaded successfully to BrowserStack`);
      console.log(`   App URL: ${response.data.app_url}`);
      console.log(`   Custom ID: ${response.data.custom_id}`);
      console.log(`   Upload Duration: ${duration}s`);
      
      return response.data;
    } catch (error: any) {
      console.error(`❌ Failed to upload ${platform} app to BrowserStack:`, error.message);
      if (error.response) {
        console.error('   Status:', error.response.status);
        console.error('   Response:', JSON.stringify(error.response.data, null, 2));
      }
      throw new Error(`BrowserStack upload failed: ${error.message}`);
    }
  }
  
  /**
   * Uploads a mobile app to BrowserStack
   * @param platform Platform type ('android' or 'ios')
   * @param appPath Local path to the APK or IPA file
   * @returns BrowserStack app URL (bs://...)
   */
  async uploadApp(platform: 'android' | 'ios', appPath: string): Promise<string> {
    const result = await this.uploadAppWithMeta(platform, appPath);
    return result.app_url;
  }
  
  /**
   * Gets information about a specific app
   * @param appId App ID or custom_id
   * @returns App information
   */
  async getAppInfo(appId: string): Promise<any> {
    try {
      const response = await this.client.get(`/app-automate/app/${appId}`);
      return response.data;
    } catch (error: any) {
      console.error('Failed to get app info:', error.message);
      throw error;
    }
  }
  
  /**
   * Lists all uploaded apps
   * @returns Array of uploaded apps
   */
  async listApps(): Promise<any[]> {
    try {
      const response = await this.client.get('/app-automate/recent_apps');
      return response.data;
    } catch (error: any) {
      console.error('Failed to list apps:', error.message);
      throw error;
    }
  }
  
  /**
   * Deletes an app from BrowserStack
   * @param appId App ID to delete
   */
  async deleteApp(appId: string): Promise<void> {
    try {
      await this.client.delete(`/app-automate/app/delete/${appId}`);
      console.log(`✓ Deleted app: ${appId}`);
    } catch (error: any) {
      console.error('Failed to delete app:', error.message);
      throw error;
    }
  }
  
  /**
   * Gets available Android devices
   * @returns Array of Android devices
   */
  async getAndroidDevices(): Promise<BrowserStackDevice[]> {
    try {
      const response = await this.client.get('/app-automate/devices.json');
      const allDevices = response.data;
      
      // Filter for Android devices
      return allDevices.filter((device: any) => 
        device.os && device.os.toLowerCase() === 'android'
      );
    } catch (error: any) {
      console.error('Failed to get Android devices:', error.message);
      throw error;
    }
  }
  
  /**
   * Gets available iOS devices
   * @returns Array of iOS devices
   */
  async getIOSDevices(): Promise<BrowserStackDevice[]> {
    try {
      const response = await this.client.get('/app-automate/devices.json');
      const allDevices = response.data;
      
      // Filter for iOS devices
      return allDevices.filter((device: any) => 
        device.os && device.os.toLowerCase() === 'ios'
      );
    } catch (error: any) {
      console.error('Failed to get iOS devices:', error.message);
      throw error;
    }
  }
  
  /**
   * Uploads both Android and iOS apps in parallel
   * @param androidPath Path to Android APK
   * @param iosPath Path to iOS IPA
   * @returns Object with both app URLs
   */
  async uploadBothApps(androidPath: string, iosPath: string): Promise<{ android: string; ios: string }> {
    console.log('\n☁️  Uploading both apps to BrowserStack in parallel...');
    
    const startTime = Date.now();
    
    try {
      const [androidUrl, iosUrl] = await Promise.all([
        this.uploadApp('android', androidPath),
        this.uploadApp('ios', iosPath)
      ]);
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      console.log(`\n✅ Both apps uploaded successfully in ${duration}s`);
      
      return {
        android: androidUrl,
        ios: iosUrl
      };
    } catch (error: any) {
      console.error('❌ Upload failed:', error.message);
      throw error;
    }
  }
  
  /**
   * Saves app URLs to cache for test execution
   * @param apps App URLs object
   * @param cacheFileName Cache file name
   */
  saveToCache(
    apps: { android: string; ios: string },
    cacheFileName: string = 'mobile-modified-apps.json',
    meta?: {
      android?: BrowserStackAppUploadResponse;
      ios?: BrowserStackAppUploadResponse;
    }
  ): void {
    const cacheDir = path.join(process.cwd(), '.test-cache');
    
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    
    const cacheFile = path.join(cacheDir, cacheFileName);
    
    fs.writeFileSync(
      cacheFile,
      JSON.stringify({
        ...apps,
        meta,
        timestamp: new Date().toISOString()
      }, null, 2)
    );
    
    console.log(`\n✓ App URLs saved to cache: ${cacheFile}`);
  }
  
  /**
   * Loads app URLs from cache
   * @param cacheFileName Cache file name
   * @returns App URLs object or null if not found
   */
  loadFromCache(cacheFileName: string = 'mobile-modified-apps.json'): { android: string; ios: string } | null {
    const cacheFile = path.join(process.cwd(), '.test-cache', cacheFileName);
    
    if (!fs.existsSync(cacheFile)) {
      return null;
    }
    
    try {
      const data = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      return {
        android: data.android,
        ios: data.ios
      };
    } catch (error) {
      console.error('Failed to load app URLs from cache:', error);
      return null;
    }
  }
}
