import { NextRequest, NextResponse } from 'next/server'
import {
  isMobileAuth,
  requireMobilePharmacyAuth,
} from '../../../../../../../lib/mobile-pharmacy-auth'
import { loadReceiptSnapshot, logReceiptEvent } from '../../../../../../../lib/pharmacy-receipt'

export const dynamic = 'force-dynamic'

/** Reprint a receipt: audits the reprint and returns the snapshot marked as a reprint. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ saleId: string }> },
) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth

  const { saleId } = await params
  const snapshot = await loadReceiptSnapshot(auth.tenantId, saleId, { isReprint: true })
  if (!snapshot) return NextResponse.json({ error: 'Sale not found' }, { status: 404 })

  await logReceiptEvent({
    tenantId: auth.tenantId,
    profileId: auth.userId,
    action: 'receipt.reprinted',
    saleId,
    details: { receiptNumber: snapshot.receiptNumber },
  })

  return NextResponse.json({ receipt: snapshot })
}
