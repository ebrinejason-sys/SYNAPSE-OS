/**
 * Clinical offline disposition (RC1): encounter disposition as SyncCommand.
 * Reuses sync-contract — no second offline system.
 */
import {
  SYNC_SCHEMA_VERSION,
  assertSyncCommand,
  hashPayload,
  resolveSyncConflict,
  type SyncCommand,
  type SyncOutboxStatus,
} from "./sync-contract"

export const CLINICAL_DISPOSITION_COMMAND = "clinical.encounter.disposition.v1" as const

/**
 * Generic offline closeout dispositions.
 * DECEASED is intentionally excluded: death must go through
 * clinical.death.pronouncement.v1 (online-only until that command is proven).
 */
export const CLINICAL_DISPOSITIONS = [
  "LOCAL_PHARMACY",
  "EXTERNAL_PHARMACY",
  "NO_MEDICATION",
  "FURTHER_LAB",
  "REFERRAL",
  "FOLLOW_UP",
  "CLINICAL_COMPLETE",
  "DISCHARGED",
  "ADMITTED",
  "TRANSFERRED",
  "REFERRED",
  "AMA",
  "LEFT_BEFORE_COMPLETION",
] as const

export type ClinicalDisposition = (typeof CLINICAL_DISPOSITIONS)[number]

export type EncounterDispositionAggregate = {
  encounterId: string
  disposition: string | null
  dispositionReason: string | null
  dispositionBy: string | null
  dispositionAt: string | null
  isSigned: boolean
  revision: number
}

export function isClinicalDisposition(value: string): value is ClinicalDisposition {
  return (CLINICAL_DISPOSITIONS as readonly string[]).includes(value)
}

