import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { isContextError, requireHospitalCapability, gateHospitalModule } from '@/lib/hospital-shared'
import { requireHospitalStaffContext } from '@/lib/hospital-dept'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'invoice', 'read', 'billing')
  if (cap) return cap

  const moduleBlock = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, 'billing')
  if (moduleBlock) return moduleBlock

  const { id: encounterId } = await params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: invoice, error: invoiceError } = await db
    .from('billing_invoices')
    .select('id, invoice_number, status, currency, total_amount, paid_amount, patient_id, encounter_id, created_at, updated_at')
    .eq('tenant_id', ctx.tenantId)
    .eq('encounter_id', encounterId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (invoiceError) return NextResponse.json({ error: invoiceError.message }, { status: 500 })
  if (!invoice) {
    return NextResponse.json({ invoice: null, lineItems: [] })
  }

  const { data: lineItems, error: lineError } = await db
    .from('billing_line_items')
    .select('id, item_name, unit_price, qty, total_price, notes, created_at')
    .eq('tenant_id', ctx.tenantId)
    .eq('invoice_id', invoice.id)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })

  if (lineError) return NextResponse.json({ error: lineError.message }, { status: 500 })

  const { data: payments, error: payError } = await db
    .from('billing_payments')
    .select('id, amount, currency, payment_method, payment_ref, receipt_number, created_at')
    .eq('tenant_id', ctx.tenantId)
    .eq('invoice_id', invoice.id)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })

  if (payError) return NextResponse.json({ error: payError.message }, { status: 500 })

  return NextResponse.json({ invoice, lineItems: lineItems ?? [], payments: payments ?? [] })
}
