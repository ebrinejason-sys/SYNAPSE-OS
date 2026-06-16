import { NextRequest, NextResponse } from "next/server"
import { getPharmacySession, isPharmacyAdmin } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { sendEmail, generateWelcomeEmail } from "@/lib/email"
import { generatePassword } from "@/lib/utils"
import { hashPassword } from "@synapse/auth/password"

const db = supabaseAdmin as any

// ── GET — list all users for this tenant ──────────────────────────────────────

export async function GET() {
  try {
    const session = await getPharmacySession()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!isPharmacyAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const tenantId = session.profile.tenant_id
    if (!tenantId) return NextResponse.json({ error: "Tenant not found" }, { status: 400 })

    const { data: userSettings, error: settingsError } = await db
      .from("pharmacy_user_settings")
      .select("profile_id, username, pharmacy_role, permissions, is_active, two_factor_enabled, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })

    if (settingsError) {
      console.error("Error fetching user settings:", settingsError)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    if (!userSettings || userSettings.length === 0) return NextResponse.json([])

    const profileIds = userSettings.map((s: any) => s.profile_id)

    const { data: profiles } = await db
      .from("profiles")
      .select("id, full_name, first_name, last_name, email")
      .in("id", profileIds)

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]))

    const users = userSettings.map((setting: any) => {
      const profile: any = profileMap.get(setting.profile_id)
      const name =
        profile?.full_name ??
        [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
        profile?.email?.split("@")[0] ||
        ""
      return {
        id: setting.profile_id,
        name,
        email: profile?.email ?? "",
        username: setting.username,
        role: setting.pharmacy_role,
        permissions: setting.permissions ?? [],
        isActive: setting.is_active,
        twoFactorEnabled: setting.two_factor_enabled ?? false,
        createdAt: setting.created_at,
      }
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error("Get users error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ── POST — create a new staff user (custom auth, not Supabase Auth) ───────────

export async function POST(request: NextRequest) {
  try {
    const session = await getPharmacySession()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!isPharmacyAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const tenantId = session.profile.tenant_id
    if (!tenantId) return NextResponse.json({ error: "Tenant not found" }, { status: 400 })

    const { name, email, username, role, permissions } = await request.json()
    if (!name || !email || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const roleMap: Record<string, string> = {
      ADMIN: "pharmacy_admin", CEO: "pharmacy_ceo", STAFF: "pharmacy_staff",
      pharmacy_admin: "pharmacy_admin", pharmacy_ceo: "pharmacy_ceo", pharmacy_staff: "pharmacy_staff",
    }
    const pharmacyRole = roleMap[role] ?? "pharmacy_staff"

    // Check email not already taken
    const { data: existingProfile } = await db
      .from("profiles")
      .select("id")
      .eq("email", email.toLowerCase())
      .maybeSingle()
    if (existingProfile) {
      return NextResponse.json({ error: "User with this email already exists" }, { status: 400 })
    }

    // Check username uniqueness within tenant
    if (username) {
      const { data: existingUsername } = await db
        .from("pharmacy_user_settings")
        .select("profile_id")
        .eq("tenant_id", tenantId)
        .eq("username", username.toLowerCase())
        .maybeSingle()
      if (existingUsername) {
        return NextResponse.json({ error: "Username is already taken" }, { status: 400 })
      }
    }

    const password = generatePassword()
    const passwordHash = await hashPassword(password)
    const now = new Date().toISOString()

    // Create profile row (custom auth)
    const { data: newProfile, error: profileError } = await db
      .from("profiles")
      .insert({
        email: email.toLowerCase(),
        full_name: name,
        password_hash: passwordHash,
        role: pharmacyRole,
        tenant_id: tenantId,
        verification_status: "verified",
        email_verified_at: now,
        is_deleted: false,
        must_change_password: true,
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single()

    if (profileError || !newProfile) {
      console.error("Error creating profile:", profileError)
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 })
    }

    const newUserId = newProfile.id

    const { error: settingsError } = await db
      .from("pharmacy_user_settings")
      .insert({
        tenant_id: tenantId,
        profile_id: newUserId,
        username: username ? username.toLowerCase() : null,
        pharmacy_role: pharmacyRole,
        permissions: pharmacyRole === "pharmacy_admin" || pharmacyRole === "pharmacy_ceo" ? [] : permissions ?? [],
        must_change_password: true,
        is_active: true,
        created_by: session.user.id,
        created_at: now,
        updated_at: now,
      })

    if (settingsError) {
      console.error("Error inserting user settings:", settingsError)
      await db.from("profiles").delete().eq("id", newUserId)
      return NextResponse.json({ error: "Failed to create user settings" }, { status: 500 })
    }

    const emailResult = await sendEmail({
      to: email,
      subject: "Welcome to Synapse Pharmacy — Your Account Details",
      html: generateWelcomeEmail(name, email, password, pharmacyRole),
    })
    if (!emailResult.success) console.error("Failed to send welcome email:", emailResult.error)

    await db.from("pharmacy_audit_logs").insert({
      tenant_id: tenantId,
      profile_id: session.user.id,
      action: "CREATE_USER",
      entity: "USER",
      entity_id: newUserId,
      details: `Created user: ${name} (${email})`,
    })

    return NextResponse.json({ success: true, user: { id: newUserId, name, email, role: pharmacyRole } })
  } catch (error) {
    console.error("Create user error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ── DELETE — remove a staff user ──────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const session = await getPharmacySession()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!isPharmacyAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const tenantId = session.profile.tenant_id
    if (!tenantId) return NextResponse.json({ error: "Tenant not found" }, { status: 400 })

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("id")
    if (!userId) return NextResponse.json({ error: "User ID required" }, { status: 400 })
    if (userId === session.user.id) return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 })

    const { data: targetSettings, error: targetError } = await db
      .from("pharmacy_user_settings")
      .select("pharmacy_role, profile_id")
      .eq("tenant_id", tenantId)
      .eq("profile_id", userId)
      .single()

    if (targetError || !targetSettings) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const { data: targetProfile } = await db.from("profiles").select("email, full_name").eq("id", userId).maybeSingle()
    const targetName = targetProfile?.full_name ?? targetProfile?.email ?? userId

    await db.from("pharmacy_notifications").delete().eq("tenant_id", tenantId).eq("profile_id", userId)
    await db.from("pharmacy_audit_logs").delete().eq("tenant_id", tenantId).eq("profile_id", userId)
    await db.from("pharmacy_orders").update({ processed_by: null }).eq("tenant_id", tenantId).eq("processed_by", userId)
    await db.from("pharmacy_orders").update({ claimed_by: null, claimed_at: null }).eq("tenant_id", tenantId).eq("claimed_by", userId)
    await db.from("pharmacy_user_settings").delete().eq("tenant_id", tenantId).eq("profile_id", userId)
    await db.from("synapse_sessions").delete().eq("user_id", userId)
    await db.from("profiles").update({ is_deleted: true, updated_at: new Date().toISOString() }).eq("id", userId)

    await db.from("pharmacy_audit_logs").insert({
      tenant_id: tenantId,
      profile_id: session.user.id,
      action: "DELETE_USER",
      entity: "USER",
      entity_id: userId,
      details: `Deleted user account: ${targetName}`,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete user error:", error)
    return NextResponse.json({ error: "Failed to delete user. Please try again." }, { status: 500 })
  }
}

// ── PATCH — update user or reset password ────────────────────────────────────

export async function PATCH(request: NextRequest) {
  try {
    const session = await getPharmacySession()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!isPharmacyAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const tenantId = session.profile.tenant_id
    if (!tenantId) return NextResponse.json({ error: "Tenant not found" }, { status: 400 })

    const { id, name, username, role, permissions, isActive, resetPassword } = await request.json()
    if (!id) return NextResponse.json({ error: "User ID required" }, { status: 400 })

    if (resetPassword) {
      const { data: targetProfile } = await db.from("profiles").select("email, full_name").eq("id", id).maybeSingle()
      if (!targetProfile) return NextResponse.json({ error: "User not found" }, { status: 404 })

      const newPassword = generatePassword()
      const newHash = await hashPassword(newPassword)

      await db.from("profiles").update({ password_hash: newHash, must_change_password: true, updated_at: new Date().toISOString() }).eq("id", id)
      await db.from("pharmacy_user_settings").update({ must_change_password: true, updated_at: new Date().toISOString() }).eq("tenant_id", tenantId).eq("profile_id", id)
      await db.from("synapse_sessions").delete().eq("user_id", id)

      const emailResult = await sendEmail({
        to: targetProfile.email,
        subject: "Password Reset — Synapse Pharmacy",
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#F97316">Password Reset</h2>
          <p>Hello ${targetProfile.full_name ?? targetProfile.email},</p>
          <p>Your password has been reset by an administrator.</p>
          <div style="background:#f3f4f6;padding:20px;border-radius:8px;margin:20px 0">
            <p><strong>Email:</strong> ${targetProfile.email}</p>
            <p><strong>New Password:</strong> ${newPassword}</p>
          </div>
          <p style="color:#dc2626"><strong>Important:</strong> You will be required to change this password on next login.</p>
        </div>`,
      })

      await db.from("pharmacy_audit_logs").insert({
        tenant_id: tenantId,
        profile_id: session.user.id,
        action: "RESET_PASSWORD",
        entity: "USER",
        entity_id: id,
        details: `Reset password for: ${targetProfile.full_name ?? targetProfile.email}`,
      })

      return NextResponse.json({ success: true, message: "Password reset. New credentials sent via email.", emailSent: emailResult.success })
    }

    if (username) {
      const { data: existingUsername } = await db
        .from("pharmacy_user_settings")
        .select("profile_id")
        .eq("tenant_id", tenantId)
        .eq("username", username.toLowerCase())
        .neq("profile_id", id)
        .maybeSingle()
      if (existingUsername) return NextResponse.json({ error: "Username is already taken" }, { status: 400 })
    }

    const roleMap: Record<string, string> = {
      ADMIN: "pharmacy_admin", CEO: "pharmacy_ceo", STAFF: "pharmacy_staff",
      pharmacy_admin: "pharmacy_admin", pharmacy_ceo: "pharmacy_ceo", pharmacy_staff: "pharmacy_staff",
    }
    const pharmacyRole = role ? (roleMap[role] ?? role) : undefined

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (username !== undefined) updateData.username = username ? username.toLowerCase() : null
    if (pharmacyRole) updateData.pharmacy_role = pharmacyRole
    if (permissions !== undefined) {
      updateData.permissions = pharmacyRole === "pharmacy_admin" || pharmacyRole === "pharmacy_ceo" ? [] : permissions ?? []
    }
    if (isActive !== undefined) updateData.is_active = isActive

    const { error: updateError } = await db
      .from("pharmacy_user_settings")
      .update(updateData)
      .eq("tenant_id", tenantId)
      .eq("profile_id", id)

    if (updateError) {
      console.error("Error updating user settings:", updateError)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    if (name) {
      await db.from("profiles").update({ full_name: name, updated_at: new Date().toISOString() }).eq("id", id)
    }

    await db.from("pharmacy_audit_logs").insert({
      tenant_id: tenantId,
      profile_id: session.user.id,
      action: "UPDATE_USER",
      entity: "USER",
      entity_id: id,
      details: `Updated user: ${name ?? id}`,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Update user error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
