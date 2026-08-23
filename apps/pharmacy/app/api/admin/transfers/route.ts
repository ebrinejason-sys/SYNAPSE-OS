import { NextRequest, NextResponse } from "next/server"
import { requirePharmacyPermission } from "@/lib/api-auth"
import { requireStoreScope } from "@/lib/pharmacy-context"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { logAudit } from "@synapse/db"

export async function GET() {
  const auth = await requirePharmacyPermission(["inventory.read", "inventory.write", "reports.operational"])
  if (!auth.ok) return auth.response
  const { tenantId } = auth

  const { data, error } = await (supabaseAdmin as any)
    .from("pharmacy_stock_transfers")
    .select("*, pharmacy_stock_transfer_items(*)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) {
    if (String(error.message).toLowerCase().includes("does not exist")) {
      return NextResponse.json([])
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const auth = await requirePharmacyPermission("inventory.write")
  if (!auth.ok) return auth.response
  const { session, tenantId } = auth

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const fromStoreId = String(body.fromStoreId ?? "")
  const toStoreId = String(body.toStoreId ?? "")
  const items = Array.isArray(body.items) ? body.items : []
  if (!fromStoreId || !toStoreId || fromStoreId === toStoreId) {
    return NextResponse.json({ error: "fromStoreId and toStoreId must be different stores" }, { status: 400 })
  }
  const scoped = requireStoreScope(
    { ...auth, storeId: auth.session.storeId ?? null },
    fromStoreId,
    { required: true },
  )
  if (!scoped.ok) return scoped.response
  if (items.length === 0) {
    return NextResponse.json({ error: "Transfer items are required" }, { status: 400 })
  }

  const db = supabaseAdmin as any
  const { data: stores, error: storeError } = await db
    .from("pharmacy_stores")
    .select("id")
    .eq("tenant_id", tenantId)
    .in("id", [fromStoreId, toStoreId])
  if (storeError) return NextResponse.json({ error: storeError.message }, { status: 500 })
  if ((stores ?? []).length !== 2) {
    return NextResponse.json({ error: "Both stores must belong to this pharmacy" }, { status: 404 })
  }

  const { data: transfer, error } = await db
    .from("pharmacy_stock_transfers")
    .insert({
      tenant_id: tenantId,
      from_store_id: fromStoreId,
      to_store_id: toStoreId,
      status: "draft",
      requested_by: session.userId,
      notes: body.notes ?? null,
    })
    .select("*")
    .single()

  if (error) {
    if (String(error.message).toLowerCase().includes("does not exist")) {
      return NextResponse.json(
        { error: "Stock transfers require the network identity migration" },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = items.map((item: { productId?: string; fromBatchId?: string; quantity?: number }) => ({
    transfer_id: transfer.id,
    product_id: item.productId,
    from_batch_id: item.fromBatchId ?? null,
    quantity: Number(item.quantity ?? 0),
  }))
  if (rows.some((r: { product_id?: string; quantity: number }) => !r.product_id || r.quantity <= 0)) {
    await db.from("pharmacy_stock_transfers").delete().eq("id", transfer.id)
    return NextResponse.json({ error: "Each item needs productId and quantity > 0" }, { status: 400 })
  }

  const { error: itemError } = await db.from("pharmacy_stock_transfer_items").insert(rows)
  if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 })

  await logAudit({
    actor_id: session.userId,
    action: "CREATE_STOCK_TRANSFER",
    resource_type: "pharmacy_stock_transfer",
    resource_id: transfer.id,
    tenant_id: tenantId,
    app_surface: "pharmacy",
  })

  return NextResponse.json({ ok: true, transfer }, { status: 201 })
}
