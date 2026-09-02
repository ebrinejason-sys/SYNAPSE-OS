import { NextResponse } from "next/server"
import { hashPassword } from "@synapse/auth"
import { createServiceClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const token = String(body.token ?? "").trim()
  const password = String(body.password ?? "")

  if (!token) return NextResponse.json({ error: "Missing invite token." }, { status: 400 })
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 })
  }

  const db = createServiceClient() as any
  const { data: invite } = await db
    .from("facility_invitations")
    .select("*")
    .eq("invite_token", token)
    .maybeSingle()

  if (!invite) return NextResponse.json({ error: "Invalid invite token." }, { status: 404 })
  if (invite.status === "ACCEPTED") {
    return NextResponse.json({ error: "This invite has already been used." }, { status: 409 })
  }
  if (invite.status === "REVOKED") {
    return NextResponse.json({ error: "This invite was revoked." }, { status: 410 })
  }
  if (new Date(invite.expires_at) < new Date()) {
    await db
      .from("facility_invitations")
      .update({ status: "EXPIRED", updated_at: new Date().toISOString() })
      .eq("id", invite.id)
    return NextResponse.json({ error: "This invite has expired." }, { status: 410 })
  }

  const passwordHash = await hashPassword(password)
  if (invite.profile_id) {
    const { error } = await db
      .from("profiles")
      .update({
        password_hash: passwordHash,
        must_change_password: false,
        password_changed_at: new Date().toISOString(),
        onboarding_complete: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invite.profile_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    return NextResponse.json({ error: "Invite has no linked profile." }, { status: 500 })
  }

  await db
    .from("facility_invitations")
    .update({
      status: "ACCEPTED",
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", invite.id)

  return NextResponse.json({ ok: true })
}
