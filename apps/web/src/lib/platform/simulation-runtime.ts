import "server-only"

import { ExchangeOutbox } from "@synapse/db/exchange"
import {
  SimulationEngine,
  assertDemoResetAllowed,
  type DemoTenantKind,
  type ScenarioId,
  type SimulationRun,
} from "@synapse/db/simulation"
import { createServiceClient } from "@/lib/supabase/server"
import {
  executeMalariaGoldenJourney,
  runMalariaGoldenJourney,
  type MalariaGoldenJourneyResult,
} from "@synapse/db/malaria-golden-journey"

type MemoryTenant = {
  id: string
  name: string
  slug: string
  kind: DemoTenantKind
  classification: "demo"
  isSynthetic: true
  createdAt: string
}

type GlobalSim = {
  engine: SimulationEngine
  tenants: Map<string, MemoryTenant>
}

const globalForSim = globalThis as typeof globalThis & { __synapseSimulation?: GlobalSim }

function store(): GlobalSim {
  if (!globalForSim.__synapseSimulation) {
    globalForSim.__synapseSimulation = {
      engine: new SimulationEngine(new ExchangeOutbox()),
      tenants: new Map(),
    }
  }
  return globalForSim.__synapseSimulation
}

export function getSimulationEngine(): SimulationEngine {
  return store().engine
}

export function listDemoTenants(): MemoryTenant[] {
  return [...store().tenants.values()]
}

export function getDemoTenant(id: string): MemoryTenant | undefined {
  return store().tenants.get(id)
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)
}

export async function createDemoTenant(params: {
  kind: DemoTenantKind
  name?: string
  actorId: string
}): Promise<MemoryTenant> {
  const name =
    params.name ??
    (params.kind === "pharmacy"
      ? "SYNAPSE DEMO PHARMACY"
      : params.kind === "laboratory"
        ? "SYNAPSE DEMO LAB"
        : params.kind === "health_centre"
          ? "SYNAPSE DEMO HEALTH CENTRE"
          : "SYNAPSE DEMO HOSPITAL")
  const id = crypto.randomUUID()
  const slug = `${slugify(name) || "synapse-demo"}-${id.slice(0, 6)}`
  const tenant: MemoryTenant = {
    id,
    name,
    slug,
    kind: params.kind,
    classification: "demo",
    isSynthetic: true,
    createdAt: new Date().toISOString(),
  }
  store().tenants.set(id, tenant)

  try {
    const db = createServiceClient() as any
    const { error } = await db.from("tenants").insert({
      id,
      name,
      slug,
      facility_type: params.kind === "pharmacy" ? "pharmacy" : params.kind === "laboratory" ? "laboratory" : "hospital",
      country: "UG",
      district: "Kampala",
      plan: "trial",
      is_active: true,
      status: "active",
      environment: "demo",
      is_synthetic: true,
      data_classification: "synthetic",
    })
    if (error) {
      await db.from("tenants").insert({ id, name, slug, facility_type: "hospital" })
    }
  } catch {
    // In-memory tenant remains the source of truth when the live schema lags.
  }

  return tenant
}

export function runScenario(params: {
  seed: number
  scenario: ScenarioId
  tenantId: string
  actorId: string
  pauseAt?: "lab_order" | "result_entry" | "prescription" | null
}): SimulationRun {
  const tenant = store().tenants.get(params.tenantId)
  if (!tenant) throw new Error("DEMO_TENANT_NOT_FOUND")
  return store().engine.run({
    seed: params.seed,
    scenario: params.scenario,
    tenantId: params.tenantId,
    tenantKind: tenant.kind,
    tenantClassification: "demo",
    actorId: params.actorId,
    pauseAt: params.pauseAt ?? null,
  })
}

export function resetDemoTenant(tenantId: string, actorId: string): string[] {
  const tenant = store().tenants.get(tenantId)
  if (!tenant) throw new Error("DEMO_TENANT_NOT_FOUND")
  assertDemoResetAllowed({ classification: tenant.classification, isSynthetic: tenant.isSynthetic })
  const removed = store().engine.resetDemoTenant({
    id: tenantId,
    classification: "demo",
    isSynthetic: true,
  })
  void actorId
  return removed
}

