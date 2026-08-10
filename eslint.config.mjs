// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**'] },

  // TypeScript sources and tests get full type-aware linting. Both projects are
  // listed so that files under tests/ resolve to a program as well.
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.test.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },

  // Tooling files are plain JavaScript and belong to no TypeScript project, so
  // type-aware rules cannot run against them.
  {
    files: ['**/*.js', '**/*.mjs'],
    extends: [js.configs.recommended, tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: {
        module: 'writable',
        require: 'readonly',
        __dirname: 'readonly',
        process: 'readonly',
        console: 'readonly',
      },
    },
  },
);
