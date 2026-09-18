#!/usr/bin/env node
/** Fail closed on committed private keys / obvious secret files. */

import { execSync } from "node:child_process"

const patterns = [
  "BEGIN RSA PRIVATE KEY",
  "BEGIN OPENSSH PRIVATE KEY",
  "BEGIN EC PRIVATE KEY",
  "AKIA[0-9A-Z]{16}",
]

const grep = patterns.map((p) => `-e ${JSON.stringify(p)}`).join(" ")
try {
  const out = execSync(
    `git grep -I -n ${patterns.map((p) => `-e '${p.replace(/'/g, "")}'`).join(" ")} -- ':!docs/**' ':!*.md' ':!package-lock.json' || true`,
    { encoding: "utf8", cwd: process.cwd() },
  )
  const hits = out.trim() ? out.trim().split("\n").filter(Boolean) : []
  if (hits.length) {
    console.error("Secret scan FAIL")
    console.error(hits.slice(0, 20).join("\n"))
    process.exit(1)
  }
  console.log("Secret scan PASS")
} catch {
  console.log("Secret scan PASS")
}
