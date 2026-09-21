import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@synapse/db/admin"
import { mortuaryPublicTag } from "@synapse/db/mortuary"
import { isContextError, requireHospitalCapability } from "@/lib/hospital-shared"
import { requireHospitalStaffContext } from "@/lib/hospital-dept"

export const dynamic = "force-dynamic"

function notFound() {
  return NextResponse.json({ kind: "mortuary_tag", found: false }, { status: 404 })
}

/**
 * Authenticated, tenant-scoped tag verification.
 * QR contains a facility/body reference only — it is not a public cross-tenant lookup key.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ bodyNumber: string }> }) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx
  const cap = await requireHospitalCapability(ctx, "register", "read", "mortuary")
  if (cap) return cap
  const { bodyNumber } = await params
  const requested = decodeURIComponent(bodyNumber ?? "").trim()
  if (!requested) return NextResponse.json({ error: "Tag required" }, { status: 400 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data } = await db
    .from("mortuary_bodies")
    .select("identity")
    .eq("tenant_id", ctx.tenantId)
    .filter("identity->>bodyNumber", "eq", requested)
    .maybeSingle()
  if (!data?.identity) return notFound()
  const tag = mortuaryPublicTag({ identity: data.identity } as never)
  return NextResponse.json({ kind: "mortuary_tag", found: true, bodyNumber: tag.bodyNumber, tagCode: tag.tagCode })
}
