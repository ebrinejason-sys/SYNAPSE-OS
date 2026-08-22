#!/usr/bin/env node
/**
 * @eslint/eslintrc requires ajv@6. Expo/metro require ajv@8.
 * npm workspaces hoist a single ajv@8, which crashes ESLint 9:
 *   TypeError: Cannot set properties of undefined (setting 'defaultMeta')
 * Nest ajv@6 under @eslint/eslintrc and eslint so Node resolution finds the
 * compatible copy first. Expo keeps the hoisted ajv@8.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const require = createRequire(join(root, "package.json"))

let ajv6Root
try {
  ajv6Root = dirname(require.resolve("ajv6/package.json"))
} catch {
  const eslintPresent = existsSync(join(root, "node_modules", "eslint"))
  if (eslintPresent) {
    console.error("[nest-eslint-ajv6] ajv6 (npm:ajv@6) is required so ESLint can run next to Expo's ajv@8")
    process.exit(1)
  }
  process.exit(0)
}

const version = JSON.parse(readFileSync(join(ajv6Root, "package.json"), "utf8")).version
if (!version.startsWith("6.")) {
  console.warn(`[nest-eslint-ajv6] ajv6 resolved to ${version}, expected 6.x; skip`)
  process.exit(0)
}

const hosts = [
  join(root, "node_modules", "@eslint", "eslintrc"),
  join(root, "node_modules", "eslint"),
  join(root, "apps", "web", "node_modules", "@eslint", "eslintrc"),
  join(root, "apps", "pharmacy", "node_modules", "@eslint", "eslintrc"),
]

let nested = 0
for (const host of hosts) {
  if (!existsSync(host)) continue
  const dest = join(host, "node_modules", "ajv")
  rmSync(dest, { recursive: true, force: true })
  mkdirSync(dirname(dest), { recursive: true })
  cpSync(ajv6Root, dest, { recursive: true })
  nested += 1
}

console.log(`[nest-eslint-ajv6] nested ajv@${version} under ${nested} eslint host(s)`)
