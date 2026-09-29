import { supabaseAdmin } from "@/lib/supabase/admin"

/**
 * True when `id` is a row of `table` owned by `tenantId`. Use before persisting
 * any client-supplied foreign key (customerId, supplierId, transactionId, ...)
 * so a tenant cannot reference — and later read back through joins — another
 * tenant's records. Service-role queries bypass RLS, so this check is the gate.
 */
export async function tenantOwnsRecord(
  table: string,
  tenantId: string,
  id: unknown,
  tenantColumn = "tenant_id",
): Promise<boolean> {
  if (typeof id !== "string" || id.trim().length === 0) return false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabaseAdmin as any)
    .from(table)
    .select("id")
    .eq("id", id)
    .eq(tenantColumn, tenantId)
    .maybeSingle()
  return Boolean(data)
}
