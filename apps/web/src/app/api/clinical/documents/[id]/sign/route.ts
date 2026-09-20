import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@synapse/db/admin"
import {
  assertSameTenant,
  clinicalDocumentFromRow,
  clinicalDocumentToRow,
  signClinicalDocument,
} from "@synapse/db/clinical-documents"
import { clinicalDocumentTimelineEvent, publishClinicalTimelineBestEffort } from "@synapse/db/clinical-timeline"
import { publishTimelineEvent } from "@synapse/db/identity-persist"
import { isContextError, requireHospitalCapability, logHospitalAudit } from "@/lib/hospital-shared"
import { requireHospitalStaffContext } from "@/lib/hospital-dept"

export const dynamic = "force-dynamic"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx
  const cap = await requireHospitalCapability(ctx, "encounter", "sign", "opd")
  if (cap) return cap

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: row, error } = await db
    .from("clinical_documents")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!row) return NextResponse.json({ error: "Document not found" }, { status: 404 })

  const current = clinicalDocumentFromRow(row)
  assertSameTenant(current, ctx.tenantId)
  let signed
  try {
    signed = signClinicalDocument(current, {
      signedBy: ctx.userId,
      witnessId: typeof body.witness_id === "string" ? body.witness_id : null,
      witnessName: typeof body.witness_name === "string" ? body.witness_name : null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to sign"
    return NextResponse.json({ error: message }, { status: 409 })
  }

  const { error: updError } = await db
    .from("clinical_documents")
    .update(clinicalDocumentToRow(signed))
    .eq("id", signed.id)
    .eq("tenant_id", ctx.tenantId)
    .eq("status", "draft")
  if (updError) return NextResponse.json({ error: updError.message }, { status: 500 })

  await logHospitalAudit({
    ctx,
    action: "UPDATE",
    tableName: "clinical_documents",
    recordId: signed.id,
    newValue: { status: signed.status, signed_by: signed.signedBy },
  })
  void publishClinicalTimelineBestEffort(
    publishTimelineEvent,
    clinicalDocumentTimelineEvent({
      tenantId: ctx.tenantId,
      hospitalId: ctx.hospitalId,
      patientId: signed.patientId,
      encounterId: signed.encounterId,
      documentId: signed.id,
      documentType: signed.documentType,
      status: signed.status,
      createdBy: ctx.userId,
    }),
  )
  return NextResponse.json({ document: signed })
}
