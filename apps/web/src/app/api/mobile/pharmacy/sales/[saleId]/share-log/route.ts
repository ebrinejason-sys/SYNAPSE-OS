import { NextRequest, NextResponse } from 'next/server'
import {
  isMobileAuth,
  requireMobilePharmacyAuth,
} from '../../../../../../../lib/mobile-pharmacy-auth'
import { loadReceiptSnapshot, logReceiptEvent } from '../../../../../../../lib/pharmacy-receipt'

export const dynamic = 'force-dynamic'

const CHANNELS = new Set(['whatsapp', 'email', 'file', 'print', 'link', 'other'])

/** Record that a receipt was shared/printed (audit trail). Tenant-scoped. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ saleId: string }> },
) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth

  const { saleId } = await params
  const body = (await req.json().catch(() => null)) as { channel?: string } | null
  const channel = String(body?.channel ?? 'other').toLowerCase()
  if (!CHANNELS.has(channel)) {
    return NextResponse.json({ error: 'Invalid channel' }, { status: 400 })
  }

  // Confirm the sale belongs to this tenant before logging (prevents cross-tenant writes).
  const snapshot = await loadReceiptSnapshot(auth.tenantId, saleId)
  if (!snapshot) return NextResponse.json({ error: 'Sale not found' }, { status: 404 })

  await logReceiptEvent({
    tenantId: auth.tenantId,
    profileId: auth.userId,
    action: 'receipt.shared',
    saleId,
    details: { channel, receiptNumber: snapshot.receiptNumber },
  })

  return NextResponse.json({ ok: true })
}
