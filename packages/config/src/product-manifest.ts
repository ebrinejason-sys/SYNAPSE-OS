/**
 * SYNAPSE product capability manifest.
 *
 * Single source of engineering and marketing truth. The public site, platform
 * admin, and documentation MUST derive status badges from this file (or a
 * deployment that copies it). Do not hardcode "live" / "operational" claims
 * in landing components.
 *
 * Status meanings:
 * - operational          — implemented, tested, security-reviewed, and verified in a live environment
 * - operational_candidate — substantial workflow; remaining live/operator proof
 * - pilot                — bounded real-world use with known limits
 * - development          — real code and tests; not a production clinical workflow
 * - partial              — meaningful behaviour, incomplete journey
 * - prototype            — demonstrates an idea
 * - placeholder          — route/table/marketing without a workflow
 * - roadmap              — designed, not implemented
 * - paused               — intentionally stopped
 * - incident             — currently degraded
 */

export const MANIFEST_VERSION = "2026.08.28"
export const MANIFEST_UPDATED = "2026-08-28"

export const CAPABILITY_STATUSES = [
  "operational",
  "operational_candidate",
  "pilot",
  "development",
  "partial",
  "prototype",
  "placeholder",
  "roadmap",
  "paused",
  "incident",
] as const

export type ManifestStatus = (typeof CAPABILITY_STATUSES)[number]

export const INTEGRATION_STATUSES = ["live", "pilot", "development", "roadmap", "not_connected"] as const
export type IntegrationStatus = (typeof INTEGRATION_STATUSES)[number]

export const PROJECT_STATUSES = [
  "OPERATIONAL",
  "DEGRADED",
  "DEVELOPMENT",
  "DEMO",
  "ROADMAP",
  "PAUSED",
  "INCIDENT",
] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export type ManifestKind = "product" | "platform" | "surface"

export type CapabilityRecord = {
  id: string
  name: string
  kind: ManifestKind
  status: ManifestStatus
  projectStatus: ProjectStatus
  summary: string
  owner: string
  publicClaim: string
  limitation: string
  environments: Array<"production" | "staging" | "demo" | "preview">
  tests: string[]
  telemetry: "connected" | "partial" | "not_connected"
}

export type IntegrationRecord = {
  id: string
  name: string
  standard?: string
  status: IntegrationStatus
  summary: string
  limitation: string
}

export type HeadlineMetric = {
  id: string
  label: string
  value: string
  kind: "capability" | "measured"
  source: string
}

function cap(partial: CapabilityRecord): CapabilityRecord {
  return partial
}

export const PRODUCTS: CapabilityRecord[] = [
  cap({
    id: "synapse-os",
    name: "Synapse OS",
    kind: "product",
    status: "partial",
    projectStatus: "DEVELOPMENT",
    summary: "Facility care delivery: registration and OPD triage exist; most specialty modules remain placeholders.",
    owner: "clinical-domain",
    publicClaim: "Hospital and facility operating system for registration, consultation, and connected care.",
    limitation:
      "Doctor/encounter/nursing/lab/imaging specialty screens are largely Coming Soon. Registration + OPD queue are the operational slice.",
    environments: ["production", "demo"],
    tests: ["apps/web/src/app/api/patients", "apps/web/src/app/api/opd"],
    telemetry: "partial",
  }),
  cap({
    id: "synapse-pharm",
    name: "Synapse Pharm",
    kind: "product",
    status: "operational_candidate",
    projectStatus: "DEVELOPMENT",
    summary: "Deepest product: POS, inventory, FEFO, purchasing, receipts, staff, billing. Live operator proof still required.",
    owner: "pharmacy-domain",
    publicClaim: "Pharmacy operations, FEFO inventory, and prescription dispensing.",
    limitation:
      "Offline checkout is disabled until durable encrypted persistence is proven. complete_pharmacy_sale still needs live isolation review.",
    environments: ["production", "demo"],
    tests: ["apps/pharmacy/lib/pos", "apps/pharmacy/app/api/admin/pos"],
    telemetry: "partial",
  }),
  cap({
    id: "synapse-app",
    name: "Synapse App",
    kind: "product",
    status: "partial",
    projectStatus: "DEVELOPMENT",
    summary: "Role-aware Expo client with read-oriented records and limited mutations. No durable offline database.",
    owner: "mobile-domain",
    publicClaim: "Patient, professional, and mobile-workforce continuity.",
    limitation: "Mostly reads. Offline is a response cache, not a local authority.",
    environments: ["production", "demo"],
    tests: ["apps/app"],
    telemetry: "not_connected",
  }),
]

