import {execSync} from 'child_process';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const packageJsonPath = path.join(rootDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;
const tagName = `v${version}`;

const args = process.argv.slice(2);
const skipMobile =
  args.includes('--skip-mobile') || args.includes('--web-only');
const skipGitPush = args.includes('--no-push');
const targetCommit = args.find((arg) => !arg.startsWith('--')) || 'HEAD';

// If tagging HEAD, ensure working tree is clean so the tag points to a committed release
if (targetCommit === 'HEAD') {
  const status = execSync('git status --porcelain', {
    cwd: rootDir,
    encoding: 'utf8',
  }).trim();
  if (status) {
    console.error('❌ Cannot tag release: uncommitted changes detected.');
    console.error('Please commit the release bundle before tagging.');
    process.exit(1);
  }
}

// 1. Tag release in git
const existingTags = execSync('git tag -l', {cwd: rootDir, encoding: 'utf8'})
  .split('\n')
  .map((t) => t.trim());

const commitHash = execSync(`git rev-parse --short ${targetCommit}`, {
  cwd: rootDir,
  encoding: 'utf8',
}).trim();
const commitMsg = execSync(`git log -1 --pretty=%B ${targetCommit}`, {
  cwd: rootDir,
  encoding: 'utf8',
}).trim();

if (!existingTags.includes(tagName)) {
  if (!commitMsg.startsWith(`Release ${tagName}`)) {
    console.warn(
      `⚠️  Warning: Target commit message ("${commitMsg}") does not match "Release ${tagName}".`
    );
  }

  try {
    execSync(`git tag -a "${tagName}" -m "Release ${tagName}" ${commitHash}`, {
      cwd: rootDir,
      stdio: 'inherit',
    });
    console.log(`🏷️  Created git tag ${tagName} on commit ${commitHash}.`);
  } catch (error) {
    console.error(`Failed to create git tag ${tagName}:`, error.message);
    process.exit(1);
  }
} else {
  console.log(`🏷️  Git tag ${tagName} already exists.`);
}

// 2. Deploy Web to Cloudflare Pages
let cloudflareStatus = 'Skipped';
const safeName = tagName.replace(/\./g, '-');
const docsPath = path.join(rootDir, 'docs');

if (fs.existsSync(docsPath)) {
  try {
    console.log(`\n☁️  Deploying ${tagName} to Cloudflare Pages...`);
    execSync(
      `npx -y wrangler pages deploy docs --project-name=chill-flight --branch="${safeName}" --commit-dirty=true`,
      {cwd: rootDir, stdio: 'inherit'}
    );
    if (targetCommit === 'HEAD') {
      execSync(
        `npx -y wrangler pages deploy docs --project-name=chill-flight --branch=main --commit-dirty=true`,
        {cwd: rootDir, stdio: 'inherit'}
      );
    }
    cloudflareStatus = 'Success';
    console.log(`✨ Cloudflare Pages deployed successfully.`);
  } catch (error) {
    cloudflareStatus = `Failed: ${error.message}`;
    console.warn(
      `\n⚠️  Cloudflare Pages deployment skipped or failed: ${error.message}`
    );
  }
}

// 3. Mobile builds & deployments (Android & iOS)
let androidStatus = 'Skipped';
let iosStatus = 'Skipped';

if (!skipMobile) {
  // Android
  console.log('\n========================================');
  console.log('🤖 Starting Android build & deployment...');
  console.log('========================================');
  try {
    execSync('node scripts/build-android.js', {cwd: rootDir, stdio: 'inherit'});
    androidStatus = 'Success';
  } catch (err) {
    androidStatus = `Failed: ${err.message}`;
    console.error('❌ Android build/deploy failed.');
  }

  // iOS
  console.log('\n========================================');
  console.log('🍎 Starting iOS build & deployment...');
  console.log('========================================');
  try {
    execSync('node scripts/build-ios.js', {cwd: rootDir, stdio: 'inherit'});
    iosStatus = 'Success';
  } catch (err) {
    iosStatus = `Failed: ${err.message}`;
    console.error('❌ iOS build/deploy failed.');
  }
}

// 4. Push git commit and tags
if (!skipGitPush) {
  console.log('\n========================================');
  console.log('📤 Pushing git commit and tags to origin...');
  console.log('========================================');
  try {
    execSync('git push origin main --tags', {cwd: rootDir, stdio: 'inherit'});
    console.log('✅ Git commit and tags successfully pushed to origin.');
  } catch (err) {
    console.warn(`⚠️  Could not push git tags automatically: ${err.message}`);
    console.log(`   You can push manually with: git push origin main --tags`);
  }
}

// 5. Extract release notes for current version
let releaseNotes = '';
try {
  const notesPath = path.join(rootDir, 'RELEASE_NOTES.md');
  if (fs.existsSync(notesPath)) {
    const notesContent = fs.readFileSync(notesPath, 'utf8');
    const versionEscaped = version.replace(/\./g, '\\.');
    const regex = new RegExp(
      `## \\[${versionEscaped}\\][^\\n]*\\n\\n([\\s\\S]*?)(?=\\n## |$)`
    );
    const match = notesContent.match(regex);
    if (match) {
      releaseNotes = match[1].trim();
    }
  }
} catch {
  // Fall back to empty release notes
}

const parts = version.split('.');
const buildCode =
  parseInt(parts[0], 10) * 10000 +
  parseInt(parts[1], 10) * 100 +
  parseInt(parts[2], 10);

// 6. Print final release summary banner
console.log('\n');
console.log('================================================================');
console.log(`🎉 RELEASE v${version} (Build ${buildCode}) COMPLETE!`);
console.log('================================================================');
console.log(`\n📊 Status Summary:`);
console.log(`   - Web (Cloudflare Pages): ${cloudflareStatus}`);
console.log(`     • Production:    https://chill-flight.pages.dev`);
console.log(`     • Custom domain: https://chill-flight.cowneck.com`);
console.log(`     • Version alias: https://${safeName}.chill-flight.pages.dev`);
console.log(`   - Android (Google Play):   ${androidStatus}`);
console.log(
  `     • Play Console:  https://play.google.com/console/developers/app/tracks`
);
console.log(`   - iOS (TestFlight / ASC):  ${iosStatus}`);
console.log(`     • App Store:     https://appstoreconnect.apple.com/apps`);

console.log(
  '\n----------------------------------------------------------------'
);
console.log('📋 Apple App Store Connect — Final submission details:');
console.log('----------------------------------------------------------------');
console.log(`Version:    ${version}`);
console.log(`Build:      ${buildCode}`);
console.log(
  `Direct URL: https://appstoreconnect.apple.com/apps/6779847377/distribution/ios/version/deliverable`
);
console.log('\nWhat\'s new in this version (copy-paste for "What\'s New"):');
console.log('```text');
console.log(releaseNotes || '(No release notes recorded for this version)');
console.log('```');
console.log(
  '----------------------------------------------------------------\n'
);
