//run with `npx eslint -c eslint.style.config.js src --fix`
import tsParser from '@typescript-eslint/parser';

export default [
  { ignores: ['dist', 'node_modules', 'public', '*.js'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { parser: tsParser, ecmaVersion: 2020, sourceType: 'module' },
    rules: {
      semi: ['error', 'always'],
      quotes: ['error', 'single', { avoidEscape: true, allowTemplateLiterals: true }],
      'jsx-quotes': ['error', 'prefer-double'],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'brace-style': ['error', '1tbs', { allowSingleLine: true }],
      'object-curly-spacing': ['error', 'always'],
      'no-trailing-spaces': 'error',
      'prefer-const': 'error',
    },
  },
];