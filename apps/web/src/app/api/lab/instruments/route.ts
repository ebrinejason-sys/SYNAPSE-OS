import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/getCurrentUser"
import { requireHospitalStaffContext } from "@/lib/hospital-dept"
import { isContextError, gateHospitalModule } from "@/lib/hospital-shared"
import { supabaseAdmin } from "@synapse/db/admin"

export const dynamic = "force-dynamic"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const ctx = await requireHospitalStaffContext({ allowLaboratory: true })
  if (isContextError(ctx)) return ctx
  const moduleBlock = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, "lab")
  if (moduleBlock) return moduleBlock

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data, error } = await db
    .from("lab_devices")
    .select(
      "id, name, manufacturer, model, connection_type, protocol, validation_status, health_status, active, last_seen_at, last_message_at",
    )
    .eq("tenant_id", ctx.tenantId)
    .order("name", { ascending: true })

  if (error) {
    return NextResponse.json({ devices: [], warning: error.message })
  }
  return NextResponse.json({ devices: data ?? [] })
}
