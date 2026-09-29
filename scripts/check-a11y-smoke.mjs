#!/usr/bin/env node
/** Accessibility smoke: production shells must expose a skip link and main landmark. */

import { readFileSync } from "node:fs"
import { join } from "node:path"

const root = process.cwd()
const files = [
  "apps/web/src/components/AppSidebar.tsx",
  "apps/web/src/app/os/[slug]/layout.tsx",
  "apps/web/src/app/hospital/admin/layout.tsx",
  "apps/web/src/app/login/page.tsx",
  "apps/web/src/app/platform/layout.tsx",
  "apps/web/src/app/lab/layout.tsx",
  "apps/web/src/app/admin/layout.tsx",
  "apps/pharmacy/app/portal/layout.tsx",
]

const failures = []
for (const file of files) {
  const source = readFileSync(join(root, file), "utf8")
  if (file.endsWith("login/page.tsx")) {
    if (!/id=["']main["']|<main/.test(source)) failures.push(`${file}: missing main landmark`)
    continue
  }
  if (!/SkipLink/.test(source) && !/id=["']main["']/.test(source)) {
    failures.push(`${file}: missing SkipLink or main landmark`)
  }
}

if (failures.length) {
  console.error("a11y smoke FAIL")
  for (const row of failures) console.error(row)
  process.exit(1)
}
console.log("a11y smoke PASS")
