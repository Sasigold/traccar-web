import js from '@eslint/js';
import eslintReact from '@eslint-react/eslint-plugin';
import { configs as importConfigs } from 'eslint-plugin-import-x';
import reactHooks from 'eslint-plugin-react-hooks';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';

const brandFlatMessage =
  'The brand is flat: no gradients, and shadows need an offset (a "0 0 8px" glow is not allowed). See BRAND.md.';

const brandColorMessage =
  'Raw color values are not allowed outside src/common/theme. Use theme.palette or the brand tokens (see BRAND.md).';

export default [
  {
    ignores: [
      'build/**',
      'build-demo/**',
      'sourcemaps/**',
      'switcher.js',
      'theme.js',
      'vite.config.js',
      'website/dist/**',
      'test-results/**',
      'playwright-report/**',
    ],
  },
  js.configs.recommended,
  eslintReact.configs.recommended,
  importConfigs['flat/recommended'],
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    settings: {
      'import-x/resolver': {
        node: {
          extensions: ['.js', '.jsx', '.json'],
        },
      },
    },
    rules: {
      'no-prototype-builtins': 'off',
      'import-x/no-unresolved': [
        'warn',
        {
          ignore: ['\\.svg', 'virtual:'],
        },
      ],
      '@eslint-react/set-state-in-effect': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'off',
      '@eslint-react/no-array-index-key': 'off',
      '@eslint-react/exhaustive-deps': [
        'warn',
        { additionalHooks: '(useCatchCallback|useAsyncTask)$' },
      ],
    },
  },
  {
    // Brand guard (BRAND.md, section 9): every color comes from the design
    // tokens in src/common/theme. Raw hex / rgb / hsl values anywhere else in
    // the app fail the lint, and therefore CI.
    files: ['src/**/*.{js,jsx}', 'website/src/**/*.{js,jsx}'],
    ignores: ['src/common/theme/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/#[0-9a-fA-F]{3,8}\\b/]',
          message: brandColorMessage,
        },
        {
          selector: 'TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b/]',
          message: brandColorMessage,
        },
        {
          selector: 'Literal[value=/^\\s*(rgba?|hsla?)\\(/]',
          message: brandColorMessage,
        },
        {
          selector: 'Literal[value=/(linear|radial|conic)-gradient\\(/]',
          message: brandFlatMessage,
        },
        {
          selector: 'TemplateElement[value.raw=/(linear|radial|conic)-gradient\\(/]',
          message: brandFlatMessage,
        },
        {
          selector: "Property[key.name='boxShadow'] > Literal[value=/^\\s*0 0 [1-9]\\d*px/]",
          message: brandFlatMessage,
        },
        {
          selector:
            "Property[key.name='boxShadow'] > TemplateLiteral > TemplateElement:first-child[value.raw=/^\\s*0 0 [1-9]\\d*px/]",
          message: brandFlatMessage,
        },
        {
          selector: 'TemplateElement[value.raw=/box-shadow:\\s*0 0 [1-9]\\d*px/]',
          message: brandFlatMessage,
        },
      ],
    },
  },
  {
    files: ['deploy/**/*.mjs', 'tools/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
  },
  prettierRecommended,
];
