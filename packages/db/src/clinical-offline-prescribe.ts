/**
 * Clinical offline prescribe (RC1): prescription as SyncCommand.
 * Completes the offline clinical path: triage → write-up → prescribe → disposition.
 */
import {
  SYNC_SCHEMA_VERSION,
  assertSyncCommand,
  hashPayload,
  resolveSyncConflict,
  type SyncCommand,
} from "./sync-contract"
import { createPrescription, type ClinicalPrescription } from "./prescription-bridge"

export const CLINICAL_PRESCRIBE_COMMAND = "clinical.encounter.prescribe.v1" as const

export type PrescribeDraft = {
  prescriptionId: string
  patientId: string
  medicationDisplay: string
  dose: string
  quantity: number
  unit: string
  pharmacyTenantId?: string | null
  carePlanId?: string | null
  personId?: string | null
}

export type EncounterPrescribeAggregate = {
  encounterId: string
  isSigned: boolean
  prescriptions: ClinicalPrescription[]
  revision: number
}

export function normalizePrescribeDraft(input: Partial<PrescribeDraft> & {
  actorId: string
  tenantId: string
  encounterId: string
}): ClinicalPrescription {
  const medicationDisplay = String(input.medicationDisplay ?? "").trim()
  const dose = String(input.dose ?? "").trim()
  const quantity = Number(input.quantity)
  const unit = String(input.unit ?? "unit").trim() || "unit"
  if (!medicationDisplay) throw new Error("MEDICATION_REQUIRED")
  if (!dose) throw new Error("DOSE_REQUIRED")
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("QUANTITY_REQUIRED")
  if (!input.patientId) throw new Error("PATIENT_REQUIRED")

  return createPrescription({
    id: input.prescriptionId ?? crypto.randomUUID(),
    tenantId: input.tenantId,
    pharmacyTenantId: input.pharmacyTenantId ?? null,
    patientId: input.patientId,
    personId: input.personId ?? null,
    encounterId: input.encounterId,
    carePlanId: input.carePlanId ?? null,
    medicationDisplay,
    dose,
    quantity,
    unit,
    prescriberId: input.actorId,
    status: "active",
    isSynthetic: false,
    simulationRunId: null,
    correlationId: input.encounterId,
  })
}

export async function buildPrescribeSyncCommand(input: {
  commandId?: string
  tenantId: string
  facilityId: string
  deviceId: string
  actorId: string
  encounterId: string
  patientId: string
  prescriptionId?: string
  medicationDisplay: string
  dose: string
  quantity: number
  unit?: string
  pharmacyTenantId?: string | null
  carePlanId?: string | null
  personId?: string | null
  baseRevision?: number | null
  correlationId?: string | null
}): Promise<SyncCommand> {
  const prescriptionId = input.prescriptionId ?? crypto.randomUUID()
  const draft = normalizePrescribeDraft({
    ...input,
    prescriptionId,
  })
  const payload = {
    encounter_id: input.encounterId,
    patient_id: draft.patientId,
    prescription_id: draft.id,
    medication_display: draft.medicationDisplay,
    dose: draft.dose,
    quantity: draft.quantity,
    unit: draft.unit,
    pharmacy_tenant_id: draft.pharmacyTenantId ?? null,
    care_plan_id: draft.carePlanId ?? null,
    person_id: draft.personId ?? null,
  }
  const command: SyncCommand = {
    commandId: input.commandId ?? crypto.randomUUID(),
    commandType: CLINICAL_PRESCRIBE_COMMAND,
    schemaVersion: SYNC_SCHEMA_VERSION,
    tenantId: input.tenantId,
    facilityId: input.facilityId,
    deviceId: input.deviceId,
    actorId: input.actorId,
    aggregateType: "encounter",
    aggregateId: input.encounterId,
    baseRevision: input.baseRevision ?? null,
    capturedAtClient: new Date().toISOString(),
    payload,
    payloadHash: await hashPayload(payload),
    correlationId: input.correlationId ?? input.encounterId,
  }
  assertSyncCommand(command)
  return command
}

