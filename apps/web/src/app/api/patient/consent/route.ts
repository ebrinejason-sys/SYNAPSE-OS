import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { supabaseAdmin } from "@synapse/db/admin"
import {
  CONSENT_CAPTURE_METHODS,
  CONSENT_PURPOSES,
  CONSENT_SIGNER_RELATIONSHIPS,
  grantConsent,
  withdrawConsent,
  type ConsentRecord,
} from "@synapse/db/consent"
import { createClinicalDocument, clinicalDocumentToRow, signClinicalDocument } from "@synapse/db/clinical-documents"
import { consentCapturedTimelineEvent, publishClinicalTimelineBestEffort } from "@synapse/db/clinical-timeline"
import { publishTimelineEvent } from "@synapse/db/identity-persist"
import { isContextError, requireHospitalCapability, gateHospitalModule, logHospitalAudit } from "@/lib/hospital-shared"
import { requireHospitalStaffContext } from "@/lib/hospital-dept"

export const dynamic = "force-dynamic"

const grantSchema = z.object({
  patient_id: z.string().uuid(),
  person_id: z.string().uuid().optional(),
  purpose: z.enum(CONSENT_PURPOSES),
  country_pack: z.string().min(1).max(80).optional(),
  signer_relationship: z.enum(CONSENT_SIGNER_RELATIONSHIPS),
  capture_method: z.enum(CONSENT_CAPTURE_METHODS),
  encounter_id: z.string().uuid().optional(),
  expires_at: z.string().datetime().optional(),
  witness_name: z.string().max(200).optional(),
  staff_witness_id: z.string().uuid().optional(),
})

const withdrawSchema = z.object({
  id: z.string().uuid(),
  action: z.literal("withdraw"),
})

function consentFromRow(row: Record<string, unknown>): ConsentRecord {
  return {
    id: String(row.id),
    personId: String(row.person_id),
    patientId: row.patient_id ? String(row.patient_id) : null,
    purpose: row.purpose as ConsentRecord["purpose"],
    status: row.status as ConsentRecord["status"],
    scopeFacilityId: row.scope_facility_id ? String(row.scope_facility_id) : null,
    encounterId: row.encounter_id ? String(row.encounter_id) : null,
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    grantedAt: row.granted_at ? String(row.granted_at) : null,
    withdrawnAt: row.withdrawn_at ? String(row.withdrawn_at) : null,
    signerRelationship: (row.signer_relationship as ConsentRecord["signerRelationship"]) ?? null,
    witnessName: row.witness_name ? String(row.witness_name) : null,
    staffWitnessId: row.staff_witness_id ? String(row.staff_witness_id) : null,
    captureMethod: (row.capture_method as ConsentRecord["captureMethod"]) ?? null,
    countryPack: row.country_pack ? String(row.country_pack) : null,
    templateVersion: row.template_version ? String(row.template_version) : null,
    contentHash: row.content_hash ? String(row.content_hash) : null,
    documentId: row.document_id ? String(row.document_id) : null,
    collectedBy: row.collected_by ? String(row.collected_by) : null,
  }
}

function consentToRow(record: ConsentRecord, tenantFacilityId: string) {
  return {
    id: record.id,
    person_id: record.personId,
    patient_id: record.patientId ?? null,
    purpose: record.purpose,
    status: record.status,
    scope_facility_id: record.scopeFacilityId ?? tenantFacilityId,
    encounter_id: record.encounterId ?? null,
    expires_at: record.expiresAt ?? null,
    granted_at: record.grantedAt ?? null,
    withdrawn_at: record.withdrawnAt ?? null,
    signer_relationship: record.signerRelationship ?? null,
    witness_name: record.witnessName ?? null,
    staff_witness_id: record.staffWitnessId ?? null,
    capture_method: record.captureMethod ?? null,
    country_pack: record.countryPack ?? null,
    template_version: record.templateVersion ?? null,
    content_hash: record.contentHash ?? null,
    document_id: record.documentId ?? null,
    collected_by: record.collectedBy ?? null,
    updated_at: new Date().toISOString(),
  }
}

export async function GET(req: NextRequest) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx
  const cap = await requireHospitalCapability(ctx, "encounter", "create", "opd")
  if (cap) return cap

  const patientId = req.nextUrl.searchParams.get("patient_id")
  if (!patientId) return NextResponse.json({ error: "patient_id required" }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: patient } = await db
    .from("patients")
    .select("id, person_id")
    .eq("id", patientId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle()
  if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 })
  if (!patient.person_id) return NextResponse.json({ consents: [] })

  const { data, error } = await db
    .from("person_consents")
    .select("*")
    .eq("person_id", patient.person_id)
    .order("created_at", { ascending: false })
    .limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ consents: (data ?? []).map((row: Record<string, unknown>) => consentFromRow(row)) })
}

