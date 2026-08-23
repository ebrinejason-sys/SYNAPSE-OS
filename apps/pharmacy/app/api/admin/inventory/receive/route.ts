import { NextRequest, NextResponse } from "next/server"
import { requirePharmacyPermission } from "@/lib/api-auth"
import { requireStoreScope } from "@/lib/pharmacy-context"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { receivePharmacyStock, parsePharmacyRpcError } from "@synapse/db/inventory-rpc"

const db = () => supabaseAdmin as any

/**
 * POST /api/admin/inventory/receive
 * Authoritative receive-stock transaction (single product/batch).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePharmacyPermission("inventory.adjust")
    if (!auth.ok) return auth.response
    const { session, tenantId } = auth

    const body = (await request.json()) as {
      productId?: string
      batchNumber?: string
      quantity?: number
      expiryDate?: string
      costPrice?: number
      sellingPrice?: number
      supplierId?: string
      supplierRef?: string
      purchaseOrderId?: string
      storeId?: string
      reason?: string
    }

    const scoped = requireStoreScope(
      { ...auth, storeId: session.storeId ?? null },
      body.storeId ?? session.storeId ?? null,
    )
    if (!scoped.ok) return scoped.response

    if (!body.productId || !body.batchNumber?.trim() || !body.quantity || !body.expiryDate) {
      return NextResponse.json(
        {
          error:
            "productId, batchNumber, quantity, and expiryDate are required to receive stock.",
          code: "REQUIRES_BATCH",
        },
        { status: 400 },
      )
    }

    const { data, error } = await receivePharmacyStock(db(), {
      tenantId,
      productId: body.productId,
      batchNumber: body.batchNumber,
      quantity: Number(body.quantity),
      expiryDate: body.expiryDate,
      costPrice: body.costPrice ?? null,
      sellingPrice: body.sellingPrice ?? null,
      receivedBy: session.user.id,
      supplierId: body.supplierId ?? null,
      supplierRef: body.supplierRef ?? null,
      purchaseOrderId: body.purchaseOrderId ?? null,
      storeId: scoped.storeId,
      reason: body.reason ?? "Stock received",
    })

    if (error) {
      return NextResponse.json(
        { error: error.humanMessage, code: error.code, detail: error.message },
        { status: 400 },
      )
    }

    return NextResponse.json({ ok: true, ...data })
  } catch (error) {
    console.error("Receive stock error:", error)
    const parsed = parsePharmacyRpcError((error as Error)?.message)
    return NextResponse.json({ error: parsed.humanMessage, code: parsed.code }, { status: 500 })
  }
}
