import { NextResponse, type NextRequest } from 'next/server'
import { requirePlatformAdmin } from '../../../../../lib/platform/auth'
import { safeRows } from '../../../../platform/_lib/platform-data'
import { listAllPayments } from '@synapse/auth/billing'

export const dynamic = 'force-dynamic'

type InvoiceRow = {
  invoice_no?: string | null
  tenant_id?: string | null
  amount_ugx?: number | string | null
  currency?: string | null
  period_start?: string | null
  period_end?: string | null
  issued_at?: string | null
}

function csvCell(value: unknown) {
  const s = value == null ? '' : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function toCsv(header: string[], rows: unknown[][]) {
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')
}

function kampalaDateStamp() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala' }).format(new Date())
}

export async function GET(req: NextRequest) {
  await requirePlatformAdmin()

  const type = req.nextUrl.searchParams.get('type') === 'invoices' ? 'invoices' : 'payments'
  const status = req.nextUrl.searchParams.get('status')

  let csv: string
  if (type === 'invoices') {
    const invoices = await safeRows<InvoiceRow>(
      'subscription_invoices',
      'invoice_no, tenant_id, amount_ugx, currency, period_start, period_end, issued_at',
      { orderBy: 'issued_at', limit: 5000 },
    )
    csv = toCsv(
      ['invoice_no', 'tenant_id', 'amount_ugx', 'currency', 'period_start', 'period_end', 'issued_at'],
      invoices.map((row) => [
        row.invoice_no,
        row.tenant_id,
        row.amount_ugx,
        row.currency,
        row.period_start,
        row.period_end,
        row.issued_at,
      ]),
    )
  } else {
    const payments = await listAllPayments(5000)
    const filtered = status ? payments.filter((p) => p.status === status) : payments
    csv = toCsv(
      ['id', 'tenant_id', 'tenant_name', 'amount_ugx', 'status', 'method', 'provider_tx_ref', 'provider_tx_id', 'created_at', 'confirmed_at'],
      filtered.map((p) => [
        p.id,
        p.tenant_id,
        p.tenant_name,
        p.amount_ugx,
        p.status,
        p.method,
        p.provider_tx_ref,
        p.provider_tx_id,
        p.created_at,
        p.confirmed_at,
      ]),
    )
  }

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="synapse-${type}-${kampalaDateStamp()}.csv"`,
    },
  })
}
