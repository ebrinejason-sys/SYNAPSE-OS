import { NextRequest, NextResponse } from "next/server"
import { canCloseForeignTill, requireCapability } from "@/lib/pharmacy-context"
import { sessionHasCapability } from "@/lib/capabilities"
import { isPharmacyAdmin } from "@/lib/auth"
import { httpStatusForPharmacyError } from "@synapse/db/errors"
import { closeTill } from "@/lib/pos/till-service"

export async function POST(request: NextRequest) {
  const auth = await requireCapability(["shift.open_close", "shift.approve_variance"])
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : ""
  if (!sessionId) return NextResponse.json({ error: "sessionId is required" }, { status: 400 })

  const actorId = auth.session.userId
  const requestedCashier = typeof body?.cashierId === "string" ? body.cashierId : actorId
  const manager =
    sessionHasCapability(auth.session, "shift.approve_variance") || isPharmacyAdmin(auth.session)
  if (
    !canCloseForeignTill({
      actorId,
      tillCashierId: requestedCashier,
      canApproveVariance: sessionHasCapability(auth.session, "shift.approve_variance"),
      isAdmin: isPharmacyAdmin(auth.session),
    })
  ) {
    return NextResponse.json(
      { error: "You cannot close another cashier's till.", code: "ACCESS_DENIED" },
      { status: 403 },
    )
  }

  const countedCash = Number(body?.countedCash)
  const varianceReason = typeof body?.varianceReason === "string" ? body.varianceReason : null
  const result = await closeTill({
    tenantId: auth.tenantId,
    cashierId: manager ? requestedCashier : actorId,
    sessionId,
    countedCash,
    varianceReason,
    notes: typeof body?.notes === "string" ? body.notes : null,
    closerId: actorId,
    allowOtherCashier: manager,
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
