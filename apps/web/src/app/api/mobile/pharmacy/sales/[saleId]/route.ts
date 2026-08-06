import { NextRequest, NextResponse } from 'next/server'
import {
  isMobileAuth,
  requireMobilePharmacyAuth,
} from '../../../../../../lib/mobile-pharmacy-auth'
import { loadReceiptSnapshot } from '../../../../../../lib/pharmacy-receipt'

export const dynamic = 'force-dynamic'

/** Full sale detail (tenant-scoped) as an immutable receipt snapshot. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ saleId: string }> },
) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth

  const { saleId } = await params
  const snapshot = await loadReceiptSnapshot(auth.tenantId, saleId)
  if (!snapshot) return NextResponse.json({ error: 'Sale not found' }, { status: 404 })

  return NextResponse.json({ sale: snapshot })
}
