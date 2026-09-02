/**
 * Capability GREEN gates.
 *
 * A public comparison cell may be "yes" only when every engineering check
 * passed AND liveEvidence is true. liveEvidence is a release decision backed
 * by deployment proof — not a landing-page edit.
 *
 * Do not set liveEvidence=true to make the website look finished.
 */

export const COMPARISON_CELLS = ["yes", "partial", "no"] as const
export type ComparisonCell = (typeof COMPARISON_CELLS)[number]

export type GateCheck = {
  id: string
  description: string
  evidence: string
  passed: boolean
}

export type CapabilityGate = {
  id: string
  comparisonLabel: string
  requirement: string
  capabilityId?: string
  integrationId?: string
  /** True only after live/operator proof for this gate. Never inferred from tests alone. */
  liveEvidence: boolean
  checks: GateCheck[]
}

export function comparisonCell(gate: CapabilityGate): ComparisonCell {
  const passed = gate.checks.filter((check) => check.passed).length
  if (passed === 0) return "no"
  if (passed === gate.checks.length && gate.liveEvidence) return "yes"
  return "partial"
}

export function assertGateNotAdvertisedLive(gate: CapabilityGate): void {
  if (comparisonCell(gate) === "yes" && !gate.liveEvidence) {
    throw new Error(`GATE_LIVE_WITHOUT_EVIDENCE:${gate.id}`)
  }
}

/**
 * Engineering truth for PROJECT GOLDEN. Checks describe code that exists in
 * this repository. liveEvidence remains false until staging/production proof.
 */
