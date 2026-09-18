export type ClinicalAiEndpoint =
  | "diagnose"
  | "copilot"
  | "soap"
  | "history"
  | "score"
  | "health_coach"

export type ClinicalAiPolicy = {
  endpoint: ClinicalAiEndpoint
  authentication: "session"
  tenantScoped: boolean
  roleAuthorized: boolean
  advisoryOnly: boolean
  timeoutMs: number
  humanOverride: true
  provenanceRequired: true
}

export const CLINICAL_AI_POLICIES: Record<ClinicalAiEndpoint, ClinicalAiPolicy> = {
  diagnose: {
    endpoint: "diagnose",
    authentication: "session",
    tenantScoped: true,
    roleAuthorized: true,
    advisoryOnly: true,
    timeoutMs: 20_000,
    humanOverride: true,
    provenanceRequired: true,
  },
  copilot: {
    endpoint: "copilot",
    authentication: "session",
    tenantScoped: true,
    roleAuthorized: true,
    advisoryOnly: true,
    timeoutMs: 15_000,
    humanOverride: true,
    provenanceRequired: true,
  },
  soap: {
    endpoint: "soap",
    authentication: "session",
    tenantScoped: true,
    roleAuthorized: true,
    advisoryOnly: true,
    timeoutMs: 15_000,
    humanOverride: true,
    provenanceRequired: true,
  },
  history: {
    endpoint: "history",
    authentication: "session",
    tenantScoped: true,
    roleAuthorized: true,
    advisoryOnly: true,
    timeoutMs: 15_000,
    humanOverride: true,
    provenanceRequired: true,
  },
  score: {
    endpoint: "score",
    authentication: "session",
    tenantScoped: true,
    roleAuthorized: true,
    advisoryOnly: true,
    timeoutMs: 10_000,
    humanOverride: true,
    provenanceRequired: true,
  },
  health_coach: {
    endpoint: "health_coach",
    authentication: "session",
    tenantScoped: false,
    roleAuthorized: true,
    advisoryOnly: true,
    timeoutMs: 20_000,
    humanOverride: true,
    provenanceRequired: true,
  },
}

export function clinicalAiUnauthorized() {
  return { error: "Unauthorized", advisory: true as const }
}

export function clinicalAiForbidden(reason: string) {
  return { error: reason, advisory: true as const }
}

export function clinicalAiUnavailable(endpoint: ClinicalAiEndpoint) {
  return {
    error: "AI_PROVIDER_UNAVAILABLE",
    advisory: true as const,
    humanOverrideRequired: true as const,
    endpoint,
    message: "Clinical AI is advisory only. Continue with clinician judgement; this endpoint did not produce a model output.",
  }
}

export function redactAiLog(input: Record<string, unknown>): Record<string, unknown> {
  const blocked = new Set(["chiefComplaint", "history", "examination", "medications", "allergies", "message", "note", "phi"])
  return Object.fromEntries(
    Object.entries(input).filter(([key]) => !blocked.has(key) && !key.toLowerCase().includes("secret")),
  )
}
