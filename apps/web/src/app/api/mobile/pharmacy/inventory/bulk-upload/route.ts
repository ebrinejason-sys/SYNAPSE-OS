import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { validateImportRow } from '@synapse/db/import-validation'
import { receivePharmacyStock } from '@synapse/db/inventory-rpc'
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
 * Products are created at quantity 0; sellable stock only via receivePharmacyStock with genuine batches.
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
  let receivedBatches = 0
  const errors: string[] = []
  const warnings: string[] = []
  const skipped: string[] = []

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2
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
      skipped.push(`${sku} (row ${rowNumber})`)
      continue
    }

    const price = num(pick(row, 'price', 'mrp', 'selling price', 'rate'))
    const cost = num(pick(row, 'cost_price', 'cost', 'purchase price'))
    const quantityStr = pick(row, 'quantity', 'qty', 'stock')
    const reorder = Math.max(
      0,
      Math.floor(num(pick(row, 'reorder_level', 'reorder')) || 10),
    )
    const category = pick(row, 'category', 'group') || 'General'
    const unit = pick(row, 'unit', 'uom', 'unit_of_measure') || 'Unit'
    const batchNumber = pick(row, 'batch', 'batch_number', 'lot') || null
    const expiryDate = pick(row, 'expiry', 'expiry_date', 'exp') || null

    const validation = validateImportRow(
      {
        name,
        sku,
        price,
        costPrice: cost,
        quantity: quantityStr,
        batchNumber,
        expiryDate,
      },
      rowNumber,
    )

    errors.push(...validation.errors)
    warnings.push(...validation.warnings)

    if (!validation.productOk) continue

    const { data: product, error } = await db()
      .from('pharmacy_products')
      .insert({
        tenant_id: auth.tenantId,
        name,
        sku,
        category,
        price,
        cost_price: cost,
        quantity: 0,
        reorder_level: reorder,
        unit_of_measure: unit,
        batch_number: validation.batch?.batchNumber ?? null,
        expiry_date: validation.batch?.expiryDate ?? null,
        is_active: true,
      })
      .select('id')
      .single()

    if (error || !product) {
      errors.push(`Row ${rowNumber}: ${error?.message ?? 'insert failed'}`)
      continue
    }

    created += 1

    if (validation.batch) {
      const { error: receiveError } = await receivePharmacyStock(db(), {
        tenantId: auth.tenantId,
        productId: product.id,
        batchNumber: validation.batch.batchNumber,
        quantity: validation.batch.quantity,
        expiryDate: validation.batch.expiryDate,
        costPrice: cost,
        sellingPrice: price,
        receivedBy: auth.userId,
        reason: 'Mobile bulk import receive',
      })
      if (receiveError) {
        warnings.push(
          `Row ${rowNumber}: product created but stock not received — ${receiveError.humanMessage}`,
        )
      } else {
        receivedBatches += 1
      }
    }
  }

  await db().from('pharmacy_audit_logs').insert({
    tenant_id: auth.tenantId,
    profile_id: auth.userId,
    action: 'BULK_UPLOAD',
    entity: 'PRODUCT',
    entity_id: null,
    details: `Mobile CSV import: created ${created}, received ${receivedBatches}, skipped ${skipped.length}, errors ${errors.length}`,
  })

  return NextResponse.json({
    ok: true,
    created,
    receivedBatches,
    skipped: skipped.slice(0, 20),
    errors: errors.slice(0, 40),
    warnings: warnings.slice(0, 40),
  })
}
