#!/usr/bin/env node
// Proves which tracked TypeScript files each workspace's ESLint config actually lints.
// Usage: node scripts/lint-coverage.mjs  (exits 1 if a tracked source file is unmatched)
import { execFileSync } from "node:child_process"
import { createRequire } from "node:module"
import { join, relative } from "node:path"

const root = new URL("..", import.meta.url).pathname
const workspaces = [
  { key: "WEB", dir: "apps/web" },
  { key: "PHARMACY", dir: "apps/pharmacy" },
]

let failed = false
for (const { key, dir } of workspaces) {
  const cwd = join(root, dir)
  const { ESLint } = createRequire(join(cwd, "package.json"))("eslint")
  const eslint = new ESLint({ cwd })
  const files = execFileSync("git", ["ls-files", "--", "*.ts", "*.tsx"], { cwd, encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
  const ignored = []
  const unmatched = []
  let matched = 0
  for (const file of files) {
    const abs = join(cwd, file)
    if (await eslint.isPathIgnored(abs)) {
      ignored.push(file)
      continue
    }
    if (await eslint.calculateConfigForFile(abs)) matched += 1
    else unmatched.push(file)
  }
  console.log(`${key}_TS_FILES_TRACKED=${files.length}`)
  console.log(`${key}_TS_FILES_MATCHED=${matched}`)
  console.log(`${key}_TS_FILES_IGNORED=${ignored.length}`)
  console.log(`${key}_TS_FILES_UNMATCHED=${unmatched.length}`)
  const ignoredRoots = [...new Set(ignored.map((f) => f.split("/").slice(0, 2).join("/")))].sort()
  if (ignoredRoots.length) console.log(`${key}_IGNORED_ROOTS=${ignoredRoots.join(",")}`)
  for (const file of unmatched) console.log(`  unmatched: ${relative(root, join(cwd, file))}`)
  if (unmatched.length) failed = true
}
process.exit(failed ? 1 : 0)