export const PLATFORM_CAPABILITIES: CapabilityRecord[] = [
  cap({
    id: "synapse-core",
    name: "Synapse Core",
    kind: "platform",
    status: "partial",
    projectStatus: "DEVELOPMENT",
    summary: "Identity helpers, MPI scoring (no auto-merge), sessions, MFA for platform admin, capability RPC.",
    owner: "identity-mpi",
    publicClaim: "Shared identity, tenancy, authorization, consent, and audit.",
    limitation: "Hospital registration is not fully wired to persons/MPI. Types lag migrations.",
    environments: ["production", "demo"],
    tests: ["apps/pharmacy/lib/platform/network-foundations.test.ts", "packages/db/src/identity.ts"],
    telemetry: "partial",
  }),
  cap({
    id: "synapse-exchange",
    name: "Synapse Exchange",
    kind: "platform",
    status: "development",
    projectStatus: "DEVELOPMENT",
    summary: "Versioned domain-event contracts and outbox. Not a national HIE.",
    owner: "interop",
    publicClaim: "Interoperability and event-exchange layer.",
    limitation:
      "Internal event bus plus an adapter SDK with simulation connectors. Live eAFYA/ALIS/UgandaEMR contracts are not claimed.",
    environments: ["demo"],
    tests: ["packages/interop/src/events.ts", "packages/interop/src/adapters/sdk.ts"],
    telemetry: "not_connected",
  }),
  cap({
    id: "synapse-lab",
    name: "Synapse Lab",
    kind: "platform",
    status: "development",
    projectStatus: "DEVELOPMENT",
    summary: "Order → specimen → result → verify → critical acknowledgement vertical slice.",
    owner: "diagnostics",
    publicClaim: "Laboratory workflow integrated with clinical care and the patient timeline.",
    limitation:
      "Not a full LIMS. Hematology, microbiology, analyzers, QC/EQA, and blood bank are roadmap. Does not replace ALIS.",
    environments: ["demo"],
    tests: ["packages/db/src/lab-workflow.ts"],
    telemetry: "not_connected",
  }),
  cap({
    id: "synapse-pathways",
    name: "Synapse Pathways",
    kind: "platform",
    status: "development",
    projectStatus: "DEVELOPMENT",
    summary: "Versioned guideline → pathway → care-plan engine. Catalog: adult sepsis, malaria, DKA, pneumonia.",
    owner: "clinical-pathways",
    publicClaim: "Guideline-driven clinical workflows with clinician override.",
    limitation:
      "Four teaching pathways. Not an autonomous treatment engine. AI may recommend activation; a clinician must start the plan.",
    environments: ["demo"],
    tests: ["packages/db/src/pathways.ts"],
    telemetry: "not_connected",
  }),
  cap({
    id: "synapse-intelligence",
    name: "Synapse Intelligence",
    kind: "platform",
    status: "development",
    projectStatus: "DEVELOPMENT",
    summary:
      "Governed intelligence kernel wrapping the existing reasoning engine. Advisory copilots share one schema. Not autonomous.",
    owner: "intelligence",
    publicClaim: "Governed AI and analytics. Clinician remains in control.",
    limitation:
      "AI never signs diagnoses, releases lab results, dispenses drugs, or submits claims. ICD codes must be resolved by the terminology service. Live evaluation harness is not deployed.",
    environments: ["demo"],
    tests: ["packages/interop/src/intelligence/kernel.ts", "apps/pharmacy/lib/platform/project-golden.test.ts"],
    telemetry: "not_connected",
  }),
  cap({
    id: "synapse-imaging",
    name: "Synapse Imaging",
    kind: "platform",
    status: "roadmap",
    projectStatus: "ROADMAP",
    summary: "RIS/PACS/DICOM workflows are not implemented.",
    owner: "imaging",
    publicClaim: "Imaging orders and reports when the module is built.",
    limitation: "Schema and marketing only. No DICOM gateway.",
    environments: [],
    tests: [],
    telemetry: "not_connected",
  }),
  cap({
    id: "synapse-public-health",
    name: "Synapse Public Health",
    kind: "platform",
    status: "placeholder",
    projectStatus: "ROADMAP",
    summary: "DHIS2 page inserts a pending row. Epidemiology screens are placeholders.",
    owner: "public-health",
    publicClaim: "Epidemiology, surveillance, and DHIS2 reporting.",
    limitation: "No live DHIS2 export. Do not claim national reporting.",
    environments: [],
    tests: [],
    telemetry: "not_connected",
  }),
  cap({
    id: "synapse-edge",
    name: "Synapse Edge",
    kind: "platform",
    status: "roadmap",
    projectStatus: "ROADMAP",
    summary: "Facility LAN runtime and durable offline sync are not complete.",
    owner: "offline-sync",
    publicClaim: "Offline/local facility continuity.",
    limitation: "Pharmacy web offline checkout is disabled. Mobile has an encrypted outbox prototype for single-counter Android.",
    environments: [],
    tests: ["apps/pharmacy/lib/platform/offline-sync-runtime.test.ts"],
    telemetry: "not_connected",
  }),
]

