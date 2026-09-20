#!/usr/bin/env node
/**
 * Apply canonical public schema chunks to the isolated acceptance database
 * over the Supabase SQL HTTP surface. Never prints secrets.
 */
import { readFileSync, readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { validateIsolatedSupabaseUrl, validateServiceRoleKey } from "./e2e-acceptance-isolation.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

function loadEnvFile(path) {
  const env = {}
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue
    const eq = trimmed.indexOf("=")
    const key = trimmed.slice(0, eq)
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

const env = {
  ...loadEnvFile(join(root, ".env.e2e-acceptance")),
  ...process.env,
}

const urlCheck = validateIsolatedSupabaseUrl(env.SYNAPSE_E2E_SUPABASE_URL)
if (urlCheck.status !== "FOUND") {
  console.error(`Refusing remote apply: ${urlCheck.reason || urlCheck.status}`)
  process.exit(1)
}
const keyCheck = validateServiceRoleKey(env.SYNAPSE_E2E_SERVICE_ROLE_KEY)
if (keyCheck.status !== "FOUND") {
  console.error(`Refusing remote apply: ${keyCheck.reason || keyCheck.status}`)
  process.exit(1)
}

const chunkDir = join(root, ".tmp/fresh-chunks")
const files = readdirSync(chunkDir).filter((name) => name.endsWith(".sql")).sort()
if (files.length === 0) {
  console.error("No SQL chunks found")
  process.exit(1)
}

const origin = new URL(env.SYNAPSE_E2E_SUPABASE_URL).origin
const endpoints = [
  `${origin}/pg/query`,
  `https://api.supabase.com/v1/projects/${urlCheck.projectRef}/database/query`,
]

async function runSql(sql) {
  const errors = []
  for (const endpoint of endpoints) {
    const headers = {
      apikey: env.SYNAPSE_E2E_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SYNAPSE_E2E_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    }
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ query: sql }),
    })
    const text = await response.text()
    if (response.ok) return { endpoint, status: response.status, body: text.slice(0, 300) }
    errors.push(`${endpoint} HTTP ${response.status} ${text.slice(0, 180)}`)
  }
  throw new Error(errors.join(" | "))
}

const probe = await runSql("select current_database() as db")
console.log(JSON.stringify({ probeOk: true, endpointHost: new URL(probe.endpoint).host, body: probe.body }))

for (const file of files) {
  const sql = readFileSync(join(chunkDir, file), "utf8")
  console.log(`Applying ${file} (${sql.length} bytes)`)
  const result = await runSql(sql)
  console.log(`OK ${file} via ${new URL(result.endpoint).host}`)
}

const verify = await runSql(`
  select count(*)::int as tables from pg_tables where schemaname='public';
`)
console.log(JSON.stringify({ verify: verify.body }))
