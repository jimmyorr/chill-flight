import {execSync} from 'child_process';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const androidDir = path.join(rootDir, 'android');

// Resolve JAVA_HOME if not already configured in shell
function resolveJavaHome() {
  if (process.env.JAVA_HOME && fs.existsSync(process.env.JAVA_HOME)) {
    return process.env.JAVA_HOME;
  }

  const candidatePaths = [
    '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
    '/Applications/Android Studio Preview.app/Contents/jbr/Contents/Home',
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  try {
    const javaHome = execSync('/usr/libexec/java_home', {
      encoding: 'utf8',
    }).trim();
    if (javaHome && fs.existsSync(javaHome)) {
      return javaHome;
    }
  } catch {
    // Ignore error if /usr/libexec/java_home is unavailable
  }

  return null;
}

// 1. Verify Java availability
const javaHome = resolveJavaHome();
if (!javaHome) {
  console.error('❌ Could not locate a Java Runtime.');
  console.error(
    'Please install Android Studio or set JAVA_HOME in your environment.'
  );
  process.exit(1);
}

const env = {
  ...process.env,
  JAVA_HOME: javaHome,
};

// 2. Check keystore configuration
const keystorePropsPath = path.join(androidDir, 'keystore.properties');
const hasEnvKey = Boolean(process.env.ANDROID_KEYSTORE_PASSWORD);

if (!fs.existsSync(keystorePropsPath) && !hasEnvKey) {
  console.warn('\n⚠️  android/keystore.properties not found.');
  console.warn(
    '   Copy android/keystore.properties.example to android/keystore.properties'
  );
  console.warn(
    '   and fill in your password to produce a signed release bundle.\n'
  );
}

// 3. Read app version from package.json
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
  `\n🤖 Building Android release bundle for v${version} (${buildCode})...`
);

// 4. Sync web assets into Android project
console.log('\n📦 Syncing Capacitor web assets...');
execSync('npx cap sync android', {cwd: rootDir, stdio: 'inherit', env});

// 5. Run Gradle bundleRelease
console.log('\n⚙️  Running Gradle bundleRelease...');
execSync('./gradlew bundleRelease', {cwd: androidDir, stdio: 'inherit', env});

// 6. Export bundle to android/app/release/
const builtAabPath = path.join(
  androidDir,
  'app/build/outputs/bundle/release/app-release.aab'
);
const exportDir = path.join(androidDir, 'app/release');
const exportedAabPath = path.join(exportDir, 'app-release.aab');

if (fs.existsSync(builtAabPath)) {
  fs.mkdirSync(exportDir, {recursive: true});
  fs.copyFileSync(builtAabPath, exportedAabPath);

  const stats = fs.statSync(exportedAabPath);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);

  console.log('\n✅ Android App Bundle generated successfully!');
  console.log(`   - Version: v${version} (versionCode ${buildCode})`);
  console.log(`   - Path: android/app/release/app-release.aab`);
  console.log(`   - Size: ${sizeMb} MB`);
  console.log('\nReady for upload to Google Play Console:');
  console.log('https://play.google.com/console\n');
} else {
  console.error('\n❌ Could not find generated app-release.aab bundle.');
  process.exit(1);
}
