import { NextRequest, NextResponse } from 'next/server'
import { httpStatusForPharmacyError } from '@synapse/db/errors'
import { closeTill, getOpenTill, openTill, presentTill, recordCashMovement } from '@synapse/db/till-service'
import { isMobileAuth, requireMobilePharmacyAuth } from '../../../../../lib/mobile-pharmacy-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth
  const open = await getOpenTill({ tenantId: auth.tenantId, cashierId: auth.userId })
  return NextResponse.json({ session: open ? presentTill(open) : null })
}

export async function POST(req: NextRequest) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  const action = String(body?.action ?? '')

  if (action === 'open') {
    const result = await openTill({
      tenantId: auth.tenantId,
      cashierId: auth.userId,
      storeId: typeof body?.storeId === 'string' ? body.storeId : null,
      openingFloat: Number(body?.openingFloat ?? 0),
      deviceId: typeof body?.deviceId === 'string' ? body.deviceId : null,
    })
    if (!result.ok) return NextResponse.json(result.error, { status: httpStatusForPharmacyError(result.error.code) })
    return NextResponse.json({ ok: true, session: result.session })
  }

  if (action === 'close') {
    const result = await closeTill({
      tenantId: auth.tenantId,
      cashierId: auth.userId,
      sessionId: String(body?.sessionId ?? ''),
      countedCash: Number(body?.countedCash),
      varianceReason: typeof body?.varianceReason === 'string' ? body.varianceReason : null,
      notes: typeof body?.notes === 'string' ? body.notes : null,
      closerId: auth.userId,
    })
    if (!result.ok) return NextResponse.json(result.error, { status: httpStatusForPharmacyError(result.error.code) })
    return NextResponse.json({ ok: true, session: result.session })
  }

  if (action === 'movement') {
    const kind = body?.kind === 'out' ? 'out' : 'in'
    const result = await recordCashMovement({
      tenantId: auth.tenantId,
      cashierId: auth.userId,
      sessionId: String(body?.sessionId ?? ''),
      kind,
      amount: Number(body?.amount),
      reason: typeof body?.reason === 'string' ? body.reason : null,
    })
    if (!result.ok) return NextResponse.json(result.error, { status: httpStatusForPharmacyError(result.error.code) })
    return NextResponse.json({ ok: true, session: result.session })
  }

  return NextResponse.json({ error: 'action must be open, close, or movement' }, { status: 400 })
}
