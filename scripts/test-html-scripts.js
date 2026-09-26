#!/usr/bin/env node
/**
 * scripts/test-html-scripts.js
 *
 * Scans HTML files in the project to verify that all local <script src="...">
 * references point to files that actually exist on disk.
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

// Find all HTML files to check (exclude docs/, node_modules/, etc.)
const ignoredDirs = new Set([
  'docs',
  'node_modules',
  'dist',
  '.git',
  'ios',
  'android',
  'src-tauri',
]);

function findHtmlFiles(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, {withFileTypes: true});
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name) && !entry.name.startsWith('.')) {
        results = results.concat(findHtmlFiles(path.join(dir, entry.name)));
      }
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      results.push(path.join(dir, entry.name));
    }
  }
  return results;
}

const htmlFiles = findHtmlFiles(rootDir);
let hasError = false;
let totalChecked = 0;

console.log('Testing HTML script references...');

for (const htmlFile of htmlFiles) {
  const content = fs.readFileSync(htmlFile, 'utf8');
  const relativeHtmlPath = path.relative(rootDir, htmlFile);
  const htmlDir = path.dirname(htmlFile);

  // Match all <script ... src="..." ...> tags
  const scriptRegex = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let match;

  while ((match = scriptRegex.exec(content)) !== null) {
    const src = match[1].trim();

    // Skip external URLs and Vite dev /src/ paths
    if (
      src.startsWith('http://') ||
      src.startsWith('https://') ||
      src.startsWith('//')
    ) {
      continue;
    }
    if (src.startsWith('/src/')) {
      // Check Vite module in project root
      const resolvedVitePath = path.join(rootDir, src);
      totalChecked++;
      if (!fs.existsSync(resolvedVitePath)) {
        console.error(
          `  FAIL: [${relativeHtmlPath}] Module path "${src}" not found on disk at "${resolvedVitePath}"`
        );
        hasError = true;
      }
      continue;
    }

    // Resolve relative to the HTML file directory, or rootDir if leading slash
    const resolvedPath = src.startsWith('/')
      ? path.join(rootDir, src)
      : path.join(htmlDir, src);

    totalChecked++;

    if (!fs.existsSync(resolvedPath)) {
      console.error(
        `  FAIL: [${relativeHtmlPath}] Script "${src}" does not exist on disk (looked at "${path.relative(rootDir, resolvedPath)}")`
      );
      hasError = true;
    }
  }
}

if (hasError) {
  console.error(
    '\n❌ HTML script validation failed. Fix missing script references above.\n'
  );
  process.exit(1);
} else {
  console.log(
    `  Passed: Verified ${totalChecked} script references across ${htmlFiles.length} HTML files.`
  );
  process.exit(0);
}
