import globals from 'globals';
import js from '@eslint/js';
import fs from 'fs';
import path from 'path';
import * as espree from 'espree';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root files already converted to ES modules (see src/main.js imports).
const ESM_FILES = ['logger.js'];

// Dynamically collect all top-level declared identifiers across project scripts
const gameGlobals = {
  ...globals.browser,
  THREE: 'readonly',
  Sentry: 'readonly',
  Capacitor: 'readonly',
  ChillFlightLogic: 'writable',
  Achievements: 'writable',
  SimplexNoise: 'writable',
  module: 'readonly',
};

// Scan root .js files for top-level declarations (functions, classes, var/let/const, window.xyz)
const rootFiles = fs
  .readdirSync(__dirname)
  .filter(
    (f) =>
      f.endsWith('.js') && !f.startsWith('eslint') && f !== 'vite.config.js'
  );

for (const file of rootFiles) {
  const code = fs.readFileSync(path.join(__dirname, file), 'utf8');
  const isModule = ESM_FILES.includes(file);
  try {
    const ast = espree.parse(code, {
      ecmaVersion: 'latest',
      sourceType: isModule ? 'module' : 'script',
    });
    for (const node of ast.body) {
      // Module top-level declarations are private; only window.xyz bridges count.
      if (isModule && node.type !== 'ExpressionStatement') continue;
      if (node.type === 'VariableDeclaration') {
        for (const decl of node.declarations) {
          if (decl.id && decl.id.type === 'Identifier') {
            gameGlobals[decl.id.name] = 'writable';
          }
        }
      } else if (node.type === 'FunctionDeclaration') {
        if (node.id) gameGlobals[node.id.name] = 'writable';
      } else if (node.type === 'ClassDeclaration') {
        if (node.id) gameGlobals[node.id.name] = 'writable';
      } else if (
        node.type === 'ExpressionStatement' &&
        node.expression.type === 'AssignmentExpression'
      ) {
        const left = node.expression.left;
        if (
          left.type === 'MemberExpression' &&
          left.object.type === 'Identifier' &&
          left.object.name === 'window' &&
          left.property.type === 'Identifier'
        ) {
          gameGlobals[left.property.name] = 'writable';
        }
      }
    }
  } catch {
    // ignore parse errors
  }
}

export default [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: gameGlobals,
    },
    rules: {
      'no-unused-vars': ['warn', {vars: 'local', args: 'none'}],
      'no-undef': 'error',
      'no-redeclare': ['error', {builtinGlobals: false}],
    },
  },
  {
    files: ESM_FILES,
    languageOptions: {
      sourceType: 'module',
    },
  },
  {
    files: ['src/**/*.js', 'vite.config.js'],
    languageOptions: {
      sourceType: 'module',
    },
  },
  {
    files: ['scripts/**/*.js', 'eslint.config.js'],
    languageOptions: {
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
  },
  {
    ignores: [
      'docs/',
      'node_modules/',
      'vendor/',
      'www/',
      'src-tauri/',
      'ios/',
      'android/',
    ],
  },
];
