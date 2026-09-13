/**
 * Hospital Pilot RC1 pulse — evidence scoreboard for Admin.
 * Never invents PASS. Live gates require frontmatter metadata (result/environment/sha/scope),
 * not merely file presence or proofKind=live.
 */
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

export type Rc1ProofKind = "domain" | "http" | "live"

export type Rc1EvidenceMeta = {
  result?: string
  environment?: string
  sha?: string
  scope?: string
  recordedAt?: string
}

export type Rc1PulseGate = {
  id: string
  label: string
  evidence: string
  proofKind: Rc1ProofKind
  status: "PASS" | "MISSING" | "STALE" | "UNVERIFIED"
  detail?: string
  meta?: Rc1EvidenceMeta
}

export type Rc1Pulse = {
  status: "STRONG_YELLOW" | "PILOT_READY" | "INCOMPLETE"
  passed: number
  total: number
  livePassed: number
  liveTotal: number
  detail: string
  gates: Rc1PulseGate[]
  checkedAt: string
  expectedSha?: string | null
}

const RC1_GATES: Array<{ id: string; label: string; evidence: string; proofKind: Rc1ProofKind }> = [
  { id: "invites", label: "Facility invites", evidence: "invite-journey-2026-09-11T06-55-28-430Z.json", proofKind: "live" },
  { id: "opd_dispense", label: "OPD→dispense live", evidence: "opd-dispense-live-2026-09-11.md", proofKind: "live" },
  { id: "writeup", label: "Clinical write-up", evidence: "clinical-writeup-2026-09-11.md", proofKind: "http" },
  { id: "closeout", label: "Closeout golden", evidence: "hospital-closeout-golden-2026-09-11.md", proofKind: "domain" },
  { id: "golden_live", label: "Hospital Golden Journey live", evidence: "hospital-golden-live-2026-09-12.md", proofKind: "live" },
  { id: "referrals", label: "Referrals live", evidence: "referral-live-2026-09-12.md", proofKind: "live" },
  { id: "offline_writeup", label: "Offline write-up SyncCommand (domain)", evidence: "clinical-offline-writeup-2026-09-12.md", proofKind: "domain" },
  { id: "sync_flush", label: "Hospital sync flush HTTP", evidence: "hospital-sync-apply-writeup-2026-09-12.md", proofKind: "http" },
  { id: "mfa", label: "MFA step-up live TOTP", evidence: "mfa-step-up-live-2026-09-12.md", proofKind: "live" },
  { id: "sha", label: "Admin SHA alignment", evidence: "admin-sha-alignment-2026-09-12.md", proofKind: "http" },
  { id: "offline_disposition", label: "Offline disposition SyncCommand (domain)", evidence: "clinical-offline-disposition-2026-09-12.md", proofKind: "domain" },
  { id: "offline_triage", label: "Offline triage SyncCommand (domain)", evidence: "clinical-offline-triage-2026-09-12.md", proofKind: "domain" },
  { id: "offline_prescribe", label: "Offline prescribe SyncCommand (domain)", evidence: "clinical-offline-prescribe-2026-09-12.md", proofKind: "domain" },
  { id: "lab_golden", label: "Lab golden journey (domain)", evidence: "lab-golden-journey-2026-09-12.md", proofKind: "domain" },
  { id: "lab_actions_http", label: "Lab actions auth HTTP", evidence: "lab-actions-http-2026-09-13.md", proofKind: "http" },
  { id: "offline_browser_bridge", label: "Hospital offline browser bridge", evidence: "hospital-offline-browser-bridge-2026-09-13.md", proofKind: "http" },
  { id: "lab_replacement_sql", label: "Lab replacement SQL disposable", evidence: "lab-replacement-sql-2026-09-13.md", proofKind: "http" },
]

const STALE_MS = 14 * 24 * 60 * 60 * 1000

function evidenceRoots(): string[] {
  return [
    join(process.cwd(), "docs", "engineering", "evidence"),
    join(process.cwd(), "..", "..", "docs", "engineering", "evidence"),
    join(process.cwd(), "..", "docs", "engineering", "evidence"),
  ]
}

