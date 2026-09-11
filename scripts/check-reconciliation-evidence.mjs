#!/usr/bin/env node
// Read-only verifier for operator-supplied production migration reconciliation
// evidence. This never applies a migration and never marks remote ledger
// reconciliation as PASS — it only verifies that a specific, checked-in
// evidence file is internally consistent and bound to concrete artifacts,
// so "an operator confirmed it" cannot silently stand in for "the bound
// evidence was actually checked."
//
// Distinguishes two separate concerns that the evidence file must carry:
//   - operatorConfirmed: a human attestation (subjective, cannot be verified
//     mechanically beyond "was it set").
//   - boundEvidenceVerified: this script's own checks that the attestation is
//     bound to the exact worktree, the exact remote ledger snapshot the
//     operator says they reviewed, the exact local migration hashes, and a
//     reviewed pending-migration set that matches what the migration-history
//     evidence actually reports as new since the baseline.
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const root = process.cwd()
const evidenceDir = join(root, "artifacts", "readiness")
const evidencePath = process.env.RECONCILIATION_EVIDENCE_PATH ?? join(evidenceDir, "reconciliation-evidence.json")
const MAX_EVIDENCE_AGE_MS = 24 * 60 * 60 * 1000

function git(args) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim()
  } catch {
    return null
  }
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex")
}

function freshness(timestamp) {
  if (!timestamp) return { fresh: false, reason: "missing reviewedAt timestamp" }
  const parsed = Date.parse(timestamp)
  if (Number.isNaN(parsed)) return { fresh: false, reason: "malformed reviewedAt timestamp" }
  const ageMs = Date.now() - parsed
  if (ageMs < 0) return { fresh: false, reason: "reviewedAt is in the future" }
  if (ageMs > MAX_EVIDENCE_AGE_MS) return { fresh: false, reason: `evidence is ${Math.round(ageMs / 3600000)}h old (max ${MAX_EVIDENCE_AGE_MS / 3600000}h)` }
  return { fresh: true, reason: null }
}

const problems = []
const warnings = []

let evidence = null
if (!existsSync(evidencePath)) {
  problems.push(`no reconciliation evidence file at ${evidencePath}`)
} else {
  try {
    evidence = JSON.parse(readFileSync(evidencePath, "utf8"))
  } catch (err) {
    problems.push(`reconciliation evidence file is not valid JSON: ${err.message}`)
  }
}

const sourceSha = git(["rev-parse", "HEAD"])

let boundToWorktree = false
let boundToRemoteLedgerSnapshot = false
let boundToLocalMigrationHashes = false
let reviewedSetGrounded = false
let operatorConfirmed = false
let evidenceFresh = false

