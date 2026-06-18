import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * RX-YYYYMMDD-NNNN — sequential per tenant per calendar day (UTC).
 * Queries existing pharmacy_transactions for the day's max sequence.
 */
export async function generateReceiptNumber(tenantId: string): Promise<string> {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  const d = String(now.getUTCDate()).padStart(2, '0')
  const prefix = `RX-${y}${m}${d}-`

  const dayStart = `${y}-${m}-${d}T00:00:00.000Z`
  const dayEnd = `${y}-${m}-${d}T23:59:59.999Z`

  const { data: rows } = await supabaseAdmin
    .from('pharmacy_transactions')
    .select('transaction_no')
    .eq('tenant_id', tenantId)
    .gte('created_at', dayStart)
    .lte('created_at', dayEnd)
    .like('transaction_no', `${prefix}%`)
    .order('transaction_no', { ascending: false })
    .limit(50)

  let maxSeq = 0
  for (const row of rows ?? []) {
    const no = row.transaction_no as string
    const seqPart = no.slice(prefix.length)
    const seq = parseInt(seqPart, 10)
    if (!Number.isNaN(seq) && seq > maxSeq) maxSeq = seq
  }

  const next = String(maxSeq + 1).padStart(4, '0')
  return `${prefix}${next}`
}
