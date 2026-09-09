import { NextResponse } from "next/server"
import { hashPassword } from "@synapse/auth"
import { createServiceClient } from "@/lib/supabase/server"
import { canBindInviteToTenant } from "@/lib/invite-scope"

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
  const trustedTenantId = request.headers.get("x-tenant-id")?.trim()
  if (trustedTenantId && trustedTenantId !== invite.tenant_id) {
    return NextResponse.json({ error: "This invitation belongs to another facility." }, { status: 403 })
  }
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

  const { data: tenant } = await db
    .from("tenants")
    .select("id, is_active")
    .eq("id", invite.tenant_id)
    .maybeSingle()
  if (!tenant) return NextResponse.json({ error: "This invite is not bound to a facility." }, { status: 409 })

  const { data: profile } = await db
    .from("profiles")
    .select("id, tenant_id")
    .eq("id", invite.profile_id)
    .maybeSingle()
  if (!profile) return NextResponse.json({ error: "Invite has no linked profile." }, { status: 409 })
  if (!canBindInviteToTenant(profile.tenant_id, [], invite.tenant_id)) {
    return NextResponse.json({ error: "This account is already associated with another facility." }, { status: 403 })
  }

  const { data: activeScopes } = await db
    .from("staff_scope_assignments")
    .select("id, tenant_id")
    .eq("profile_id", invite.profile_id)
    .eq("is_active", true)
  if (!canBindInviteToTenant(profile.tenant_id, (activeScopes ?? []).map((scope: { tenant_id: string | null }) => scope.tenant_id), invite.tenant_id)) {
    return NextResponse.json({ error: "This account is already scoped to another facility." }, { status: 403 })
  }

  const passwordHash = await hashPassword(password)
  if (invite.profile_id) {
    const { error } = await db
      .from("profiles")
      .update({
        tenant_id: invite.tenant_id,
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

  if (!(activeScopes ?? []).some((scope: { tenant_id: string | null }) => scope.tenant_id === invite.tenant_id)) {
    const { error: scopeError } = await db.from("staff_scope_assignments").insert({
      profile_id: invite.profile_id,
      tenant_id: invite.tenant_id,
      role: invite.role,
      is_active: true,
    })
    if (scopeError) return NextResponse.json({ error: "Failed to bind staff access to this facility." }, { status: 500 })
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