export async function POST(req: NextRequest) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx
  const cap = await requireHospitalCapability(ctx, "encounter", "create", "opd")
  if (cap) return cap
  const moduleBlock = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, "opd")
  if (moduleBlock) return moduleBlock

  const body = await req.json().catch(() => null)
  if (body?.action === "withdraw") {
    const parsed = withdrawSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any
    const { data: row } = await db.from("person_consents").select("*").eq("id", parsed.data.id).maybeSingle()
    if (!row) return NextResponse.json({ error: "Consent not found" }, { status: 404 })
    const current = consentFromRow(row)
    const { data: patient } = await db
      .from("patients")
      .select("id")
      .eq("person_id", current.personId)
      .eq("tenant_id", ctx.tenantId)
      .limit(1)
      .maybeSingle()
    if (!patient) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    let withdrawn
    try {
      withdrawn = withdrawConsent(current, { actorId: ctx.userId })
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Unable to withdraw" }, { status: 409 })
    }
    const { error } = await db
      .from("person_consents")
      .update({
        status: withdrawn.status,
        withdrawn_at: withdrawn.withdrawnAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", withdrawn.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await db.from("person_consent_events").insert({
      consent_id: withdrawn.id,
      actor_id: ctx.userId,
      action: "withdrawn",
      from_status: current.status,
      to_status: "withdrawn",
    })
    await logHospitalAudit({
      ctx,
      action: "UPDATE",
      tableName: "person_consents",
      recordId: withdrawn.id!,
      newValue: { status: "withdrawn", purpose: withdrawn.purpose },
    })
    void publishClinicalTimelineBestEffort(
      publishTimelineEvent,
      consentCapturedTimelineEvent({
        tenantId: ctx.tenantId,
        hospitalId: ctx.hospitalId,
        patientId: patient.id,
        personId: withdrawn.personId,
        encounterId: withdrawn.encounterId,
        consentId: withdrawn.id!,
        purpose: withdrawn.purpose,
        status: "withdrawn",
        createdBy: ctx.userId,
      }),
    )
    return NextResponse.json({ consent: withdrawn })
  }

  const parsed = grantSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: patient } = await db
    .from("patients")
    .select("id, person_id, full_name")
    .eq("id", parsed.data.patient_id)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle()
  if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 })
  const personId = parsed.data.person_id ?? patient.person_id
  if (!personId) return NextResponse.json({ error: "PERSON_REQUIRED" }, { status: 409 })

  const granted = grantConsent({
    personId,
    patientId: parsed.data.patient_id,
    purpose: parsed.data.purpose,
    countryPack: parsed.data.country_pack,
    signerRelationship: parsed.data.signer_relationship,
    captureMethod: parsed.data.capture_method,
    collectedBy: ctx.userId,
    scopeFacilityId: ctx.tenantId,
    encounterId: parsed.data.encounter_id,
    expiresAt: parsed.data.expires_at,
    witnessName: parsed.data.witness_name,
    staffWitnessId: parsed.data.staff_witness_id,
  })

  const snapshot = [
    `CONSENT ${granted.purpose}`,
    `Country pack: ${granted.countryPack} ${granted.templateVersion}`,
    `Hash: ${granted.contentHash}`,
    `Signer: ${granted.signerRelationship}`,
    `Capture: ${granted.captureMethod}`,
    "Legal body is loaded from the country pack, not hardcoded in SYNAPSE.",
  ].join("\n")

  const document = signClinicalDocument(
    createClinicalDocument({
      tenantId: ctx.tenantId,
      facilityId: ctx.hospitalId,
      patientId: parsed.data.patient_id,
      personId,
      encounterId: parsed.data.encounter_id ?? null,
      authorId: ctx.userId,
      documentType: granted.purpose === "refusal_of_treatment" || granted.purpose === "discharge_ama" ? "REFUSAL_FORM" : "CONSENT_FORM",
      templateId: `consent.${granted.purpose}`,
      templateVersion: granted.templateVersion ?? "v1",
      countryPack: granted.countryPack,
      structuredPayload: {
        purpose: granted.purpose,
        contentHash: granted.contentHash,
        captureMethod: granted.captureMethod,
      },
      renderedSnapshot: snapshot,
    }),
    { signedBy: ctx.userId, witnessName: granted.witnessName, witnessId: granted.staffWitnessId },
  )
  granted.documentId = document.id

  const { error: docError } = await db.from("clinical_documents").insert(clinicalDocumentToRow(document))
  if (docError) return NextResponse.json({ error: docError.message }, { status: 500 })

  const { error } = await db.from("person_consents").insert(consentToRow(granted, ctx.tenantId))
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await db.from("person_consent_events").insert({
    consent_id: granted.id,
    actor_id: ctx.userId,
    action: "granted",
    to_status: "granted",
  })
  await logHospitalAudit({
    ctx,
    action: "INSERT",
    tableName: "person_consents",
    recordId: granted.id!,
    newValue: { purpose: granted.purpose, status: "granted", content_hash: granted.contentHash },
  })
  void publishClinicalTimelineBestEffort(
    publishTimelineEvent,
    consentCapturedTimelineEvent({
      tenantId: ctx.tenantId,
      hospitalId: ctx.hospitalId,
      patientId: parsed.data.patient_id,
      personId,
      encounterId: parsed.data.encounter_id,
      consentId: granted.id!,
      purpose: granted.purpose,
      status: "granted",
      createdBy: ctx.userId,
    }),
  )
  return NextResponse.json({ consent: granted, document }, { status: 201 })
}
