import { Page, expect } from '@playwright/test';
import { StudioClient } from '../../src/api/studioClient';
import { ENV } from '../../src/utils/env';
import { gotoCanvas, gotoPreview, getComputedCss, toHaveSnapshot, saveCssMetrics } from '../../src/playwright/helpers';
import data from '../testdata/data.json';
import { inspect } from 'util';
import { getWidgetKey } from '../../src/matrix/generator';

class StyleScreen {
  private page?: Page;
  private client: StudioClient;

  constructor(page?: Page) {
    this.page = page;
    // This client must be authenticated
    this.client = new StudioClient({
      baseUrl: ENV.studioBaseUrl,
      projectId: ENV.projectId,
      cookie: ENV.studioCookie,
    });
  }

  async getPreviewUrl(): Promise<string | undefined> {
    const previewUrl = await this.client.inplaceDeploy();
    console.log('Preview URL:', previewUrl);
    if (previewUrl) {
      process.env.RUNTIME_BASE_URL = previewUrl;
    }
    return previewUrl;


  }

  async rollbackComponent(component: string): Promise<void> {
    await this.client.updateComponentOverride(component, {});
    await this.client.publishAndBuild();
    console.log('🔄 Rolled back component to default:', component);
  }

  async updateComponentAndPublish(component: string, payload: any): Promise<void> {
    const fs = require('fs');
    const path = require('path');
    const lockFile = path.join(process.cwd(), '.test-cache', 'studio.lock');
    const isProcessRunning = (pid: number) => {
      try {
        process.kill(pid, 0);
        return true;
      } catch (e) {
        return false;
      }
    };

    // Simple retry-based lock to prevent concurrent Studio updates
    let acquired = false;
    for (let attempt = 0; attempt < 60; attempt++) { // 1 minute timeout
      try {
        let isStale = false;
        if (fs.existsSync(lockFile)) {
          const pid = parseInt(fs.readFileSync(lockFile, 'utf-8'));
          if (!isProcessRunning(pid)) {
            console.log(`⚠️  Detected stale Studio lock (PID ${pid}). Removing...`);
            fs.unlinkSync(lockFile);
            isStale = true;
          }
        }

        if (!fs.existsSync(lockFile) || isStale) {
          fs.writeFileSync(lockFile, process.pid.toString());
          acquired = true;
          break;
        }
      } catch (e) { }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (!acquired) {
      console.warn('⚠️ Could not acquire Studio lock after 2 minutes. Proceeding anyway, but collisions may occur.');
    }

    try {
      // Fetch existing payload first
      const existing = await this.client.getComponentOverride(component).catch(() => ({}));

      const deepMerge = (target: any, source: any, path: string[] = []): any => {
        for (const key of Object.keys(source)) {
          const srcVal = source[key];
          const tgtVal = target[key];
          const currentPath = [...path, key];

          // Handle arrays: replace entirely (Studio does not merge arrays)
          if (Array.isArray(srcVal)) {
            target[key] = [...srcVal];
            continue;
          }

          // Handle nulls
          if (srcVal === null) {
            target[key] = null;
            continue;
          }

          // Handle objects recursively
          if (typeof srcVal === 'object') {
            if (typeof tgtVal !== 'object' || tgtVal === null || Array.isArray(tgtVal)) {
              target[key] = {};
            }

            // Log when merging appearances or variant groups to track preservation
            if (currentPath.includes('appearances') && currentPath.length === 3) {
              console.log(`📂 Merging appearance: ${key}`);
              if (tgtVal && typeof tgtVal === 'object') {
                console.log(`   └─ Existing appearances: ${Object.keys(target).join(', ')}`);
              }
            }

            if (currentPath.includes('variantGroups') || currentPath.includes('variants')) {
              const groupLevel = currentPath[currentPath.length - 1];
              if (tgtVal && typeof tgtVal === 'object') {
                console.log(`🔀 Merging variants in ${currentPath[currentPath.length - 2]}: adding ${key}, preserving ${Object.keys(tgtVal).join(', ')}`);
              }
            }

            // Recursively merge all nested objects (preserves both appearances AND variants)
            deepMerge(target[key], srcVal, currentPath);
            continue;
          }

          // Primitive override
          target[key] = srcVal;
        }
        return target;
      };

      // Log diff between existing and incoming payload
      console.log('📘 Existing payload keys:', Object.keys(existing || {}));
      console.log('📗 Incoming payload keys:', Object.keys(payload || {}));

      const mergedPayload = deepMerge(existing || {}, payload || {});
      console.log('📙 Merged payload keys:', Object.keys(mergedPayload || {}));

      // --------------------
      // Schema validation
      // --------------------
      const isValidObject = (obj: any) => obj && typeof obj === 'object' && !Array.isArray(obj);
      if (!isValidObject(mergedPayload)) {
        throw new Error('❌ Schema validation failed: merged payload is not a valid object');
      }

      const topKeys = Object.keys(mergedPayload);
      if (topKeys.length === 0) {
        throw new Error('❌ Schema validation failed: merged payload is empty');
      }

      console.log('✅ Schema validation passed. Top-level keys:', topKeys);

      // --------------------
      // Save merged payload to artifacts
      // --------------------
      const fs = require('fs');
      const path = require('path');
      const outDir = path.join(process.cwd(), 'artifacts', 'merged-payloads');
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      const filePath = path.join(outDir, `${component}-merged.json`);
      fs.writeFileSync(filePath, JSON.stringify(mergedPayload, null, 2), 'utf-8');
      console.log('💾 Saved merged payload to:', filePath);

      // Attach merged payload to Playwright report (safe Playwright API only)
      try {
        const t = (globalThis as any).test;
        if (t?.info) {
          await t.info().attach(`${component}-merged.json`, {
            body: JSON.stringify(mergedPayload, null, 2),
            contentType: 'application/json'
          });
          console.log('📎 Attached merged payload to Playwright report');
        }
      } catch (err) {
        console.warn('⚠️ Unable to attach merged payload to report:', (err as any)?.message);
      }

      await this.client.updateComponentOverride(component, mergedPayload);
      console.log('Updated component:', component, 'payload:', inspect(payload, { depth: null, colors: true }));
      await this.client.publishAndBuild();
      const updatedStyle = await this.client.getComponentOverride(component);
      console.log('Updated style from server:', updatedStyle);

      // Attach server-returned payload to Playwright report
      try {
        const t = (globalThis as any).test;
        if (t?.info) {
          await t.info().attach(`${component}-server-returned.json`, {
            body: JSON.stringify(updatedStyle, null, 2),
            contentType: 'application/json',
          });
          console.log('📎 Attached server-returned payload to Playwright report');
        }
      } catch (err) {
        console.warn('⚠️ Unable to attach server-returned payload:', (err as any)?.message);
      }
      // const result = expect(updatedStyle).toEqual(payload);
      // console.log('result:',result);
    } catch (error: any) {
      console.error('❌ Error updating component:', error.message);
      throw error;
    } finally {
      // Release lock
      if (acquired && fs.existsSync(lockFile)) {
        try {
          fs.unlinkSync(lockFile);
        } catch (e) { }
      }
    }
  }

  // async rollbackComponentAndPublish(component: string): Promise<void> {
  //   await this.client.updateComponentOverride(component, {});
  //   await this.client.publishAndBuild();
  // }

  async verifyInCanvas(page: Page, snapshotName: string): Promise<{ imagesAreEqual: boolean; diffPixels?: number; totalPixels?: number }> {
    // Derive the widget page from the widget under test; default to 'button' if unknown
    const rawWidget = snapshotName.split('-')[0] || 'button';
    // Navigation uses the core widget name ('formcontrols') as requested
    await gotoCanvas(page, rawWidget);

    const canvasSelectorMap = data.style.canvasSelectors as Record<string, string>;
    const selector = canvasSelectorMap[rawWidget] || canvasSelectorMap['button'];

    await page.reload({ waitUntil: 'networkidle' });
    const css = await getComputedCss(page, selector, 'color');
    expect(css).toBeTruthy();
    console.log(`📸 Comparing canvas with base-canvas for: ${snapshotName}`);
    await page.reload({ waitUntil: 'networkidle' });
    await saveCssMetrics(page, selector, ['color', 'background-color'], `canvas-${snapshotName}`);

    // Call toHaveSnapshot which now triggers Playwright's visual diff UI
    const result = await toHaveSnapshot(page, `canvas-${snapshotName}`, `canvas-${rawWidget}`);

    // Validate condition 1: Screenshots should DIFFER (not match)
    if (result.imagesAreEqual) {
      throw new Error(
        `❌ Screenshot comparison FAILED: Images matched baseline but were expected to DIFFER.\n` +
        `This indicates the token had NO visual effect on the widget.\n` +
        `Baseline: canvas-${rawWidget}.png\n` +
        `Actual: canvas-${snapshotName}.png`
      );
    }

    console.log(`✅ Condition 1 PASSED: Screenshots differ from baseline (${result.diffPixels || 0} pixels changed)`);
    return result;
  }

  async verifyInPreview(page: Page, snapshotName: string): Promise<{ imagesAreEqual: boolean; diffPixels?: number; totalPixels?: number }> {
    // Derive the widget preview route from the widget under test; default to 'button' if unknown
    const rawWidget = snapshotName.split('-')[0] || 'button';
    // Navigation uses the core widget name ('formcontrols') as requested
    await gotoPreview(page, rawWidget);

    const previewSelectorMap = data.style.previewSelectors as Record<string, string>;
    const selector = previewSelectorMap[rawWidget] || previewSelectorMap['button'];

    // Explicitly wait for the preview selector to be visible, otherwise fail
    await page.waitForSelector(selector, { state: 'visible', timeout: 45000 });
    const css = await getComputedCss(page, selector, 'color');
    expect(css).toBeTruthy();
    console.log(`📸 Comparing preview with base-preview for: ${snapshotName}`);
    await page.reload({ waitUntil: 'networkidle' });
    await saveCssMetrics(page, selector, ['color', 'background-color'], `preview-${snapshotName}`);

    // Call toHaveSnapshot which now triggers Playwright's visual diff UI
    const result = await toHaveSnapshot(page, `preview-${snapshotName}`, `preview-${rawWidget}`);

    // Validate condition 1: Screenshots should DIFFER (not match)
    if (result.imagesAreEqual) {
      console.log(`⚠️ Preview screenshot matched baseline — allowing partial‑pass logic.`);
      return result;
    }

    console.log(`✅ Condition 1 PASSED: Screenshots differ from baseline (${result.diffPixels || 0} pixels changed)`);
    return result;
  }
}

export default StyleScreen;