export function applyPrescribeSyncCommand(
  aggregate: EncounterPrescribeAggregate,
  command: SyncCommand,
): { aggregate: EncounterPrescribeAggregate; prescription: ClinicalPrescription } {
  assertSyncCommand(command)
  if (command.commandType !== CLINICAL_PRESCRIBE_COMMAND) throw new Error("UNSUPPORTED_COMMAND")
  if (command.aggregateId !== aggregate.encounterId) throw new Error("AGGREGATE_MISMATCH")
  if (aggregate.isSigned) throw new Error("ENCOUNTER_SIGNED_IMMUTABLE")

  const prescription = normalizePrescribeDraft({
    actorId: command.actorId,
    tenantId: command.tenantId,
    encounterId: aggregate.encounterId,
    prescriptionId: String(command.payload.prescription_id ?? ""),
    patientId: String(command.payload.patient_id ?? ""),
    medicationDisplay: String(command.payload.medication_display ?? ""),
    dose: String(command.payload.dose ?? ""),
    quantity: Number(command.payload.quantity),
    unit: String(command.payload.unit ?? "unit"),
    pharmacyTenantId: (command.payload.pharmacy_tenant_id as string | null) ?? null,
    carePlanId: (command.payload.care_plan_id as string | null) ?? null,
    personId: (command.payload.person_id as string | null) ?? null,
  })

  const without = aggregate.prescriptions.filter((rx) => rx.id !== prescription.id)
  return {
    aggregate: {
      encounterId: aggregate.encounterId,
      isSigned: aggregate.isSigned,
      prescriptions: [...without, prescription],
      revision: aggregate.revision + 1,
    },
    prescription,
  }
}

export async function runClinicalOfflinePrescribeGolden(input?: {
  encounterId?: string
}): Promise<{
  ok: boolean
  correlationId: string
  steps: Array<{ id: string; status: "PASS" | "FAIL"; detail?: string }>
  aggregate?: EncounterPrescribeAggregate
}> {
  const tenantId = crypto.randomUUID()
  const facilityId = crypto.randomUUID()
  const encounterId = input?.encounterId ?? crypto.randomUUID()
  const patientId = crypto.randomUUID()
  const deviceId = crypto.randomUUID()
  const actorId = crypto.randomUUID()
  const commandId = crypto.randomUUID()
  const prescriptionId = crypto.randomUUID()
  const steps: Array<{ id: string; status: "PASS" | "FAIL"; detail?: string }> = []

  const draft = await buildPrescribeSyncCommand({
    commandId,
    tenantId,
    facilityId,
    deviceId,
    actorId,
    encounterId,
    patientId,
    prescriptionId,
    medicationDisplay: "Amoxicillin 500mg",
    dose: "1 capsule TID x 5 days",
    quantity: 15,
    unit: "capsule",
  })
  steps.push({ id: "queue", status: "PASS" })

  let aggregate: EncounterPrescribeAggregate = {
    encounterId,
    isSigned: false,
    prescriptions: [],
    revision: 0,
  }

  try {
    const applied = applyPrescribeSyncCommand(aggregate, draft)
    aggregate = applied.aggregate
    steps.push({ id: "apply", status: "PASS" })
  } catch (error) {
    steps.push({
      id: "apply",
      status: "FAIL",
      detail: error instanceof Error ? error.message : String(error),
    })
    return { ok: false, correlationId: encounterId, steps, aggregate }
  }

  const replay = resolveSyncConflict({
    existing: { commandId: draft.commandId, payloadHash: draft.payloadHash, status: "applied" },
    incoming: { commandId: draft.commandId, payloadHash: draft.payloadHash },
    commandType: draft.commandType,
  })
  steps.push({
    id: "replay",
    status: replay === "replay" ? "PASS" : "FAIL",
    detail: replay === "replay" ? undefined : JSON.stringify(replay),
  })

  const conflicting = await buildPrescribeSyncCommand({
    commandId,
    tenantId,
    facilityId,
    deviceId,
    actorId,
    encounterId,
    patientId,
    prescriptionId,
    medicationDisplay: "Different drug",
    dose: "Different dose",
    quantity: 1,
  })
  const conflict = resolveSyncConflict({
    existing: { commandId: draft.commandId, payloadHash: draft.payloadHash, status: "applied" },
    incoming: { commandId: conflicting.commandId, payloadHash: conflicting.payloadHash },
    commandType: conflicting.commandType,
  })
  const conflictOk = typeof conflict === "object" && conflict.reason === "idempotency_mismatch"
  steps.push({
    id: "conflict",
    status: conflictOk ? "PASS" : "FAIL",
    detail: conflictOk ? undefined : JSON.stringify(conflict),
  })

  try {
    applyPrescribeSyncCommand({ ...aggregate, isSigned: true }, draft)
    steps.push({ id: "signed_reject", status: "FAIL", detail: "expected ENCOUNTER_SIGNED_IMMUTABLE" })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    steps.push({
      id: "signed_reject",
      status: msg === "ENCOUNTER_SIGNED_IMMUTABLE" ? "PASS" : "FAIL",
      detail: msg,
    })
  }

  const shapeOk =
    aggregate.prescriptions.length === 1 &&
    aggregate.prescriptions[0]?.medicationDisplay === "Amoxicillin 500mg" &&
    aggregate.prescriptions[0]?.quantity === 15
  steps.push({ id: "shape", status: shapeOk ? "PASS" : "FAIL" })

  return { ok: steps.every((s) => s.status === "PASS"), correlationId: encounterId, steps, aggregate }
}
