import {execSync} from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const iosDir = path.join(rootDir, 'ios');
const appDir = path.join(iosDir, 'App');
const buildDir = path.join(appDir, 'build');
const archivePath = path.join(buildDir, 'App.xcarchive');
const exportDir = path.join(buildDir, 'export');
const ipaPath = path.join(exportDir, 'App.ipa');

// 1. Resolve DEVELOPER_DIR for Xcode
function resolveDeveloperDir() {
  if (process.env.DEVELOPER_DIR && fs.existsSync(process.env.DEVELOPER_DIR)) {
    return process.env.DEVELOPER_DIR;
  }
  const defaultXcode = '/Applications/Xcode.app/Contents/Developer';
  if (fs.existsSync(defaultXcode)) {
    return defaultXcode;
  }
  return null;
}

const developerDir = resolveDeveloperDir();
if (!developerDir) {
  console.error('❌ Could not locate Xcode developer directory.');
  console.error(
    'Please install Xcode or set DEVELOPER_DIR in your environment.'
  );
  process.exit(1);
}

const env = {
  ...process.env,
  DEVELOPER_DIR: developerDir,
};

// 2. Read version from package.json
const pkg = JSON.parse(
  fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')
);
const version = pkg.version;
const parts = version.split('.');
const buildCode =
  parseInt(parts[0], 10) * 10000 +
  parseInt(parts[1], 10) * 100 +
  parseInt(parts[2], 10);

console.log(
  `\n🍎 Building iOS release for v${version} (Build ${buildCode})...`
);

// 3. Sync web assets into iOS project
console.log('\n📦 Syncing Capacitor web assets...');
execSync('npx cap sync ios', {cwd: rootDir, stdio: 'inherit', env});

// 4. Clean previous build artifacts
if (fs.existsSync(buildDir)) {
  fs.rmSync(buildDir, {recursive: true, force: true});
}
fs.mkdirSync(buildDir, {recursive: true});

// 5. Compile and Archive
console.log('\n⚙️  Running xcodebuild archive...');
const archiveCmd = [
  'xcodebuild archive',
  '-project App.xcodeproj',
  '-scheme App',
  '-configuration Release',
  "-destination 'generic/platform=iOS'",
  `-archivePath "${archivePath}"`,
].join(' ');

execSync(archiveCmd, {cwd: appDir, stdio: 'inherit', env});

// 6. Generate exportOptions.plist and export IPA
console.log('\n📦 Exporting signed IPA for App Store Connect...');
const exportOptionsPlist = path.join(buildDir, 'exportOptions.plist');
const exportOptionsContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store-connect</string>
    <key>teamID</key>
    <string>X5333WXA73</string>
    <key>signingStyle</key>
    <string>automatic</string>
    <key>uploadSymbols</key>
    <true/>
</dict>
</plist>
`;
fs.writeFileSync(exportOptionsPlist, exportOptionsContent, 'utf8');

const exportCmd = [
  'xcodebuild -exportArchive',
  `-archivePath "${archivePath}"`,
  `-exportPath "${exportDir}"`,
  `-exportOptionsPlist "${exportOptionsPlist}"`,
  '-allowProvisioningUpdates',
].join(' ');

execSync(exportCmd, {cwd: appDir, stdio: 'inherit', env});

if (!fs.existsSync(ipaPath)) {
  console.error(
    '\n❌ Export failed: App.ipa was not found in export directory.'
  );
  process.exit(1);
}

const stats = fs.statSync(ipaPath);
const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
console.log('\n✅ Signed IPA created successfully:');
console.log(`   - Version: v${version} (Build ${buildCode})`);
console.log(`   - Path: ios/App/build/export/App.ipa`);
console.log(`   - Size: ${sizeMb} MB`);

// 7. Check for App Store Connect API credentials to upload
function loadAppStoreConfig() {
  const configPath = path.join(iosDir, 'appstore.properties');
  const config = {
    apiKey: process.env.APP_STORE_API_KEY || '',
    apiIssuer: process.env.APP_STORE_API_ISSUER || '',
    p8Path: process.env.APP_STORE_P8_PATH || '',
  };

  if (fs.existsSync(configPath)) {
    const lines = fs.readFileSync(configPath, 'utf8').split('\n');
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx !== -1) {
        const key = line.slice(0, idx).trim();
        const val = line.slice(idx + 1).trim();
        if (key && val) {
          config[key] = val;
        }
      }
    }
  }

  // Expand ~ if present in path
  if (config.p8Path.startsWith('~/')) {
    config.p8Path = path.join(os.homedir(), config.p8Path.slice(2));
  }

  return config;
}

const appStoreConfig = loadAppStoreConfig();

if (
  appStoreConfig.apiKey &&
  appStoreConfig.apiIssuer &&
  appStoreConfig.p8Path
) {
  if (!fs.existsSync(appStoreConfig.p8Path)) {
    console.error(
      `\n❌ Could not find .p8 private key file at: ${appStoreConfig.p8Path}`
    );
    console.log('Opening Xcode Organizer for manual distribution...');
    try {
      execSync(`open "${archivePath}"`);
    } catch {
      // Ignore if GUI cannot open
    }
  } else {
    console.log('\n🚀 Uploading IPA to App Store Connect / TestFlight...');
    try {
      const uploadCmd = [
        'xcrun altool --upload-package',
        `"${ipaPath}"`,
        '--type ios',
        `--api-key "${appStoreConfig.apiKey}"`,
        `--api-issuer "${appStoreConfig.apiIssuer}"`,
        `--p8-file-path "${appStoreConfig.p8Path}"`,
        '--show-progress',
      ].join(' ');

      execSync(uploadCmd, {stdio: 'inherit', env});
      console.log(
        '\n🎉 App successfully delivered to App Store Connect / TestFlight!'
      );
      console.log(
        'You can track build processing at: https://appstoreconnect.apple.com/apps\n'
      );
    } catch (err) {
      console.error('\n❌ App Store Connect upload failed:', err.message);
      console.log('You can still distribute via Xcode Organizer:');
      execSync(`open "${archivePath}"`);
    }
  }
} else {
  console.log('\nℹ️  App Store Connect API key not configured yet.');
  console.log(
    '   To enable automatic CLI upload to TestFlight / App Store Connect:'
  );
  console.log(
    '   Fill in your apiKey, apiIssuer, and p8Path in ios/appstore.properties'
  );
  console.log('   (see ios/appstore.properties.example for details).\n');
  console.log('Opening Xcode Organizer for one-click distribution...');
  try {
    execSync(`open "${archivePath}"`);
  } catch {
    // Ignore if GUI cannot open
  }
}
