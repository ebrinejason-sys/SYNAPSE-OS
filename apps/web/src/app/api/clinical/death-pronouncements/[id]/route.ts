import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@synapse/db/admin"
import { assertSameDeathTenant, deathPronouncementFromRow } from "@synapse/db/death-pronouncement"
import { isContextError, requireHospitalCapability } from "@/lib/hospital-shared"
import { requireHospitalStaffContext } from "@/lib/hospital-dept"

export const dynamic = "force-dynamic"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx
  const cap = await requireHospitalCapability(ctx, "death", "view", "clinical")
  if (cap) return cap
  const { id } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data } = await db.from("death_pronouncements").select("*").eq("id", id).eq("tenant_id", ctx.tenantId).maybeSingle()
  if (!data) return NextResponse.json({ error: "Pronouncement not found" }, { status: 404 })
  const record = deathPronouncementFromRow(data)
  try {
    assertSameDeathTenant(record, ctx.tenantId)
  } catch {
    return NextResponse.json({ error: "Pronouncement not found" }, { status: 404 })
  }
  return NextResponse.json({ pronouncement: record })
}

export async function PATCH() {
  return NextResponse.json({ error: "PRONOUNCEMENT_IMMUTABLE" }, { status: 409 })
}
