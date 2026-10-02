import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/admin"

/** Trimmed barcode, or null when blank (blank never collides). */
export function normalizeBarcode(value: unknown): string | null {
  if (value === undefined || value === null) return null
  const v = String(value).trim()
  return v.length > 0 ? v.slice(0, 128) : null
}

/**
 * Barcodes must be unique within a pharmacy so a scan resolves to one product.
 * Mirrors the proposed partial unique index (tenant_id, btrim(barcode)).
 */
export async function duplicateBarcodeResponse(
  tenantId: string,
  barcode: string | null,
  excludeProductId?: string,
): Promise<NextResponse | null> {
  if (!barcode) return null
  let q = (supabaseAdmin as any)
    .from("pharmacy_products")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .eq("barcode", barcode)
  if (excludeProductId) q = q.neq("id", excludeProductId)
  const { data } = await q.limit(1)
  const hit = Array.isArray(data) ? data[0] : data
  if (!hit) return null
  return NextResponse.json(
    { error: `Barcode ${barcode} is already used by another product (${hit.name ?? "existing product"}).`, code: "DUPLICATE_BARCODE" },
    { status: 409 },
  )
}
