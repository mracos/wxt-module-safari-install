import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  { ignores: ['node_modules/'] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      // Empty catch blocks are intentional: missing dirs and failed LaunchServices
      // deregistration are both best-effort, not errors.
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  prettier,
];
