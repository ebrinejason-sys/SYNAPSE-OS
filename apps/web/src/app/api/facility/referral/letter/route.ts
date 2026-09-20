import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { supabaseAdmin } from "@synapse/db/admin"
import { clinicalDocumentFromRow, clinicalDocumentToRow, signClinicalDocument } from "@synapse/db/clinical-documents"
import { facilityReferralFromRow } from "@synapse/db/referral-lifecycle"
import { buildReferralLetterDocument, referralLetterVerificationPayload, referralLoopFromRow } from "@synapse/db/referral-loop"
import { clinicalDocumentTimelineEvent, publishClinicalTimelineBestEffort } from "@synapse/db/clinical-timeline"
import { publishTimelineEvent } from "@synapse/db/identity-persist"
import { isContextError, requireHospitalCapability, logHospitalAudit } from "@/lib/hospital-shared"
import { requireHospitalStaffContext } from "@/lib/hospital-dept"

export const dynamic = "force-dynamic"

const signSchema = z.object({
  id: z.string().uuid(),
  witness_name: z.string().max(200).optional(),
})

async function loadAccessibleReferral(id: string, tenantId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data, error } = await db.from("facility_referrals").select("*").eq("id", id).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  if (data.from_tenant_id !== tenantId && data.to_tenant_id !== tenantId) return "forbidden" as const
  return data as Record<string, unknown>
}

export async function GET(req: NextRequest) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx
  const cap = await requireHospitalCapability(ctx, "encounter", "create", "opd")
  if (cap) return cap

  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  let row: Record<string, unknown> | "forbidden" | null
  try {
    row = await loadAccessibleReferral(id, ctx.tenantId)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Load failed" }, { status: 500 })
  }
  if (row === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (!row) return NextResponse.json({ error: "Referral not found" }, { status: 404 })

  const referral = facilityReferralFromRow(row)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any

  if (row.letter_document_id) {
    const { data: letterRow } = await db
      .from("clinical_documents")
      .select("*")
      .eq("id", row.letter_document_id)
      .eq("tenant_id", referral.fromTenantId)
      .maybeSingle()
    if (letterRow) {
      return NextResponse.json({
        referral,
        loop: referralLoopFromRow({ id: referral.id, status: referral.status, ...row }),
        letter: clinicalDocumentFromRow(letterRow),
        verification: referralLetterVerificationPayload(referral.id),
      })
    }
  }

  if (ctx.tenantId !== referral.fromTenantId) {
    return NextResponse.json({ error: "Letter not generated yet" }, { status: 404 })
  }

  const { data: patient } = await db
    .from("patients")
    .select("id, full_name, mrn, person_id")
    .eq("id", referral.patientId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle()
  if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 })

  let synapseId = patient.mrn ? `MRN:${patient.mrn}` : referral.patientId
  if (patient.person_id) {
    const { data: person } = await db
      .from("persons")
      .select("synapse_id")
      .eq("id", patient.person_id)
      .maybeSingle()
    if (person?.synapse_id) synapseId = person.synapse_id
  }

  const letter = buildReferralLetterDocument({
    tenantId: ctx.tenantId,
    facilityId: ctx.hospitalId,
    authorId: ctx.userId,
    patientName: patient.full_name || "Patient",
    synapseId,
    referringFacility: ctx.tenantId,
    receivingFacility: referral.toTenantId,
    referringClinician: ctx.fullName || ctx.email,
    referral,
  })

  const { error: insertError } = await db.from("clinical_documents").insert(clinicalDocumentToRow(letter))
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
  await db
    .from("facility_referrals")
    .update({ letter_document_id: letter.id, updated_at: new Date().toISOString() })
    .eq("id", referral.id)
    .eq("from_tenant_id", ctx.tenantId)

  await logHospitalAudit({
    ctx,
    action: "INSERT",
    tableName: "clinical_documents",
    recordId: letter.id,
    newValue: { document_type: "REFERRAL_LETTER", referral_id: referral.id },
  })

  return NextResponse.json({
    referral,
    loop: referralLoopFromRow({ id: referral.id, status: referral.status, ...row }),
    letter,
    verification: referralLetterVerificationPayload(referral.id),
  })
}

export async function POST(req: NextRequest) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx
  const cap = await requireHospitalCapability(ctx, "encounter", "sign", "opd")
  if (cap) return cap

  const parsed = signSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  let row: Record<string, unknown> | "forbidden" | null
  try {
    row = await loadAccessibleReferral(parsed.data.id, ctx.tenantId)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Load failed" }, { status: 500 })
  }
  if (row === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (!row) return NextResponse.json({ error: "Referral not found" }, { status: 404 })
  const referral = facilityReferralFromRow(row)
  if (ctx.tenantId !== referral.fromTenantId) {
    return NextResponse.json({ error: "Only referring facility can sign the letter" }, { status: 403 })
  }
  if (!row.letter_document_id) return NextResponse.json({ error: "Generate the letter first" }, { status: 409 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: letterRow } = await db
    .from("clinical_documents")
    .select("*")
    .eq("id", row.letter_document_id)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle()
  if (!letterRow) return NextResponse.json({ error: "Letter not found" }, { status: 404 })

  let signed
  try {
    signed = signClinicalDocument(clinicalDocumentFromRow(letterRow), {
      signedBy: ctx.userId,
      witnessName: parsed.data.witness_name ?? null,
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unable to sign" }, { status: 409 })
  }

  const { error } = await db
    .from("clinical_documents")
    .update(clinicalDocumentToRow(signed))
    .eq("id", signed.id)
    .eq("tenant_id", ctx.tenantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logHospitalAudit({
    ctx,
    action: "UPDATE",
    tableName: "clinical_documents",
    recordId: signed.id,
    newValue: { status: "signed", referral_id: referral.id },
  })
  void publishClinicalTimelineBestEffort(
    publishTimelineEvent,
    clinicalDocumentTimelineEvent({
      tenantId: ctx.tenantId,
      hospitalId: ctx.hospitalId,
      patientId: referral.patientId,
      encounterId: referral.encounterId,
      documentId: signed.id,
      documentType: "REFERRAL_LETTER",
      status: "signed",
      createdBy: ctx.userId,
    }),
  )
  return NextResponse.json({
    letter: signed,
    verification: referralLetterVerificationPayload(referral.id),
  })
}
