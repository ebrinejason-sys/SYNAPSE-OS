#!/usr/bin/env node
/**
 * Preflight configuration check for SYNAPSE-OS production acceptance.
 *
 * Validates required environment secrets without printing their values.
 * Exits non-zero if any required configuration is MISSING or INVALID.
 */

const checks = {
  SYNAPSE_E2E_BASE_URL: {
    source: "VERCEL",
    description: "Remote acceptance deployment URL",
    required: true,
    validate: (value) => {
      if (!value) return { status: "MISSING" }
      try {
        const url = new URL(value)
        if (url.protocol !== "https:") {
          return { status: "INVALID", reason: "Must use https://" }
        }
        if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
          return { status: "INVALID", reason: "Must be remote, not localhost" }
        }
        if (url.hostname.endsWith(".invalid") || url.hostname.endsWith(".example") || url.hostname.endsWith(".test")) {
          return { status: "INVALID", reason: "Must be a real Vercel Preview host, not a placeholder" }
        }
        return { status: "FOUND" }
      } catch {
        return { status: "INVALID", reason: "Not a valid URL" }
      }
    },
  },
  SYNAPSE_E2E_EMAIL: {
    source: "OPERATOR_CREATED",
    description: "E2E staff email credential",
    required: true,
    validate: (value) => {
      if (!value) return { status: "MISSING" }
      if (!value.includes("@")) {
        return { status: "INVALID", reason: "Not a valid email format" }
      }
      if (!value.endsWith("@synapseos.invalid")) {
        return { status: "INVALID", reason: "Must be a synthetic @synapseos.invalid E2E identity" }
      }
      return { status: "FOUND" }
    },
  },
  SYNAPSE_E2E_PASSWORD: {
    source: "OPERATOR_CREATED",
    description: "E2E staff password",
    required: true,
    validate: (value) => {
      if (!value) return { status: "MISSING" }
      if (value.length < 12) {
        return { status: "INVALID", reason: "Must be at least 12 characters" }
      }
      return { status: "FOUND" }
    },
  },
  SYNAPSE_E2E_FIXED_OTP: {
    source: "OPERATOR_CREATED",
    description: "Fixed 6-digit OTP for synthetic tenant auth",
    required: true,
    validate: (value) => {
      if (!value) return { status: "MISSING" }
      if (!/^\d{6}$/.test(value)) {
        return { status: "INVALID", reason: "Must be exactly 6 digits" }
      }
      return { status: "FOUND" }
    },
  },
  SYNAPSE_E2E_SUPABASE_URL: {
    source: "SUPABASE",
    description: "Isolated E2E database URL (seed only)",
    required: true,
    validate: (value) => {
      if (!value) return { status: "MISSING" }
      try {
        new URL(value)
        return { status: "FOUND" }
      } catch {
        return { status: "INVALID", reason: "Not a valid URL" }
      }
    },
  },
  SYNAPSE_E2E_SERVICE_ROLE_KEY: {
    source: "SUPABASE",
    description: "Service role key for seeding (seed only)",
    required: true,
    validate: (value) => {
      if (!value) return { status: "MISSING" }
      if (value.length < 32) {
        return { status: "INVALID", reason: "Too short to be a service role key" }
      }
      return { status: "FOUND" }
    },
  },
  SYNAPSE_E2E_REMOTE_HOST_READY: {
    source: "ATTESTATION",
    description: "Operator attestation that remote Vercel deployment has E2E gates configured",
    required: true,
    validate: (value) => {
      if (!value) return { status: "MISSING" }
      if (value !== "true") {
        return { status: "INVALID", reason: 'Must be exactly "true"' }
      }
      return { status: "FOUND" }
    },
  },
}

console.log("=" .repeat(80))
console.log("SYNAPSE-OS Production Acceptance Configuration Doctor")
console.log("=" .repeat(80))
console.log()

let allValid = true
const results = []

for (const [key, config] of Object.entries(checks)) {
  const value = process.env[key]
  const result = config.validate(value)
  
  const line = {
    variable: key,
    status: result.status,
    source: config.source,
    description: config.description,
    reason: result.reason,
  }
  
  results.push(line)
  
  if (result.status !== "FOUND") {
    allValid = false
  }
}

const maxVarLen = Math.max(...results.map((r) => r.variable.length))
const maxStatusLen = Math.max(...results.map((r) => r.status.length))
const maxSourceLen = Math.max(...results.map((r) => r.source.length))

for (const result of results) {
  const statusSymbol = result.status === "FOUND" ? "✓" : "✗"
  const statusColor = result.status === "FOUND" ? "" : ""
  
  console.log(
    `${statusSymbol} ${result.variable.padEnd(maxVarLen)} | ${result.status.padEnd(maxStatusLen)} | ${result.source.padEnd(maxSourceLen)} | ${result.description}`,
  )
  
  if (result.reason) {
    console.log(`  → ${result.reason}`)
  }
}

console.log()
console.log("=" .repeat(80))

if (!allValid) {
  console.log("❌ PREFLIGHT FAILED: Configuration is incomplete or invalid")
  console.log()
  console.log("Required GitHub Environment Secrets (production-acceptance):")
  console.log("  - SYNAPSE_E2E_BASE_URL")
  console.log("  - SYNAPSE_E2E_EMAIL")
  console.log("  - SYNAPSE_E2E_PASSWORD")
  console.log("  - SYNAPSE_E2E_FIXED_OTP")
  console.log("  - SYNAPSE_E2E_SUPABASE_URL")
  console.log("  - SYNAPSE_E2E_SERVICE_ROLE_KEY")
  console.log("  - SYNAPSE_E2E_REMOTE_HOST_READY")
  console.log()
  console.log("Required Vercel Preview Variables (for SYNAPSE_E2E_BASE_URL deployment):")
  console.log("  - SYNAPSE_E2E_AUTH=true")
  console.log("  - SYNAPSE_E2E_ACCEPTANCE_ENV=true")
  console.log("  - SYNAPSE_E2E_FIXED_OTP=(same value as GitHub secret)")
  console.log()
  console.log("See docs/runbooks/PRODUCTION_ACCEPTANCE_SETUP.md for details")
  console.log("=" .repeat(80))
  process.exit(1)
}

console.log("✅ PREFLIGHT PASSED: All required configuration is present and valid")
console.log()
console.log("Note: This check validates format only. Runtime correctness depends on:")
console.log("  1. Remote Vercel deployment has SYNAPSE_E2E_AUTH, SYNAPSE_E2E_ACCEPTANCE_ENV, SYNAPSE_E2E_FIXED_OTP")
console.log("  2. Supabase credentials have write access to the isolated E2E database")
console.log("  3. E2E staff credentials match seeded fixtures")
console.log("=" .repeat(80))
