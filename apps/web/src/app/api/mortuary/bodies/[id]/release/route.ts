import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { supabaseAdmin } from "@synapse/db/admin"
import {
  assertSameMortuaryTenant,
  authorizeMortuaryRelease,
  mortuaryBodyFromRow,
  mortuaryBodyToRow,
  releaseMortuaryBody,
} from "@synapse/db/mortuary"
import { clinicalDocumentToRow, createClinicalDocument, signClinicalDocument } from "@synapse/db/clinical-documents"
import { isContextError, requireHospitalCapability, logHospitalAudit } from "@/lib/hospital-shared"
import { requireHospitalStaffContext } from "@/lib/hospital-dept"

export const dynamic = "force-dynamic"

const bodySchema = z.object({
  recipient_name: z.string().min(1).max(120),
  recipient_identity: z.string().min(1).max(120),
  relationship_or_authority: z.string().min(1).max(120),
  complete_release: z.boolean().optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx
  const cap = await requireHospitalCapability(ctx, "release", "approve", "mortuary")
  if (cap) return cap
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const { id } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data } = await db.from("mortuary_bodies").select("*").eq("id", id).eq("tenant_id", ctx.tenantId).maybeSingle()
  if (!data) return NextResponse.json({ error: "Body not found" }, { status: 404 })
  let body = mortuaryBodyFromRow(data)
  try {
    assertSameMortuaryTenant(body, ctx.tenantId)
    body = authorizeMortuaryRelease(body, {
      hasReleaseCapability: true,
      authorizedBy: ctx.userId,
      recipientName: parsed.data.recipient_name,
      recipientIdentity: parsed.data.recipient_identity,
      relationshipOrAuthority: parsed.data.relationship_or_authority,
    })
    const document = signClinicalDocument(createClinicalDocument({
      tenantId: ctx.tenantId,
      facilityId: ctx.hospitalId,
      patientId: String(body.identity.patientId ?? body.id),
      personId: body.identity.personId,
      encounterId: body.encounterId,
      authorId: ctx.userId,
      documentType: "BODY_RELEASE",
      templateId: "mortuary.release.v1",
      templateVersion: "v1",
      structuredPayload: { bodyNumber: body.identity.bodyNumber },
      renderedSnapshot: `BODY RELEASE AUTHORIZATION\nBody number: ${body.identity.bodyNumber}\nRecipient identity recorded.`,
    }), { signedBy: ctx.userId })
    body.releaseDocumentId = document.id
    body.release.supportingDocumentId = document.id
    if (parsed.data.complete_release) {
      body = releaseMortuaryBody(body, { staffId: ctx.userId, hasReleaseCapability: true })
    }
    const { error: docError } = await db.from("clinical_documents").insert(clinicalDocumentToRow(document))
    if (docError) return NextResponse.json({ error: docError.message }, { status: 500 })
    const { error } = await db.from("mortuary_bodies").update(mortuaryBodyToRow(body)).eq("id", id).eq("tenant_id", ctx.tenantId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (body.status === "released" && body.storage) {
      await db.from("mortuary_storage_slots").update({ occupied_body_id: null, updated_at: body.updatedAt })
        .eq("tenant_id", ctx.tenantId)
        .eq("mortuary_id", body.storage.mortuaryId)
        .eq("slot_code", body.storage.slotCode)
    }
    await logHospitalAudit({ ctx, action: "UPDATE", tableName: "mortuary_bodies", recordId: id, newValue: { status: body.status, authorized: true } })
    return NextResponse.json({ body })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Release failed"
    return NextResponse.json({ error: message }, { status: message.includes("FORBIDDEN") ? 403 : 400 })
  }
}
