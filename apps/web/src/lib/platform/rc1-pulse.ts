/**
 * Hospital Pilot RC1 pulse — evidence-file scoreboard for Admin.
 * Never invents PASS: a gate is PASS only when its evidence file exists.
 * proofKind distinguishes domain / http / live so Admin never labels domain-only as live-verified.
 */
import { existsSync } from "node:fs"
import { join } from "node:path"

export type Rc1ProofKind = "domain" | "http" | "live"

export type Rc1PulseGate = {
  id: string
  label: string
  evidence: string
  proofKind: Rc1ProofKind
  status: "PASS" | "MISSING"
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
]

function evidenceRoots(): string[] {
  return [
    join(process.cwd(), "docs", "engineering", "evidence"),
    join(process.cwd(), "..", "..", "docs", "engineering", "evidence"),
    join(process.cwd(), "..", "docs", "engineering", "evidence"),
  ]
}

export function getHospitalPilotRc1Pulse(existsImpl: (path: string) => boolean = existsSync): Rc1Pulse {
  const roots = evidenceRoots()
  const gates: Rc1PulseGate[] = RC1_GATES.map((gate) => {
    const found = roots.some((root) => existsImpl(join(root, gate.evidence)))
    return {
      id: gate.id,
      label: gate.label,
      evidence: gate.evidence,
      proofKind: gate.proofKind,
      status: found ? "PASS" : "MISSING",
    }
  })
  const passed = gates.filter((g) => g.status === "PASS").length
  const total = gates.length
  const liveGates = gates.filter((g) => g.proofKind === "live")
  const livePassed = liveGates.filter((g) => g.status === "PASS").length
  const liveTotal = liveGates.length
  let status: Rc1Pulse["status"] = "INCOMPLETE"
  // PILOT_READY requires every gate present AND every live gate present (no domain-only inflation).
  if (passed === total && livePassed === liveTotal && liveTotal > 0) status = "PILOT_READY"
  else if (passed >= Math.ceil(total * 0.75)) status = "STRONG_YELLOW"
  return {
    status,
    passed,
    total,
    livePassed,
    liveTotal,
    detail: `${passed}/${total} evidence files on disk (${livePassed}/${liveTotal} live); domain/http PASS ≠ live workflow PASS`,
    gates,
    checkedAt: new Date().toISOString(),
  }
}
