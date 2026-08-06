import { NextRequest, NextResponse } from 'next/server'
import {
  isMobileAuth,
  requireMobilePharmacyAuth,
} from '../../../../../../../lib/mobile-pharmacy-auth'
import { loadReceiptSnapshot } from '../../../../../../../lib/pharmacy-receipt'

export const dynamic = 'force-dynamic'

/** Immutable receipt snapshot (tenant-scoped) for preview / sharing. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ saleId: string }> },
) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth

  const { saleId } = await params
  const snapshot = await loadReceiptSnapshot(auth.tenantId, saleId)
  if (!snapshot) return NextResponse.json({ error: 'Sale not found' }, { status: 404 })

  return NextResponse.json({ receipt: snapshot })
}
