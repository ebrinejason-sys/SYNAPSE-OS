import nextPlugin from "@next/eslint-plugin-next"
import reactHooks from "eslint-plugin-react-hooks"
import tsPlugin from "@typescript-eslint/eslint-plugin"
import tsParser from "@typescript-eslint/parser"

/**
 * Native ESLint 9 flat config. Do not use FlatCompat/@eslint/eslintrc:
 * that package requires ajv@6 while Expo/metro require ajv@8 in this monorepo.
 *
 * ESLint 9 only matches js/mjs/cjs unless a config object sets `files`.
 * Without this glob, every .ts/.tsx file is ignored ("no matching configuration").
 */
const sourceFiles = ["**/*.{js,mjs,cjs,jsx,ts,tsx}"]

export default [
  {
    files: sourceFiles,
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooks,
    },
    linterOptions: { reportUnusedDisableDirectives: "off" },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
  },
  nextPlugin.flatConfig.coreWebVitals,
  {
    files: sourceFiles,
    rules: {
      "react/no-unescaped-entities": "off",
      "@next/next/no-html-link-for-pages": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },
  {
    ignores: [
      "eslint.config.mjs",
      "next-env.d.ts",
      ".next/**",
      "node_modules/**",
      "out/**",
      "public/**",
    ],
  },
]
