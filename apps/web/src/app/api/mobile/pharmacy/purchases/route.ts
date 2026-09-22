import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { receivePharmacyPurchase, type ReceivePurchaseLine } from '@synapse/db/pharmacy-purchases'
import {
  isMobileAuth,
  mobileHasPharmacyCapability,
  requireMobilePharmacyAuth,
  type MobileAuth,
} from '../../../../../lib/mobile-pharmacy-auth'

export const dynamic = 'force-dynamic'

const db = () => supabaseAdmin as any

function canManagePurchasing(auth: MobileAuth): boolean {
  return mobileHasPharmacyCapability(auth, 'purchasing.manage')
}

function mapPurchase(row: Record<string, unknown>) {
  const supplierRaw = (row.supplier as Record<string, unknown> | null) ?? null
  const itemsRaw = (row.items as Record<string, unknown>[] | null) ?? []
  return {
    id: String(row.id),
    purchaseNo: String(row.purchase_no ?? ''),
    status: String(row.status ?? 'DRAFT'),
    paymentStatus: String(row.payment_status ?? 'UNPAID'),
    paymentMethod: (row.payment_method as string | null) ?? null,
    supplierInvoiceNo: (row.supplier_invoice_no as string | null) ?? null,
    total: Number(row.total ?? 0),
    amountPaid: Number(row.amount_paid ?? 0),
    balance: Number(row.balance ?? 0),
    purchaseDate: (row.purchase_date as string | null) ?? null,
    receivedDate: (row.received_date as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    createdAt: (row.created_at as string | null) ?? null,
    supplier: {
      id: String(supplierRaw?.id ?? row.supplier_id ?? ''),
      name: String(supplierRaw?.name ?? ''),
    },
    items: itemsRaw.map((item) => ({
      id: String(item.id),
      productId: (item.product_id as string | null) ?? null,
      productName: String(item.product_name ?? ''),
      quantity: Number(item.quantity ?? 0),
      unitCost: Number(item.unit_cost ?? 0),
      lineTotal: Number(item.line_total ?? 0),
      batchNumber: (item.batch_number as string | null) ?? null,
      expiryDate: (item.expiry_date as string | null) ?? null,
    })),
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth
  if (!canManagePurchasing(auth)) {
    return NextResponse.json({ error: 'Purchasing permission required' }, { status: 403 })
  }

  const { data, error } = await db()
    .from('pharmacy_purchases')
    .select(
      `
      *,
      supplier:pharmacy_suppliers(id, name, email, phone),
      items:pharmacy_purchase_items(id, product_id, product_name, quantity, unit_cost, line_total, batch_number, expiry_date)
    `,
    )
    .eq('tenant_id', auth.tenantId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('[mobile/pharmacy/purchases GET]', error.message)
    return NextResponse.json({ error: 'Failed to load purchases' }, { status: 500 })
  }

  return NextResponse.json({
    purchases: (data ?? []).map((row: Record<string, unknown>) => mapPurchase(row)),
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth
  if (!canManagePurchasing(auth)) {
    return NextResponse.json({ error: 'Purchasing permission required' }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const linesRaw = Array.isArray(body.lines) ? body.lines : []
  const lines: ReceivePurchaseLine[] = linesRaw.map((line: Record<string, unknown>, index: number) => ({
    clientItemId: typeof line.clientItemId === 'string' ? line.clientItemId : `line-${index}`,
    productId: String(line.productId ?? ''),
    productName: String(line.productName ?? ''),
    quantity: Number(line.quantity ?? 0),
    unitCost: Number(line.unitCost ?? line.costPrice ?? 0),
    batchNumber: String(line.batchNumber ?? ''),
    expiryDate: String(line.expiryDate ?? ''),
    manufactureDate: (line.manufactureDate as string | null) ?? null,
    sellingPrice: line.sellingPrice != null ? Number(line.sellingPrice) : null,
    updateSellingPrice: Boolean(line.updateSellingPrice),
    supplierProductRef: (line.supplierProductRef as string | null) ?? null,
  }))

  const idempotencyKey =
    req.headers.get('idempotency-key')?.trim() ||
    (typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim()) ||
    crypto.randomUUID()

  const result = await receivePharmacyPurchase(db(), {
    tenantId: auth.tenantId,
    actorId: auth.userId,
    supplierId: String(body.supplierId ?? ''),
    supplierInvoiceNo: (body.supplierInvoiceNo as string | null) ?? null,
    supplierReceiptRef: (body.supplierReceiptRef as string | null) ?? null,
    paymentStatus: (body.paymentStatus as string | null) ?? null,
    paymentMethod: (body.paymentMethod as string | null) ?? null,
    amountPaid: body.amountPaid != null ? Number(body.amountPaid) : 0,
    tax: body.tax != null ? Number(body.tax) : 0,
    discount: body.discount != null ? Number(body.discount) : 0,
    otherCost: body.otherCost != null ? Number(body.otherCost) : 0,
    notes: (body.notes as string | null) ?? null,
    idempotencyKey,
    receiveNow: body.receiveNow !== false,
    lines,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error, code: result.code }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    replay: Boolean(result.replay),
    purchaseId: result.purchaseId,
    purchaseNo: result.purchaseNo,
    status: result.status,
    paymentStatus: result.paymentStatus,
    grandTotal: result.grandTotal,
    received: result.received,
  })
}
