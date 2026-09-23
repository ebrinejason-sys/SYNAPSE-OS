import { NextRequest, NextResponse } from "next/server"
import { requirePharmacyPermission } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { createPurchaseCatalogProduct, matchCatalogProducts } from "@synapse/db/pharmacy-purchases"

const db = () => supabaseAdmin as any

async function loadCatalog(tenantId: string) {
  const { data, error } = await db()
    .from("pharmacy_products")
    .select(
      "id, name, sku, barcode, generic_name, strength, dosage_form, manufacturer, price, cost_price, quantity, unit_of_measure, category, reorder_level",
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
  const matches = matchCatalogProducts({ q, barcode, sku, name: q, genericName: q }, rows, 12)
  return NextResponse.json({ matches })
}

export async function POST(request: NextRequest) {
  const auth = await requirePharmacyPermission(["purchasing.manage", "inventory.write"])
  if (!auth.ok) return auth.response
  const { session, tenantId } = auth
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const result = await createPurchaseCatalogProduct(db(), {
    tenantId,
    actorId: session.user.id,
    name: String(body.name ?? ""),
    genericName: (body.genericName as string | null) ?? null,
    brand: (body.brand as string | null) ?? null,
    strength: (body.strength as string | null) ?? null,
    dosageForm: (body.dosageForm as string | null) ?? null,
    unit: (body.unit as string | null) ?? (body.unitOfMeasure as string | null) ?? null,
    barcode: (body.barcode as string | null) ?? null,
    sku: (body.sku as string | null) ?? null,
    manufacturer: (body.manufacturer as string | null) ?? null,
    category: (body.category as string | null) ?? null,
    sellingPrice: body.sellingPrice != null ? Number(body.sellingPrice) : body.price != null ? Number(body.price) : 0,
    costPrice: body.costPrice != null ? Number(body.costPrice) : body.unitCost != null ? Number(body.unitCost) : 0,
    reorderLevel: body.reorderLevel != null ? Number(body.reorderLevel) : 10,
    expiryRequired: body.expiryRequired !== false,
    createAnyway: body.createAnyway === true,
    quantity: body.quantity,
  })

  if (!result.ok) {
    if (result.code === "DUPLICATE_PRODUCT") {
      return NextResponse.json(
        { error: result.error, code: result.code, candidates: result.candidates },
        { status: 409 },
      )
    }
    const status = result.code === "NAME_REQUIRED" || result.code === "SKU_EXISTS" ? 400 : 500
    return NextResponse.json({ error: result.error, code: result.code }, { status })
  }

  return NextResponse.json({ ok: true, product: result.product })
}
