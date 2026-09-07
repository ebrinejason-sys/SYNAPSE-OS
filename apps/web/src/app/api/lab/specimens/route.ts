import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/getCurrentUser"
import { hasPlatformAdminAccess } from "@/lib/platform/auth"
import { requireHospitalStaffContext } from "@/lib/hospital-dept"
import { isContextError, gateHospitalModule } from "@/lib/hospital-shared"
import { supabaseAdmin } from "@synapse/db/admin"

export const dynamic = "force-dynamic"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (hasPlatformAdminAccess(user.role, user.email)) {
    return NextResponse.json({ specimens: [], source: "simulation" })
  }

  const ctx = await requireHospitalStaffContext({ allowLaboratory: true })
  if (isContextError(ctx)) return ctx
  const moduleBlock = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, "lab")
  if (moduleBlock) return moduleBlock

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data, error } = await db
    .from("lab_specimens")
    .select(
      "id, accession_number, barcode, specimen_type, status, collected_at, received_at, lab_order_id, patients(first_name, last_name, mrn)",
    )
    .eq("tenant_id", ctx.tenantId)
    .order("collected_at", { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ specimens: data ?? [], source: "database" })
}
