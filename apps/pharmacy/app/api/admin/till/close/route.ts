import { NextRequest, NextResponse } from "next/server"
import { requireCapability } from "@/lib/pharmacy-context"
import { sessionHasCapability } from "@/lib/capabilities"
import { httpStatusForPharmacyError } from "@synapse/db/errors"
import { closeTill } from "@/lib/pos/till-service"

export async function POST(request: NextRequest) {
  const auth = await requireCapability(["shift.open_close", "shift.approve_variance"])
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : ""
  if (!sessionId) return NextResponse.json({ error: "sessionId is required" }, { status: 400 })

  const countedCash = Number(body?.countedCash)
  const varianceReason = typeof body?.varianceReason === "string" ? body.varianceReason : null
  const result = await closeTill({
    tenantId: auth.tenantId,
    cashierId: typeof body?.cashierId === "string" ? body.cashierId : auth.session.userId,
    sessionId,
    countedCash,
    varianceReason,
    notes: typeof body?.notes === "string" ? body.notes : null,
    closerId: auth.session.userId,
  })
  if (!result.ok) {
    if (
      result.error.code === "TILL_VARIANCE_REQUIRES_REASON" &&
      !sessionHasCapability(auth.session, "shift.approve_variance") &&
      varianceReason
    ) {
      // Cashiers may close with a reason; managers review later. No extra gate.
    }
    return NextResponse.json(result.error, { status: httpStatusForPharmacyError(result.error.code) })
  }
  return NextResponse.json({ ok: true, session: result.session })
}
