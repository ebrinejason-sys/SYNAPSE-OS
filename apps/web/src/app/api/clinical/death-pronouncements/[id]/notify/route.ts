import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { supabaseAdmin } from "@synapse/db/admin"
import {
  assertSameDeathTenant,
  deathPronouncementFromRow,
  recordNextOfKinNotification,
} from "@synapse/db/death-pronouncement"
import { nextOfKinTimelineEvent, publishClinicalTimelineBestEffort } from "@synapse/db/clinical-timeline"
import { publishTimelineEvent } from "@synapse/db/identity-persist"
import { isContextError, requireHospitalCapability, logHospitalAudit } from "@/lib/hospital-shared"
import { requireHospitalStaffContext } from "@/lib/hospital-dept"

export const dynamic = "force-dynamic"

const bodySchema = z.object({
  notified: z.boolean(),
  relationship: z.string().max(80).optional().nullable(),
  method: z.string().max(80).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx
  const cap = await requireHospitalCapability(ctx, "death", "pronounce", "clinical")
  if (cap) return cap
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const { id } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data } = await db.from("death_pronouncements").select("*").eq("id", id).eq("tenant_id", ctx.tenantId).maybeSingle()
  if (!data) return NextResponse.json({ error: "Pronouncement not found" }, { status: 404 })
  const current = deathPronouncementFromRow(data)
  try {
    assertSameDeathTenant(current, ctx.tenantId)
  } catch {
    return NextResponse.json({ error: "Pronouncement not found" }, { status: 404 })
  }
  const next = recordNextOfKinNotification(current, { ...parsed.data, actorId: ctx.userId, notifiedBy: ctx.userId })
  const { error } = await db.from("death_pronouncements").update({
    next_of_kin: next.nextOfKin,
    updated_at: next.updatedAt,
    audit: next.audit,
  }).eq("id", id).eq("tenant_id", ctx.tenantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logHospitalAudit({ ctx, action: "UPDATE", tableName: "death_pronouncements", recordId: id, newValue: { next_of_kin_notified: parsed.data.notified } })
  if (parsed.data.notified) {
    void publishClinicalTimelineBestEffort(
      publishTimelineEvent,
      nextOfKinTimelineEvent({
        tenantId: ctx.tenantId,
        hospitalId: ctx.hospitalId,
        patientId: next.patientId,
        encounterId: next.encounterId,
        pronouncementId: next.id,
        createdBy: ctx.userId,
      }),
    )
  }
  return NextResponse.json({ pronouncement: next })
}
