import globals from 'globals';
import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        // Injected by the native runtime (Capacitor apps only).
        Capacitor: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', {vars: 'local', args: 'none'}],
      // typeof checks count too: a `typeof x` guard on a name that isn't
      // defined anywhere is silently false, which hides broken references.
      'no-undef': ['error', {typeof: true}],
      'no-redeclare': ['error', {builtinGlobals: false}],
    },
  },
  {
    files: ['terrain-worker.js'],
    languageOptions: {
      globals: {...globals.worker},
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
