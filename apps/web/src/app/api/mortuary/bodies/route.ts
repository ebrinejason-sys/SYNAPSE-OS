import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { supabaseAdmin } from "@synapse/db/admin"
import {
  assertSameMortuaryTenant,
  createMortuaryBody,
  mortuaryBodyFromRow,
  mortuaryBodyToRow,
} from "@synapse/db/mortuary"
import { clinicalDocumentToRow, createClinicalDocument, signClinicalDocument } from "@synapse/db/clinical-documents"
import { mortuaryTransferTimelineEvent, publishClinicalTimelineBestEffort } from "@synapse/db/clinical-timeline"
import { publishTimelineEvent } from "@synapse/db/identity-persist"
import { isContextError, requireHospitalCapability, gateHospitalModule, logHospitalAudit } from "@/lib/hospital-shared"
import { requireHospitalStaffContext } from "@/lib/hospital-dept"

export const dynamic = "force-dynamic"

const createSchema = z.object({
  pronouncement_id: z.string().uuid(),
  unknown_person: z.boolean().optional(),
  temporary_identity: z.string().max(80).optional().nullable(),
  tag_code: z.string().max(80).optional(),
})

export async function GET(req: NextRequest) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx
  const cap = await requireHospitalCapability(ctx, "register", "read", "mortuary")
  if (cap) return cap
  const status = req.nextUrl.searchParams.get("status")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  let query = db.from("mortuary_bodies").select("*").eq("tenant_id", ctx.tenantId).order("updated_at", { ascending: false }).limit(100)
  if (status) query = query.eq("status", status)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ bodies: (data ?? []).map((row: Record<string, unknown>) => mortuaryBodyFromRow(row)) })
}

export async function POST(req: NextRequest) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx
  const cap = await requireHospitalCapability(ctx, "register", "write", "mortuary")
  if (cap) return cap
  const moduleBlock = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, "mortuary")
  if (moduleBlock) return moduleBlock
  const parsed = createSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: pronouncement } = await db.from("death_pronouncements").select("*").eq("id", parsed.data.pronouncement_id).eq("tenant_id", ctx.tenantId).maybeSingle()
  if (!pronouncement) return NextResponse.json({ error: "Pronouncement not found" }, { status: 404 })

  let body
  try {
    body = createMortuaryBody({
      tenantId: ctx.tenantId,
      facilityId: ctx.hospitalId,
      pronouncementId: pronouncement.id,
      encounterId: pronouncement.encounter_id,
      actorId: ctx.userId,
      isSynthetic: Boolean(pronouncement.is_synthetic),
      identity: {
        patientId: pronouncement.patient_id,
        personId: pronouncement.person_id,
        unknownPerson: Boolean(parsed.data.unknown_person),
        temporaryIdentity: parsed.data.temporary_identity ?? null,
        tagCode: parsed.data.tag_code,
      },
    })
    assertSameMortuaryTenant(body, ctx.tenantId)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid body" }, { status: 400 })
  }

  const transfer = signClinicalDocument(createClinicalDocument({
    tenantId: ctx.tenantId,
    facilityId: ctx.hospitalId,
    patientId: pronouncement.patient_id,
    personId: pronouncement.person_id,
    encounterId: pronouncement.encounter_id,
    authorId: ctx.userId,
    documentType: "MORTUARY_TRANSFER",
    templateId: "mortuary.transfer.v1",
    templateVersion: "v1",
    structuredPayload: { bodyNumber: body.identity.bodyNumber, tagCode: body.identity.tagCode },
    renderedSnapshot: `MORTUARY TRANSFER\nBody number: ${body.identity.bodyNumber}\nTag: ${body.identity.tagCode}`,
  }), { signedBy: ctx.userId })
  body.transferDocumentId = transfer.id

  const { error: docError } = await db.from("clinical_documents").insert(clinicalDocumentToRow(transfer))
  if (docError) return NextResponse.json({ error: docError.message }, { status: 500 })
  const { error } = await db.from("mortuary_bodies").insert(mortuaryBodyToRow(body))
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logHospitalAudit({ ctx, action: "INSERT", tableName: "mortuary_bodies", recordId: body.id, newValue: { bodyNumber: body.identity.bodyNumber } })
  void publishClinicalTimelineBestEffort(publishTimelineEvent, mortuaryTransferTimelineEvent({
    tenantId: ctx.tenantId,
    hospitalId: ctx.hospitalId,
    patientId: pronouncement.patient_id,
    encounterId: pronouncement.encounter_id,
    bodyId: body.id,
    createdBy: ctx.userId,
  }))
  return NextResponse.json({ body, publicTag: { bodyNumber: body.identity.bodyNumber, tagCode: body.identity.tagCode } }, { status: 201 })
}
