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
    return NextResponse.json({ results: [], source: "simulation" })
  }

  const ctx = await requireHospitalStaffContext({ allowLaboratory: true })
  if (isContextError(ctx)) return ctx
  const moduleBlock = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, "lab")
  if (moduleBlock) return moduleBlock

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data, error } = await db
    .from("lab_results")
    .select(
      "id, lab_order_id, test_name, loinc_code, result_value, unit, reference_range, status, is_critical, is_abnormal, abnormal_flag, analyzer, result_source, verified_at, created_at",
    )
    .eq("tenant_id", ctx.tenantId)
    .eq("is_synthetic", false)
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const orderIds = [...new Set((data ?? []).map((r: { lab_order_id: string }) => r.lab_order_id))]
  const accessionByOrder = new Map<string, string>()
  const patientByOrder = new Map<string, string>()
  if (orderIds.length) {
    const { data: orders } = await db
      .from("lab_orders")
      .select("id, accession_number, patients(first_name, last_name)")
      .eq("tenant_id", ctx.tenantId)
      .in("id", orderIds)
    for (const o of orders ?? []) {
      accessionByOrder.set(String(o.id), o.accession_number ?? "")
      const p = o.patients as { first_name?: string; last_name?: string } | null
      patientByOrder.set(
        String(o.id),
        p ? [p.first_name, p.last_name].filter(Boolean).join(" ") : "",
      )
    }
  }

  const results = (data ?? []).map((r: Record<string, unknown>) => ({
    ...r,
    accession_number: accessionByOrder.get(String(r.lab_order_id)) ?? null,
    patient_name: patientByOrder.get(String(r.lab_order_id)) || null,
  }))

  return NextResponse.json({ results, source: "database" })
}
