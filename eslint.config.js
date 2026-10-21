import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import importPlugin from 'eslint-plugin-import';
import reactHooks from 'eslint-plugin-react-hooks';

const NODE_ONLY_MODULES = [
  'fs',
  'fs/promises',
  'path',
  'child_process',
  'os',
  'crypto',
  'url',
  'worker_threads',
];

export default tseslint.config(
  { ignores: ['**/out/**', '**/dist/**', '**/coverage/**', '.superpowers/**'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['**/*.tsx'],
    ...reactHooks.configs.flat.recommended,
    languageOptions: { globals: { ...globals.browser } },
  },
  // Architecture §3 dependency rule: packages never depend on apps.
  {
    plugins: { import: importPlugin },
    rules: {
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './packages',
              from: './apps',
              message: 'packages/* must not import from apps/* (architecture §3 dependency rule).',
            },
          ],
        },
      ],
    },
  },
  // Themes and UI run in the browser too, so they never touch Node or Electron.
  {
    files: ['packages/themes/**', 'packages/ui/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [...NODE_ONLY_MODULES, 'electron'].map((name) => ({
            name,
            message:
              'themes and ui must not import Node or Electron (architecture §3 dependency rule).',
          })),
          patterns: [
            {
              group: ['node:*'],
              message:
                'themes and ui must not import Node or Electron (architecture §3 dependency rule).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
