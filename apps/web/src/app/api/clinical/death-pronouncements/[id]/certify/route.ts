import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { supabaseAdmin } from "@synapse/db/admin"
import {
  assertSameDeathTenant,
  certifyCauseOfDeath,
  deathPronouncementFromRow,
  deathPronouncementToRow,
} from "@synapse/db/death-pronouncement"
import { isContextError, requireHospitalCapability, logHospitalAudit } from "@/lib/hospital-shared"
import { requireHospitalStaffContext } from "@/lib/hospital-dept"

export const dynamic = "force-dynamic"

const bodySchema = z.object({
  cause_of_death: z.array(z.object({
    sequence: z.number().int().positive(),
    role: z.enum(["immediate", "due_to", "underlying", "other_significant"]),
    narrative: z.string().min(1).max(500),
    icd11Code: z.string().max(40).optional().nullable(),
    icd11Title: z.string().max(200).optional().nullable(),
    clinicianConfirmed: z.literal(true),
  })).min(2),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx
  const cap = await requireHospitalCapability(ctx, "death", "certify", "clinical")
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
    const certified = certifyCauseOfDeath(current, {
      certifiedBy: ctx.userId,
      hasCertifyCapability: true,
      causeOfDeath: parsed.data.cause_of_death,
    })
    const { error } = await db.from("death_pronouncements").update(deathPronouncementToRow(certified)).eq("id", id).eq("tenant_id", ctx.tenantId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logHospitalAudit({ ctx, action: "UPDATE", tableName: "death_pronouncements", recordId: id, newValue: { status: "certified" } })
    return NextResponse.json({ pronouncement: certified })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Certification failed"
    const status = message.includes("FORBIDDEN") ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
