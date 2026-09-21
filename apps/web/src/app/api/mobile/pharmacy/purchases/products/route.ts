import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@synapse/db/admin"
import {
  createPurchaseCatalogProduct,
  matchCatalogProducts,
} from "@synapse/db/pharmacy-purchases"
import {
  isMobileAuth,
  mobileHasPharmacyCapability,
  requireMobilePharmacyAuth,
} from "../../../../../../lib/mobile-pharmacy-auth"

export const dynamic = "force-dynamic"

const db = () => supabaseAdmin as any

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

export async function GET(req: NextRequest) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth
  if (
    !mobileHasPharmacyCapability(auth, "purchasing.manage") &&
    !mobileHasPharmacyCapability(auth, "inventory.read")
  ) {
    return NextResponse.json({ error: "Purchasing permission required" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q") ?? ""
  const barcode = searchParams.get("barcode")
  const sku = searchParams.get("sku")
  const rows = await loadCatalog(auth.tenantId)
  const matches = matchCatalogProducts({ q, barcode, sku, name: q, genericName: q }, rows, 12)
  return NextResponse.json({ matches })
}

export async function POST(req: NextRequest) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth
  if (
    !mobileHasPharmacyCapability(auth, "purchasing.manage") ||
    !mobileHasPharmacyCapability(auth, "inventory.write")
  ) {
    return NextResponse.json({ error: "Purchasing permission required" }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const result = await createPurchaseCatalogProduct(db(), {
    tenantId: auth.tenantId,
    actorId: auth.userId,
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
    costPrice: body.costPrice != null ? Number(body.costPrice) : 0,
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
