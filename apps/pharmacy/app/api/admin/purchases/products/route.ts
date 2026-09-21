import { NextRequest, NextResponse } from "next/server"
import { requirePharmacyPermission } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase/admin"
import {
  findDuplicateProducts,
  generateProductSku,
  rankProductMatches,
  type CatalogProduct,
} from "@synapse/db/pharmacy-purchases"
import { catalogueOpeningQuantity } from "@/lib/inventory/catalogue-write"

const db = () => supabaseAdmin as any

function toCatalog(row: Record<string, unknown>): CatalogProduct {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    sku: (row.sku as string | null) ?? null,
    barcode: (row.barcode as string | null) ?? null,
    genericName: (row.generic_name as string | null) ?? null,
    brandName: (row.name as string | null) ?? null,
    strength: (row.strength as string | null) ?? null,
    dosageForm: (row.dosage_form as string | null) ?? null,
    manufacturer: (row.manufacturer as string | null) ?? null,
    price: row.price != null ? Number(row.price) : null,
    costPrice: row.cost_price != null ? Number(row.cost_price) : null,
  }
}

async function loadCatalog(tenantId: string) {
  const { data, error } = await db()
    .from("pharmacy_products")
    .select(
      "id, name, sku, barcode, generic_name, strength, dosage_form, manufacturer, price, cost_price, unit_of_measure, category, reorder_level",
    )
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .limit(2000)
  if (error) throw error
  return (data ?? []) as Array<Record<string, unknown>>
}

export async function GET(request: NextRequest) {
  const auth = await requirePharmacyPermission(["purchasing.manage", "inventory.read"])
  if (!auth.ok) return auth.response
  const { tenantId } = auth
  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q") ?? ""
  const barcode = searchParams.get("barcode")
  const sku = searchParams.get("sku")
  const rows = await loadCatalog(tenantId)
  const matches = rankProductMatches(
    { q, barcode, sku, name: q, genericName: q },
    rows.map(toCatalog),
    12,
  )
  return NextResponse.json({
    matches: matches.map((m) => ({
      ...m,
      existing: true,
    })),
  })
}

export async function POST(request: NextRequest) {
  const auth = await requirePharmacyPermission(["purchasing.manage", "inventory.write"])
  if (!auth.ok) return auth.response
  const { session, tenantId } = auth
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  const name = String(body.name ?? "").trim()
  if (!name) return NextResponse.json({ error: "Product name is required" }, { status: 400 })

  const rows = await loadCatalog(tenantId)
  const candidates = findDuplicateProducts(
    {
      q: name,
      name,
      genericName: (body.genericName as string | null) ?? null,
      brandName: (body.brand as string | null) ?? name,
      barcode: (body.barcode as string | null) ?? null,
      sku: (body.sku as string | null) ?? null,
      strength: (body.strength as string | null) ?? null,
      dosageForm: (body.dosageForm as string | null) ?? null,
      manufacturer: (body.manufacturer as string | null) ?? null,
    },
    rows.map(toCatalog),
  )

  if (candidates.length > 0 && body.createAnyway !== true) {
    return NextResponse.json(
      {
        error: "A similar product already exists.",
        code: "DUPLICATE_PRODUCT",
        candidates,
      },
      { status: 409 },
    )
  }

  const sku = String(body.sku ?? "").trim() || generateProductSku()
  const { data: existingSku } = await db()
    .from("pharmacy_products")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("sku", sku)
    .maybeSingle()
  if (existingSku) {
    return NextResponse.json({ error: "Product with this SKU already exists" }, { status: 400 })
  }

  const { data: product, error } = await db()
    .from("pharmacy_products")
    .insert({
      tenant_id: tenantId,
      name,
      sku,
      barcode: String(body.barcode ?? "").trim() || null,
      category: String(body.category ?? "General"),
      price: Number(body.price ?? body.sellingPrice ?? 0),
      cost_price: Number(body.costPrice ?? 0),
      quantity: catalogueOpeningQuantity(body.quantity),
      reorder_level: Number(body.reorderLevel ?? 10),
      unit_of_measure: String(body.unit ?? body.unitOfMeasure ?? "Tablet"),
      manufacturer: String(body.manufacturer ?? "").trim() || null,
      strength: String(body.strength ?? "").trim() || null,
      dosage_form: String(body.dosageForm ?? "").trim() || null,
      generic_name: String(body.genericName ?? "").trim() || null,
      expiry_required: body.expiryRequired === false ? false : true,
    })
    .select()
    .single()

  if (error || !product) {
    return NextResponse.json({ error: error?.message ?? "Failed to create product" }, { status: 500 })
  }

  await db().from("pharmacy_audit_logs").insert({
    tenant_id: tenantId,
    profile_id: session.user.id,
    action: body.createAnyway === true ? "product.created_duplicate_override" : "product.created_from_purchase",
    entity: "PRODUCT",
    entity_id: product.id,
    details: JSON.stringify({
      name,
      sku,
      barcode: product.barcode,
      duplicateOverride: body.createAnyway === true,
      candidates: candidates.map((c) => ({ id: c.id, name: c.name, score: c.score })),
    }),
  })

  return NextResponse.json({
    ok: true,
    product: {
      id: product.id,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      price: Number(product.price ?? 0),
      costPrice: product.cost_price != null ? Number(product.cost_price) : null,
      genericName: product.generic_name,
      strength: product.strength,
      dosageForm: product.dosage_form,
      manufacturer: product.manufacturer,
    },
  })
}
