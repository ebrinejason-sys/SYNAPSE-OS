import { NextRequest, NextResponse } from 'next/server'
import { gateFeature } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'
import {
  isMobileAuth,
  isMobilePharmacyAdmin,
  requireMobilePharmacyAuth,
} from '../../../../../../lib/mobile-pharmacy-auth'
import {
  findSaleIdempotency,
  readIdempotencyKey,
  storeSaleIdempotency,
} from '../../../../../../lib/pharmacy-pos/idempotency'
import {
  extractSaleErrorCode,
  friendlySaleError,
  saleErrorHttpStatus,
  validateSaleLine,
  type SaleLineInput,
} from '../../../../../../lib/pharmacy-pos/sale-validation'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any

/**
 * Complete a POS sale via live `complete_pharmacy_sale` RPC (same as pharmacy portal).
 * Cashier = authenticated mobile user. Catalog list prices enforced server-side.
 */
export async function POST(req: NextRequest) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth

  const gate = await gateFeature(auth.tenantId, 'pos.sell')
  if (gate) return gate

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const idempotencyKey = readIdempotencyKey(req, body)
  if (idempotencyKey) {
    const prior = await findSaleIdempotency(auth.tenantId, idempotencyKey)
    if (prior) {
      return NextResponse.json(
        { ok: true, sale: prior.response, idempotentReplay: true },
        { status: 200, headers: { 'X-Idempotent-Replay': 'true' } },
      )
    }
  }

  const itemsIn = Array.isArray(body.items) ? (body.items as SaleLineInput[]) : []
  if (itemsIn.length === 0) {
    return NextResponse.json({ error: 'Cart is empty' }, { status: 400 })
  }

  const paymentMethod =
    typeof body.paymentMethod === 'string' ? body.paymentMethod.trim() : ''
  if (!paymentMethod) {
    return NextResponse.json({ error: 'paymentMethod is required' }, { status: 400 })
  }

  const { data: settings } = await db()
    .from('pharmacy_settings')
    .select('discount_approval_threshold_pct')
    .eq('tenant_id', auth.tenantId)
    .maybeSingle()

  const threshold = Number(settings?.discount_approval_threshold_pct ?? 5)
  const approvedBy =
    typeof body.discountApprovedBy === 'string' && body.discountApprovedBy
      ? body.discountApprovedBy
      : null

  const isAdmin = isMobilePharmacyAdmin(auth)
  const rpcItems: Record<string, unknown>[] = []

  for (const raw of itemsIn) {
    const productId = String(raw.productId ?? '')
    const { data: product } = await db()
      .from('pharmacy_products')
      .select('id, price, name, is_active')
      .eq('id', productId)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle()

    const validated = validateSaleLine({
      raw,
      product: product
        ? { id: product.id, price: Number(product.price ?? 0), is_active: product.is_active }
        : null,
      thresholdPct: threshold,
      isAdmin,
      actorUserId: auth.userId,
      approvedBy,
    })

    if (!validated.ok) {
      return NextResponse.json(
        {
          error: validated.error,
          ...(validated.code ? { code: validated.code } : {}),
          ...(validated.threshold != null ? { threshold: validated.threshold } : {}),
        },
        { status: validated.status },
      )
    }

    rpcItems.push(validated.rpcItem)
  }

  // Line discounts are already on each rpc item. Passing the same sum as
  // p_discount_total double-counts inside complete_pharmacy_sale.
  const { data, error } = await db().rpc('complete_pharmacy_sale', {
    p_tenant_id: auth.tenantId,
    p_cashier_id: auth.userId,
    p_items: rpcItems,
    p_payment_method: paymentMethod,
    p_session_id: body.sessionId ?? null,
    p_cart_id: body.cartId ?? null,
    p_payment_ref: body.paymentRef ?? null,
    p_discount_total: 0,
    p_tax_amount: Number(body.taxAmount ?? 0),
    p_patient_id: body.patientId ?? null,
    p_confirmed_by: auth.userId,
    ...(idempotencyKey ? { p_idempotency_key: idempotencyKey } : {}),
  })

  if (error) {
    const msg = error.message ?? 'Sale failed'
    return NextResponse.json(
      {
        error: friendlySaleError(msg),
        code: extractSaleErrorCode(msg),
      },
      { status: saleErrorHttpStatus(msg) },
    )
  }

  const responseBody = { ok: true as const, sale: data, lowStock: [] as Array<{
    id: string
    name: string
    quantity: number
    reorderLevel: number
  }> }

  // Surface reorder crossings in the response (also pushed async below).
  try {
    const productIds = [...new Set(rpcItems.map((i) => String(i.product_id)))]
    if (productIds.length > 0) {
      const { data: products } = await db()
        .from('pharmacy_products')
        .select('id, name, quantity, reorder_level')
        .eq('tenant_id', auth.tenantId)
        .in('id', productIds)
      responseBody.lowStock = (products ?? [])
        .filter(
          (p: { quantity?: number; reorder_level?: number }) =>
            Number(p.reorder_level ?? 0) > 0 &&
            Number(p.quantity ?? 0) <= Number(p.reorder_level ?? 0),
        )
        .map((p: { id: string; name: string; quantity?: number; reorder_level?: number }) => ({
          id: p.id,
          name: p.name,
          quantity: Number(p.quantity ?? 0),
          reorderLevel: Number(p.reorder_level ?? 0),
        }))
    }
  } catch {
    // non-fatal
  }

  if (idempotencyKey) {
    const saleId =
      data && typeof data === 'object'
        ? String(
            (data as { sale_id?: unknown; id?: unknown }).sale_id ??
              (data as { id?: unknown }).id ??
              '',
          ) || null
        : null
    await storeSaleIdempotency({
      tenantId: auth.tenantId,
      key: idempotencyKey,
      userId: auth.userId,
      saleId,
      response: data,
    })
  }

  void (async () => {
    try {
      const productIds = [...new Set(rpcItems.map((i) => String(i.product_id)))]
      if (productIds.length === 0) return
      const { data: products } = await db()
        .from('pharmacy_products')
        .select('id, name, quantity, reorder_level')
        .eq('tenant_id', auth.tenantId)
        .in('id', productIds)
      const low = (products ?? []).filter(
        (p: { quantity?: number; reorder_level?: number }) =>
          Number(p.reorder_level ?? 0) > 0 &&
          Number(p.quantity ?? 0) <= Number(p.reorder_level ?? 0),
      )
      if (low.length === 0) return
      const { notifyPharmacyStock } = await import('@synapse/auth/mobile-push')
      for (const p of low.slice(0, 5)) {
        notifyPharmacyStock({
          tenantId: auth.tenantId,
          productName: p.name,
          reason: 'reorder',
          detail: `${p.name} is at ${p.quantity} (reorder ${p.reorder_level}).`,
        })
      }
    } catch (err) {
      console.error('[mobile/pos] reorder push failed:', err)
    }
  })()

  return NextResponse.json(responseBody)
}