export const SURFACES: CapabilityRecord[] = [
  cap({
    id: "website",
    name: "synapseos.tech",
    kind: "surface",
    status: "partial",
    projectStatus: "DEVELOPMENT",
    summary: "Public landing and marketing. Status badges must follow this manifest.",
    owner: "growth",
    publicClaim: "Public story of the connected health platform.",
    limitation: "Historical hero counters overstated readiness and could render as 0+ when animation never fired.",
    environments: ["production"],
    tests: [],
    telemetry: "partial",
  }),
  cap({
    id: "admin-platform",
    name: "admin.synapseos.tech",
    kind: "surface",
    status: "partial",
    projectStatus: "DEVELOPMENT",
    summary: "Platform Control Center. MFA-gated. Expanding from tenant ops into ecosystem observability.",
    owner: "platform-ops",
    publicClaim: "Internal operational cockpit. Not a clinical EHR.",
    limitation: "Must not expose identifiable clinical records to operators without a documented break-glass path.",
    environments: ["production", "demo"],
    tests: ["apps/web/src/lib/platform/auth.ts"],
    telemetry: "partial",
  }),
  cap({
    id: "apis",
    name: "Platform APIs",
    kind: "surface",
    status: "partial",
    projectStatus: "DEVELOPMENT",
    summary: "Next.js route handlers across web and pharmacy. FHIR advertised resources return 501.",
    owner: "platform-ops",
    publicClaim: "Application and integration APIs.",
    limitation: "FHIR CapabilityStatement must list only implemented resources. Unimplemented types stay 501.",
    environments: ["production", "demo"],
    tests: [],
    telemetry: "not_connected",
  }),
  cap({
    id: "mobile-builds",
    name: "Mobile builds",
    kind: "surface",
    status: "partial",
    projectStatus: "DEVELOPMENT",
    summary: "Expo/EAS Android preview APK. EAS telemetry is not wired into admin.",
    owner: "mobile-domain",
    publicClaim: "Android staff and pharmacy client.",
    limitation: "EAS adapter displays NOT CONNECTED until credentials exist.",
    environments: ["production"],
    tests: [],
    telemetry: "not_connected",
  }),
  cap({
    id: "documentation",
    name: "Documentation",
    kind: "surface",
    status: "partial",
    projectStatus: "DEVELOPMENT",
    summary: "Architecture blueprints, ADRs, and this milestone's specs.",
    owner: "lead-architect",
    publicClaim: "Engineering and operating model documentation.",
    limitation: "Blueprints are architectural evidence, not production truth.",
    environments: ["production"],
    tests: [],
    telemetry: "not_connected",
  }),
]

