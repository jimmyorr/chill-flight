import {execSync} from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const androidDir = path.join(rootDir, 'android');
const packageName = 'com.cowneck.chillflight';

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

// 2. Read keystore properties configuration
const keystorePropsPath = path.join(androidDir, 'keystore.properties');
const keystoreConfig = {};

if (fs.existsSync(keystorePropsPath)) {
  const lines = fs.readFileSync(keystorePropsPath, 'utf8').split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx !== -1) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      if (key && val) {
        keystoreConfig[key] = val;
      }
    }
  }
}

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

if (!fs.existsSync(builtAabPath)) {
  console.error('\n❌ Could not find generated app-release.aab bundle.');
  process.exit(1);
}

fs.mkdirSync(exportDir, {recursive: true});
fs.copyFileSync(builtAabPath, exportedAabPath);

const stats = fs.statSync(exportedAabPath);
const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);

console.log('\n✅ Android App Bundle generated successfully!');
console.log(`   - Version: v${version} (versionCode ${buildCode})`);
console.log(`   - Path: android/app/release/app-release.aab`);
console.log(`   - Size: ${sizeMb} MB`);

// 7. Resolve Google Play service account for automatic upload
function resolveServiceAccountPath() {
  const customPath =
    keystoreConfig.serviceAccountJson ||
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT;
  if (customPath) {
    let resolved = customPath;
    if (resolved.startsWith('~/')) {
      resolved = path.join(os.homedir(), resolved.slice(2));
    } else if (!path.isAbsolute(resolved)) {
      resolved = path.join(rootDir, resolved);
    }
    if (fs.existsSync(resolved)) return resolved;
  }

  const defaultAndroid = path.join(androidDir, 'play-service-account.json');
  if (fs.existsSync(defaultAndroid)) return defaultAndroid;

  const privateKeysDir = path.join(os.homedir(), '.private_keys');
  if (fs.existsSync(privateKeysDir)) {
    const pkFiles = fs.readdirSync(privateKeysDir);
    for (const file of pkFiles) {
      if (
        (file.startsWith('chill-flight-') ||
          file.startsWith('play-service-account')) &&
        file.endsWith('.json')
      ) {
        return path.join(privateKeysDir, file);
      }
    }
  }

  const files = fs.readdirSync(androidDir);
  for (const file of files) {
    if (
      (file.startsWith('chill-flight-') ||
        file.startsWith('play-service-account')) &&
      file.endsWith('.json')
    ) {
      return path.join(androidDir, file);
    }
  }

  return null;
}

function createGoogleJwt(serviceAccount) {
  const header = {alg: 'RS256', typ: 'JWT'};
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signatureInput = `${b64Header}.${b64Payload}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signatureInput);
  const signature = signer.sign(serviceAccount.private_key, 'base64url');

  return `${signatureInput}.${signature}`;
}

function getLatestReleaseNotes(appVersion) {
  const notesPath = path.join(rootDir, 'RELEASE_NOTES.md');
  if (!fs.existsSync(notesPath)) return null;
  const content = fs.readFileSync(notesPath, 'utf8');
  const escapedVersion = appVersion.replace(/\./g, '\\.');
  const regex = new RegExp(
    `##\\s+\\[?${escapedVersion}\\]?[^\\n]*\\n([\\s\\S]*?)(?=\\n##|$)`
  );
  const match = content.match(regex);
  if (match && match[1]) {
    let notes = match[1].trim();
    if (notes.length > 500) {
      notes = notes.slice(0, 497) + '...';
    }
    return notes;
  }
  return null;
}

