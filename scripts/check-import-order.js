#!/usr/bin/env node
/**
 * scripts/check-import-order.js
 *
 * src/main.js imports every game module in load order. A module may only
 * import modules listed before it there, which keeps the module graph free of
 * cycles (a cycle can run a module before the ones it depends on, leaving
 * their exports uninitialized). Calls into later modules go through hooks.js.
 */

import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import * as espree from 'espree';

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const read = (f) => fs.readFileSync(path.join(rootDir, f), 'utf8');
const importsOf = (f) =>
  espree
    .parse(read(f), {ecmaVersion: 'latest', sourceType: 'module'})
    .body.filter((n) => n.type === 'ImportDeclaration')
    .map((n) => n.source.value);

console.log('Checking module import order...');

// Load order: root modules as imported by src/main.js.
const order = importsOf('src/main.js')
  .filter((s) => s.startsWith('../'))
  .map((s) => s.slice(3));
const position = new Map(order.map((f, i) => [f, i]));

const rootModules = fs.readdirSync(rootDir).filter(
  (f) =>
    f.endsWith('.js') &&
    !f.startsWith('eslint') &&
    f !== 'vite.config.js' &&
    f !== 'terrain-worker.js' // worker entry point, loaded separately
);

const problems = [];
for (const f of rootModules) {
  if (!position.has(f)) problems.push(`${f} is not imported by src/main.js`);
}
for (const f of order) {
  for (const spec of importsOf(f)) {
    if (!spec.startsWith('./')) continue;
    const dep = spec.slice(2).split('?')[0];
    if (!dep.endsWith('.js') || dep.includes('/')) continue;
    if (!position.has(dep)) {
      problems.push(`${f} imports ${dep}, which src/main.js doesn't list`);
    } else if (position.get(dep) >= position.get(f)) {
      problems.push(
        `${f} imports ${dep}, which loads after it (use hooks.js or move code)`
      );
    }
  }
}

if (problems.length) {
  console.error('FAIL: module import order problems:');
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(
  `  Passed: ${order.length} modules only import modules that load before them.`
);
