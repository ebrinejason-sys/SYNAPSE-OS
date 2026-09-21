import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { supabaseAdmin } from "@synapse/db/admin"
import {
  MORTUARY_STATUSES,
  applyMortuaryTransitionCommand,
  assertGenericCustodyDestination,
  assertSameMortuaryTenant,
  assignMortuaryStorage,
  isProtectedMortuaryReleaseStatus,
  mortuaryBodyFromRow,
  mortuaryBodyToRow,
  recordMortuaryProperty,
  transitionMortuaryBody,
} from "@synapse/db/mortuary"
import { isContextError, requireHospitalCapability, logHospitalAudit } from "@/lib/hospital-shared"
import { requireHospitalStaffContext } from "@/lib/hospital-dept"

export const dynamic = "force-dynamic"

const bodySchema = z.object({
  to: z.enum(MORTUARY_STATUSES),
  command_id: z.string().uuid().optional(),
  detail: z.string().max(240).optional(),
  storage: z.object({
    mortuary_id: z.string().min(1).max(80),
    room: z.string().max(80).optional().nullable(),
    section: z.string().max(80).optional().nullable(),
    slot_code: z.string().min(1).max(80),
  }).optional(),
  property: z.array(z.object({
    item: z.string().min(1).max(120),
    description: z.string().max(240).optional().nullable(),
    quantity: z.number().int().positive(),
    sealed_bag_reference: z.string().max(80).optional().nullable(),
    witness: z.string().max(120).optional().nullable(),
  })).optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx
  const cap = await requireHospitalCapability(ctx, "custody", "write", "mortuary")
  if (cap) return cap
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  if (isProtectedMortuaryReleaseStatus(parsed.data.to)) {
    return NextResponse.json({ error: "Use the authorized mortuary release workflow" }, { status: 403 })
  }
  try {
    assertGenericCustodyDestination(parsed.data.to)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Use the authorized mortuary release workflow"
    return NextResponse.json({ error: message }, { status: 403 })
  }
  const { id } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data } = await db.from("mortuary_bodies").select("*").eq("id", id).eq("tenant_id", ctx.tenantId).maybeSingle()
  if (!data) return NextResponse.json({ error: "Body not found" }, { status: 404 })
  let body = mortuaryBodyFromRow(data)
  try {
    assertSameMortuaryTenant(body, ctx.tenantId)
    if (parsed.data.command_id) {
      const applied = Array.isArray(body.audit) ? body.audit.map((row) => row.detail).filter(Boolean) as string[] : []
      body = applyMortuaryTransitionCommand({
        body,
        commandId: parsed.data.command_id,
        appliedCommandIds: applied,
        to: parsed.data.to,
        actorId: ctx.userId,
      })
    } else if (parsed.data.property) {
      body = recordMortuaryProperty(body, {
        actorId: ctx.userId,
        items: parsed.data.property.map((item) => ({
          item: item.item,
          description: item.description,
          quantity: item.quantity,
          sealedBagReference: item.sealed_bag_reference,
          recordedBy: ctx.userId,
          witness: item.witness,
        })),
      })
    } else if (parsed.data.storage) {
      const { data: occupied } = await db.from("mortuary_storage_slots").select("mortuary_id, slot_code, occupied_body_id").eq("tenant_id", ctx.tenantId).not("occupied_body_id", "is", null)
      const occupiedSlotIds = (occupied ?? [])
        .filter((row: { occupied_body_id: string }) => row.occupied_body_id !== body.id)
        .map((row: { mortuary_id: string; slot_code: string }) => `${row.mortuary_id}:${row.slot_code}`)
      body = assignMortuaryStorage(body, {
        actorId: ctx.userId,
        occupiedSlotIds,
        storage: {
          mortuaryId: parsed.data.storage.mortuary_id,
          room: parsed.data.storage.room ?? null,
          section: parsed.data.storage.section ?? null,
          slotCode: parsed.data.storage.slot_code,
        },
      })
    } else {
      body = transitionMortuaryBody(body, { to: parsed.data.to, actorId: ctx.userId, detail: parsed.data.detail })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid transition"
    const status = message === "MORTUARY_TRANSITION_DUPLICATE"
      ? 409
      : message === "MORTUARY_RELEASE_REQUIRES_AUTHORIZED_WORKFLOW"
        ? 403
        : 400
    return NextResponse.json({ error: message }, { status })
  }

  const { error } = await db.from("mortuary_bodies").update(mortuaryBodyToRow(body)).eq("id", id).eq("tenant_id", ctx.tenantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (parsed.data.storage) {
    await db.from("mortuary_storage_slots").upsert({
      tenant_id: ctx.tenantId,
      facility_id: ctx.hospitalId,
      mortuary_id: parsed.data.storage.mortuary_id,
      room: parsed.data.storage.room ?? null,
      section: parsed.data.storage.section ?? null,
      slot_code: parsed.data.storage.slot_code,
      occupied_body_id: body.id,
      updated_at: body.updatedAt,
    }, { onConflict: "tenant_id,mortuary_id,slot_code" })
  }
  await logHospitalAudit({ ctx, action: "UPDATE", tableName: "mortuary_bodies", recordId: id, newValue: { status: body.status } })
  return NextResponse.json({ body })
}
