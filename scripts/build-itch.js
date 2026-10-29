// Packages the game as an HTML5 ZIP archive for itch.io.
// The ZIP contains index.html at the root of the archive, as required by itch.io.
// Assets are built to a temporary directory so docs/ is never touched.
import {execFileSync, execSync} from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const DEFAULT_OUT = path.join(DIST, 'chill-flight-itch.zip');
const outZip = path.resolve(process.argv[2] || process.env.OUT || DEFAULT_OUT);

// Ensure destination folder exists
fs.mkdirSync(path.dirname(outZip), {recursive: true});

// Temporary build directory
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chill-flight-itch-'));

try {
  console.log('Building web assets with Vite ...');
  execSync(`npx vite build --outDir "${tempDir}" --emptyOutDir`, {
    cwd: ROOT,
    stdio: ['ignore', 'inherit', 'inherit'],
  });

  const entryHtml = path.join(tempDir, 'index.html');
  if (!fs.existsSync(entryHtml)) {
    throw new Error('Build failed: index.html was not found in the output.');
  }

  if (fs.existsSync(outZip)) {
    fs.rmSync(outZip);
  }

  console.log(`Packaging ZIP archive into ${outZip} ...`);
  try {
    execFileSync('zip', ['-q', '-r', outZip, '.', '-x', '*.DS_Store*'], {
      cwd: tempDir,
      stdio: 'inherit',
    });
  } catch {
    // Fallback to Python zipfile if zip binary is unavailable
    execFileSync(
      'python3',
      [
        '-c',
        `
import zipfile, os, sys
src, dest = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(dest, 'w', zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk(src):
        for f in files:
            if f.startswith('.DS_Store'): continue
            fp = os.path.join(root, f)
            zf.write(fp, os.path.relpath(fp, src))
`,
        tempDir,
        outZip,
      ],
      {stdio: 'inherit'}
    );
  }

  const stat = fs.statSync(outZip);
  const sizeMB = (stat.size / (1024 * 1024)).toFixed(2);
  console.log(`\n✅ Created itch.io package: ${outZip} (${sizeMB} MB)`);
  console.log('📦 index.html is located at the root of the ZIP file.');
} finally {
  fs.rmSync(tempDir, {recursive: true, force: true});
}
