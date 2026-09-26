import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { requirePharmacyPermission } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { sendEmail, generateWelcomeEmail } from "@/lib/email"
import { generatePassword } from "@/lib/utils"
import { hashPassword, validatePasswordStrength } from "@synapse/auth/password"

const db = supabaseAdmin

type UserSettingRow = {
  profile_id: string
  username: string | null
  pharmacy_role: string | null
  permissions: string[] | null
  is_active: boolean | null
  two_factor_enabled: boolean | null
  created_at: string | null
  store_id: string | null
}

type ProfileSummaryRow = {
  id: string
  full_name: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
}

/**
 * Profile roles an administrator of a pharmacy tenant may manage. Anything else
 * (platform_admin, superadmin, hospital/clinical roles, patients) is outside
 * pharmacy staff scope and is treated as not found.
 */
const PHARMACY_STAFF_PROFILE_ROLES = new Set([
  "pharmacy_admin",
  "pharmacy_ceo",
  "pharmacy_owner",
  "pharmacy_staff",
  "pharmacy_cashier",
  "cashier",
  "pharmacist",
  "inventory_officer",
  "pharmacy_store_manager",
  "store_manager",
  "finance",
])

/** pharmacy_user_settings.pharmacy_role values an admin may assign. */
const ASSIGNABLE_PHARMACY_ROLES = new Set([
  "pharmacy_admin",
  "pharmacy_ceo",
  "pharmacy_staff",
  "pharmacy_cashier",
  "pharmacist",
  "inventory_officer",
  "pharmacy_store_manager",
  "finance",
])

type TenantStaffTarget = {
  id: string
  email: string | null
  full_name: string | null
  pharmacy_role: string | null
}

/**
 * Resolve a management target strictly inside the caller's tenant. The target must
 * have a pharmacy_user_settings row in this tenant AND a profile whose own tenant_id
 * is this tenant and whose role is pharmacy staff. Returns null otherwise, and the
 * caller must answer 404 so other tenants' accounts cannot be probed.
 */
async function resolveTenantStaffTarget(tenantId: string, id: unknown): Promise<TenantStaffTarget | null> {
  if (typeof id !== "string" || id.trim().length === 0) return null
  const { data: settings } = await db
    .from("pharmacy_user_settings")
    .select("profile_id, pharmacy_role")
    .eq("tenant_id", tenantId)
    .eq("profile_id", id)
    .maybeSingle()
  if (!settings) return null
  const { data: profile } = await (db as any)
    .from("profiles")
    .select("id, email, full_name, role, tenant_id")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle()
  if (!profile || profile.id !== id || profile.tenant_id !== tenantId) return null
  if (!PHARMACY_STAFF_PROFILE_ROLES.has(String(profile.role ?? ""))) return null
  return {
    id,
    email: profile.email ?? null,
    full_name: profile.full_name ?? null,
    pharmacy_role: (settings as { pharmacy_role: string | null }).pharmacy_role ?? null,
  }
}

const notFound = () => NextResponse.json({ error: "User not found" }, { status: 404 })

// ── GET — list all users for this tenant ──────────────────────────────────────

