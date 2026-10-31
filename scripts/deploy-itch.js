// Deploys the HTML5 web package to itch.io via the butler CLI tool.
import {execSync} from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const packageJsonPath = path.join(rootDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;
const tagName = `v${version}`;

const ITCH_TARGET = process.env.ITCH_TARGET || 'cowneck/chill-flight:html5';
const ITCH_GAME_ID = process.env.ITCH_GAME_ID || '5254359';

export function hasButlerCredentials() {
  if (process.env.BUTLER_API_KEY) return true;
  const home = os.homedir();
  const macCreds = path.join(
    home,
    'Library/Application Support/itch/butler_creds'
  );
  const unixCreds = path.join(home, '.config/itch/butler_creds');
  return fs.existsSync(macCreds) || fs.existsSync(unixCreds);
}

export function extractReleaseNotes(dir = rootDir, ver = version) {
  try {
    const notesPath = path.join(dir, 'RELEASE_NOTES.md');
    if (!fs.existsSync(notesPath)) {
      return {markdown: '', plainText: ''};
    }
    const notesContent = fs.readFileSync(notesPath, 'utf8');
    const versionEscaped = ver.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(
      `## \\[${versionEscaped}\\][^\\n]*\\n\\n([\\s\\S]*?)(?=\\n## |$)`
    );
    const match = notesContent.match(regex);
    if (!match) {
      return {markdown: '', plainText: ''};
    }
    const markdown = match[1].trim();
    const plainText = markdown
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/(^|[^\w*])([*_])(\S(?:.*?\S)?)\2(?=[^\w*]|$)/gm, '$1$3')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    return {markdown, plainText};
  } catch {
    return {markdown: '', plainText: ''};
  }
}

export function printItchDevlogDetails(options = {}) {
  const {
    version: ver = version,
    target = ITCH_TARGET,
    gameId = ITCH_GAME_ID,
  } = options;
  const cleanVersion = ver.startsWith('v') ? ver.slice(1) : ver;
  const {markdown} = extractReleaseNotes(rootDir, cleanVersion);

  const [project] = target.split(':');
  const [user, slug] = project
    ? project.split('/')
    : ['cowneck', 'chill-flight'];
  const gameUrl =
    user && slug
      ? `https://${user}.itch.io/${slug}`
      : 'https://cowneck.itch.io/chill-flight';
  const dashboardUrl = `https://itch.io/game/summary/${gameId}`;

  console.log(
    '\n----------------------------------------------------------------'
  );
  console.log('🎮 itch.io devlog — Submission details:');
  console.log(
    '----------------------------------------------------------------'
  );
  console.log(`Game page:     ${gameUrl}`);
  console.log(`Dashboard:     ${dashboardUrl}`);
  console.log(`Title:         Chill Flight v${cleanVersion}`);
  console.log(`Type:          Major update`);
  console.log('\nPost body (copy-paste for devlog):');
  console.log('```markdown');
  console.log(markdown || '(No release notes recorded for this version)');
  console.log('```');
  console.log(
    '----------------------------------------------------------------\n'
  );
}

export function deployItch(options = {}) {
  const {userVersion = tagName, target = ITCH_TARGET, dryRun = false} = options;

  // 1. Verify butler is installed
  try {
    execSync('butler -V', {stdio: 'ignore'});
  } catch {
    throw new Error(
      'Butler CLI is not installed or not in PATH. Please install it first.'
    );
  }

  // 2. Verify butler credentials
  if (!hasButlerCredentials()) {
    throw new Error(
      "Butler credentials not found. Please run 'butler login' in your terminal or set BUTLER_API_KEY."
    );
  }

  // 3. Build itch.io zip package
  console.log('\n📦 Packaging web assets for itch.io...');
  execSync('node scripts/build-itch.js', {cwd: rootDir, stdio: 'inherit'});

  const zipPath = path.join(rootDir, 'dist/chill-flight-itch.zip');
  if (!fs.existsSync(zipPath)) {
    throw new Error(`Package file not found at ${zipPath}`);
  }

  // 4. Push to itch.io
  const command = dryRun ? 'push-preview' : 'push';
  const versionArg = dryRun ? '' : ` --userversion "${userVersion}"`;
  console.log(
    `\n🚀 ${dryRun ? 'Testing upload' : 'Uploading'} ${zipPath} to itch.io (${target}) as ${userVersion}...`
  );
  execSync(`butler ${command} "${zipPath}" "${target}"${versionArg}`, {
    cwd: rootDir,
    stdio: 'inherit',
  });
  console.log(
    `\n✨ itch.io deployment complete: https://cowneck.itch.io/chill-flight`
  );

  // 5. Print devlog instructions with release notes
  printItchDevlogDetails({version: userVersion, target});
}

// When run directly as a script
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-n');
  try {
    deployItch({dryRun});
  } catch (error) {
    console.error(`\n❌ itch.io deployment failed: ${error.message}`);
    process.exit(1);
  }
}
