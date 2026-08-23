import { NextRequest, NextResponse } from "next/server"
import { requireCapability, requireStoreScope } from "@/lib/pharmacy-context"
import { httpStatusForPharmacyError } from "@synapse/db/errors"
import { openTill } from "@/lib/pos/till-service"

export async function POST(request: NextRequest) {
  const auth = await requireCapability("shift.open_close")
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)
  const openingFloat = Number(body?.openingFloat ?? 0)
  const requestedStore = typeof body?.storeId === "string" ? body.storeId : auth.storeId
  const scoped = requireStoreScope(auth, requestedStore)
  if (!scoped.ok) return scoped.response

  const result = await openTill({
    tenantId: auth.tenantId,
    cashierId: auth.session.userId,
    storeId: scoped.storeId,
    openingFloat,
    deviceId: typeof body?.deviceId === "string" ? body.deviceId : null,
    tillCode: typeof body?.tillCode === "string" ? body.tillCode : null,
  })
  if (!result.ok) {
    return NextResponse.json(result.error, { status: httpStatusForPharmacyError(result.error.code) })
  }
  return NextResponse.json({ ok: true, session: result.session })
}
