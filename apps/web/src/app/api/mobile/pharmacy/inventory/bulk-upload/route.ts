import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import {
  isMobileAuth,
  isMobilePharmacyAdmin,
  requireMobilePharmacyAuth,
} from '../../../../../../lib/mobile-pharmacy-auth'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any

const WRITE_ROLES = new Set([
  'pharmacy_admin',
  'pharmacy_ceo',
  'pharmacist',
  'pharmacy_store_manager',
])

function parseCsv(text: string): Record<string, string>[] {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length < 2) return []

  const split = (line: string) => {
    const cells: string[] = []
    let cur = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        inQuotes = !inQuotes
        continue
      }
      if (ch === ',' && !inQuotes) {
        cells.push(cur.trim())
        cur = ''
        continue
      }
      cur += ch
    }
    cells.push(cur.trim())
    return cells
  }

  const headerLine = lines[0]
  if (!headerLine) return []
  const headers = split(headerLine).map((h) => h.toLowerCase())
  return lines.slice(1).map((line) => {
    const cells = split(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? ''
    })
    return row
  })
}

function pick(row: Record<string, string>, ...names: string[]): string {
  for (const name of names) {
    const want = name.toLowerCase()
    for (const [k, v] of Object.entries(row)) {
      if (k === want || k.includes(want)) {
        if (v?.trim()) return v.trim()
      }
    }
  }
  return ''
}

function num(value: string): number {
  if (!value) return 0
  const n = Number(value.replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

/**
 * Paste-friendly CSV bulk create for mobile.
 * Expected headers (flexible): name, sku, price, quantity, cost_price, category, unit, batch, expiry
 */
export async function POST(req: NextRequest) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth

  if (!WRITE_ROLES.has(auth.role) && !isMobilePharmacyAdmin(auth)) {
    return NextResponse.json({ error: 'Inventory write requires a manager role' }, { status: 403 })
  }

  const body = (await req.json().catch(() => null)) as { csv?: string } | null
  const csv = body?.csv?.trim() ?? ''
  if (!csv) return NextResponse.json({ error: 'csv text is required' }, { status: 400 })

  const rows = parseCsv(csv)
  if (rows.length === 0) {
    return NextResponse.json({ error: 'No data rows found' }, { status: 400 })
  }

  let created = 0
  const errors: string[] = []
  const skipped: string[] = []

  for (const [index, row] of rows.entries()) {
    const name = pick(row, 'name', 'product name', 'item', 'medicine')
    if (!name) continue

    let sku = pick(row, 'sku', 'code', 'item code')
    if (!sku) {
      sku = `${name
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w.slice(0, 3).toUpperCase())
        .join('')}-${Date.now().toString(36).slice(-3)}${index}`
    }

    const { data: existing } = await db()
      .from('pharmacy_products')
      .select('id')
      .eq('tenant_id', auth.tenantId)
      .eq('sku', sku)
      .maybeSingle()

    if (existing) {
      skipped.push(`${sku} (row ${index + 2})`)
      continue
    }

    const price = num(pick(row, 'price', 'mrp', 'selling price', 'rate'))
    const cost = num(pick(row, 'cost_price', 'cost', 'purchase price'))
    const quantity = Math.max(0, Math.floor(num(pick(row, 'quantity', 'qty', 'stock'))))
    const reorder = Math.max(
      0,
      Math.floor(num(pick(row, 'reorder_level', 'reorder')) || 10),
    )
    const category = pick(row, 'category', 'group') || 'General'
    const unit = pick(row, 'unit', 'uom', 'unit_of_measure') || 'Unit'
    const batchNumber = pick(row, 'batch', 'batch_number', 'lot') || null
    const expiryDate = pick(row, 'expiry', 'expiry_date', 'exp') || null

    const { data: product, error } = await db()
      .from('pharmacy_products')
      .insert({
        tenant_id: auth.tenantId,
        name,
        sku,
        category,
        price,
        cost_price: cost,
        quantity,
        reorder_level: reorder,
        unit_of_measure: unit,
        batch_number: batchNumber,
        expiry_date: expiryDate,
        is_active: true,
      })
      .select('id')
      .single()

    if (error || !product) {
      errors.push(`Row ${index + 2}: ${error?.message ?? 'insert failed'}`)
      continue
    }

    if (batchNumber && quantity > 0 && expiryDate) {
      await db().from('pharmacy_product_batches').insert({
        tenant_id: auth.tenantId,
        product_id: product.id,
        batch_number: batchNumber,
        quantity,
        initial_quantity: quantity,
        expiry_date: expiryDate,
        cost_price: cost,
        is_active: true,
      })
    }

    created += 1
  }

  await db().from('pharmacy_audit_logs').insert({
    tenant_id: auth.tenantId,
    profile_id: auth.userId,
    action: 'BULK_UPLOAD',
    entity: 'PRODUCT',
    entity_id: null,
    details: `Mobile CSV import: created ${created}, skipped ${skipped.length}, errors ${errors.length}`,
  })

  return NextResponse.json({
    ok: true,
    created,
    skipped: skipped.slice(0, 20),
    errors: errors.slice(0, 20),
  })
}
