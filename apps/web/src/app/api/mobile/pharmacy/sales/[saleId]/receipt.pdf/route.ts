import { NextRequest, NextResponse } from 'next/server'
import { renderReceiptHtml } from '@synapse/db/receipt'
import {
  isMobileAuth,
  requireMobilePharmacyAuth,
} from '../../../../../../../lib/mobile-pharmacy-auth'
import { loadReceiptSnapshot } from '../../../../../../../lib/pharmacy-receipt'

export const dynamic = 'force-dynamic'

/**
 * Print-ready receipt HTML (tenant-scoped). The native app converts this to a PDF
 * file on device via `expo-print` (Print.printToFileAsync({ html })), which avoids a
 * heavy server-side PDF dependency and keeps the receipt an immutable snapshot.
 * `?reprint=1` marks the document as a reprint.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ saleId: string }> },
) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth

  const { saleId } = await params
  const isReprint = new URL(req.url).searchParams.get('reprint') === '1'
  const snapshot = await loadReceiptSnapshot(auth.tenantId, saleId, { isReprint })
  if (!snapshot) return NextResponse.json({ error: 'Sale not found' }, { status: 404 })

  return new NextResponse(renderReceiptHtml(snapshot), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
