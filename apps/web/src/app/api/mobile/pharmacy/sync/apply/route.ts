import { NextRequest, NextResponse } from 'next/server'
import {
  assertSyncCommand,
  hashPayload,
  resolveSyncConflict,
  toSyncOutboxRow,
  type SyncCommand,
  type SyncConflict,
} from '@synapse/db/sync-contract'
import { classifyApplyHttpFailure } from '@synapse/db/sync-runtime'
import { supabaseAdmin } from '@synapse/db/admin'
import {
  isMobileAuth,
  requireMobilePharmacyAuth,
} from '../../../../../../lib/mobile-pharmacy-auth'
import { POST as completeSale } from '../../pos/complete-sale/route'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any

type ServerOutboxRow = {
  id: string
  tenant_id: string
  idempotency_key: string
  payload: {
    envelope?: SyncCommand
    serverResponse?: unknown
  }
  status: 'queued' | 'syncing' | 'applied' | 'conflict' | 'rejected'
  applied_at: string | null
  conflict_reason: string | null
}

export async function POST(request: NextRequest) {
  const auth = await requireMobilePharmacyAuth(request)
  if (!isMobileAuth(auth)) return auth

  const body = (await request.json().catch(() => null)) as {
    command?: SyncCommand
  } | null
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

  if (
    command.commandType !== 'pharmacy.sale.complete.v1' ||
    command.aggregateType !== 'pharmacy_sale'
  ) {
    return NextResponse.json({ error: 'Unsupported sync command type' }, { status: 400 })
  }
  if (command.tenantId !== auth.tenantId || command.actorId !== auth.userId) {
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
    const checkpoint = outbox.applied_at ?? new Date().toISOString()
    return NextResponse.json({
      ok: true,
      outcome: 'replay',
      commandId: command.commandId,
      serverAckId: outbox.id,
      checkpoint,
      result: outbox.payload.serverResponse,
    })
  }
  if (registration.replay === 'conflict') {
    const conflict: SyncConflict = {
      policy: 'human_review',
      reason: 'idempotency_mismatch',
    }
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
    .eq('tenant_id', auth.tenantId)
  if (syncingError) {
    return NextResponse.json({ error: 'Unable to start command apply' }, { status: 503 })
  }

  const forwarded = new NextRequest(
    new URL('/api/mobile/pharmacy/pos/complete-sale', request.url),
    {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify({
        ...command.payload,
        idempotencyKey: command.commandId,
        syncReplay: true,
      }),
    },
  )
  const saleResponse = await completeSale(forwarded)
  const saleResult = (await saleResponse.json().catch(() => ({}))) as Record<string, unknown>

  if (!saleResponse.ok) {
    const code = typeof saleResult.code === 'string' ? saleResult.code : ''
    const nextKind = classifyApplyHttpFailure(saleResponse.status, code)
    const nextStatus = nextKind === 'rejected' ? 'rejected' : 'queued'
    const insufficientStock = nextKind === 'rejected' && code.toUpperCase().includes('STOCK')
    const reason = insufficientStock
      ? 'insufficient_stock'
      : typeof saleResult.error === 'string'
        ? saleResult.error
        : `apply_http_${saleResponse.status}`

    const { error: failureUpdateError } = await db()
      .from('offline_mutation_outbox')
      .update({ status: nextStatus, conflict_reason: reason })
      .eq('id', outbox.id)
      .eq('tenant_id', auth.tenantId)
    if (failureUpdateError) {
      return NextResponse.json({ error: 'Unable to record command failure' }, { status: 503 })
    }

    return NextResponse.json(
      {
        ...saleResult,
        outcome: nextKind,
        reason,
      },
      { status: saleResponse.status },
    )
  }

  const appliedAt = new Date().toISOString()
  const { error: appliedError } = await db()
    .from('offline_mutation_outbox')
    .update({
      status: 'applied',
      applied_at: appliedAt,
      conflict_reason: null,
      payload: {
        envelope: command,
        serverResponse: saleResult,
      },
    })
    .eq('id', outbox.id)
    .eq('tenant_id', auth.tenantId)
  if (appliedError) {
    // The sale RPC is idempotent. Returning retry is safe: the next apply
    // replays commandId and finishes this acknowledgement record.
    return NextResponse.json({ error: 'Sale applied; acknowledgement pending' }, { status: 503 })
  }

  const wasReplay =
    saleResponse.headers.get('X-Idempotent-Replay') === 'true' ||
    saleResult.idempotentReplay === true
  return NextResponse.json({
    ok: true,
    outcome: wasReplay ? 'replay' : 'applied',
    commandId: command.commandId,
    serverAckId: outbox.id,
    checkpoint: appliedAt,
    result: saleResult,
  })
}

async function registerCommand(
  command: SyncCommand,
): Promise<
  | {
      row: ServerOutboxRow
      replay: 'none' | 'applied' | 'conflict' | 'rejected'
    }
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
  if (!error && data) {
    return { row: data as ServerOutboxRow, replay: 'none' }
  }

  // A concurrent retry may have won the unique (tenant_id, idempotency_key).
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

async function classifyExisting(
  existing: ServerOutboxRow,
  incoming: SyncCommand,
): Promise<{
  row: ServerOutboxRow
  replay: 'none' | 'applied' | 'conflict' | 'rejected'
}> {
  const stored = existing.payload?.envelope
  const resolution = stored
    ? resolveSyncConflict({
        existing: {
          commandId: existing.idempotency_key,
          payloadHash: stored.payloadHash,
          status: existing.status,
        },
        incoming: {
          commandId: incoming.commandId,
          payloadHash: incoming.payloadHash,
        },
        commandType: incoming.commandType,
      })
    : {
        policy: 'human_review' as const,
        reason: 'idempotency_mismatch' as const,
      }

  if (resolution !== 'replay') {
    await db()
      .from('offline_mutation_outbox')
      .update({ status: 'conflict', conflict_reason: resolution.reason })
      .eq('id', existing.id)
      .eq('tenant_id', existing.tenant_id)
    existing.status = 'conflict'
    existing.conflict_reason = resolution.reason
    return { row: existing, replay: 'conflict' }
  }
  if (existing.status === 'applied') return { row: existing, replay: 'applied' }
  if (existing.status === 'conflict') return { row: existing, replay: 'conflict' }
  if (existing.status === 'rejected') return { row: existing, replay: 'rejected' }
  return { row: existing, replay: 'none' }
}
