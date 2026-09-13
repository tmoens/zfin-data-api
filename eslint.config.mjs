// eslint.config.mjs
import typescriptEslintParser from '@typescript-eslint/parser';
import typescriptEslintPlugin from '@typescript-eslint/eslint-plugin';
import prettierPlugin from 'eslint-plugin-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';

export default [
  // Flat config has no implicit ignores beyond node_modules, so build output and rendered deploy
  // artifacts have to be named here or `eslint .` reports on generated .d.ts files.
  {
    ignores: ['dist/**', 'coverage/**', 'deploy/.rendered/**'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.json'],

    languageOptions: {
      parser: typescriptEslintParser,
      parserOptions: {
        ecmaVersion: 'latest',
      },
    },

    plugins: {
      '@typescript-eslint': typescriptEslintPlugin,
      prettier: prettierPlugin,
      'simple-import-sort': simpleImportSort,
    },

    rules: {
      'no-console': 'warn',
      'no-unused-vars': 'off', // Disabled in favor of @typescript-eslint/no-unused-vars

      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      'simple-import-sort/imports': 'error',

      'prettier/prettier': 'error',
    },

    settings: {},
  },
];