if (evidence) {
  if (!evidence.supabaseProjectId || typeof evidence.supabaseProjectId !== "string") {
    problems.push("missing supabaseProjectId")
  }

  if (!evidence.sourceShaFull || evidence.sourceShaFull !== sourceSha) {
    problems.push(`sourceShaFull (${evidence.sourceShaFull ?? "missing"}) does not match current HEAD (${sourceSha ?? "unknown"}) — evidence is not bound to this worktree`)
  } else {
    boundToWorktree = true
  }

  if (!evidence.remoteLedgerSnapshotPath || !evidence.remoteLedgerSnapshotSha256) {
    problems.push("missing remoteLedgerSnapshotPath or remoteLedgerSnapshotSha256")
  } else {
    const snapshotPath = join(root, evidence.remoteLedgerSnapshotPath)
    if (!existsSync(snapshotPath)) {
      problems.push(`remoteLedgerSnapshotPath does not exist: ${evidence.remoteLedgerSnapshotPath}`)
    } else {
      const actualHash = sha256(readFileSync(snapshotPath))
      if (actualHash !== evidence.remoteLedgerSnapshotSha256) {
        problems.push(`remoteLedgerSnapshotSha256 does not match the content at ${evidence.remoteLedgerSnapshotPath} — snapshot was altered or the hash is stale`)
      } else {
        boundToRemoteLedgerSnapshot = true
      }
    }
  }

  const migrationHistoryPath = join(evidenceDir, "migration-history.json")
  if (!existsSync(migrationHistoryPath)) {
    problems.push("missing artifacts/readiness/migration-history.json — run npm run db:history:check first so local migration hashes can be bound")
  } else {
    const migrationHistory = JSON.parse(readFileSync(migrationHistoryPath, "utf8"))
    if (!evidence.localMigrationHashesSha256) {
      problems.push("missing localMigrationHashesSha256")
    } else {
      const localHashesDigest = sha256(JSON.stringify((migrationHistory.migrations ?? []).map((m) => [m.file, m.rawSha256])))
      if (localHashesDigest !== evidence.localMigrationHashesSha256) {
        problems.push("localMigrationHashesSha256 does not match the current migration-history.json evidence — local migrations changed since this evidence was reviewed")
      } else {
        boundToLocalMigrationHashes = true
      }
    }

    const reportedPending = new Set(
      (migrationHistory.warnings ?? [])
        .filter((w) => typeof w === "string" && w.startsWith("migration added since"))
        .map((w) => w.split(": ").slice(1).join(": ").trim()),
    )
    const reviewedSet = Array.isArray(evidence.reviewedPendingMigrations) ? evidence.reviewedPendingMigrations : []
    if (reviewedSet.length === 0 && reportedPending.size === 0) {
      warnings.push("reviewedPendingMigrations is empty — valid because no migrations are currently pending")
    }
    const reviewedAsSet = new Set(reviewedSet)
    const missingFromReview = [...reportedPending].filter((f) => !reviewedAsSet.has(f))
    const extraInReview = reviewedSet.filter((f) => !reportedPending.has(f))
    if (missingFromReview.length) problems.push(`reviewedPendingMigrations is missing files the migration-history evidence reports as pending: ${missingFromReview.join(", ")}`)
    if (extraInReview.length) problems.push(`reviewedPendingMigrations lists files not reported as pending by migration-history evidence: ${extraInReview.join(", ")}`)
    reviewedSetGrounded = missingFromReview.length === 0 && extraInReview.length === 0
  }

  const freshCheck = freshness(evidence.reviewedAt)
  evidenceFresh = freshCheck.fresh
  if (!freshCheck.fresh) problems.push(`reviewedAt failed freshness check: ${freshCheck.reason}`)

  if (!evidence.operator || typeof evidence.operator !== "string") {
    problems.push("missing operator identity")
  }
  operatorConfirmed = evidence.operatorConfirmed === true
  if (!operatorConfirmed) problems.push("operatorConfirmed is not explicitly true")
}

const boundEvidenceVerified = boundToWorktree && boundToRemoteLedgerSnapshot && boundToLocalMigrationHashes && reviewedSetGrounded && evidenceFresh

const output = {
  generatedAt: new Date().toISOString(),
  evidencePath,
  sourceSha,
  operatorConfirmed,
  boundEvidenceVerified,
  bindings: {
    worktree: boundToWorktree,
    remoteLedgerSnapshot: boundToRemoteLedgerSnapshot,
    localMigrationHashes: boundToLocalMigrationHashes,
    reviewedPendingMigrationSet: reviewedSetGrounded,
    fresh: evidenceFresh,
  },
  problems,
  warnings,
  // Operator confirmation plus verified bindings is still never sufficient
  // authorization to apply a production migration from this repository —
  // that remains a separate, explicit, human-run operator action.
  productionMigrationAuthorization: "NEVER_GRANTED_BY_THIS_CHECK",
}

mkdirSync(evidenceDir, { recursive: true })
writeFileSync(join(evidenceDir, "reconciliation-evidence-check.json"), `${JSON.stringify(output, null, 2)}\n`)
console.log(JSON.stringify(output, null, 2))

if (problems.length) {
  console.error("[reconciliation:check] evidence is incomplete, stale, or not bound to this worktree")
  process.exitCode = 1
} else {
  console.error("[reconciliation:check] operator-confirmed evidence is bound and internally consistent; production migration application remains a separate operator action")
}
