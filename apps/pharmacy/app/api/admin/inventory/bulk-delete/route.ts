import { NextRequest, NextResponse } from "next/server"
import { requirePharmacyAdmin } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase/admin"

export async function DELETE(request: NextRequest) {
  const auth = await requirePharmacyAdmin()
  if (!auth.ok) return auth.response
  const { session, tenantId } = auth

  const body = await request.json().catch(() => ({}))
  const productIds: string[] = Array.isArray(body.productIds) ? body.productIds : []

  if (productIds.length === 0) {
    return NextResponse.json({ error: "No product IDs provided" }, { status: 400 })
  }

  // Verify all products belong to this tenant before deleting
  const { data: products, error: fetchError } = await (supabaseAdmin as any)
    .from("pharmacy_products")
    .select("id")
    .eq("tenant_id", tenantId)
    .in("id", productIds)

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })

  const validIds = ((products ?? []) as { id: string }[]).map((p) => p.id)
  if (validIds.length === 0) {
    return NextResponse.json({ error: "No matching products found for this tenant" }, { status: 404 })
  }

  const { error: deleteError } = await (supabaseAdmin as any)
    .from("pharmacy_products")
    .delete()
    .eq("tenant_id", tenantId)
    .in("id", validIds)

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  await (supabaseAdmin as any).from("pharmacy_audit_logs").insert({
    tenant_id: tenantId,
    profile_id: session.user.id,
    action: "BULK_DELETE_PRODUCTS",
    entity: "PRODUCT",
    entity_id: null,
    details: `Bulk deleted ${validIds.length} products`,
  })

  return NextResponse.json({ success: true, deleted: validIds.length })
}
