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