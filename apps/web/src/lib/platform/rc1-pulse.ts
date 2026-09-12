/**
 * Hospital Pilot RC1 pulse — evidence-file scoreboard for Admin.
 * Never invents PASS: a gate is PASS only when its evidence file exists.
 */
import { existsSync } from "node:fs"
import { join } from "node:path"

export type Rc1PulseGate = {
  id: string
  label: string
  evidence: string
  status: "PASS" | "MISSING"
}

export type Rc1Pulse = {
  status: "STRONG_YELLOW" | "PILOT_READY" | "INCOMPLETE"
  passed: number
  total: number
  detail: string
  gates: Rc1PulseGate[]
  checkedAt: string
}

const RC1_GATES: Array<{ id: string; label: string; evidence: string }> = [
  { id: "invites", label: "Facility invites", evidence: "invite-journey-2026-09-11T06-55-28-430Z.json" },
  { id: "opd_dispense", label: "OPD→dispense live", evidence: "opd-dispense-live-2026-09-11.md" },
  { id: "writeup", label: "Clinical write-up", evidence: "clinical-writeup-2026-09-11.md" },
  { id: "closeout", label: "Closeout golden", evidence: "hospital-closeout-golden-2026-09-11.md" },
  { id: "golden_live", label: "Hospital Golden Journey live", evidence: "hospital-golden-live-2026-09-12.md" },
  { id: "referrals", label: "Referrals live", evidence: "referral-live-2026-09-12.md" },
  { id: "offline_writeup", label: "Offline write-up SyncCommand", evidence: "clinical-offline-writeup-2026-09-12.md" },
  { id: "sync_flush", label: "Hospital sync flush HTTP", evidence: "hospital-sync-apply-writeup-2026-09-12.md" },
  { id: "mfa", label: "MFA step-up live TOTP", evidence: "mfa-step-up-live-2026-09-12.md" },
  { id: "sha", label: "Admin SHA alignment", evidence: "admin-sha-alignment-2026-09-12.md" },
  { id: "offline_disposition", label: "Offline disposition SyncCommand", evidence: "clinical-offline-disposition-2026-09-12.md" },
  { id: "offline_triage", label: "Offline triage SyncCommand", evidence: "clinical-offline-triage-2026-09-12.md" },
  { id: "offline_prescribe", label: "Offline prescribe SyncCommand", evidence: "clinical-offline-prescribe-2026-09-12.md" },
  { id: "lab_golden", label: "Lab golden journey (specimen/TAT/amend)", evidence: "lab-golden-journey-2026-09-12.md" },
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
      status: found ? "PASS" : "MISSING",
    }
  })
  const passed = gates.filter((g) => g.status === "PASS").length
  const total = gates.length
  let status: Rc1Pulse["status"] = "INCOMPLETE"
  if (passed === total) status = "PILOT_READY"
  else if (passed >= Math.ceil(total * 0.75)) status = "STRONG_YELLOW"
  return {
    status,
    passed,
    total,
    detail: `${passed}/${total} RC1 evidence gates present on disk`,
    gates,
    checkedAt: new Date().toISOString(),
  }
}
