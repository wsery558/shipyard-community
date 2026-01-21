import js from '@eslint/js';

const browserGlobals = {
  console: 'readonly',
  window: 'readonly',
  document: 'readonly',
  fetch: 'readonly',
  WebSocket: 'readonly',
  location: 'readonly',
  alert: 'readonly',
  confirm: 'readonly',
  setTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  navigator: 'readonly',
  URLSearchParams: 'readonly',
  localStorage: 'readonly',
  sessionStorage: 'readonly',
  Blob: 'readonly',
  URL: 'readonly'
};

const nodeGlobals = {
  console: 'readonly',
  process: 'readonly',
  Buffer: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly'
};

// Convert all recommended rules from error to warn
const warnOnlyRules = Object.fromEntries(
  Object.entries(js.configs.recommended.rules).map(([rule, config]) => {
    if (Array.isArray(config) && config[0] === 'error') {
      return [rule, ['warn', ...config.slice(1)]];
    } else if (config === 'error' || config === 2) {
      return [rule, 'warn'];
    }
    return [rule, config];
  })
);

export default [
  {
    ...js.configs.recommended,
    rules: warnOnlyRules
  },
  // JSX/React files (browser)
  {
    ignores: ['node_modules/**', 'ui-dist/**', 'data/**', 'packages/open-core/data/**', 'dist/**'],
    files: ['**/*.jsx', 'ui/**/*.js', 'apps/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true }
      },
      globals: browserGlobals
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
    }
  },
  // Node/server files
  {
    ignores: ['node_modules/**', 'ui-dist/**', 'data/**', 'packages/open-core/data/**', 'dist/**'],
    files: ['server.mjs', 'scripts/**/*.mjs', 'src/**/*.mjs', 'packages/**/*.mjs', '*.config.js', '**/vite.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: nodeGlobals
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
    }
  }
];