export const ALL_CAPABILITIES: CapabilityRecord[] = [...PRODUCTS, ...PLATFORM_CAPABILITIES, ...SURFACES]

export const INTEGRATIONS: IntegrationRecord[] = [
  {
    id: "fhir-r4",
    name: "FHIR R4",
    standard: "HL7 FHIR R4",
    status: "development",
    summary:
      "Flagship resource mappers and tenant-authorized HTTP handlers exist. CapabilityStatement lists only implemented types.",
    limitation: "Not a certified FHIR server. Live tenant round-trip is not proven. Immunization remains unimplemented.",
  },
  {
    id: "icd-11",
    name: "ICD-11",
    standard: "WHO ICD-11",
    status: "development",
    summary:
      "Terminology service targets WHO ICD-11 MMS 2026-01 with a local cache. AI proposals are terms, not codes.",
    limitation:
      "WHO API credentials are optional; cache/fixtures operate when the API is unavailable. Not a certified coding product until live WHO + clinician UI proof.",
  },
  {
    id: "loinc",
    name: "LOINC",
    standard: "LOINC",
    status: "development",
    summary: "loinc_code columns and a reference table exist; catalogue is not operationally maintained.",
    limitation: "Lab slice uses a small curated set for demo tests.",
  },
  {
    id: "snomed",
    name: "SNOMED CT",
    standard: "SNOMED CT",
    status: "roadmap",
    summary: "Not licensed or loaded.",
    limitation: "Do not advertise SNOMED use.",
  },
  {
    id: "dicom",
    name: "DICOM",
    standard: "DICOM",
    status: "roadmap",
    summary: "No PACS/DICOM gateway.",
    limitation: "Imaging is schema/marketing only.",
  },
  {
    id: "hl7-astm",
    name: "HL7 / ASTM instruments",
    standard: "HL7 v2 / ASTM",
    status: "development",
    summary: "Parsers exist in @synapse/interop. Instrument ingest route is a mock success.",
    limitation: "No live analyzer connection.",
  },
  {
    id: "dhis2",
    name: "DHIS2",
    standard: "DHIS2",
    status: "roadmap",
    summary: "Export UI inserts a pending database row.",
    limitation: "No live national export.",
  },
  {
    id: "alis",
    name: "ALIS",
    status: "roadmap",
    summary: "Designed as a future LIS adapter. Simulation adapter exists. Not an ALIS replacement.",
    limitation: "No live connection.",
  },
  {
    id: "ugandaemr",
    name: "UgandaEMR",
    status: "roadmap",
    summary: "Identifier namespace reserved. OpenMRS/UgandaEMR simulation adapter exists.",
    limitation: "No live OpenMRS/UgandaEMR sync.",
  },
  {
    id: "eafya",
    name: "eAFYA",
    status: "roadmap",
    summary: "Named in the interoperability roadmap. Simulation adapter exists for overlay-mode tests.",
    limitation: "No live adapter. Do not claim a Ministry integration.",
  },
  {
    id: "irrds",
    name: "IRRDS / LDR",
    status: "roadmap",
    summary: "Named in the interoperability roadmap only.",
    limitation: "No adapter.",
  },
  {
    id: "insurers",
    name: "Insurers",
    status: "development",
    summary: "Insurance copilot with eligibility, coverage, draft claims, scrubber, denial and appeal. Advisory only.",
    limitation: "No live payer gateway. Auto-submit is not operational.",
  },
  {
    id: "notifications",
    name: "Notifications",
    status: "development",
    summary: "Email, SMS providers, Expo push exist.",
    limitation: "No durable delivery ledger for all channels.",
  },
]

