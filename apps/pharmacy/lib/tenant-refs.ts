import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/admin"

/**
 * Tenant-ownership check for foreign keys supplied by the client.
 * A supplier / purchase order / store id from another pharmacy is reported as
 * "not found" (404) so tenant B's ids are neither usable nor enumerable.
 */
export type TenantRefs = {
  supplierId?: unknown
  purchaseOrderId?: unknown
  storeId?: unknown
}

const TABLES: Record<keyof TenantRefs, { table: string; label: string }> = {
  supplierId: { table: "pharmacy_suppliers", label: "Supplier" },
  purchaseOrderId: { table: "pharmacy_purchase_orders", label: "Purchase order" },
  storeId: { table: "pharmacy_stores", label: "Store" },
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function tenantRefsNotFound(tenantId: string, refs: TenantRefs): Promise<NextResponse | null> {
  for (const key of Object.keys(TABLES) as Array<keyof TenantRefs>) {
    const value = refs[key]
    if (value === undefined || value === null || value === "") continue
    const { table, label } = TABLES[key]
    if (typeof value !== "string" || !UUID.test(value)) {
      return NextResponse.json({ error: `${label} not found`, code: `${key.replace(/Id$/, "").toUpperCase()}_NOT_FOUND` }, { status: 404 })
    }
    const { data } = await (supabaseAdmin as any)
      .from(table)
      .select("id")
      .eq("id", value)
      .eq("tenant_id", tenantId)
      .maybeSingle()
    if (!data) {
      return NextResponse.json({ error: `${label} not found`, code: `${key.replace(/Id$/, "").toUpperCase()}_NOT_FOUND` }, { status: 404 })
    }
  }
  return null
}
