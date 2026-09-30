import {execSync} from 'child_process';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;
const tagName = `v${version}`;

// Optional commit target (defaults to HEAD)
const targetCommit = process.argv[2] || 'HEAD';

// If tagging HEAD, ensure working tree is clean so the tag points to a committed release
if (targetCommit === 'HEAD') {
  const status = execSync('git status --porcelain', {encoding: 'utf8'}).trim();
  if (status) {
    console.error('❌ Cannot tag release: uncommitted changes detected.');
    console.error('Please commit the release bundle before tagging.');
    process.exit(1);
  }
}

// Check if tag already exists
const existingTags = execSync('git tag -l', {encoding: 'utf8'})
  .split('\n')
  .map((t) => t.trim());

if (existingTags.includes(tagName)) {
  console.log(`Git tag ${tagName} already exists.`);
  process.exit(0);
}

const commitHash = execSync(`git rev-parse --short ${targetCommit}`, {
  encoding: 'utf8',
}).trim();
const commitMsg = execSync(`git log -1 --pretty=%B ${targetCommit}`, {
  encoding: 'utf8',
}).trim();

if (!commitMsg.startsWith(`Release ${tagName}`)) {
  console.warn(
    `⚠️  Warning: Target commit message ("${commitMsg}") does not match "Release ${tagName}".`
  );
}

try {
  execSync(`git tag -a "${tagName}" -m "Release ${tagName}" ${commitHash}`, {
    stdio: 'inherit',
  });
  console.log(`🏷️  Created git tag ${tagName} on commit ${commitHash}.`);
  console.log(`Remember to push the tag with: git push origin ${tagName}`);
} catch (error) {
  console.error(`Failed to create git tag ${tagName}:`, error.message);
  process.exit(1);
}
