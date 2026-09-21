import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@synapse/db/admin"
import { assertSameMortuaryTenant, mortuaryBodyFromRow, mortuaryPublicTag } from "@synapse/db/mortuary"
import { isContextError, requireHospitalCapability } from "@/lib/hospital-shared"
import { requireHospitalStaffContext } from "@/lib/hospital-dept"

export const dynamic = "force-dynamic"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx
  const cap = await requireHospitalCapability(ctx, "register", "read", "mortuary")
  if (cap) return cap
  const { id } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data } = await db.from("mortuary_bodies").select("*").eq("id", id).eq("tenant_id", ctx.tenantId).maybeSingle()
  if (!data) return NextResponse.json({ error: "Body not found" }, { status: 404 })
  const body = mortuaryBodyFromRow(data)
  try {
    assertSameMortuaryTenant(body, ctx.tenantId)
  } catch {
    return NextResponse.json({ error: "Body not found" }, { status: 404 })
  }
  return NextResponse.json({ body, publicTag: mortuaryPublicTag(body) })
}
