import { NextRequest, NextResponse } from "next/server"
import { requireCapability } from "@/lib/pharmacy-context"
import { httpStatusForPharmacyError } from "@synapse/db/errors"
import { recordCashMovement } from "@/lib/pos/till-service"

export async function POST(request: NextRequest) {
  const auth = await requireCapability("shift.open_close")
  if (!auth.ok) return auth.response
  const body = await request.json().catch(() => null)
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : ""
  const kind = body?.kind === "out" ? "out" : body?.kind === "in" ? "in" : null
  if (!sessionId || !kind) {
    return NextResponse.json({ error: "sessionId and kind (in|out) are required" }, { status: 400 })
  }
  const result = await recordCashMovement({
    tenantId: auth.tenantId,
    cashierId: auth.session.userId,
    sessionId,
    kind,
    amount: Number(body?.amount),
    reason: typeof body?.reason === "string" ? body.reason : null,
  })
  if (!result.ok) {
    return NextResponse.json(result.error, { status: httpStatusForPharmacyError(result.error.code) })
  }
  return NextResponse.json({ ok: true, session: result.session })
}
