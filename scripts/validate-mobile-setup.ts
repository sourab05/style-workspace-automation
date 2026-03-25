#!/usr/bin/env ts-node

/**
 * Mobile Framework Validation Script
 * Validates that the mobile framework is properly configured and ready to run
 */

import * as fs from 'fs';
import * as path from 'path';
import { config as sharedConfig } from '../wdio/config/wdio.shared.conf';
import { config as browserstackConfig } from '../wdio/config/wdio.browserstack.conf';

console.log('\n' + '='.repeat(80));
console.log('🔍 MOBILE FRAMEWORK VALIDATION');
console.log('='.repeat(80));

let hasErrors = false;
let hasWarnings = false;

// Check 1: Required files exist
console.log('\n📁 Step 1: Checking required files...');
const requiredFiles = [
  'wdio/config/wdio.shared.conf.ts',
  'wdio/config/wdio.browserstack.conf.ts',
  'wdio/services/browserstack.service.ts',
  'wdio/helpers/screenshot.helpers.ts',
  'wdio/helpers/appium.helpers.ts',
  'wdio/pages/MobileWidget.page.ts',
  'wdio/utils/batch-token-merger.ts',
  'wdio/specs/mobile.global.setup.ts',
  'wdio/specs/mobile.token.validate.spec.ts',
  'scripts/build-mobile-apps.ts',
  '.env.example'
];

for (const file of requiredFiles) {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} - MISSING`);
    hasErrors = true;
  }
}

// Check 2: Environment variables
console.log('\n🔐 Step 2: Checking environment configuration...');
const requiredEnvVars = [
  'STUDIO_BASE_URL',
  'PROJECT_ID',
  'STUDIO_USERNAME',
  'STUDIO_PASSWORD',
  'BROWSERSTACK_USERNAME',
  'BROWSERSTACK_ACCESS_KEY',
  'MOBILE_BUILD_COMMAND_ANDROID',
  'MOBILE_BUILD_COMMAND_IOS'
];

let envConfigured = 0;
for (const envVar of requiredEnvVars) {
  if (process.env[envVar]) {
    console.log(`  ✅ ${envVar} - Configured`);
    envConfigured++;
  } else {
    console.log(`  ⚠️  ${envVar} - Not configured`);
    hasWarnings = true;
  }
}

if (envConfigured === 0) {
  console.log('\n  ⚠️  No environment variables configured.');
  console.log('  📝 Copy .env.example to .env and configure your credentials.');
}

// Check 3: Dependencies installed
console.log('\n📦 Step 3: Checking dependencies...');
const requiredPackages = [
  '@wdio/cli',
  '@wdio/mocha-framework',
  '@wdio/browserstack-service',
  'webdriverio',
  'pixelmatch',
  'pngjs',
  'form-data',
  '@types/mocha',
  '@types/node',
  '@wdio/types'
];

const packageJsonPath = path.join(process.cwd(), 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };
  
  for (const pkg of requiredPackages) {
    if (allDeps[pkg]) {
      const nodeModulesPath = path.join(process.cwd(), 'node_modules', pkg);
      if (fs.existsSync(nodeModulesPath)) {
        console.log(`  ✅ ${pkg} - Installed`);
      } else {
        console.log(`  ⚠️  ${pkg} - In package.json but not installed`);
        console.log(`     Run 'npm install' to install dependencies`);
        hasWarnings = true;
      }
    } else {
      console.log(`  ❌ ${pkg} - Not in package.json`);
      hasErrors = true;
    }
  }
} else {
  console.log('  ❌ package.json not found');
  hasErrors = true;
}

// Check 4: TypeScript compilation
console.log('\n🔨 Step 4: Checking TypeScript compilation...');
try {
  const { execSync } = require('child_process');
  execSync('npx tsc --noEmit', { stdio: 'pipe' });
  console.log('  ✅ TypeScript compilation successful');
} catch (error: any) {
  console.log('  ❌ TypeScript compilation has errors');
  console.log('  📝 Run "npx tsc --noEmit" to see detailed errors');
  hasErrors = true;
}

// Check 5: Configuration validity
console.log('\n⚙️  Step 5: Checking WDIO configuration...');
try {
  if (sharedConfig.specs && sharedConfig.specs.length > 0) {
    console.log('  ✅ Shared config - Valid');
  } else {
    console.log('  ⚠️  Shared config - Missing specs');
    hasWarnings = true;
  }
  
  if (browserstackConfig.user || browserstackConfig.key) {
    console.log('  ✅ BrowserStack config - Valid');
  } else {
    console.log('  ⚠️  BrowserStack config - Missing credentials');
    hasWarnings = true;
  }
} catch (error: any) {
  console.log('  ❌ Config validation failed:', error.message);
  hasErrors = true;
}

// Check 6: Token files
console.log('\n🎨 Step 6: Checking token files...');
const tokensDir = path.join(process.cwd(), 'Tokens');
if (fs.existsSync(tokensDir)) {
  const tokenFiles = fs.readdirSync(tokensDir).filter(f => f.endsWith('.json'));
  console.log(`  ✅ Token directory exists (${tokenFiles.length} files)`);
  if (tokenFiles.length === 0) {
    console.log('  ⚠️  No token files found');
    hasWarnings = true;
  }
} else {
  console.log('  ❌ Tokens/ directory not found');
  hasErrors = true;
}

// Check 7: Cache directory
console.log('\n📂 Step 7: Checking cache directory...');
const cacheDir = path.join(process.cwd(), '.test-cache');
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
  console.log('  ✅ Created .test-cache directory');
} else {
  console.log('  ✅ Cache directory exists');
}

// Check 8: Screenshot directories
console.log('\n📸 Step 8: Checking screenshot directories...');
const screenshotDirs = [
  'screenshots',
  'screenshots/base-image',
  'screenshots/mobile-actual',
  'screenshots/mobile-baseline',
  'screenshots/mobile-diff'
];

for (const dir of screenshotDirs) {
  const dirPath = path.join(process.cwd(), dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`  ✅ Created ${dir}`);
  } else {
    console.log(`  ✅ ${dir} exists`);
  }
}

// Summary
console.log('\n' + '='.repeat(80));
console.log('📊 VALIDATION SUMMARY');
console.log('='.repeat(80));

if (hasErrors) {
  console.log('❌ FAILED - Critical errors found');
  console.log('\n🔧 Fix the errors above before running the framework.');
  process.exit(1);
} else if (hasWarnings) {
  console.log('⚠️  WARNINGS - Framework is set up but needs configuration');
  console.log('\n📝 Next steps:');
  console.log('   1. Run "npm install" to install dependencies');
  console.log('   2. Copy .env.example to .env');
  console.log('   3. Configure environment variables in .env');
  console.log('   4. Run validation again: ts-node scripts/validate-mobile-setup.ts');
  process.exit(0);
} else {
  console.log('✅ SUCCESS - Framework is ready!');
  console.log('\n🚀 You can now run:');
  console.log('   npm run test:mobile:setup   # Build & upload apps');
  console.log('   npm run test:mobile         # Run mobile tests');
  console.log('   npm run test:all            # Run everything');
  console.log('\n' + '='.repeat(80));
  process.exit(0);
}
