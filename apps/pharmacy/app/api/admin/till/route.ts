import { NextRequest, NextResponse } from "next/server"
import { requireCapability } from "@/lib/pharmacy-context"
import { getOpenTill, presentTill } from "@/lib/pos/till-service"
import { supabaseAdmin } from "@synapse/db/admin"

export async function GET(request: NextRequest) {
  const auth = await requireCapability(["shift.view_own", "shift.open_close", "pos.sell"])
  if (!auth.ok) return auth.response

  const sessionId = request.nextUrl.searchParams.get("sessionId")
  if (sessionId) {
    const { data } = await (supabaseAdmin as any)
      .from("pharmacy_cashier_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("tenant_id", auth.tenantId)
      .maybeSingle()
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (data.cashier_id !== auth.session.userId && !auth.session.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    return NextResponse.json({ session: presentTill(data) })
  }

  const open = await getOpenTill({ tenantId: auth.tenantId, cashierId: auth.session.userId })
  return NextResponse.json({ session: open ? presentTill(open) : null })
}