/** Honest headline metrics. Never invent production volume. */
export const HEADLINE_METRICS: HeadlineMetric[] = [
  {
    id: "products",
    label: "Customer-facing products",
    value: "3",
    kind: "capability",
    source: "OS, Pharm, and App charters",
  },
  {
    id: "connected-journey",
    label: "Flagship connected journey",
    value: "Sepsis + Lab + Pharm",
    kind: "capability",
    source: "Simulation Lab vertical slice",
  },
  {
    id: "lab-status",
    label: "Synapse Lab",
    value: "In development",
    kind: "capability",
    source: "product-manifest laboratory status",
  },
  {
    id: "pharm-status",
    label: "Synapse Pharm",
    value: "Operational candidate",
    kind: "capability",
    source: "product-manifest pharmacy status",
  },
]

export const CLINICAL_JOURNEY_STEPS = [
  { id: "patient", label: "Patient" },
  { id: "registration", label: "Registration" },
  { id: "clinical", label: "Clinical care" },
  { id: "pathway", label: "Pathway" },
  { id: "diagnostics", label: "Lab / Imaging" },
  { id: "diagnosis", label: "Diagnosis" },
  { id: "prescription", label: "Prescription" },
  { id: "pharmacy", label: "Pharmacy" },
  { id: "follow-up", label: "Follow-up" },
  { id: "public-health", label: "Public health" },
] as const

export const PUBLIC_STORY = {
  heroTitle: "Intelligence for the entire care journey.",
  heroSupport:
    "SYNAPSE is the intelligence, clinical orchestration and interoperability layer that can run a facility, sit beside an existing EMR, or connect fragmented systems — without pretending national integrations are live.",
  philosophy:
    "Keep eAFYA. Connect SYNAPSE. Or run Synapse OS natively. Identity, consent, audit, clinical reasoning, ICD-11, pathways, lab, pharmacy and claims share one kernel.",
  ctas: [
    { id: "explore", label: "Explore the platform", href: "#platform" },
    { id: "demo", label: "Open live demo", href: "https://demo.synapseos.tech" },
    { id: "pilot", label: "Apply for pilot", href: "/apply" },
    { id: "pharm", label: "Get Synapse Pharm", href: "#pharm" },
  ],
} as const

export function statusLabel(status: ManifestStatus): string {
  switch (status) {
    case "operational":
      return "Live"
    case "operational_candidate":
      return "Operational candidate"
    case "pilot":
      return "Pilot"
    case "development":
      return "In development"
    case "partial":
      return "Partial"
    case "prototype":
      return "Prototype"
    case "placeholder":
      return "Placeholder"
    case "roadmap":
      return "Roadmap"
    case "paused":
      return "Paused"
    case "incident":
      return "Incident"
  }
}

export function integrationLabel(status: IntegrationStatus): string {
  switch (status) {
    case "live":
      return "LIVE"
    case "pilot":
      return "PILOT"
    case "development":
      return "DEVELOPMENT"
    case "roadmap":
      return "ROADMAP"
    case "not_connected":
      return "NOT CONNECTED"
  }
}

export function canAdvertiseAsLive(status: ManifestStatus): boolean {
  return status === "operational"
}

export function getCapability(id: string): CapabilityRecord | undefined {
  return ALL_CAPABILITIES.find((item) => item.id === id)
}

export function capabilitiesByKind(kind: ManifestKind): CapabilityRecord[] {
  return ALL_CAPABILITIES.filter((item) => item.kind === kind)
}

export function overallPlatformHealth(incidentsOpen = 0): ProjectStatus {
  if (incidentsOpen > 0) return "INCIDENT"
  return "DEVELOPMENT"
}

export const PRODUCT_MANIFEST = {
  version: MANIFEST_VERSION,
  updated: MANIFEST_UPDATED,
  products: PRODUCTS,
  platform: PLATFORM_CAPABILITIES,
  surfaces: SURFACES,
  integrations: INTEGRATIONS,
  metrics: HEADLINE_METRICS,
  journey: CLINICAL_JOURNEY_STEPS,
  story: PUBLIC_STORY,
} as const
