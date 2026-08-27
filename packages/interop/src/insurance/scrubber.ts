/**
 * Claim scrubber — advisory only. Never auto-submits.
 * Unverified ICD-11 codes are hard errors.
 */

export type ScrubDiagnosis = {
  display: string
  stemCode?: string | null
  verified: boolean
  release?: string | null
}

export type ScrubInput = {
  diagnoses: ScrubDiagnosis[]
  procedures: string[]
  medications: string[]
  charges: number
  eligibilityCovered: boolean
  documentation?: string[]
}

export type ScrubResult = {
  errors: string[]
  warnings: string[]
  rejectionRisk: number
  riskLabel: "low" | "medium" | "high"
  readyForHumanReview: boolean
  autoSubmit: false
}

export function scrubClaim(input: ScrubInput): ScrubResult {
  const errors: string[] = []
  const warnings: string[] = []
  let rejectionRisk = 0

  if (!input.eligibilityCovered) {
    errors.push("No active eligibility on file.")
    rejectionRisk += 0.4
  }
  if (!input.diagnoses.length) {
    errors.push("No diagnoses attached.")
    rejectionRisk += 0.3
  }
  for (const dx of input.diagnoses) {
    if (!dx.verified || !dx.stemCode) {
      errors.push(`ICD-11 not clinician-verified: ${dx.display}`)
      rejectionRisk += 0.35
    }
    if (dx.release && dx.release !== "2026-01") {
      warnings.push(`Diagnosis ${dx.display} uses ICD-11 release ${dx.release}, expected 2026-01.`)
      rejectionRisk += 0.05
    }
  }
  if (!input.procedures.length) {
    warnings.push("No procedures attached.")
    rejectionRisk += 0.15
  }
  if (input.charges <= 0) {
    warnings.push("Charge total is zero.")
    rejectionRisk += 0.1
  }
  if (input.charges > 5_000_000) {
    warnings.push("High charge total may trigger payer review.")
    rejectionRisk += 0.2
  }
  if (!input.documentation?.length) {
    warnings.push("No supporting documentation listed.")
    rejectionRisk += 0.1
  }

  rejectionRisk = Math.min(1, rejectionRisk)
  const riskLabel: ScrubResult["riskLabel"] =
    rejectionRisk < 0.3 ? "low" : rejectionRisk < 0.6 ? "medium" : "high"

  return {
    errors,
    warnings,
    rejectionRisk,
    riskLabel,
    readyForHumanReview: errors.length === 0,
    autoSubmit: false,
  }
}

export function classifyDenial(reason: string): { category: string; suggestedFixes: string[] } {
  const text = reason.toLowerCase()
  if (text.includes("code") || text.includes("icd") || text.includes("diagnosis")) {
    return {
      category: "coding",
      suggestedFixes: ["Re-validate ICD-11 via terminology service", "Attach clinician-confirmed coding"],
    }
  }
  if (text.includes("eligib") || text.includes("policy")) {
    return {
      category: "eligibility",
      suggestedFixes: ["Re-run eligibility", "Confirm policy was active on date of service"],
    }
  }
  if (text.includes("document") || text.includes("attachment")) {
    return {
      category: "documentation",
      suggestedFixes: ["Attach missing clinical notes", "Include lab/imaging reports cited in the claim"],
    }
  }
  return {
    category: "other",
    suggestedFixes: ["Request payer denial code", "Draft appeal after human review"],
  }
}