export function serializeRun(run: SimulationRun) {
  const engine = store().engine
  const events = engine.outbox.list({ simulationRunId: run.id })
  const lab = engine.lab.snapshot()
  return {
    id: run.id,
    seed: run.seed,
    scenario: run.scenario,
    tenantId: run.tenantId,
    status: run.status,
    correlationId: run.correlationId,
    createdAt: run.createdAt,
    notes: run.notes,
    is_synthetic: run.is_synthetic,
    data_classification: run.data_classification,
    patient: run.patient
      ? {
          id: run.patient.id,
          personId: run.patient.personId,
          synapseId: run.patient.synapseId,
          mrn: run.patient.mrn,
          name: run.patient.demographics.fullName,
          sex: run.patient.demographics.sex,
        }
      : null,
    encounter: run.encounter
      ? {
          id: run.encounter.id,
          type: run.encounter.encounterType,
          chiefComplaint: run.encounter.chiefComplaint,
          vitals: run.encounter.vitals,
        }
      : null,
    carePlan: run.carePlan
      ? {
          id: run.carePlan.id,
          pathwayId: run.carePlan.pathwayId,
          pathwayVersion: run.carePlan.pathwayVersion,
          status: run.carePlan.status,
          currentStepId: run.carePlan.currentStepId,
          outcome: run.carePlan.outcome ?? null,
          steps: run.carePlan.steps,
        }
      : null,
    labOrder: run.labOrder
      ? {
          id: run.labOrder.id,
          testName: run.labOrder.testName,
          loincCode: run.labOrder.loincCode,
          status: run.labOrder.status,
          accessionNumber: run.labOrder.accessionNumber ?? null,
          urgency: run.labOrder.urgency,
        }
      : null,
    labResult: lab.results.find((row) => row.labOrderId === run.labOrder?.id) ?? null,
    criticalAck: lab.acknowledgements.find((row) => row.labOrderId === run.labOrder?.id) ?? null,
    prescription: run.prescription ?? null,
    dispense: run.dispense ?? null,
    timeline: run.timeline,
    events: events.map((event) => ({
      event_id: event.event_id,
      event_type: event.event_type,
      source: event.source,
      timestamp: event.timestamp,
      correlation_id: event.correlation_id,
      causation_id: event.causation_id,
      patient_id: event.patient_id ? `${event.patient_id.slice(0, 4)}…${event.patient_id.slice(-4)}` : null,
      status: event.status,
      retry_count: event.retry_count,
    })),
  }
}

export async function persistRunBestEffort(run: SimulationRun): Promise<void> {
  try {
    const db = createServiceClient() as any
    await db.from("synapse_simulation_runs").insert({
      id: run.id,
      seed: run.seed,
      scenario: run.scenario,
      tenant_id: run.tenantId,
      actor_id: run.actorId,
      correlation_id: run.correlationId,
      status: run.status,
      pause_at: run.pauseAt ?? null,
      is_synthetic: true,
      data_classification: "synthetic",
      snapshot: serializeRun(run),
    })
    const events = store().engine.outbox.list({ simulationRunId: run.id })
    if (events.length) {
      await db.from("synapse_domain_events").insert(
        events.map((event) => ({
          event_id: event.event_id,
          event_type: event.event_type,
          version: event.version,
          tenant_id: event.tenant_id,
          facility_id: event.facility_id,
          actor_id: event.actor_id,
          patient_id: event.patient_id,
          person_id: event.person_id,
          encounter_id: event.encounter_id,
          occurred_at: event.timestamp,
          correlation_id: event.correlation_id,
          causation_id: event.causation_id,
          payload: event.payload,
          source: event.source,
          idempotency_key: event.idempotency_key,
          is_synthetic: true,
          simulation_run_id: run.id,
          status: event.status,
          retry_count: event.retry_count,
        })),
      )
    }
    if (run.prescription) {
      await db.from("clinical_prescriptions").insert({
        id: run.prescription.id,
        tenant_id: run.tenantId,
        pharmacy_tenant_id: run.tenantId,
        patient_id: run.patient?.id ?? null,
        person_id: run.patient?.personId ?? null,
        encounter_id: run.encounter?.id ?? null,
        care_plan_id: run.carePlan?.id ?? null,
        medication_display: run.prescription.medicationDisplay,
        dose: run.prescription.dose,
        quantity: run.prescription.quantity,
        unit: "unit",
        prescriber_id: run.actorId,
        status: run.prescription.status,
        correlation_id: run.correlationId,
        is_synthetic: true,
        simulation_run_id: run.id,
      })
    }
  } catch {
    // Persistence is best-effort until the migration is applied in each environment.
  }
}

export function runMalariaGoldenJourneyForPlatform(params: {
  tenantId: string
  clinicianId: string
  seed?: number
}): MalariaGoldenJourneyResult {
  const engine = getSimulationEngine()
  return executeMalariaGoldenJourney({
    ...params,
    outbox: engine.outbox,
    lab: engine.lab,
    pathways: engine.pathways,
  })
}

export async function persistGoldenJourneyBestEffort(result: MalariaGoldenJourneyResult): Promise<void> {
  try {
    const db = createServiceClient() as any
    const events = getSimulationEngine().outbox.list({ correlationId: result.correlationId })
    if (!events.length) return
    await db.from("synapse_domain_events").insert(
      events.map((event) => ({
        event_id: event.event_id,
        event_type: event.event_type,
        version: event.version,
        tenant_id: event.tenant_id,
        facility_id: event.facility_id,
        actor_id: event.actor_id,
        patient_id: event.patient_id,
        person_id: event.person_id,
        encounter_id: event.encounter_id,
        occurred_at: event.timestamp,
        correlation_id: event.correlation_id,
        causation_id: event.causation_id,
        payload: event.payload,
        source: event.source,
        idempotency_key: event.idempotency_key,
        is_synthetic: true,
        simulation_run_id: result.runId,
        status: event.status,
        retry_count: event.retry_count,
      })),
    )
  } catch {
    // Best-effort until migration is applied.
  }
}
