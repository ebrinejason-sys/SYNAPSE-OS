import { NextRequest, NextResponse } from 'next/server'
import {
  assertSyncCommand,
  hashPayload,
  toSyncOutboxRow,
  type SyncCommand,
  type SyncConflict,
} from '@synapse/db/sync-contract'
import {
  CLINICAL_WRITEUP_COMMAND,
  applyWriteupSyncCommand,
} from '@synapse/db/clinical-offline-writeup'
import {
  CLINICAL_DISPOSITION_COMMAND,
  applyDispositionSyncCommand,
  isClinicalDisposition,
} from '@synapse/db/clinical-offline-disposition'
import {
  CLINICAL_TRIAGE_COMMAND,
  applyTriageSyncCommand,
  triageFromEncounterMetadata,
  vitalsInsertFromTriage,
} from '@synapse/db/clinical-offline-triage'
import {
  CLINICAL_PRESCRIBE_COMMAND,
  applyPrescribeSyncCommand,
} from '@synapse/db/clinical-offline-prescribe'
import { persistClinicalPrescriptionBestEffort } from '@synapse/db/prescription-persist'
import {
  composeClinicalNote,
  writeupFromEncounterMetadata,
} from '@synapse/db/clinical-writeup'
import { supabaseAdmin } from '@synapse/db/admin'
import { isContextError, requireHospitalCapability, requireHospitalAudit, HospitalAuditRequiredError } from '@/lib/hospital-shared'
import { requireHospitalStaffContext } from '@/lib/hospital-dept'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any

type ServerOutboxRow = {
  id: string
  tenant_id: string
  idempotency_key: string
  payload: { envelope?: SyncCommand; serverResponse?: unknown }
  status: 'queued' | 'syncing' | 'applied' | 'conflict' | 'rejected'
  applied_at: string | null
  conflict_reason: string | null
}

/**
 * Hospital clinical SyncCommand flush — RC1 write-up vertical slice.
 * Mirrors pharmacy mobile sync/apply outbox semantics (idempotent replay,
 * hash conflict, rejection) under hospital staff auth.
 */
