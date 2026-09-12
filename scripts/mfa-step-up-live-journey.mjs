#!/usr/bin/env node
/**
 * Live MFA TOTP step-up journey against pilot Supabase.
 *
 * Proves: enrollment secret → current TOTP → verifyStepUpMfa → hasRecentVerifiedMfa
 * on a real synapse_sessions row. Does NOT invent PASS.
 *
 * Usage:
 *   node scripts/mfa-step-up-live-journey.mjs --project-ref qfqakzmjatszisuqjwon
 *   node scripts/mfa-step-up-live-journey.mjs --email ebrinetushabe@gmail.com
 */
import { createClient } from "@supabase/supabase-js"
import { execFileSync, spawnSync } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const require = createRequire(import.meta.url)

function argValue(flag) {
  const idx = process.argv.indexOf(flag)
  return idx >= 0 ? process.argv[idx + 1] : null
}

function fetchServiceRole(projectRef) {
  const raw = execFileSync(
    "npx",
    ["supabase", "projects", "api-keys", "--project-ref", projectRef, "-o", "json"],
    { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  )
  const keys = JSON.parse(raw)
  const service =
    keys.find((k) => k.name === "service_role" || k.id === "service_role") ||
    keys.find((k) => String(k.name || "").includes("service"))
  if (!service?.api_key) throw new Error("service_role key not found via supabase CLI")
  return service.api_key
}

// RFC 6238 TOTP (same algorithm as packages/auth/src/totp.ts) — secret never logged.
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
function b32Decode(input) {
  const str = input.toUpperCase().replace(/=+$/, "").replace(/\s/g, "")
  const bytes = []
  let bits = 0
  let value = 0
  for (const ch of str) {
    const idx = B32.indexOf(ch)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

async function totpCode(secret, counter) {
  const key = b32Decode(secret)
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64BE(BigInt(counter))
  const crypto = await import("node:crypto")
  const mac = crypto.createHmac("sha1", key).update(buf).digest()
  const off = mac[19] & 0xf
  const num =
    (((mac[off] & 0x7f) << 24) |
      ((mac[off + 1] & 0xff) << 16) |
      ((mac[off + 2] & 0xff) << 8) |
      (mac[off + 3] & 0xff)) %
    1_000_000
  return num.toString().padStart(6, "0")
}

function currentStep(nowMs = Date.now()) {
  return Math.floor(nowMs / 1000 / 30)
}

const projectRef = argValue("--project-ref") || process.env.SUPABASE_PROJECT_REF || "qfqakzmjatszisuqjwon"
const email = (argValue("--email") || "ebrinetushabe@gmail.com").toLowerCase()
const url = (
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  `https://${projectRef}.supabase.co`
).trim()
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim() || fetchServiceRole(projectRef)
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

const evidenceDir = join(root, "docs/engineering/evidence")
mkdirSync(evidenceDir, { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, "-")

const steps = []
function step(name, ok, detail = {}) {
  steps.push({ name, ok, ...detail })
  console.error(`${ok ? "PASS" : "FAIL"} ${name}${detail.note ? ` — ${detail.note}` : ""}`)
}

const { data: profile, error: profileErr } = await db
  .from("profiles")
  .select("id, email, is_admin, platform_control_role")
  .eq("email", email)
  .maybeSingle()

if (profileErr || !profile) {
  step("load_profile", false, { note: profileErr?.message || "not found" })
  failOut()
}
step("load_profile", true, { userId: profile.id, email: profile.email, is_admin: profile.is_admin })

const { data: enrollment, error: enrollErr } = await db
  .from("mfa_enrollments")
  .select("id, user_id, verified, secret")
  .eq("user_id", profile.id)
  .eq("verified", true)
  .maybeSingle()

if (enrollErr || !enrollment?.secret) {
  step("load_enrollment", false, { note: enrollErr?.message || "no verified enrollment/secret" })
  failOut()
}
step("load_enrollment", true, { enrollmentId: enrollment.id, hasSecret: true })

const now = new Date()
const { data: sessions, error: sessErr } = await db
  .from("synapse_sessions")
  .select("id, expires_at, revoked_at, mfa_assured_at")
  .eq("user_id", profile.id)
  .is("revoked_at", null)
  .gt("expires_at", now.toISOString())
  .order("expires_at", { ascending: false })
  .limit(5)

if (sessErr || !sessions?.length) {
  step("load_live_session", false, { note: sessErr?.message || "no unexpired session" })
  failOut()
}
const session = sessions[0]
step("load_live_session", true, { sessionId: session.id, expires_at: session.expires_at })

const code = await totpCode(enrollment.secret, currentStep())
if (!/^\d{6}$/.test(code)) {
  step("generate_totp", false)
  failOut()
}
step("generate_totp", true, { note: "generated from enrolled secret (not logged)" })

// Call real domain function via tsx
const runner = `
import { verifyStepUpMfa, hasRecentVerifiedMfa } from ${JSON.stringify(join(root, "packages/auth/src/mfa-recency.ts"))}
async function main() {
  const userId = ${JSON.stringify(profile.id)}
  const sessionId = ${JSON.stringify(session.id)}
  const code = ${JSON.stringify(code)}
  const verify = await verifyStepUpMfa(userId, sessionId, code)
  const recent = verify.ok ? await hasRecentVerifiedMfa(userId, sessionId) : false
  console.log(JSON.stringify({ verify, recent }))
}
main().catch((err) => {
  console.error(err)
  process.exit(1)
})
`

const env = {
  ...process.env,
  SUPABASE_URL: url,
  NEXT_PUBLIC_SUPABASE_URL: url,
  SUPABASE_SERVICE_ROLE_KEY: key,
}

const tsx = spawnSync("npx", ["tsx", "-e", runner], {
  cwd: root,
  env,
  encoding: "utf8",
  maxBuffer: 4 * 1024 * 1024,
})

if (tsx.status !== 0) {
  step("verifyStepUpMfa", false, {
    note: (tsx.stderr || tsx.stdout || "tsx failed").slice(0, 500),
  })
  failOut()
}

let domain
try {
  const lines = (tsx.stdout || "").trim().split("\n").filter(Boolean)
  domain = JSON.parse(lines[lines.length - 1])
} catch (e) {
  step("verifyStepUpMfa", false, { note: `parse failed: ${(tsx.stdout || "").slice(0, 300)}` })
  failOut()
}

const verifyOk = Boolean(domain?.verify?.ok)
step("verifyStepUpMfa", verifyOk, verifyOk ? {} : { code: domain?.verify?.code })
const recentOk = Boolean(domain?.recent)
step("hasRecentVerifiedMfa", recentOk)

const ok = steps.every((s) => s.ok)
const report = {
  generatedAt: new Date().toISOString(),
  supabaseProjectId: projectRef,
  journey: "mfa-step-up-live-totp",
  ok,
  email,
  userId: profile.id,
  sessionId: session.id,
  enrollmentId: enrollment.id,
  codeSource: "generated_from_enrolled_secret_service_role",
  steps,
  notes: ok
    ? [
        "Live TOTP step-up PASS via real verifyStepUpMfa + hasRecentVerifiedMfa against pilot DB.",
        "Code generated from enrolled secret (service role); secret and code are not retained in evidence.",
      ]
    : ["Live TOTP step-up incomplete — see failed steps."],
}

writeEvidence(report)
process.exit(ok ? 0 : 1)

function writeEvidence(report) {
  const jsonPath = join(evidenceDir, `mfa-step-up-live-${stamp}.json`)
  const mdPath = join(evidenceDir, "mfa-step-up-live-2026-09-12.md")
  writeFileSync(jsonPath, JSON.stringify(report, null, 2))
  writeFileSync(
    mdPath,
    `# MFA step-up live TOTP — 2026-09-12

## Result
**${report.ok ? "PASS" : "FAIL"}**

- Project: \`${projectRef}\`
- User: \`${email}\`
- Session: \`${report.sessionId}\`
- Code source: enrolled secret via service role (not phone UI; same RFC 6238 path)

## Steps
${steps.map((s) => `- ${s.ok ? "PASS" : "FAIL"} \`${s.name}\`${s.code ? ` (${s.code})` : ""}${s.note ? ` — ${s.note}` : ""}`).join("\n")}

## Run
\`\`\`bash
node scripts/mfa-step-up-live-journey.mjs --project-ref ${projectRef} --email ${email}
\`\`\`

## Artifact
\`${jsonPath.replace(root + "/", "")}\`
`,
  )
  console.log(JSON.stringify({ ok: report.ok, jsonPath, mdPath }, null, 2))
}

function failOut() {
  writeEvidence({
    generatedAt: new Date().toISOString(),
    supabaseProjectId: projectRef,
    journey: "mfa-step-up-live-totp",
    ok: false,
    email,
    userId: profile?.id ?? null,
    sessionId: null,
    enrollmentId: enrollment?.id ?? null,
    codeSource: "generated_from_enrolled_secret_service_role",
    steps,
    notes: ["Aborted on failed step."],
  })
  process.exit(1)
}
