import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@synapse/db/admin"
import { mortuaryPublicTag } from "@synapse/db/mortuary"

export const dynamic = "force-dynamic"

/** Public tag lookup returns body number only. Never deceased patient PHI. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ bodyNumber: string }> }) {
  const { bodyNumber } = await params
  if (!bodyNumber?.trim()) return NextResponse.json({ error: "Tag required" }, { status: 400 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data } = await db
    .from("mortuary_bodies")
    .select("identity")
    .filter("identity->>bodyNumber", "eq", bodyNumber)
    .limit(1)
    .maybeSingle()
  if (!data) return NextResponse.json({ kind: "mortuary_tag", found: false })
  const tag = mortuaryPublicTag({ identity: data.identity } as never)
  return NextResponse.json({ kind: "mortuary_tag", found: true, bodyNumber: tag.bodyNumber, tagCode: tag.tagCode })
}
