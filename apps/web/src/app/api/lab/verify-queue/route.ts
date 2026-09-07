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
    return NextResponse.json({ items: [], source: "simulation" })
  }

  if (user.role === "lab_tech") {
    return NextResponse.json({ error: "lab_scientist required for verification queue" }, { status: 403 })
  }

  const ctx = await requireHospitalStaffContext({ allowLaboratory: true })
  if (isContextError(ctx)) return ctx
  const moduleBlock = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, "lab")
  if (moduleBlock) return moduleBlock

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: orders, error } = await db
    .from("lab_orders")
    .select(
      "id, test_name, loinc_code, accession_number, workflow_status, patients(first_name, last_name)",
    )
    .eq("tenant_id", ctx.tenantId)
    .eq("is_synthetic", false)
    .in("workflow_status", ["RESULT_ENTERED", "VERIFICATION_PENDING", "VERIFIED"])
    .order("ordered_at", { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const orderIds = (orders ?? []).map((o: { id: string }) => o.id)
  const resultByOrder = new Map<string, Record<string, unknown>>()
  if (orderIds.length) {
    const { data: results } = await db
      .from("lab_results")
      .select(
        "id, lab_order_id, result_value, unit, reference_range, is_critical, is_abnormal, abnormal_flag, analyzer, result_source, entered_at, created_at",
      )
      .eq("tenant_id", ctx.tenantId)
      .in("lab_order_id", orderIds)
    for (const r of results ?? []) {
      resultByOrder.set(String(r.lab_order_id), r)
    }
  }

  const items = (orders ?? []).map((o: Record<string, unknown>) => {
    const patient = o.patients as { first_name?: string; last_name?: string } | null
    const r = resultByOrder.get(String(o.id))
    return {
      orderId: String(o.id),
      testName: String(o.test_name),
      loincCode: String(o.loinc_code ?? ""),
      accessionNumber: (o.accession_number as string | null) ?? null,
      patientName: patient ? [patient.first_name, patient.last_name].filter(Boolean).join(" ") : null,
      status: String(o.workflow_status),
      result: r
        ? {
            id: String(r.id),
            resultValue: String(r.result_value),
            unit: (r.unit as string | null) ?? null,
            referenceRange: (r.reference_range as string | null) ?? null,
            isCritical: Boolean(r.is_critical),
            isAbnormal: Boolean(r.is_abnormal),
            flag: (r.abnormal_flag as string | null) ?? null,
            analyzer: (r.analyzer as string | null) ?? null,
            source: (r.result_source as string | null) ?? null,
            enteredAt: (r.entered_at as string | null) ?? (r.created_at as string | null) ?? null,
          }
        : null,
    }
  })

  return NextResponse.json({ items, source: "database" })
}
