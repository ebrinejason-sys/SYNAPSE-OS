import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@synapse/db/admin"
import { isContextError, gateHospitalModule, logHospitalAudit } from "@/lib/hospital-shared"
import { requireHospitalStaffContext } from "@/lib/hospital-dept"

export const dynamic = "force-dynamic"

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx
  const blocked = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, "lab")
  if (blocked) return blocked
  const { id } = await params
  const scientist = ["lab_scientist", "lab_manager", "hospital_admin"].includes(ctx.role)
  const clinician = ["doctor", "clinical_officer"].includes(ctx.role)
  if (!scientist && !clinician) return NextResponse.json({ error: "Critical-value acknowledgement requires scientist or clinician access" }, { status: 403 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: result } = await db.from("lab_results").select("id, is_critical").eq("id", id).eq("tenant_id", ctx.tenantId).maybeSingle()
  if (!result) return NextResponse.json({ error: "Result not found" }, { status: 404 })
  const now = new Date().toISOString()
  const patch = scientist
    ? { critical_scientist_ack_at: now, critical_scientist_ack_by: ctx.userId }
    : { critical_clinician_ack_at: now, critical_clinician_ack_by: ctx.userId }
  const { data, error } = await db.from("lab_results").update(patch).eq("id", id).eq("tenant_id", ctx.tenantId).select("id, critical_scientist_ack_at, critical_clinician_ack_at").single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logHospitalAudit({ ctx, action: scientist ? "LAB_CRITICAL_SCIENTIST_ACK" : "LAB_CRITICAL_CLINICIAN_ACK", tableName: "lab_results", recordId: id, newValue: { at: now } })
  return NextResponse.json({ result: data })
}
