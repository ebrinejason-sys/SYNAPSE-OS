import { NextRequest, NextResponse } from "next/server"
import { requirePharmacyPermission } from "@/lib/api-auth"
import { requireStoreScope } from "@/lib/pharmacy-context"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { receivePharmacyStockTransfer, type PharmacyRpcError } from "@synapse/db/inventory-rpc"
import { logAudit } from "@synapse/db"

const db = () => supabaseAdmin as any

function rpcFail(err: PharmacyRpcError, status = 400) {
  return NextResponse.json(
    { error: err.humanMessage, code: err.code, detail: err.message },
    { status },
  )
}

/**
 * POST /api/admin/transfers/:id/receive
 *
 * Executes the in_transit -> received transition: re-creates/tops-up the
 * genuine source batch (batch_number + expiry_date + cost_price) at the
 * transfer's to_store_id via the receive_pharmacy_stock_transfer RPC.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requirePharmacyPermission("inventory.adjust")
    if (!auth.ok) return auth.response
    const { session, tenantId } = auth
    const { id } = await params

    const { data: transfer, error: lookupError } = await db()
      .from("pharmacy_stock_transfers")
      .select("id, status, from_store_id, to_store_id")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .maybeSingle()

    if (lookupError) {
      if (String(lookupError.message).toLowerCase().includes("does not exist")) {
        return NextResponse.json(
          { error: "Stock transfers require the network identity migration" },
          { status: 503 },
        )
      }
      return NextResponse.json({ error: lookupError.message }, { status: 500 })
    }
    if (!transfer) {
      return NextResponse.json({ error: "Transfer not found" }, { status: 404 })
    }

    const scoped = requireStoreScope(
      { ...auth, storeId: session.storeId ?? null },
      transfer.to_store_id,
    )
    if (!scoped.ok) return scoped.response

    const { data, error } = await receivePharmacyStockTransfer(db(), {
      tenantId,
      transferId: id,
      actorId: session.userId,
    })

    if (error) {
      return rpcFail(error)
    }

    await logAudit({
      actor_id: session.userId,
      action: "RECEIVE_STOCK_TRANSFER",
      resource_type: "pharmacy_stock_transfer",
      resource_id: id,
      tenant_id: tenantId,
      after_state: { ...data },
      app_surface: "pharmacy",
    })

    return NextResponse.json({ ok: true, ...data })
  } catch (error) {
    console.error("Receive stock transfer error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