export function parseEvidenceFrontmatter(text: string): Rc1EvidenceMeta {
  const match = text.match(/^---\s*\n([\s\S]*?)\n---/)
  if (!match?.[1]) return {}
  const meta: Rc1EvidenceMeta = {}
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":")
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "")
    if (key === "result" || key === "environment" || key === "sha" || key === "scope" || key === "recordedAt") {
      meta[key] = value
    }
  }
  return meta
}

function findEvidenceFile(
  evidence: string,
  existsImpl: (path: string) => boolean,
  readImpl: (path: string) => string,
): { path: string; body: string } | null {
  for (const root of evidenceRoots()) {
    const path = join(root, evidence)
    if (!existsImpl(path)) continue
    try {
      return { path, body: readImpl(path) }
    } catch {
      return { path, body: "" }
    }
  }
  return null
}

function evaluateGate(
  gate: (typeof RC1_GATES)[number],
  existsImpl: (path: string) => boolean,
  readImpl: (path: string) => string,
  expectedSha?: string | null,
): Rc1PulseGate {
  const found = findEvidenceFile(gate.evidence, existsImpl, readImpl)
  if (!found) {
    return { ...gate, status: "MISSING", detail: "evidence file absent" }
  }

  if (gate.proofKind !== "live") {
    return { ...gate, status: "PASS", detail: `${gate.proofKind} evidence present (not live workflow)` }
  }

  const meta = parseEvidenceFrontmatter(found.body)
  if (!meta.result || !meta.environment || !meta.sha || !meta.scope || !meta.recordedAt) {
    return {
      ...gate,
      status: "UNVERIFIED",
      detail: "live evidence missing required frontmatter (result/environment/sha/scope/recordedAt)",
      meta,
    }
  }
  if (meta.result.toUpperCase() !== "PASS") {
    return { ...gate, status: "UNVERIFIED", detail: `live result=${meta.result}`, meta }
  }
  const recorded = Date.parse(meta.recordedAt)
  if (!Number.isFinite(recorded) || Date.now() - recorded > STALE_MS) {
    return { ...gate, status: "STALE", detail: "live evidence older than 14 days or bad recordedAt", meta }
  }
  if (expectedSha && meta.sha && !expectedSha.startsWith(meta.sha) && !meta.sha.startsWith(expectedSha.slice(0, 7))) {
    return {
      ...gate,
      status: "STALE",
      detail: `evidence sha ${meta.sha} does not match expected ${expectedSha.slice(0, 12)}`,
      meta,
    }
  }
  return { ...gate, status: "PASS", detail: `live PASS on ${meta.environment}`, meta }
}

export function getHospitalPilotRc1Pulse(
  existsImpl: (path: string) => boolean = existsSync,
  options?: {
    readImpl?: (path: string) => string
    expectedSha?: string | null
  },
): Rc1Pulse {
  const readImpl =
    options?.readImpl ??
    ((path: string) => {
      try {
        return readFileSync(path, "utf8")
      } catch {
        return ""
      }
    })
  const expectedSha = options?.expectedSha ?? process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? null
  const gates = RC1_GATES.map((gate) => evaluateGate(gate, existsImpl, readImpl, expectedSha))
  const passed = gates.filter((g) => g.status === "PASS").length
  const total = gates.length
  const liveGates = gates.filter((g) => g.proofKind === "live")
  const livePassed = liveGates.filter((g) => g.status === "PASS").length
  const liveTotal = liveGates.length
  let status: Rc1Pulse["status"] = "INCOMPLETE"
  if (passed === total && livePassed === liveTotal && liveTotal > 0) status = "PILOT_READY"
  else if (passed >= Math.ceil(total * 0.75)) status = "STRONG_YELLOW"
  return {
    status,
    passed,
    total,
    livePassed,
    liveTotal,
    detail: `${passed}/${total} gates PASS; live ${livePassed}/${liveTotal} with valid metadata (file≠live)`,
    gates,
    checkedAt: new Date().toISOString(),
    expectedSha,
  }
}
