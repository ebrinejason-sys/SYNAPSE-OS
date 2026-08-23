import { NextResponse } from "next/server"
import { requirePharmacyPermission } from "@/lib/api-auth"
import { supabaseAdmin } from "@synapse/db/admin"
import { reconcileProductStore } from "@/lib/inventory/reconciliation"

export async function GET() {
  const auth = await requirePharmacyPermission(["inventory.read", "reports.operational"])
  if (!auth.ok) return auth.response

  const { data: batches, error } = await (supabaseAdmin as any)
    .from("pharmacy_product_batches")
    .select("id, product_id, store_id, quantity, status, expiry_date")
    .eq("tenant_id", auth.tenantId)
    .limit(5000)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const grouped = new Map<string, Array<{ quantity: number; status?: string | null; expiryDate?: string | null }>>()
  for (const batch of batches ?? []) {
    const key = `${batch.product_id}:${batch.store_id ?? "main"}`
    const list = grouped.get(key) ?? []
    list.push({
      quantity: Number(batch.quantity ?? 0),
      status: batch.status,
      expiryDate: batch.expiry_date,
    })
    grouped.set(key, list)
  }

  const rows = [...grouped.entries()].map(([key, list]) => {
    const [productId, storeId] = key.split(":")
    return reconcileProductStore({
      productId,
      storeId: storeId === "main" ? null : storeId,
      batches: list,
    })
  })
  const issues = rows.filter((row) => row.issues.length > 0)
  return NextResponse.json({
    ok: true,
    checked: rows.length,
    issueCount: issues.length,
    issues: issues.slice(0, 200),
    note: "Read-only integrity check. Never auto-fixes stock.",
  })
}
