/**
 * Clinical pathways: Guideline → Pathway → Patient Care Plan.
 * Recommendations are overridable. Pathway version used at start is frozen.
 * Overrides never auto-retrain AI.
 */

export type GuidelineSource = {
  id: string
  name: string
  organization: string
  version: string
  publishedOn: string
  url?: string | null
}

export type PathwayActionKind =
  | "observation"
  | "lab_order"
  | "imaging_order"
  | "medication"
  | "monitoring"
  | "escalation"
  | "outcome"

export type PathwayStepDefinition = {
  id: string
  sequence: number
  name: string
  required: boolean
  actionKind: PathwayActionKind
  instruction: string
  recommendedAction: string
  orderSet?: Array<{ loincCode?: string; testName?: string; medicationDisplay?: string; urgency?: string }>
}

export type ClinicalPathwayDefinition = {
  id: string
  name: string
  specialty: string
  version: string
  source: GuidelineSource
  sourceVersion: string
  effectiveDate: string
  reviewDate: string
  status: "draft" | "active" | "retired"
  countryPack: string
  author: string
  reviewer: string
  triggers: string[]
  steps: PathwayStepDefinition[]
}

export type CarePlanStatus = "active" | "completed" | "overridden" | "abandoned"

export type CarePlanStep = {
  stepId: string
  status: "pending" | "in_progress" | "completed" | "overridden" | "skipped"
  recommendedAction: string
  actualAction?: string | null
  completedAt?: string | null
}

export type PathwayOverride = {
  id: string
  carePlanId: string
  pathwayId: string
  pathwayVersion: string
  stepId: string
  recommendedAction: string
  actualAction: string
  reason: string
  clinicianId: string
  timestamp: string
  patientContextReference: string
  mayTrainModels: false
}

export type PatientCarePlan = {
  id: string
  tenantId: string
  patientId: string
  personId?: string | null
  encounterId: string
  pathwayId: string
  pathwayVersion: string
  sourceId: string
  status: CarePlanStatus
  currentStepId: string
  steps: CarePlanStep[]
  startedAt: string
  completedAt?: string | null
  outcome?: string | null
  isSynthetic: boolean
  simulationRunId?: string | null
  correlationId: string
}

export const WHO_SEPSIS_GUIDELINE: GuidelineSource = {
  id: "guideline.who.sepsis.2021",
  name: "Sepsis identification and management (adapted teaching set)",
  organization: "WHO / Uganda Clinical Guidelines (adapted)",
  version: "teaching-2026.1",
  publishedOn: "2026-01-15",
  url: null,
}

export const SEPSIS_PATHWAY: ClinicalPathwayDefinition = {
  id: "pathway.adult-sepsis",
  name: "Adult suspected sepsis",
  specialty: "emergency / internal medicine",
  version: "1.0.0",
  source: WHO_SEPSIS_GUIDELINE,
  sourceVersion: WHO_SEPSIS_GUIDELINE.version,
  effectiveDate: "2026-08-01",
  reviewDate: "2027-08-01",
  status: "active",
  countryPack: "UG",
  author: "SYNAPSE clinical content (demo)",
  reviewer: "clinician-in-control",
  triggers: ["fever", "hypotension", "tachycardia", "suspected_infection", "qsofa>=2"],
  steps: [
    {
      id: "assess",
      sequence: 1,
      name: "Assessment",
      required: true,
      actionKind: "observation",
      instruction: "Record vitals, qSOFA inputs, and suspected source. Clinician confirms pathway start.",
      recommendedAction: "Activate adult sepsis pathway after clinician confirmation",
    },
    {
      id: "investigate",
      sequence: 2,
      name: "Investigations",
      required: true,
      actionKind: "lab_order",
      instruction: "Order lactate (STAT). Additional tests may include CBC. Do not wait for results to start supportive care.",
      recommendedAction: "Order STAT lactate",
      orderSet: [{ loincCode: "2524-7", testName: "Lactate", urgency: "STAT" }],
    },
    {
      id: "interpret",
      sequence: 3,
      name: "Result interpretation",
      required: true,
      actionKind: "escalation",
      instruction: "Critical lactate requires acknowledgement by an authorized clinician. AI may not release or treat.",
      recommendedAction: "Acknowledge critical lactate and review source control",
    },
    {
      id: "treat",
      sequence: 4,
      name: "Treatment",
      required: true,
      actionKind: "medication",
      instruction: "Recommend empiric antimicrobial and fluids per local protocol. Clinician must prescribe.",
      recommendedAction: "Prescribe ceftriaxone 2 g IV (demo formulary) after clinician confirmation",
      orderSet: [{ medicationDisplay: "Ceftriaxone 2 g IV", urgency: "STAT" }],
    },
    {
      id: "dispense",
      sequence: 5,
      name: "Pharmacy dispense",
      required: true,
      actionKind: "medication",
      instruction: "Prescribing and dispensing remain separate permissions.",
      recommendedAction: "Pharmacist verifies and dispenses against the medication request",
    },
    {
      id: "monitor",
      sequence: 6,
      name: "Monitoring",
      required: true,
      actionKind: "monitoring",
      instruction: "Repeat observations. Record response.",
      recommendedAction: "Repeat vitals within 1 hour",
    },
    {
      id: "outcome",
      sequence: 7,
      name: "Outcome",
      required: true,
      actionKind: "outcome",
      instruction: "Record clinical outcome. Keep the pathway version that was actually used.",
      recommendedAction: "Record pathway outcome",
    },
  ],
}

