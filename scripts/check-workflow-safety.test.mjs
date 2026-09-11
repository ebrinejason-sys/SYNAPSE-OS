import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { test } from "node:test"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const deploy = readFileSync(join(root, ".github/workflows/deploy.yml"), "utf8")
const production = readFileSync(join(root, ".github/workflows/db-production.yml"), "utf8")

test("automatic deployment workflow cannot mutate production schema", () => {
  assert.doesNotMatch(deploy, /supabase\s+db\s+push|npm\s+run\s+db:push/i)
  assert.match(deploy, /name:\s+Deployment/)
  assert.match(production, /workflow_dispatch:/)
  assert.match(production, /supabase\s+db\s+push/)
})

test("production apply requires an explicit reconciliation attestation bound to source_sha", () => {
  assert.match(production, /reconciliation_confirmation:/)
  assert.match(production, /RECONCILIATION_CONFIRMATION[^\n]*!=\s*"RECONCILED"/)
})

test("production workflow validates source_sha format and matches checked-out HEAD before use", () => {
  assert.match(production, /\^\[0-9a-f\]\{40\}\$/)
  assert.match(production, /Checked-out HEAD/)
})

test("production workflow passes untrusted inputs through environment variables, not direct shell interpolation", () => {
  const runBlocks = [...production.matchAll(/run:\s*\|([\s\S]*?)(?=\n\s{6}-\s|\n\S|$)/g)].map((m) => m[1])
  for (const block of runBlocks) {
    assert.doesNotMatch(block, /\$\{\{\s*inputs\./, "inputs.* must not be interpolated directly inside a run: shell block")
  }
})

test("production workflow piped commands propagate failure (pipefail) instead of swallowing them under tee", () => {
  const pipedToTee = production.includes("| tee")
  assert.ok(pipedToTee)
  assert.match(production, /set -euo pipefail/)
})

test("post-apply verification raises on missing tables or disabled RLS instead of only printing query results", () => {
  assert.match(production, /RAISE EXCEPTION/)
  assert.doesNotMatch(production, /SELECT\s+to_regclass\('public\.facility_invitations'\)\s+IS NOT NULL/)
})