export async function GET() {
  try {
    const auth = await requirePharmacyPermission("staff.manage")
  if (!auth.ok) return auth.response
  const { session, tenantId } = auth

    if (!tenantId) return NextResponse.json({ error: "Tenant not found" }, { status: 400 })

    let { data: userSettings, error: settingsError } = await db
      .from("pharmacy_user_settings")
      .select("profile_id, username, pharmacy_role, permissions, is_active, two_factor_enabled, created_at, store_id")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })

    if (settingsError && String(settingsError.message ?? "").toLowerCase().includes("store_id")) {
      const fallback = await db
        .from("pharmacy_user_settings")
        .select("profile_id, username, pharmacy_role, permissions, is_active, two_factor_enabled, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
      userSettings = fallback.data as typeof userSettings
      settingsError = fallback.error
    }

    if (settingsError) {
      console.error("Error fetching user settings:", settingsError)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    if (!userSettings || userSettings.length === 0) return NextResponse.json([])

    const settingsRows = (userSettings ?? []) as UserSettingRow[]
    const profileIds = settingsRows.map((s) => s.profile_id)

    const { data: profiles } = await db
      .from("profiles")
      .select("id, full_name, first_name, last_name, email")
      .in("id", profileIds)

    const profileRows = (profiles ?? []) as ProfileSummaryRow[]
    const profileMap = new Map(profileRows.map((p) => [p.id, p]))

    const users = settingsRows.map((setting) => {
      const profile = profileMap.get(setting.profile_id)
      const name =
        profile?.full_name ||
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
        storeId: setting.store_id ?? null,
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
    const auth = await requirePharmacyPermission("staff.manage")
  if (!auth.ok) return auth.response
  const { session, tenantId } = auth

    if (!tenantId) return NextResponse.json({ error: "Tenant not found" }, { status: 400 })

    const { name, email, username, role, permissions, storeId, password: providedPassword, sendWelcomeEmail } =
      await request.json()
    if (!name || !email || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const roleMap: Record<string, string> = {
      ADMIN: "pharmacy_admin", CEO: "pharmacy_ceo", STAFF: "pharmacy_staff",
      pharmacy_admin: "pharmacy_admin", pharmacy_ceo: "pharmacy_ceo", pharmacy_staff: "pharmacy_staff",
    }
    const pharmacyRole = roleMap[role] ?? "pharmacy_staff"

    if (storeId) {
      const { data: store } = await db
        .from("pharmacy_stores")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("id", storeId)
        .maybeSingle()
      if (!store) return NextResponse.json({ error: "Store not found" }, { status: 400 })
    }

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

    const customPassword =
      typeof providedPassword === "string" && providedPassword.trim().length > 0
        ? providedPassword.trim()
        : null
    if (customPassword) {
      const strength = validatePasswordStrength(customPassword)
      if (!strength.valid) {
        return NextResponse.json(
          { error: strength.errors[0] ?? "Password is too weak" },
          { status: 400 },
        )
      }
    }

    const password = customPassword ?? generatePassword()
    const passwordHash = await hashPassword(password)
    const mustChangePassword = !customPassword
    const now = new Date().toISOString()
    const newUserId = randomUUID()

    // Create profile row (custom auth)
    const { data: newProfile, error: profileError } = await db
      .from("profiles")
      .insert({
        id: newUserId,
        email: email.toLowerCase(),
        full_name: name,
        password_hash: passwordHash,
        role: pharmacyRole,
        tenant_id: tenantId,
        verification_status: "verified",
        email_verified_at: now,
        is_deleted: false,
        must_change_password: mustChangePassword,
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single()

    if (profileError || !newProfile) {
      console.error("Error creating profile:", profileError)
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 })
    }

    const settingsPayload: Record<string, unknown> = {
        tenant_id: tenantId,
        profile_id: newUserId,
        username: username ? username.toLowerCase() : null,
        pharmacy_role: pharmacyRole,
        permissions: pharmacyRole === "pharmacy_admin" || pharmacyRole === "pharmacy_ceo" ? [] : permissions ?? [],
        must_change_password: mustChangePassword,
        // Email OTP at login is role-based for pharmacy admins. TOTP remains opt-in.
        two_factor_enabled: false,
        is_active: true,
        created_by: session.user.id,
        created_at: now,
        updated_at: now,
    }
    if (storeId) settingsPayload.store_id = storeId

    let { error: settingsError } = await db
      .from("pharmacy_user_settings")
      .insert(settingsPayload)

    if (settingsError && storeId && String(settingsError.message ?? "").toLowerCase().includes("store_id")) {
      delete settingsPayload.store_id
      const retry = await db.from("pharmacy_user_settings").insert(settingsPayload)
      settingsError = retry.error
    }

    if (settingsError) {
      console.error("Error inserting user settings:", settingsError)
      await db.from("profiles").delete().eq("id", newUserId).eq("tenant_id", tenantId)
      return NextResponse.json({ error: "Failed to create user settings" }, { status: 500 })
    }

    const shouldEmail = sendWelcomeEmail !== false
    let emailSent = false
    if (shouldEmail) {
      const emailResult = await sendEmail({
        to: email,
        subject: "Welcome to Synapse Pharmacy — Your Account Details",
        html: generateWelcomeEmail(name, email, password, pharmacyRole),
      })
      emailSent = emailResult.success
      if (!emailResult.success) console.error("Failed to send welcome email:", emailResult.error)
    }

    await db.from("pharmacy_audit_logs").insert({
      tenant_id: tenantId,
      profile_id: session.user.id,
      action: "CREATE_USER",
      entity: "USER",
      entity_id: newUserId,
      details: `Created user: ${name} (${email})${customPassword ? " with admin-set password" : ""}`,
    })

    return NextResponse.json({
      success: true,
      user: { id: newUserId, name, email, role: pharmacyRole },
      emailSent,
      /** Only returned when admin set the password and chose not to email — for one-time display. */
      temporaryPassword: !shouldEmail && customPassword ? password : undefined,
    })
  } catch (error) {
    console.error("Create user error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ── DELETE — remove a staff user ──────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requirePharmacyPermission("staff.manage")
  if (!auth.ok) return auth.response
  const { session, tenantId } = auth

    if (!tenantId) return NextResponse.json({ error: "Tenant not found" }, { status: 400 })

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("id")
    if (!userId) return NextResponse.json({ error: "User ID required" }, { status: 400 })
    if (userId === session.user.id) return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 })

    // Tenant + staff-scope check before any write.
    const target = await resolveTenantStaffTarget(tenantId, userId)
    if (!target) return notFound()
    const targetName = target.full_name ?? target.email ?? userId

    await db.from("pharmacy_notifications").delete().eq("tenant_id", tenantId).eq("profile_id", userId)
    // Audit history is never deleted. The profile is soft-deleted (is_deleted), so the
    // pharmacy_audit_logs.profile_id FK (ON DELETE NO ACTION) stays satisfied and the
    // user's past actions remain attributable.
    await db.from("pharmacy_orders").update({ processed_by: null }).eq("tenant_id", tenantId).eq("processed_by", userId)
    await db.from("pharmacy_orders").update({ claimed_by: null, claimed_at: null }).eq("tenant_id", tenantId).eq("claimed_by", userId)
    await db.from("pharmacy_user_settings").delete().eq("tenant_id", tenantId).eq("profile_id", userId)
    await db.from("synapse_sessions").delete().eq("user_id", userId)
    await db
      .from("profiles")
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .eq("tenant_id", tenantId)

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
    const auth = await requirePharmacyPermission("staff.manage")
  if (!auth.ok) return auth.response
  const { session, tenantId } = auth

    if (!tenantId) return NextResponse.json({ error: "Tenant not found" }, { status: 400 })

    const { id, name, username, role, permissions, isActive, resetPassword, password: setPassword } =
      await request.json()
    if (!id) return NextResponse.json({ error: "User ID required" }, { status: 400 })

    const roleMap: Record<string, string> = {
      ADMIN: "pharmacy_admin", CEO: "pharmacy_ceo", STAFF: "pharmacy_staff",
      pharmacy_admin: "pharmacy_admin", pharmacy_ceo: "pharmacy_ceo", pharmacy_staff: "pharmacy_staff",
    }
    const pharmacyRole = role ? (roleMap[role] ?? role) : undefined
    if (pharmacyRole && !ASSIGNABLE_PHARMACY_ROLES.has(pharmacyRole)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }

    // Tenant + staff-scope check before ANY write (including the self-block audit).
    // Accounts in other tenants, platform admins and non-pharmacy roles are "not found".
    const target = await resolveTenantStaffTarget(tenantId, id)
    if (!target) return notFound()

    // Server-side self-protection: an admin may not deactivate their own account
    // or change their own pharmacy role (either can lock the pharmacy out of administration).
    if (id === session.user.id) {
      const changesOwnRole = Boolean(pharmacyRole) && pharmacyRole !== target.pharmacy_role
      if (isActive === false || changesOwnRole) {
        await db.from("pharmacy_audit_logs").insert({
          tenant_id: tenantId,
          profile_id: session.user.id,
          action: "SELF_LIFECYCLE_BLOCKED",
          entity: "USER",
          entity_id: id,
          details: isActive === false ? "Blocked self-deactivation" : "Blocked self role change",
        })
        return NextResponse.json(
          { error: "You cannot deactivate or change the role of your own account. Ask another administrator." },
          { status: 403 },
        )
      }
    }

    if (typeof setPassword === "string" && setPassword.trim().length > 0) {
      const strength = validatePasswordStrength(setPassword.trim())
      if (!strength.valid) {
        return NextResponse.json({ error: strength.errors[0] ?? "Password is too weak" }, { status: 400 })
      }
      const newHash = await hashPassword(setPassword.trim())
      await db
        .from("profiles")
        .update({
          password_hash: newHash,
          must_change_password: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("tenant_id", tenantId)
      await db
        .from("pharmacy_user_settings")
        .update({ must_change_password: false, updated_at: new Date().toISOString() })
        .eq("tenant_id", tenantId)
        .eq("profile_id", id)
      await db.from("synapse_sessions").delete().eq("user_id", id)
      await db.from("pharmacy_audit_logs").insert({
        tenant_id: tenantId,
        profile_id: session.user.id,
        action: "SET_PASSWORD",
        entity: "USER",
        entity_id: id,
        details: `Admin set password for user ${id}`,
      })
      return NextResponse.json({ success: true, message: "Password updated" })
    }

    if (resetPassword) {
      const targetProfile = target
      if (!targetProfile.email) return notFound()

      const newPassword = generatePassword()
      const newHash = await hashPassword(newPassword)

      await db.from("profiles").update({ password_hash: newHash, must_change_password: true, updated_at: new Date().toISOString() }).eq("id", id).eq("tenant_id", tenantId)
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
      await db
        .from("profiles")
        .update({ full_name: name, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("tenant_id", tenantId)
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
