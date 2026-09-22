import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { receivePharmacyPurchase, type ReceivePurchaseLine } from '@synapse/db/pharmacy-purchases'
import { isContextError, requireHospitalCapability } from '@/lib/hospital-shared'
import { requireHospitalStaffContext } from '@/lib/hospital-dept'

export const dynamic = 'force-dynamic'

const db = () => supabaseAdmin as any

export async function GET() {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx
  const cap = await requireHospitalCapability(ctx, 'inventory', 'read', 'dispensing')
  if (cap) return cap

  const { data, error } = await db()
    .from('pharmacy_purchases')
    .select(
      'id, purchase_no, status, payment_status, total, amount_paid, balance, purchase_date, supplier_id, pharmacy_suppliers(name), pharmacy_purchase_items(product_name, quantity, batch_number, expiry_date, unit_cost)',
    )
    .eq('tenant_id', ctx.tenantId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ purchases: data ?? [] })
}

export async function POST(req: NextRequest) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx
  const cap = await requireHospitalCapability(ctx, 'inventory', 'write', 'dispensing')
  if (cap) return cap

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const linesRaw = Array.isArray(body.lines) ? body.lines : []
  const lines: ReceivePurchaseLine[] = linesRaw.map((line: Record<string, unknown>, index: number) => ({
    clientItemId: typeof line.clientItemId === 'string' ? line.clientItemId : `line-${index}`,
    productId: String(line.productId ?? ''),
    productName: String(line.productName ?? ''),
    quantity: Number(line.quantity ?? 0),
    unitCost: Number(line.unitCost ?? 0),
    batchNumber: String(line.batchNumber ?? ''),
    expiryDate: String(line.expiryDate ?? ''),
  }))

  const result = await receivePharmacyPurchase(db(), {
    tenantId: ctx.tenantId,
    actorId: ctx.userId,
    supplierId: String(body.supplierId ?? ''),
    supplierInvoiceNo: (body.supplierInvoiceNo as string | null) ?? null,
    idempotencyKey:
      req.headers.get('idempotency-key')?.trim() ||
      (typeof body.idempotencyKey === 'string' ? body.idempotencyKey : crypto.randomUUID()),
    receiveNow: true,
    lines,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error, code: result.code }, { status: 400 })
  }
  return NextResponse.json(result)
}
