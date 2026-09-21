import { NextResponse } from "next/server"
import { supabaseAdmin } from "@synapse/db/admin"
import { evaluateDeltaCheck } from "@synapse/db/lab-device-intelligence"
import { isContextError, gateHospitalModule } from "@/lib/hospital-shared"
import { requireHospitalStaffContext } from "@/lib/hospital-dept"

export const dynamic = "force-dynamic"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx
  const blocked = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, "lab")
  if (blocked) return blocked
  const { id } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: current } = await db
    .from("lab_results")
    .select("id, loinc_code, test_name, result_value, unit, verified_at, created_at, lab_order_id")
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle()
  if (!current) return NextResponse.json({ error: "Result not found" }, { status: 404 })
  const { data: order } = await db.from("lab_orders").select("patient_id").eq("id", current.lab_order_id).eq("tenant_id", ctx.tenantId).maybeSingle()
  if (!order) return NextResponse.json({ error: "Result not found" }, { status: 404 })
  const { data: previousRows } = await db
    .from("lab_results")
    .select("id, result_value, unit, verified_at, created_at, lab_orders!inner(patient_id)")
    .eq("tenant_id", ctx.tenantId)
    .eq("loinc_code", current.loinc_code)
    .eq("status", "final")
    .neq("id", id)
    .order("created_at", { ascending: false })
    .limit(8)

  const previous = (previousRows ?? []).filter((row: { lab_orders?: { patient_id?: string }; unit?: string | null }) =>
    row.lab_orders?.patient_id === order.patient_id,
  )
  const comparable = previous.filter((row: { unit?: string | null }) => !row.unit || !current.unit || row.unit === current.unit)
  const latest = comparable[0]
  const currentNum = Number(current.result_value)
  const previousNum = latest ? Number(latest.result_value) : NaN
  const trendAvailable = Number.isFinite(currentNum) && Number.isFinite(previousNum)
  return NextResponse.json({
    current: { id: current.id, value: current.result_value, unit: current.unit, at: current.verified_at ?? current.created_at },
    previous: comparable.map((row: { id: string; result_value: string; unit: string | null; verified_at: string | null; created_at: string }) => ({
      id: row.id,
      value: row.result_value,
      unit: row.unit,
      at: row.verified_at ?? row.created_at,
    })),
    trendAvailable,
    unavailableReason: trendAvailable ? null : "Incompatible units or insufficient numeric history",
    direction: trendAvailable ? (currentNum > previousNum ? "up" : currentNum < previousNum ? "down" : "stable") : null,
    delta: trendAvailable ? evaluateDeltaCheck({ current: currentNum, previous: previousNum, percentLimit: 30 }) : null,
  })
}
