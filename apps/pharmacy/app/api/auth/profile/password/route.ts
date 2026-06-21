import { NextRequest, NextResponse } from "next/server"
import { getPharmacySession } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { verifyPassword, hashPassword, validatePasswordStrength } from "@synapse/auth"

export async function POST(request: NextRequest) {
  const session = await getPharmacySession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : ""
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : ""

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Current and new password are required" }, { status: 400 })
  }

  const strengthError = validatePasswordStrength(newPassword)
  if (strengthError) return NextResponse.json({ error: strengthError }, { status: 400 })

  const db = supabaseAdmin as any
  const { data: profile } = await db
    .from("profiles")
    .select("id, password_hash")
    .eq("id", session.userId)
    .single()

  if (!profile?.password_hash) {
    return NextResponse.json({ error: "Account does not have a password set" }, { status: 400 })
  }

  const valid = await verifyPassword(currentPassword, profile.password_hash as string)
  if (!valid) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 })
  }

  const newHash = await hashPassword(newPassword)
  const { error: updateError } = await db
    .from("profiles")
    .update({ password_hash: newHash, must_change_password: false })
    .eq("id", session.userId)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