async function uploadToGooglePlay(saPath) {
  const track =
    keystoreConfig.playTrack || process.env.GOOGLE_PLAY_TRACK || 'alpha';

  console.log(`\n🚀 Uploading AAB to Google Play Console (track: ${track})...`);
  const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf8'));
  const jwt = createGoogleJwt(serviceAccount);

  // 1. Get access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Google OAuth failed (${tokenRes.status}): ${errText}`);
  }

  const {access_token: accessToken} = await tokenRes.json();
  const authHeaders = {Authorization: `Bearer ${accessToken}`};

  // 2. Create edit
  const editRes = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/edits`,
    {
      method: 'POST',
      headers: {...authHeaders, 'Content-Type': 'application/json'},
    }
  );
  if (!editRes.ok) {
    const errText = await editRes.text();
    throw new Error(`Failed to create edit (${editRes.status}): ${errText}`);
  }
  const {id: editId} = await editRes.json();

  // 3. Upload AAB bundle
  console.log('📦 Uploading bundle media to Google Play...');
  const aabBuffer = fs.readFileSync(exportedAabPath);
  const uploadRes = await fetch(
    `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${packageName}/edits/${editId}/bundles?uploadType=media`,
    {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/octet-stream',
      },
      body: aabBuffer,
    }
  );

  let targetVersionCode = buildCode;
  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    if (errText.includes('already been used')) {
      console.log(
        `ℹ️  versionCode ${buildCode} is already uploaded in Google Play library. Promoting to track "${track}"...`
      );
    } else {
      throw new Error(`Failed to upload AAB (${uploadRes.status}): ${errText}`);
    }
  } else {
    const uploadData = await uploadRes.json();
    targetVersionCode = uploadData.versionCode;
    console.log(`✨ Uploaded bundle with versionCode: ${targetVersionCode}`);
  }

  // 4. Assign to track with release notes
  console.log(
    `📋 Assigning versionCode ${targetVersionCode} to track "${track}"...`
  );
  const releaseObj = {
    name: version,
    versionCodes: [targetVersionCode.toString()],
    status: 'completed',
  };

  const releaseNotesText = getLatestReleaseNotes(version);
  if (releaseNotesText) {
    console.log('📝 Attaching release notes from RELEASE_NOTES.md:');
    console.log(releaseNotesText);
    releaseObj.releaseNotes = [
      {
        language: 'en-US',
        text: releaseNotesText,
      },
    ];
  }

  const trackRes = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/edits/${editId}/tracks/${track}`,
    {
      method: 'PUT',
      headers: {...authHeaders, 'Content-Type': 'application/json'},
      body: JSON.stringify({
        releases: [releaseObj],
      }),
    }
  );
  if (!trackRes.ok) {
    const errText = await trackRes.text();
    throw new Error(`Failed to update track (${trackRes.status}): ${errText}`);
  }

  // 5. Commit edit with retry
  console.log('💾 Committing release edit...');
  let commitRes;
  for (let attempt = 1; attempt <= 3; attempt++) {
    commitRes = await fetch(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/edits/${editId}:commit`,
      {method: 'POST', headers: authHeaders}
    );
    if (commitRes.ok) break;
    if (attempt < 3 && [500, 502, 503, 504].includes(commitRes.status)) {
      console.log(
        `⚠️  Google API returned ${commitRes.status}. Retrying in 2 seconds (attempt ${attempt}/3)...`
      );
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  if (!commitRes.ok) {
    const errText = await commitRes.text();
    throw new Error(`Failed to commit edit (${commitRes.status}): ${errText}`);
  }

  console.log('\n🎉 App successfully published to Google Play!');
  console.log(`   - Track: ${track}`);
  console.log(
    'You can track release status at: https://play.google.com/console\n'
  );
}

const serviceAccountPath = resolveServiceAccountPath();

if (serviceAccountPath) {
  try {
    await uploadToGooglePlay(serviceAccountPath);
  } catch (err) {
    console.error('\n❌ Google Play upload failed:', err.message);
    console.log(
      'You can still manually upload the bundle at: https://play.google.com/console\n'
    );
  }
} else {
  console.log('\nℹ️  Google Play service account not configured yet.');
  console.log('   To enable automatic CLI upload to Google Play Console:');
  console.log(
    '   Download your Service Account JSON key from Google Cloud / Play Console'
  );
  console.log(
    '   and place it at android/play-service-account.json (or specify serviceAccountJson in android/keystore.properties).'
  );
  console.log('\nReady for upload to Google Play Console:');
  console.log('https://play.google.com/console\n');
}