export async function POST(request: NextRequest) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'encounter', 'create', 'opd')
  if (cap) return cap

  const body = (await request.json().catch(() => null)) as { command?: SyncCommand } | null
  if (!body?.command) {
    return NextResponse.json({ error: 'SyncCommand is required' }, { status: 400 })
  }

  const command = body.command
  try {
    assertSyncCommand(command)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid SyncCommand' },
      { status: 400 },
    )
  }

  const supported =
    command.aggregateType === 'encounter' &&
    (command.commandType === CLINICAL_WRITEUP_COMMAND ||
      command.commandType === CLINICAL_DISPOSITION_COMMAND ||
      command.commandType === CLINICAL_TRIAGE_COMMAND ||
      command.commandType === CLINICAL_PRESCRIBE_COMMAND)
  if (!supported) {
    return NextResponse.json({ error: 'Unsupported sync command type' }, { status: 400 })
  }
  if (command.tenantId !== ctx.tenantId || command.actorId !== ctx.userId) {
    return NextResponse.json({ error: 'Sync command scope mismatch' }, { status: 403 })
  }

  const computedHash = await hashPayload(command.payload)
  if (computedHash !== command.payloadHash) {
    return NextResponse.json({ error: 'SYNC_PAYLOAD_HASH_INVALID' }, { status: 400 })
  }

  const registration = await registerCommand(command)
  if ('error' in registration) return registration.error
  const outbox = registration.row

  if (registration.replay === 'applied') {
    return NextResponse.json({
      ok: true,
      outcome: 'replay',
      commandId: command.commandId,
      serverAckId: outbox.id,
      checkpoint: outbox.applied_at ?? new Date().toISOString(),
      result: outbox.payload.serverResponse,
    })
  }
  if (registration.replay === 'conflict') {
    const conflict: SyncConflict = { policy: 'human_review', reason: 'idempotency_mismatch' }
    return NextResponse.json(
      {
        error: 'Command id was already used with different content',
        outcome: 'conflict',
        conflict,
      },
      { status: 409 },
    )
  }
  if (registration.replay === 'rejected') {
    return NextResponse.json(
      {
        error: outbox.conflict_reason ?? 'Command was rejected',
        outcome: 'rejected',
        reason: outbox.conflict_reason ?? 'rejected',
      },
      { status: 409 },
    )
  }

  const { error: syncingError } = await db()
    .from('offline_mutation_outbox')
    .update({ status: 'syncing', conflict_reason: null })
    .eq('id', outbox.id)
    .eq('tenant_id', ctx.tenantId)
  if (syncingError) {
    return NextResponse.json({ error: 'Unable to start command apply' }, { status: 503 })
  }

  const encounterId = command.aggregateId
  const { data: encounter, error: loadError } = await db()
    .from('encounters')
    .select('id, metadata, is_signed, chief_complaint, status, clinical_stage, patient_id, disposition, disposition_reason, disposition_by, disposition_at')
    .eq('id', encounterId)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle()

  if (loadError) {
    await markOutbox(outbox.id, ctx.tenantId, 'queued', loadError.message)
    return NextResponse.json({ error: loadError.message, outcome: 'retry' }, { status: 503 })
  }
  if (!encounter) {
    await markOutbox(outbox.id, ctx.tenantId, 'rejected', 'ENCOUNTER_NOT_FOUND')
    return NextResponse.json({ error: 'Encounter not found', outcome: 'rejected' }, { status: 404 })
  }
  if (encounter.is_signed) {
    await markOutbox(outbox.id, ctx.tenantId, 'rejected', 'ENCOUNTER_SIGNED_IMMUTABLE')
    return NextResponse.json(
      {
        error: 'Encounter is signed — sync refused',
        outcome: 'rejected',
        reason: 'ENCOUNTER_SIGNED_IMMUTABLE',
      },
      { status: 409 },
    )
  }

  let updatePayload: Record<string, unknown>
  let serverResponse: Record<string, unknown>
  let auditValue: Record<string, unknown>

  try {
    if (command.commandType === CLINICAL_WRITEUP_COMMAND) {
      const next = applyWriteupSyncCommand(
        {
          encounterId,
          metadata: (encounter.metadata as Record<string, unknown>) ?? {},
          revision: 0,
        },
        command,
      )
      const writeup = writeupFromEncounterMetadata(next.metadata)
      const metadata = {
        ...next.metadata,
        clinical_note: composeClinicalNote(writeup, encounter.chief_complaint),
      }
      updatePayload = {
        metadata,
        updated_at: new Date().toISOString(),
        status:
          encounter.status === 'open' || !encounter.status ? 'in_progress' : encounter.status,
      }
      serverResponse = {
        encounterId,
        writeup,
        clinicalNote: metadata.clinical_note,
        revision: next.revision,
      }
      auditValue = { syncCommandId: command.commandId, writeup: true }
    } else if (command.commandType === CLINICAL_TRIAGE_COMMAND) {
      const next = applyTriageSyncCommand(
        {
          encounterId,
          metadata: (encounter.metadata as Record<string, unknown>) ?? {},
          clinicalStage: (encounter as { clinical_stage?: string | null }).clinical_stage ?? null,
          isSigned: Boolean(encounter.is_signed),
          revision: 0,
        },
        command,
      )
      const triage = triageFromEncounterMetadata(next.metadata)
      updatePayload = {
        metadata: next.metadata,
        clinical_stage: next.clinicalStage,
        updated_at: new Date().toISOString(),
        status:
          encounter.status === 'open' || !encounter.status ? 'in_progress' : encounter.status,
      }
      // Persist vitals row (best-effort companion to metadata.triage)
      const vitalsRow = vitalsInsertFromTriage({
        tenantId: ctx.tenantId,
        encounterId,
        triage,
        actorId: ctx.userId,
        // The outbox UUID is server-generated and stable across retries. Never
        // use a client-selected UUID as a service-role upsert primary key.
        id: outbox.id,
      })
      const { error: vitalsError } = await db().from('vitals').upsert(vitalsRow, { onConflict: 'id' })
      if (vitalsError) {
        await markOutbox(outbox.id, ctx.tenantId, 'queued', vitalsError.message)
        return NextResponse.json({ error: vitalsError.message, outcome: 'retry' }, { status: 503 })
      }
      serverResponse = {
        encounterId,
        triage,
        clinicalStage: next.clinicalStage,
        revision: next.revision,
      }
      auditValue = { syncCommandId: command.commandId, triage: true, clinicalStage: next.clinicalStage }
    } else if (command.commandType === CLINICAL_PRESCRIBE_COMMAND) {
      const applied = applyPrescribeSyncCommand(
        {
          encounterId,
          isSigned: Boolean(encounter.is_signed),
          prescriptions: [],
          revision: 0,
        },
        command,
      )
      if (encounter.patient_id && applied.prescription.patientId !== encounter.patient_id) {
        await markOutbox(outbox.id, ctx.tenantId, 'rejected', 'PATIENT_MISMATCH')
        return NextResponse.json({ error: 'Patient does not match encounter', outcome: 'rejected' }, { status: 400 })
      }
      const persistRx = await persistClinicalPrescriptionBestEffort(db(), applied.prescription)
      if (!persistRx.ok) {
        await markOutbox(outbox.id, ctx.tenantId, 'queued', persistRx.error)
        return NextResponse.json({ error: persistRx.error, outcome: 'retry' }, { status: 503 })
      }
      updatePayload = {
        updated_at: new Date().toISOString(),
        status:
          encounter.status === 'open' || !encounter.status ? 'in_progress' : encounter.status,
      }
      serverResponse = {
        encounterId,
        prescriptionId: applied.prescription.id,
        medicationDisplay: applied.prescription.medicationDisplay,
        quantity: applied.prescription.quantity,
        unit: applied.prescription.unit,
        status: applied.prescription.status,
        revision: applied.aggregate.revision,
      }
      auditValue = {
        syncCommandId: command.commandId,
        prescriptionId: applied.prescription.id,
        medicationDisplay: applied.prescription.medicationDisplay,
      }
    } else {
      const disposition = String(command.payload.disposition ?? '')
      if (!isClinicalDisposition(disposition)) {
        await markOutbox(outbox.id, ctx.tenantId, 'rejected', 'INVALID_DISPOSITION')
        return NextResponse.json({ error: 'Invalid disposition', outcome: 'rejected' }, { status: 400 })
      }
      if (disposition === 'LOCAL_PHARMACY') {
        const { data: prescription } = await db()
          .from('clinical_prescriptions')
          .select('id')
          .eq('tenant_id', ctx.tenantId)
          .eq('encounter_id', encounterId)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle()
        if (!prescription) {
          await markOutbox(outbox.id, ctx.tenantId, 'rejected', 'LOCAL_PHARMACY_REQUIRES_RX')
          return NextResponse.json(
            { error: 'Local Pharmacy requires an active prescription', outcome: 'rejected' },
            { status: 409 },
          )
        }
      }
      const next = applyDispositionSyncCommand(
        {
          encounterId,
          disposition: encounter.disposition ?? null,
          dispositionReason: encounter.disposition_reason ?? null,
          dispositionBy: encounter.disposition_by ?? null,
          dispositionAt: encounter.disposition_at ?? null,
          isSigned: Boolean(encounter.is_signed),
          revision: 0,
        },
        command,
      )
      updatePayload = {
        disposition: next.disposition,
        disposition_reason: next.dispositionReason,
        disposition_by: next.dispositionBy,
        disposition_at: next.dispositionAt,
        updated_at: new Date().toISOString(),
      }
      serverResponse = {
        encounterId,
        disposition: next.disposition,
        reason: next.dispositionReason,
        recordedAt: next.dispositionAt,
        revision: next.revision,
      }
      auditValue = {
        syncCommandId: command.commandId,
        disposition: next.disposition,
        reason: next.dispositionReason,
      }
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'APPLY_FAILED'
    await markOutbox(outbox.id, ctx.tenantId, 'rejected', reason)
    return NextResponse.json({ error: reason, outcome: 'rejected' }, { status: 400 })
  }

  const { error: updateError } = await db()
    .from('encounters')
    .update(updatePayload)
    .eq('id', encounterId)
    .eq('tenant_id', ctx.tenantId)
    .eq('is_signed', false)

  if (updateError) {
    await markOutbox(outbox.id, ctx.tenantId, 'queued', updateError.message)
    return NextResponse.json({ error: updateError.message, outcome: 'retry' }, { status: 503 })
  }

  const appliedAt = new Date().toISOString()

  // Required audit before client-visible success. Domain write may already be
  // committed; on audit failure we leave outbox syncing/queued so retry is
  // idempotent (same commandId + payloadHash → replay once audited).
  try {
    await requireHospitalAudit({
      ctx,
      action: 'UPDATE',
      tableName: 'encounters',
      recordId: encounterId,
      newValue: auditValue,
    })
  } catch (err) {
    const message = err instanceof HospitalAuditRequiredError ? err.message : 'AUDIT_REQUIRED_FAILED'
    await db()
      .from('offline_mutation_outbox')
      .update({
        status: 'queued',
        conflict_reason: `AUDIT_REQUIRED:${message}`,
        payload: { envelope: command, serverResponse },
      })
      .eq('id', outbox.id)
      .eq('tenant_id', ctx.tenantId)
    return NextResponse.json(
      { error: 'AUDIT_REQUIRED_FAILED', outcome: 'retry', reason: message },
      { status: 503 },
    )
  }

  await db()
    .from('offline_mutation_outbox')
    .update({
      status: 'applied',
      applied_at: appliedAt,
      conflict_reason: null,
      payload: { envelope: command, serverResponse },
    })
    .eq('id', outbox.id)
    .eq('tenant_id', ctx.tenantId)

  return NextResponse.json({
    ok: true,
    outcome: 'applied',
    commandId: command.commandId,
    serverAckId: outbox.id,
    checkpoint: appliedAt,
    result: serverResponse,
  })
}

