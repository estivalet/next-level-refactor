import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import importPlugin from 'eslint-plugin-import';
import reactHooks from 'eslint-plugin-react-hooks';
import { builtinModules } from 'node:module';

const APP_PACKAGE_PATTERN = {
  group: ['launcher', 'api', 'admin'].flatMap((app) => [
    `@nextlevel/${app}`,
    `@nextlevel/${app}/**`,
  ]),
  message: 'packages/* must not import from apps/* (architecture §3 dependency rule).',
};

const BROWSER_SAFE_MESSAGE =
  'themes and ui must not import Node or Electron (architecture §3 dependency rule).';

const RENDERER_MESSAGE =
  'The renderer talks to main only through window.nextlevel (NFR-SEC-1); no Node or Electron imports.';

/** no-restricted-imports options that ban Node built-ins and Electron, plus any extra patterns. */
function noNodeOrElectron(message, extraPatterns = []) {
  return {
    paths: [...builtinModules, 'electron'].map((name) => ({ name, message })),
    patterns: [...extraPatterns, { group: ['node:*', 'electron/*'], message }],
  };
}

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
  // The path rule above only sees relative imports; workspace symlinks make apps importable by name.
  {
    files: ['packages/**'],
    rules: { 'no-restricted-imports': ['error', { patterns: [APP_PACKAGE_PATTERN] }] },
  },
  // Themes and UI run in the browser too, so they never touch Node or Electron. This block
  // replaces the rule options above for these files, so it repeats the app pattern.
  {
    files: ['packages/themes/**', 'packages/ui/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        noNodeOrElectron(BROWSER_SAFE_MESSAGE, [APP_PACKAGE_PATTERN]),
      ],
    },
  },
  {
    files: ['apps/launcher/src/renderer/**'],
    rules: { 'no-restricted-imports': ['error', noNodeOrElectron(RENDERER_MESSAGE)] },
  },
  {
    files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
