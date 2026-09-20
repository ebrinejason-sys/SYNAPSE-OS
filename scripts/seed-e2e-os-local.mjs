#!/usr/bin/env node
/**
 * Seed the local disposable Supabase with the synthetic E2E fixture.
 * Password comes from the gitignored E2E env file. Database URL/key come
 * from local .env.local. Refuses any remote/production host.
 */
import { readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

function loadEnvFile(path) {
  const env = {}
  try {
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
  } catch {
    return env
  }
  return env
}

const local = loadEnvFile(join(root, ".env.local"))
const e2e = loadEnvFile(join(root, ".env.e2e-acceptance"))
const status = spawnSync("npx", ["supabase", "status", "-o", "env"], {
  cwd: root,
  encoding: "utf8",
})
if (status.status !== 0) {
  console.error("Local supabase is not running")
  process.exit(1)
}
const statusEnv = {}
for (const line of (status.stdout || "").split(/\r?\n/)) {
  const eq = line.indexOf("=")
  if (eq === -1) continue
  statusEnv[line.slice(0, eq)] = line.slice(eq + 1).replace(/^"|"$/g, "")
}
const url = statusEnv.API_URL || ""
const key = statusEnv.SERVICE_ROLE_KEY || local.SUPABASE_SERVICE_ROLE_KEY || ""
const password = e2e.SYNAPSE_E2E_PASSWORD || ""

let host
try {
  host = new URL(url).hostname
} catch {
  console.error("Local SUPABASE_URL is not a valid URL")
  process.exit(1)
}
if (host !== "127.0.0.1" && host !== "localhost" && host !== "[::1]") {
  console.error("Refusing to seed a non-loopback database")
  process.exit(1)
}
if (!key || key.length < 32) {
  console.error("Local service role key missing")
  process.exit(1)
}
if (!password || password.length < 12) {
  console.error("E2E password missing from gitignored env")
  process.exit(1)
}

const result = spawnSync("npm", ["run", "seed:e2e-os"], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    SYNAPSE_E2E_SEED: "true",
    SYNAPSE_E2E_PASSWORD: password,
    SYNAPSE_E2E_SUPABASE_URL: url,
    SYNAPSE_E2E_SERVICE_ROLE_KEY: key,
    SYNAPSE_E2E_ALLOW_PRODUCTION_DB: "",
  },
})
process.exit(result.status ?? 1)