async function markOutbox(
  id: string,
  tenantId: string,
  status: ServerOutboxRow['status'],
  reason: string,
) {
  await db()
    .from('offline_mutation_outbox')
    .update({ status, conflict_reason: reason })
    .eq('id', id)
    .eq('tenant_id', tenantId)
}

async function registerCommand(
  command: SyncCommand,
): Promise<
  | { row: ServerOutboxRow; replay: 'none' | 'applied' | 'conflict' | 'rejected' }
  | { error: NextResponse }
> {
  const existing = await findCommand(command.tenantId, command.commandId)
  if ('error' in existing) return existing
  if (existing.row) return classifyExisting(existing.row, command)

  const { data, error } = await db()
    .from('offline_mutation_outbox')
    .insert(toSyncOutboxRow(command))
    .select('id, tenant_id, idempotency_key, payload, status, applied_at, conflict_reason')
    .single()
  if (!error && data) return { row: data as ServerOutboxRow, replay: 'none' }
  if (error?.code === '23505') {
    const raced = await findCommand(command.tenantId, command.commandId)
    if ('error' in raced) return raced
    if (raced.row) return classifyExisting(raced.row, command)
  }
  return {
    error: NextResponse.json({ error: 'Unable to persist sync command' }, { status: 503 }),
  }
}

