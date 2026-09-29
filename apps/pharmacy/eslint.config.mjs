import nextPlugin from "@next/eslint-plugin-next"
import reactHooks from "eslint-plugin-react-hooks"
import tsPlugin from "@typescript-eslint/eslint-plugin"
import tsParser from "@typescript-eslint/parser"

/**
 * Native ESLint 9 flat config. Avoid FlatCompat — @eslint/eslintrc needs ajv@6
 * which collides with Expo's ajv@8 in this workspace.
 *
 * ESLint 9 only matches js/mjs/cjs unless a config object sets `files`.
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
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/exhaustive-deps": "off",
      // Brand and receipt marks stay as <img>. A warn here fails --max-warnings 0
      // once TypeScript files are actually linted.
      "@next/next/no-img-element": "off",
      "react/no-unescaped-entities": "off",
    },
  },
  {
    ignores: ["next-env.d.ts", ".next/**", "vitest.config.ts", "node_modules/**", "prisma/**"],
  },
]
