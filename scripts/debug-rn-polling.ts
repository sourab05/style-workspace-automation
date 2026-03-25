import { RnProjectManager } from '../src/api/rnProjectManager';
import { ENV } from '../src/utils/env';
import * as path from 'path';
import * as fs from 'fs';

async function debugPolling() {
    console.log('🔍 Starting RN Polling Debug Script...');

    const baseUrl = ENV.studioBaseUrl.replace(/\/$/, '');
    const rnManager = new RnProjectManager({
        projectId: ENV.projectId,
        studioProjectId: ENV.studioProjectId,
        username: ENV.studioUsername || '',
        password: ENV.studioPassword || '',
        baseUrl: baseUrl,
        fileServiceUrl: `${baseUrl}/file-service`
    });

    try {
        // 1. Login
        await rnManager.login();

        // 2. Trigger Build
        console.log('\n🚀 Triggering a fresh NATIVE_MOBILE build for debugging...');
        const result = await (rnManager as any).buildNativeMobileApp('development');

        console.log('\n✅ Debug build cycle completed successfully!');
        console.log('📦 ZIP URL:', result);

        // 3. Verify debug file exists
        const debugFile = path.join(process.cwd(), '.test-cache', 'last-build-status.json');
        if (fs.existsSync(debugFile)) {
            console.log(`\n📄 Latest job status captured in: ${debugFile}`);
            const status = JSON.parse(fs.readFileSync(debugFile, 'utf-8'));
            console.log('📋 Job ID:', status.id);
            console.log('📋 Job Type:', status.type);
            console.log('📋 Job Status:', status.completed ? 'Completed' : 'Running');
        }

    } catch (error: any) {
        console.error('\n❌ Debug script failed:', error.message);

        const debugFile = path.join(process.cwd(), '.test-cache', 'last-build-status.json');
        if (fs.existsSync(debugFile)) {
            console.log(`\n📄 Detailed failure capture found in: ${debugFile}`);
        }
        process.exit(1);
    }
}

debugPolling();