export const CAPABILITY_GATES: CapabilityGate[] = [
  {
    id: "ai-differential",
    comparisonLabel: "AI differential diagnosis (UCG-grounded)",
    requirement:
      "Authorized longitudinal context, reasoning engine, provenance, clinician ACCEPT/MODIFY/REJECT/DEFER, audit, evaluation tests.",
    capabilityId: "synapse-intelligence",
    liveEvidence: false,
    checks: [
      {
        id: "reasoning-engine",
        description: "Reasoning sessions, hypotheses, evidence, can't-miss, clinician actions",
        evidence: "apps/web/src/lib/reasoning",
        passed: true,
      },
      {
        id: "longitudinal-context",
        description: "PatientContextPacket from timeline/labs/meds/insurance",
        evidence: "apps/web/src/lib/longitudinal/context.ts",
        passed: true,
      },
      {
        id: "governed-kernel",
        description: "Shared intelligence kernel with structured recommendation schema",
        evidence: "packages/interop/src/intelligence/kernel.ts",
        passed: true,
      },
      {
        id: "no-caller-tenant",
        description: "AI writes use session tenant, never body tenantId + service-role",
        evidence: "apps/web/src/app/api/ai/diagnose/route.ts",
        passed: true,
      },
      {
        id: "evaluation-harness-live",
        description: "Production evaluation set with unsafe-output rate",
        evidence: "not deployed",
        passed: false,
      },
    ],
  },
  {
    id: "offline-first",
    comparisonLabel: "Offline-first with sync",
    requirement: "Encrypted durable local DB, command queue, idempotency, conflicts, reconnection tests.",
    capabilityId: "synapse-edge",
    liveEvidence: false,
    checks: [
      {
        id: "pharm-outbox-prototype",
        description: "Pharmacy Android encrypted outbox prototype",
        evidence: "packages/db/src/offline-crypto.ts",
        passed: true,
      },
      {
        id: "clinical-vertical-slice",
        description: "Register → encounter → obs → lab order → Rx → sync",
        evidence: "not implemented as durable clinical kernel",
        passed: false,
      },
      {
        id: "conflict-tests",
        description: "Network-loss tests at every step",
        evidence: "missing",
        passed: false,
      },
    ],
  },
  {
    id: "fhir-r4",
    comparisonLabel: "FHIR R4 resources",
    requirement: "Real endpoints, validation, flagship resources, tenant authorization, integration tests.",
    integrationId: "fhir-r4",
    liveEvidence: false,
    checks: [
      {
        id: "flagship-mappers",
        description: "Canonical ↔ FHIR mappers for 11 flagship resources",
        evidence: "packages/interop/src/fhir/r4.ts",
        passed: true,
      },
      {
        id: "honest-capability-statement",
        description: "CapabilityStatement lists only implemented resources",
        evidence: "apps/web/src/app/fhir/metadata/route.ts",
        passed: true,
      },
      {
        id: "http-not-501",
        description: "Flagship resource routes no longer return 501",
        evidence: "apps/web/src/app/fhir",
        passed: true,
      },
      {
        id: "live-tenant-roundtrip",
        description: "Production tenant FHIR round-trip with authz",
        evidence: "not proven",
        passed: false,
      },
    ],
  },
  {
    id: "insurance-copilot",
    comparisonLabel: "Insurance claim copilot",
    requirement:
      "Eligibility, coverage, claim assembly, scrubber, rejection risk, denial workflow, appeal draft, audit, human approval.",
    integrationId: "insurers",
    liveEvidence: false,
    checks: [
      {
        id: "advisory-services",
        description: "Eligibility, coverage, preauth/claim drafts, denial, appeal",
        evidence: "apps/web/src/lib/insurance/copilot.ts",
        passed: true,
      },
      {
        id: "scrubber",
        description: "Claim scrubber rejects unverified ICD-11 codes",
        evidence: "packages/interop/src/insurance/scrubber.ts",
        passed: true,
      },
      {
        id: "wired-routes",
        description: "Check/claim routes use session tenant",
        evidence: "apps/web/src/app/api/insurance",
        passed: true,
      },
      {
        id: "live-payer-gateway",
        description: "Live payer submission",
        evidence: "intentionally not automatic",
        passed: false,
      },
    ],
  },
  {
    id: "icd-11",
    comparisonLabel: "ICD-11 coding",
    requirement: "WHO API, 2026 release, cache, coding UI, verified code/URI, clinician confirmation. AI never invents codes.",
    integrationId: "icd-11",
    liveEvidence: false,
    checks: [
      {
        id: "terminology-service",
        description: "Search/lookup against ICD-11 2026 MMS with local cache",
        evidence: "packages/interop/src/terminology/icd11.ts",
        passed: true,
      },
      {
        id: "ai-cannot-invent",
        description: "Kernel strips model-emitted codes before persist",
        evidence: "packages/interop/src/intelligence/kernel.ts",
        passed: true,
      },
      {
        id: "who-credentials-live",
        description: "Server-side WHO ICD API credentials in production",
        evidence: "WHO_ICD_CLIENT_ID unset",
        passed: false,
      },
      {
        id: "clinician-coding-ui",
        description: "Encounter coding UI with autocomplete",
        evidence: "API only in this milestone",
        passed: false,
      },
    ],
  },
  {
    id: "uganda-guidelines",
    comparisonLabel: "Uganda Clinical Guidelines in workflow",
    requirement: "Versioned guidelines, executable pathways, real orders/events, clinician override, outcomes.",
    capabilityId: "synapse-pathways",
    liveEvidence: false,
    checks: [
      {
        id: "sepsis-pathway",
        description: "Adult sepsis pathway with override reasons",
        evidence: "packages/db/src/pathways.ts",
        passed: true,
      },
      {
        id: "four-pathways",
        description: "Sepsis, malaria, DKA, pneumonia",
        evidence: "packages/db/src/pathways.ts PATHWAY_CATALOG",
        passed: true,
      },
      {
        id: "outcome-tracking-live",
        description: "Live outcome tracking across facilities",
        evidence: "demo/simulation only",
        passed: false,
      },
    ],
  },
  {
    id: "mobile-app",
    comparisonLabel: "Patient / professional mobile app",
    requirement: "Secure workflows, appointments/results/meds/follow-up, notifications.",
    capabilityId: "synapse-app",
    liveEvidence: false,
    checks: [
      {
        id: "expo-client",
        description: "Role-aware Expo client exists",
        evidence: "apps/app",
        passed: true,
      },
      {
        id: "durable-offline",
        description: "Durable local authority",
        evidence: "response cache only",
        passed: false,
      },
    ],
  },
  {
    id: "pharmacy-pos",
    comparisonLabel: "Integrated pharmacy POS",
    requirement: "Maintain current Pharm release gate. Not GREEN until live operator proof.",
    capabilityId: "synapse-pharm",
    liveEvidence: false,
    checks: [
      {
        id: "pos-inventory-fefo",
        description: "POS, FEFO inventory, receipts, staff, billing",
        evidence: "apps/pharmacy",
        passed: true,
      },
      {
        id: "live-operator-proof",
        description: "Live tenant isolation, current-SHA APK, smoke",
        evidence: "YELLOW controlled pilot",
        passed: false,
      },
    ],
  },
  {
    id: "dhis2",
    comparisonLabel: "DHIS2 export pipeline",
    requirement: "Mapped payload generation, validation, sandbox transmission, retry/audit.",
    integrationId: "dhis2",
    capabilityId: "synapse-public-health",
    liveEvidence: false,
    checks: [
      {
        id: "simulation-adapter",
        description: "Mock DHIS2 adapter for Simulation Lab",
        evidence: "packages/interop/src/adapters/dhis2.ts",
        passed: true,
      },
      {
        id: "privacy-aggregate",
        description: "Privacy-gated aggregate DataValueSet builder (no identifiable packet export)",
        evidence: "packages/interop/src/dhis2/privacy-export.ts",
        passed: true,
      },
      {
        id: "export-job-queue",
        description: "Idempotent job queue + attempt log + platform monitor",
        evidence: "packages/db/src/dhis2-export.ts",
        passed: true,
      },
      {
        id: "clinical-rollup-hook",
        description: "EncounterSigned → monthly diagnosis rollup enqueue",
        evidence: "packages/db/src/dhis2-export.ts scheduleDhis2RollupAfterEncounterSign",
        passed: true,
      },
      {
        id: "cron-drain",
        description: "Nightly cron drains pending DHIS2 export jobs",
        evidence: "apps/web/src/app/api/cron/dhis2-export/route.ts",
        passed: true,
      },
      {
        id: "live-national-push",
        description: "Live MoH DHIS2 transmission with operator proof",
        evidence: "simulation default; liveEvidence required",
        passed: false,
      },
    ],
  },
  {
    id: "public-health-export-aggregate",
    comparisonLabel: "Public health aggregate export capability",
    requirement: "Capability gate public_health.export_aggregate; audit every attempt; synthetic tenants blocked from live.",
    capabilityId: "synapse-public-health",
    liveEvidence: false,
    checks: [
      {
        id: "capability-key",
        description: "public_health.export_aggregate documented and enforced in export builder",
        evidence: "packages/interop/src/dhis2/types.ts",
        passed: true,
      },
      {
        id: "platform-monitor",
        description: "Platform DHIS2 monitor triggers simulation export",
        evidence: "apps/web/src/app/platform/dhis2/page.tsx",
        passed: true,
      },
    ],
  },
  {
    id: "longitudinal-timeline",
    comparisonLabel: "Longitudinal patient timeline",
    requirement: "Shared identity + timeline events across encounter, lab, Rx, pharmacy.",
    capabilityId: "synapse-core",
    liveEvidence: false,
    checks: [
      {
        id: "timeline-model",
        description: "Timeline helpers and simulation event chain",
        evidence: "packages/db/src/timeline.ts",
        passed: true,
      },
      {
        id: "production-wiring",
        description: "Hospital registration fully on persons/MPI",
        evidence: "partial",
        passed: false,
      },
    ],
  },
  {
    id: "clinical-pathway-engine",
    comparisonLabel: "Clinical pathway engine",
    requirement: "Versioned pathways, clinician activation, lab-driven reassessment, visible deviation.",
    capabilityId: "synapse-pathways",
    liveEvidence: false,
    checks: [
      {
        id: "runtime",
        description: "PathwayRuntime with required override reasons",
        evidence: "packages/db/src/pathways.ts",
        passed: true,
      },
      {
        id: "intelligence-recommend-only",
        description: "AI may recommend activation; clinician must start",
        evidence: "packages/interop/src/intelligence/kernel.ts",
        passed: true,
      },
      {
        id: "live-orders",
        description: "Pathway actions create live orders in production",
        evidence: "simulation",
        passed: false,
      },
    ],
  },
  {
    id: "explainable-reasoning",
    comparisonLabel: "Explainable clinical reasoning",
    requirement: "Supporting/contradicting evidence, missing info, confidence, cannot-miss, provenance.",
    capabilityId: "synapse-intelligence",
    liveEvidence: false,
    checks: [
      {
        id: "structured-schema",
        description: "Recommendation schema with provenance",
        evidence: "packages/interop/src/intelligence/kernel.ts",
        passed: true,
      },
      {
        id: "live-audit-volume",
        description: "Production clinician accept/reject telemetry",
        evidence: "not connected",
        passed: false,
      },
    ],
  },
  {
    id: "claim-rejection-prevention",
    comparisonLabel: "Insurance rejection prevention",
    requirement: "Scrubber + denial analytics by payer/service/diagnosis.",
    integrationId: "insurers",
    liveEvidence: false,
    checks: [
      {
        id: "scrubber-risk",
        description: "Scrubber and heuristic rejection risk",
        evidence: "packages/interop/src/insurance/scrubber.ts",
        passed: true,
      },
      {
        id: "payer-learning",
        description: "Insurer-specific learned rejection rates",
        evidence: "not implemented",
        passed: false,
      },
    ],
  },
  {
    id: "synthetic-simulation",
    comparisonLabel: "Synthetic clinical simulation",
    requirement: "Deterministic scenarios plus mock external systems.",
    capabilityId: "admin-platform",
    liveEvidence: false,
    checks: [
      {
        id: "sepsis-slice",
        description: "Sepsis + critical lab deterministic seed",
        evidence: "packages/db/src/simulation.ts",
        passed: true,
      },
      {
        id: "overlay-adapters",
        description: "Mock eAFYA/UgandaEMR/ALIS/DHIS2/insurer adapters",
        evidence: "packages/interop/src/adapters/simulation.ts",
        passed: true,
      },
      {
        id: "failure-injection",
        description: "Timeout, duplicate, out-of-order, identifier mismatch",
        evidence: "packages/interop/src/adapters/sdk.ts NetworkFault",
        passed: true,
      },
    ],
  },
  {
    id: "cross-system-identity",
    comparisonLabel: "Cross-system patient identity",
    requirement: "Identity crosswalk, no auto-merge, overlay adapter aliases.",
    capabilityId: "synapse-core",
    liveEvidence: false,
    checks: [
      {
        id: "crosswalk",
        description: "Namespaced aliases, reject unsafe merge",
        evidence: "packages/db/src/identity-crosswalk.ts",
        passed: true,
      },
      {
        id: "live-eafya-link",
        description: "Live eAFYA/UgandaEMR identity contract",
        evidence: "simulation only",
        passed: false,
      },
    ],
  },
  {
    id: "facility-observability",
    comparisonLabel: "Facility operations observability",
    requirement: "Control Center metrics for intelligence, exchange, ICD-11, adapters. Never fabricate telemetry.",
    capabilityId: "admin-platform",
    liveEvidence: false,
    checks: [
      {
        id: "control-center",
        description: "Platform Control Center with honest NOT CONNECTED probes",
        evidence: "apps/web/src/app/platform",
        passed: true,
      },
      {
        id: "live-connector-metrics",
        description: "Message/error/latency telemetry per adapter",
        evidence: "NO TELEMETRY until wired",
        passed: false,
      },
    ],
  },
]

export function getGate(id: string): CapabilityGate | undefined {
  return CAPABILITY_GATES.find((gate) => gate.id === id)
}

export function advertisedYesCount(): number {
  return CAPABILITY_GATES.filter((gate) => comparisonCell(gate) === "yes").length
}
