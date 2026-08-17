import { NextRequest, NextResponse } from "next/server"
import { requirePharmacyPermission } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { logAudit } from "@synapse/db"

const STORE_TYPES = new Set(["main", "satellite", "dispensary", "warehouse", "branch"])

function mapStore(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    storeType: String(row.store_type ?? "main"),
    isActive: Boolean(row.is_active ?? true),
    isWarehouse: Boolean(row.is_warehouse ?? false),
    parentStoreId: (row.parent_store_id as string | null) ?? null,
    address: (row.address as string | null) ?? null,
    district: (row.district as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    createdAt: (row.created_at as string | null) ?? null,
  }
}

export async function GET() {
  const auth = await requirePharmacyPermission(["settings.manage", "staff.manage", "inventory.read", "pos.sell"])
  if (!auth.ok) return auth.response
  const { tenantId } = auth

  const { data, error } = await (supabaseAdmin as any)
    .from("pharmacy_stores")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data ?? []).map((row: Record<string, unknown>) => mapStore(row)))
}

export async function POST(request: NextRequest) {
  const auth = await requirePharmacyPermission("settings.manage")
  if (!auth.ok) return auth.response
  const { session, tenantId } = auth

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const name = String(body.name ?? "").trim()
  if (!name) return NextResponse.json({ error: "Branch name is required" }, { status: 400 })

  const storeTypeRaw = String(body.storeType ?? "satellite").toLowerCase()
  const storeType = STORE_TYPES.has(storeTypeRaw) ? storeTypeRaw : "satellite"

  const { data, error } = await (supabaseAdmin as any)
    .from("pharmacy_stores")
    .insert({
      tenant_id: tenantId,
      name,
      store_type: storeType,
      is_active: true,
      is_warehouse: storeType === "warehouse",
      parent_store_id: body.parentStoreId ?? null,
      address: body.address ?? null,
      district: body.district ?? null,
      phone: body.phone ?? null,
    })
    .select("*")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit({
    actor_id: session.userId,
    action: "CREATE_PHARMACY_BRANCH",
    resource_type: "pharmacy_store",
    resource_id: data.id,
    tenant_id: tenantId,
    after_state: { name, storeType },
    app_surface: "pharmacy",
  })

  return NextResponse.json(mapStore(data as Record<string, unknown>), { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const auth = await requirePharmacyPermission("settings.manage")
  if (!auth.ok) return auth.response
  const { session, tenantId } = auth

  const body = await request.json().catch(() => null)
  if (!body?.id) return NextResponse.json({ error: "id is required" }, { status: 400 })

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.name === "string") patch.name = body.name.trim()
  if (typeof body.isActive === "boolean") patch.is_active = body.isActive
  if (typeof body.address === "string") patch.address = body.address
  if (typeof body.district === "string") patch.district = body.district
  if (typeof body.phone === "string") patch.phone = body.phone
  if (typeof body.storeType === "string" && STORE_TYPES.has(body.storeType.toLowerCase())) {
    patch.store_type = body.storeType.toLowerCase()
    patch.is_warehouse = body.storeType.toLowerCase() === "warehouse"
  }

  const { data, error } = await (supabaseAdmin as any)
    .from("pharmacy_stores")
    .update(patch)
    .eq("id", body.id)
    .eq("tenant_id", tenantId)
    .select("*")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await logAudit({
    actor_id: session.userId,
    action: "UPDATE_PHARMACY_BRANCH",
    resource_type: "pharmacy_store",
    resource_id: String(body.id),
    tenant_id: tenantId,
    app_surface: "pharmacy",
  })

  return NextResponse.json(mapStore(data as Record<string, unknown>))
}
