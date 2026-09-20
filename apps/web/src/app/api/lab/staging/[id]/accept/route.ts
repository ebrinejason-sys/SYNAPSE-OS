import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@synapse/db/admin"
import { LabWorkflow } from "@synapse/db/lab-workflow"
import { rowToLabOrder, persistLabOrderBestEffort } from "@synapse/db/lab-order-persist"
import { persistLabResultBestEffort, rowToLabResult } from "@synapse/db/lab-result-persist"
import { isContextError, requireHospitalCapability, gateHospitalModule, logHospitalAudit } from "@/lib/hospital-shared"
import { requireHospitalStaffContext } from "@/lib/hospital-dept"

export const dynamic = "force-dynamic"

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx
  if (ctx.role !== "lab_scientist" && ctx.role !== "lab_manager" && ctx.role !== "hospital_admin") {
    return NextResponse.json({ error: "Lab scientist review required" }, { status: 403 })
  }
  const cap = await requireHospitalCapability(ctx, "result", "enter", "lab")
  if (cap) return cap
  const moduleBlock = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, "lab")
  if (moduleBlock) return moduleBlock

  const { id } = await params
  const db = supabaseAdmin as any
  const { data: staging, error } = await db
    .from("lab_result_staging")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!staging) return NextResponse.json({ error: "Staging result not found" }, { status: 404 })
  if (staging.status === "ACCEPTED" && staging.clinical_result_id) {
    return NextResponse.json({ stagingId: id, accepted: true, alreadyAccepted: true, clinicalResultId: staging.clinical_result_id })
  }
  if (staging.status !== "READY_FOR_REVIEW") return NextResponse.json({ error: "Staging result must be mapped and accession-matched before acceptance" }, { status: 409 })
  if (!staging.lab_order_id || !staging.mapped_loinc || !staging.value) return NextResponse.json({ error: "Staging result is incomplete" }, { status: 409 })

  const { data: orderRow } = await db
    .from("lab_orders")
    .select("*")
    .eq("id", staging.lab_order_id)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle()
  if (!orderRow) return NextResponse.json({ error: "Lab order not found" }, { status: 404 })
  const order = rowToLabOrder(orderRow)
  const { data: encounter } = await db.from("encounters").select("id, hospital_id, patient_id").eq("id", order.encounterId).eq("tenant_id", ctx.tenantId).maybeSingle()
  if (!encounter || encounter.hospital_id !== ctx.hospitalId || encounter.patient_id !== order.patientId) return NextResponse.json({ error: "Lab order not found" }, { status: 404 })
  if (!["RECEIVED", "PROCESSING"].includes(order.status)) return NextResponse.json({ error: `Lab order must be received before analyzer acceptance; current state is ${order.status}` }, { status: 409 })

  const lab = new LabWorkflow([order])
  const entered = lab.enterResult({ resultId: crypto.randomUUID(), orderId: order.id, value: String(staging.value), analyzer: String(staging.device_id ?? "analyzer") })
  const resultPersist = await persistLabResultBestEffort(db, entered.result, {
    enteredBy: ctx.userId,
    source: "ANALYZER",
    encounterId: order.encounterId,
  })
  if (!resultPersist.ok) return NextResponse.json({ error: resultPersist.error }, { status: 500 })
  const orderPersist = await persistLabOrderBestEffort(db, entered.order)
  if (!orderPersist.ok) return NextResponse.json({ error: orderPersist.error }, { status: 500 })

  const reviewedAt = new Date().toISOString()
  const { error: stageError } = await db.from("lab_result_staging").update({ status: "ACCEPTED", reviewed_by: ctx.userId, reviewed_at: reviewedAt, clinical_result_id: entered.result.id, updated_at: reviewedAt }).eq("id", id).eq("tenant_id", ctx.tenantId).eq("status", "READY_FOR_REVIEW")
  if (stageError) return NextResponse.json({ error: stageError.message }, { status: 500 })
  await logHospitalAudit({ ctx, action: "ANALYZER_RESULT_ACCEPTED", tableName: "lab_result_staging", recordId: id, newValue: { clinical_result_id: entered.result.id, lab_order_id: order.id } })
  return NextResponse.json({ stagingId: id, accepted: true, clinicalResultId: entered.result.id, orderId: order.id, workflowStatus: entered.order.status })
}