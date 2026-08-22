import nextPlugin from "@next/eslint-plugin-next"

/**
 * Native ESLint 9 flat config. Do not use FlatCompat/@eslint/eslintrc:
 * that package requires ajv@6 while Expo/metro require ajv@8 in this monorepo.
 */
export default [
  nextPlugin.flatConfig.coreWebVitals,
  {
    rules: {
      "react/no-unescaped-entities": "off",
      "@next/next/no-html-link-for-pages": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
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
