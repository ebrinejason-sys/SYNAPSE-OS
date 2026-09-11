/**
 * Structured doctor encounter write-up for Hospital Pilot RC1.
 * Persisted under encounters.metadata.writeup (no migration required).
 */

export type ClinicalWriteup = {
  hpi: string
  pmh: string
  medications: string
  allergies: string
  familySocial: string
  ros: string
  examination: string
  assessment: string
  plan: string
  updatedAt?: string
  updatedBy?: string | null
}

export const EMPTY_CLINICAL_WRITEUP: ClinicalWriteup = {
  hpi: "",
  pmh: "",
  medications: "",
  allergies: "",
  familySocial: "",
  ros: "",
  examination: "",
  assessment: "",
  plan: "",
}

const MAX_FIELD = 8000

export function normalizeClinicalWriteup(input: Partial<ClinicalWriteup> | null | undefined): ClinicalWriteup {
  const src = input ?? {}
  const pick = (key: keyof ClinicalWriteup) => {
    const raw = src[key]
    return typeof raw === "string" ? raw.slice(0, MAX_FIELD) : ""
  }
  return {
    hpi: pick("hpi"),
    pmh: pick("pmh"),
    medications: pick("medications"),
    allergies: pick("allergies"),
    familySocial: pick("familySocial"),
    ros: pick("ros"),
    examination: pick("examination"),
    assessment: pick("assessment"),
    plan: pick("plan"),
    updatedAt: typeof src.updatedAt === "string" ? src.updatedAt : undefined,
    updatedBy: typeof src.updatedBy === "string" || src.updatedBy === null ? src.updatedBy : undefined,
  }
}

export function writeupFromEncounterMetadata(metadata: unknown): ClinicalWriteup {
  if (!metadata || typeof metadata !== "object") return { ...EMPTY_CLINICAL_WRITEUP }
  const writeup = (metadata as Record<string, unknown>).writeup
  if (!writeup || typeof writeup !== "object") return { ...EMPTY_CLINICAL_WRITEUP }
  return normalizeClinicalWriteup(writeup as Partial<ClinicalWriteup>)
}

export function mergeWriteupIntoMetadata(
  metadata: unknown,
  writeup: ClinicalWriteup,
): Record<string, unknown> {
  const base =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? { ...(metadata as Record<string, unknown>) }
      : {}
  return {
    ...base,
    writeup: normalizeClinicalWriteup(writeup),
  }
}

/** Narrative clinical note assembled for signing / display. */
export function composeClinicalNote(writeup: ClinicalWriteup, chiefComplaint?: string | null): string {
  const sections: Array<[string, string]> = [
    ["Chief complaint", (chiefComplaint ?? "").trim()],
    ["HPI", writeup.hpi.trim()],
    ["Past medical history", writeup.pmh.trim()],
    ["Medications", writeup.medications.trim()],
    ["Allergies / reactions", writeup.allergies.trim()],
    ["Family / social history", writeup.familySocial.trim()],
    ["Review of systems", writeup.ros.trim()],
    ["Examination", writeup.examination.trim()],
    ["Assessment", writeup.assessment.trim()],
    ["Plan", writeup.plan.trim()],
  ]
  return sections
    .filter(([, body]) => body.length > 0)
    .map(([title, body]) => title + "\n" + body)
    .join("\n\n")
}

export function writeupCompleteness(writeup: ClinicalWriteup): {
  filled: number
  total: number
  missing: string[]
} {
  const fields: Array<[keyof ClinicalWriteup, string]> = [
    ["hpi", "HPI"],
    ["pmh", "Past medical history"],
    ["medications", "Medications"],
    ["allergies", "Allergies"],
    ["familySocial", "Family / social"],
    ["ros", "ROS"],
    ["examination", "Examination"],
    ["assessment", "Assessment"],
    ["plan", "Plan"],
  ]
  const missing = fields.filter(([key]) => !String(writeup[key] ?? "").trim()).map(([, label]) => label)
  return { filled: fields.length - missing.length, total: fields.length, missing }
}
