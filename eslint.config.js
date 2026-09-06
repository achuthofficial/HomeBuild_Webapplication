import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

/**
 * `npm run lint` was declared in package.json but had no config and no eslint
 * dependency, so it failed on a clean checkout.
 *
 * The rules that earn their place here are the ones that catch the bugs this
 * codebase has actually shipped: a hook called conditionally, a stale
 * dependency array, and an unused import left behind by a refactor.
 */
export default [
  { ignores: ['dist/**', 'node_modules/**', 'public/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        /* Inlined by vite.config.js `define`, so it exists at runtime but
           nothing declares it in source. */
        __APP_VERSION__: 'readonly',
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: { react: { version: 'detect' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      /* Without these two, every component imported for JSX reads as an
         unused variable — no-unused-vars does not know that <Card /> is a
         reference to `Card`. */
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
      ...reactHooks.configs.recommended.rules,
      /* React Compiler guidance about cascading renders, not a correctness
         rule. Every site it flags here is the same legitimate pattern —
         seeding form state once the row it edits has loaded. Kept as a
         warning so it stays visible rather than silenced, but it does not
         fail the build. */
      'react-hooks/set-state-in-effect': 'warn',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      /* Caught real dead code during the fixture cleanup. Args are exempt
         because event handlers legitimately ignore trailing parameters. */
      'no-unused-vars': [
        'error',
        { args: 'none', varsIgnorePattern: '^_' },
      ],
    },
  },
]
