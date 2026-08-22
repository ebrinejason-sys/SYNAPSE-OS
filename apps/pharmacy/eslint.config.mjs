import nextPlugin from "@next/eslint-plugin-next"

/**
 * Native ESLint 9 flat config. Avoid FlatCompat — @eslint/eslintrc needs ajv@6
 * which collides with Expo's ajv@8 in this workspace.
 */
export default [
  nextPlugin.flatConfig.coreWebVitals,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@next/next/no-img-element": "warn",
      "react/no-unescaped-entities": "off",
    },
  },
  {
    ignores: ["next-env.d.ts", ".next/**", "vitest.config.ts", "node_modules/**", "prisma/**"],
  },
]
