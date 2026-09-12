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
  composeClinicalNote,
  writeupFromEncounterMetadata,
} from '@synapse/db/clinical-writeup'
import { supabaseAdmin } from '@synapse/db/admin'
import { isContextError, requireHospitalCapability, logHospitalAudit } from '@/lib/hospital-shared'
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

  if (command.commandType !== CLINICAL_WRITEUP_COMMAND || command.aggregateType !== 'encounter') {
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
    .select('id, metadata, is_signed, chief_complaint, status')
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
        error: 'Encounter is signed — write-up sync refused',
        outcome: 'rejected',
        reason: 'ENCOUNTER_SIGNED_IMMUTABLE',
      },
      { status: 409 },
    )
  }

  let next
  try {
    next = applyWriteupSyncCommand(
      {
        encounterId,
        metadata: (encounter.metadata as Record<string, unknown>) ?? {},
        revision: 0,
      },
      command,
    )
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'APPLY_FAILED'
    await markOutbox(outbox.id, ctx.tenantId, 'rejected', reason)
    return NextResponse.json({ error: reason, outcome: 'rejected' }, { status: 400 })
  }

  const writeup = writeupFromEncounterMetadata(next.metadata)
  const metadata = {
    ...next.metadata,
    clinical_note: composeClinicalNote(writeup, encounter.chief_complaint),
  }

  const { error: updateError } = await db()
    .from('encounters')
    .update({
      metadata,
      updated_at: new Date().toISOString(),
      status:
        encounter.status === 'open' || !encounter.status ? 'in_progress' : encounter.status,
    })
    .eq('id', encounterId)
    .eq('tenant_id', ctx.tenantId)
    .eq('is_signed', false)

  if (updateError) {
    await markOutbox(outbox.id, ctx.tenantId, 'queued', updateError.message)
    return NextResponse.json({ error: updateError.message, outcome: 'retry' }, { status: 503 })
  }

  const appliedAt = new Date().toISOString()
  const serverResponse = {
    encounterId,
    writeup,
    clinicalNote: metadata.clinical_note,
    revision: next.revision,
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

  await logHospitalAudit({
    ctx,
    action: 'UPDATE',
    tableName: 'encounters',
    recordId: encounterId,
    newValue: { syncCommandId: command.commandId, writeup: true },
  })

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
  if (row.status === 'rejected') return { row, replay: 'rejected' }
  if (prior && prior.payloadHash && prior.payloadHash !== command.payloadHash) {
    return { row, replay: 'conflict' }
  }
  if (row.status === 'applied') return { row, replay: 'applied' }
  return { row, replay: 'none' }
}
