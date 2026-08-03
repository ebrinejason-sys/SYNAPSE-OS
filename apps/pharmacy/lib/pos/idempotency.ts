import { supabaseAdmin } from "@/lib/supabase/admin"

const SCOPE = "pharmacy.pos.complete-sale"

export type IdempotentSaleRecord = {
  saleId: string | null
  response: unknown
}

/**
 * Look up a prior successful complete-sale for (tenant, key).
 * Returns null when the key is new or the table is unavailable.
 */
export async function findSaleIdempotency(
  tenantId: string,
  key: string,
): Promise<IdempotentSaleRecord | null> {
  const db = supabaseAdmin as any
  const { data, error } = await db
    .from("pharmacy_sale_idempotency")
    .select("sale_id, response_payload")
    .eq("tenant_id", tenantId)
    .eq("idempotency_key", key)
    .maybeSingle()

  if (error) {
    // Table may not be migrated yet — fail open without caching.
    console.warn("[pos] idempotency lookup skipped:", error.message)
    return null
  }
  if (!data) return null
  return {
    saleId: data.sale_id ?? null,
    response: data.response_payload,
  }
}

export async function storeSaleIdempotency(params: {
  tenantId: string
  key: string
  userId: string
  saleId: string | null
  response: unknown
}): Promise<void> {
  const db = supabaseAdmin as any
  const { error } = await db.from("pharmacy_sale_idempotency").upsert(
    {
      tenant_id: params.tenantId,
      idempotency_key: params.key,
      sale_id: params.saleId,
      response_payload: params.response,
      created_by: params.userId,
    },
    { onConflict: "tenant_id,idempotency_key", ignoreDuplicates: true },
  )
  if (error) {
    console.warn("[pos] idempotency store skipped:", error.message)
  }
}

/** Normalize Idempotency-Key header or body field. */
export function readIdempotencyKey(
  request: Request,
  body: Record<string, unknown> | null,
): string | null {
  const header =
    request.headers.get("idempotency-key")?.trim() ||
    request.headers.get("x-idempotency-key")?.trim()
  if (header && header.length <= 128) return header
  const fromBody = body?.idempotencyKey
  if (typeof fromBody === "string" && fromBody.trim() && fromBody.trim().length <= 128) {
    return fromBody.trim()
  }
  return null
}

export { SCOPE as POS_SALE_IDEMPOTENCY_SCOPE }