export const PATHWAY_CATALOG: ClinicalPathwayDefinition[] = [SEPSIS_PATHWAY]

export function getPathway(id: string, version?: string): ClinicalPathwayDefinition {
  const found = PATHWAY_CATALOG.find((item) => item.id === id && (!version || item.version === version))
  if (!found) throw new Error("PATHWAY_NOT_FOUND")
  return found
}

export function instantiateCarePlan(params: {
  id: string
  tenantId: string
  patientId: string
  personId?: string | null
  encounterId: string
  pathway: ClinicalPathwayDefinition
  startedAt?: string
  isSynthetic?: boolean
  simulationRunId?: string | null
  correlationId: string
}): PatientCarePlan {
  if (params.pathway.status !== "active") throw new Error("PATHWAY_NOT_ACTIVE")
  const steps: CarePlanStep[] = params.pathway.steps.map((step, index) => ({
    stepId: step.id,
    status: index === 0 ? "in_progress" : "pending",
    recommendedAction: step.recommendedAction,
    actualAction: null,
    completedAt: null,
  }))
  return {
    id: params.id,
    tenantId: params.tenantId,
    patientId: params.patientId,
    personId: params.personId ?? null,
    encounterId: params.encounterId,
    pathwayId: params.pathway.id,
    pathwayVersion: params.pathway.version,
    sourceId: params.pathway.source.id,
    status: "active",
    currentStepId: params.pathway.steps[0]!.id,
    steps,
    startedAt: params.startedAt ?? new Date().toISOString(),
    isSynthetic: params.isSynthetic ?? false,
    simulationRunId: params.simulationRunId ?? null,
    correlationId: params.correlationId,
  }
}

export class PathwayRuntime {
  private plans: PatientCarePlan[]
  private overrides: PathwayOverride[]

  constructor(plans: PatientCarePlan[] = [], overrides: PathwayOverride[] = []) {
    this.plans = plans
    this.overrides = overrides
  }

  start(plan: PatientCarePlan): PatientCarePlan {
    this.plans.push(plan)
    return plan
  }

  get(id: string): PatientCarePlan {
    const plan = this.plans.find((row) => row.id === id)
    if (!plan) throw new Error("CARE_PLAN_NOT_FOUND")
    return plan
  }

  completeStep(params: {
    carePlanId: string
    stepId: string
    actualAction?: string
    at?: string
  }): PatientCarePlan {
    const plan = this.get(params.carePlanId)
    if (plan.status !== "active") throw new Error("CARE_PLAN_NOT_ACTIVE")
    const step = plan.steps.find((row) => row.stepId === params.stepId)
    if (!step) throw new Error("CARE_PLAN_STEP_NOT_FOUND")
    step.status = "completed"
    step.actualAction = params.actualAction ?? step.recommendedAction
    step.completedAt = params.at ?? new Date().toISOString()
    const next = plan.steps.find((row) => row.status === "pending")
    plan.currentStepId = next?.stepId ?? step.stepId
    if (next) next.status = "in_progress"
    else {
      plan.status = "completed"
      plan.completedAt = step.completedAt
    }
    return plan
  }

  overrideStep(params: {
    overrideId: string
    carePlanId: string
    stepId: string
    actualAction: string
    reason: string
    clinicianId: string
    patientContextReference: string
  }): { plan: PatientCarePlan; override: PathwayOverride } {
    if (!params.reason.trim()) throw new Error("OVERRIDE_REASON_REQUIRED")
    const plan = this.get(params.carePlanId)
    const step = plan.steps.find((row) => row.stepId === params.stepId)
    if (!step) throw new Error("CARE_PLAN_STEP_NOT_FOUND")
    const override: PathwayOverride = {
      id: params.overrideId,
      carePlanId: plan.id,
      pathwayId: plan.pathwayId,
      pathwayVersion: plan.pathwayVersion,
      stepId: params.stepId,
      recommendedAction: step.recommendedAction,
      actualAction: params.actualAction,
      reason: params.reason.trim(),
      clinicianId: params.clinicianId,
      timestamp: new Date().toISOString(),
      patientContextReference: params.patientContextReference,
      mayTrainModels: false,
    }
    this.overrides.push(override)
    step.status = "overridden"
    step.actualAction = params.actualAction
    step.completedAt = override.timestamp
    const next = plan.steps.find((row) => row.status === "pending")
    plan.currentStepId = next?.stepId ?? step.stepId
    if (next) next.status = "in_progress"
    plan.status = "active"
    return { plan, override }
  }

  recordOutcome(carePlanId: string, outcome: string): PatientCarePlan {
    const plan = this.get(carePlanId)
    plan.outcome = outcome
    if (plan.status === "active" && plan.steps.every((step) => step.status !== "pending" && step.status !== "in_progress")) {
      plan.status = "completed"
      plan.completedAt = new Date().toISOString()
    }
    return plan
  }

  snapshot() {
    return { plans: [...this.plans], overrides: [...this.overrides] }
  }
}
