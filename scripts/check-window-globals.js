#!/usr/bin/env node
/**
 * scripts/check-window-globals.js
 *
 * Game code shares values through ES module imports, not window properties.
 * ESLint's no-undef can't see `window.foo` reads, so this check fails if any
 * module or inline HTML script reads a window property that no game code
 * assigns and that isn't a browser/runtime global. That's how a stale
 * `window.foo` lookup (always undefined) gets caught.
 */

import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import * as espree from 'espree';
import globals from 'globals';

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);

// Globals provided outside game code.
const ALLOWED = new Set([
  ...Object.keys(globals.browser),
  ...Object.keys(globals.worker),
  '__APP_VERSION__', // injected by vite.config.js
  '__COMMIT_HASH__',
  '__IS_DIRTY__',
  '__TAURI__', // desktop (Tauri) runtime
  'Capacitor', // native (Capacitor) runtime
  'DEBUG', // set by hand in devtools to enable log.info
  'orientation', // legacy iOS screen orientation API (not in `globals`)
]);

const sources = [];
for (const dir of ['.', 'src', 'debug']) {
  for (const f of fs.readdirSync(path.join(rootDir, dir))) {
    const rel = path.join(dir, f);
    if (
      f.endsWith('.js') &&
      !f.startsWith('eslint') &&
      f !== 'vite.config.js'
    ) {
      sources.push({
        file: rel,
        code: fs.readFileSync(path.join(rootDir, rel), 'utf8'),
      });
    } else if (f.endsWith('.html')) {
      const html = fs.readFileSync(path.join(rootDir, rel), 'utf8');
      for (const m of html.matchAll(
        /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g
      )) {
        const line = html.slice(0, m.index).split('\n').length;
        sources.push({file: rel, code: m[1], lineOffset: line - 1});
      }
    }
  }
}

function parse(code) {
  for (const sourceType of ['module', 'script']) {
    try {
      return espree.parse(code, {ecmaVersion: 'latest', sourceType, loc: true});
    } catch {
      /* try the next source type */
    }
  }
  return null;
}

function walk(node, visit, parent) {
  if (!node || typeof node.type !== 'string') return;
  visit(node, parent);
  for (const key of Object.keys(node)) {
    const value = node[key];
    if (Array.isArray(value)) value.forEach((c) => walk(c, visit, node));
    else if (value && typeof value.type === 'string') walk(value, visit, node);
  }
}

const isGlobalObject = (n) =>
  n.type === 'Identifier' && ['window', 'globalThis', 'self'].includes(n.name);

const written = new Set();
const reads = [];
for (const {file, code, lineOffset = 0} of sources) {
  const ast = parse(code);
  if (!ast) {
    console.error(`FAIL: could not parse ${file}`);
    process.exit(1);
  }
  walk(ast, (node, parent) => {
    if (
      node.type !== 'MemberExpression' ||
      node.computed ||
      !isGlobalObject(node.object) ||
      node.property.type !== 'Identifier'
    ) {
      return;
    }
    const name = node.property.name;
    const isWrite =
      parent?.type === 'AssignmentExpression' && parent.left === node;
    if (isWrite) written.add(name);
    else
      reads.push({name, where: `${file}:${node.loc.start.line + lineOffset}`});
  });
}

console.log('Checking window property reads...');
const bad = reads.filter((r) => !written.has(r.name) && !ALLOWED.has(r.name));
if (bad.length) {
  console.error('FAIL: window properties read but never assigned:');
  for (const r of bad) console.error(`  window.${r.name} at ${r.where}`);
  process.exit(1);
}
console.log(
  `  Passed: ${reads.length} window property reads all resolve to something assigned.`
);