async function findCommand(
  tenantId: string,
  commandId: string,
): Promise<{ row: ServerOutboxRow | null } | { error: NextResponse }> {
  const { data, error } = await db()
    .from('offline_mutation_outbox')
    .select('id, tenant_id, idempotency_key, payload, status, applied_at, conflict_reason')
    .eq('tenant_id', tenantId)
    .eq('idempotency_key', commandId)
    .maybeSingle()
  if (error) {
    return {
      error: NextResponse.json({ error: 'Unable to read sync command' }, { status: 503 }),
    }
  }
  return { row: (data as ServerOutboxRow | null) ?? null }
}

function classifyExisting(
  row: ServerOutboxRow,
  command: SyncCommand,
): { row: ServerOutboxRow; replay: 'applied' | 'conflict' | 'rejected' | 'none' } {
  const prior = row.payload?.envelope
  if (!prior || ['tenantId', 'actorId', 'facilityId', 'aggregateType', 'aggregateId',
    'commandType', 'schemaVersion', 'payloadHash', 'baseRevision'].some(
      (key) => prior[key as keyof SyncCommand] !== command[key as keyof SyncCommand],
    )) {
    return { row, replay: 'conflict' }
  }
  if (row.status === 'rejected') return { row, replay: 'rejected' }
  if (row.status === 'applied') return { row, replay: 'applied' }
  return { row, replay: 'none' }
}
