import { NextRequest, NextResponse } from 'next/server'
import { renderReceiptHtml } from '@synapse/db/receipt'
import { supabaseAdmin } from '@synapse/db/admin'
import {
  isMobileAuth,
  requireMobilePharmacyAuth,
} from '../../../../../../../lib/mobile-pharmacy-auth'
import { loadReceiptSnapshot } from '../../../../../../../lib/pharmacy-receipt'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any

function paperFromPrinterType(printerType: string | null | undefined): '58' | '80' | 'a4' {
  const t = String(printerType ?? '').toLowerCase()
  if (t.includes('58')) return '58'
  if (t.includes('a4') || t.includes('brother') || t.includes('letter')) return 'a4'
  return '80'
}

/**
 * Print-ready receipt HTML (tenant-scoped). Uses pharmacy printer preferences
 * (paper width / font scale) when available.
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

  const { data: settings } = await db()
    .from('pharmacy_settings')
    .select('printer_type, receipt_paper_width, receipt_font_scale')
    .eq('tenant_id', auth.tenantId)
    .maybeSingle()

  const paperRaw = String(settings?.receipt_paper_width ?? '').toLowerCase()
  const paperWidth: '58' | '80' | 'a4' =
    paperRaw === '58' || paperRaw === '80' || paperRaw === 'a4'
      ? paperRaw
      : paperFromPrinterType(settings?.printer_type)
  const fontScale = Number(settings?.receipt_font_scale ?? 1) || 1

  return new NextResponse(renderReceiptHtml(snapshot, { paperWidth, fontScale }), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