export async function buildDispositionSyncCommand(input: {
  commandId?: string
  tenantId: string
  facilityId: string
  deviceId: string
  actorId: string
  encounterId: string
  disposition: ClinicalDisposition
  reason?: string | null
  baseRevision?: number | null
  correlationId?: string | null
}): Promise<SyncCommand> {
  if (String(input.disposition) === "DECEASED") {
    throw new Error("DEATH_REQUIRES_PRONOUNCEMENT_COMMAND")
  }
  if (!isClinicalDisposition(input.disposition)) {
    throw new Error("INVALID_DISPOSITION")
  }
  const payload = {
    encounter_id: input.encounterId,
    disposition: input.disposition,
    reason: input.reason?.trim() || null,
  }
  const command: SyncCommand = {
    commandId: input.commandId ?? crypto.randomUUID(),
    commandType: CLINICAL_DISPOSITION_COMMAND,
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

export function applyDispositionSyncCommand(
  aggregate: EncounterDispositionAggregate,
  command: SyncCommand,
): EncounterDispositionAggregate {
  assertSyncCommand(command)
  if (command.commandType !== CLINICAL_DISPOSITION_COMMAND) {
    throw new Error("UNSUPPORTED_COMMAND")
  }
  if (command.aggregateId !== aggregate.encounterId) {
    throw new Error("AGGREGATE_MISMATCH")
  }
  if (aggregate.isSigned) {
    throw new Error("ENCOUNTER_SIGNED_IMMUTABLE")
  }
  const disposition = String(command.payload.disposition ?? "")
  if (disposition === "DECEASED") {
    throw new Error("DEATH_REQUIRES_PRONOUNCEMENT_COMMAND")
  }
  if (!isClinicalDisposition(disposition)) {
    throw new Error("INVALID_DISPOSITION")
  }
  const reason =
    typeof command.payload.reason === "string" && command.payload.reason.trim()
      ? command.payload.reason.trim()
      : null
  return {
    encounterId: aggregate.encounterId,
    disposition,
    dispositionReason: reason,
    dispositionBy: command.actorId,
    dispositionAt: command.capturedAtClient,
    isSigned: aggregate.isSigned,
    revision: aggregate.revision + 1,
  }
}

type Queued = {
  command: SyncCommand
  status: SyncOutboxStatus
}

/**
 * In-memory offline→sync proof for disposition.
 * Same commandId+hash → replay; same commandId different hash → conflict.
 */
export async function runClinicalOfflineDispositionGolden(input?: {
  encounterId?: string
  tenantId?: string
}): Promise<{
  ok: boolean
  correlationId: string
  steps: Array<{ id: string; status: "PASS" | "FAIL"; detail?: string }>
  aggregate?: EncounterDispositionAggregate
}> {
  const tenantId = input?.tenantId ?? crypto.randomUUID()
  const facilityId = crypto.randomUUID()
  const encounterId = input?.encounterId ?? crypto.randomUUID()
  const deviceId = crypto.randomUUID()
  const actorId = crypto.randomUUID()
  const commandId = crypto.randomUUID()
  const steps: Array<{ id: string; status: "PASS" | "FAIL"; detail?: string }> = []

  const draft = await buildDispositionSyncCommand({
    commandId,
    tenantId,
    facilityId,
    deviceId,
    actorId,
    encounterId,
    disposition: "CLINICAL_COMPLETE",
    reason: "Offline closeout disposition",
  })

  const outbox: Queued[] = [{ command: draft, status: "queued" }]
  steps.push({ id: "queue", status: "PASS" })

  let aggregate: EncounterDispositionAggregate = {
    encounterId,
    disposition: null,
    dispositionReason: null,
    dispositionBy: null,
    dispositionAt: null,
    isSigned: false,
    revision: 0,
  }

  try {
    aggregate = applyDispositionSyncCommand(aggregate, draft)
    outbox[0]!.status = "applied"
    steps.push({ id: "apply", status: "PASS" })
  } catch (error) {
    steps.push({
      id: "apply",
      status: "FAIL",
      detail: error instanceof Error ? error.message : String(error),
    })
    return { ok: false, correlationId: encounterId, steps, aggregate }
  }

  // Idempotent replay
  const replay = resolveSyncConflict({
    existing: {
      commandId: draft.commandId,
      payloadHash: draft.payloadHash,
      status: "applied",
    },
    incoming: { commandId: draft.commandId, payloadHash: draft.payloadHash },
    commandType: draft.commandType,
  })
  if (replay !== "replay") {
    steps.push({ id: "replay", status: "FAIL", detail: JSON.stringify(replay) })
    return { ok: false, correlationId: encounterId, steps, aggregate }
  }
  steps.push({ id: "replay", status: "PASS" })

  // Hash mismatch conflict
  const conflicting = await buildDispositionSyncCommand({
    commandId,
    tenantId,
    facilityId,
    deviceId,
    actorId,
    encounterId,
    disposition: "FOLLOW_UP",
    reason: "Different payload same commandId",
  })
  const conflict = resolveSyncConflict({
    existing: {
      commandId: draft.commandId,
      payloadHash: draft.payloadHash,
      status: "applied",
    },
    incoming: { commandId: conflicting.commandId, payloadHash: conflicting.payloadHash },
    commandType: conflicting.commandType,
  })
  const conflictOk = typeof conflict === "object" && conflict.reason === "idempotency_mismatch"
  if (!conflictOk) {
    steps.push({ id: "conflict", status: "FAIL", detail: JSON.stringify(conflict) })
    return { ok: false, correlationId: encounterId, steps, aggregate }
  }
  steps.push({ id: "conflict", status: "PASS" })

  // Signed encounter must refuse
  try {
    applyDispositionSyncCommand({ ...aggregate, isSigned: true }, draft)
    steps.push({ id: "signed_reject", status: "FAIL", detail: "expected ENCOUNTER_SIGNED_IMMUTABLE" })
    return { ok: false, correlationId: encounterId, steps, aggregate }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    steps.push({
      id: "signed_reject",
      status: msg === "ENCOUNTER_SIGNED_IMMUTABLE" ? "PASS" : "FAIL",
      detail: msg,
    })
    if (msg !== "ENCOUNTER_SIGNED_IMMUTABLE") {
      return { ok: false, correlationId: encounterId, steps, aggregate }
    }
  }

  const ok = steps.every((s) => s.status === "PASS") && aggregate.disposition === "CLINICAL_COMPLETE"
  return { ok, correlationId: encounterId, steps, aggregate }
}
