import { NextRequest, NextResponse } from "next/server"
import { getPharmacySession, isPharmacyAdmin } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { sendEmail, generateWelcomeEmail } from "@/lib/email"
import { generatePassword } from "@/lib/utils"

export async function GET(request: NextRequest) {
  try {
    const session = await getPharmacySession()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (!isPharmacyAdmin(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tenantId = session.profile.tenant_id
    if (!tenantId) return NextResponse.json({ error: "Tenant not found" }, { status: 400 })

    // Get all pharmacy_user_settings for this tenant
    const supabase = await createClient()
    const { data: userSettings, error: settingsError } = await supabase
      .from("pharmacy_user_settings")
      .select("profile_id, username, pharmacy_role, permissions, is_active, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })

    if (settingsError) {
      console.error("Error fetching user settings:", settingsError)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    if (!userSettings || userSettings.length === 0) {
      return NextResponse.json([])
    }

    // Get all auth users (paginated)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    if (authError) {
      console.error("Error fetching auth users:", authError)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    const profileIds = userSettings.map((s) => s.profile_id)

    // Get profiles for name info
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, first_name, last_name")
      .in("id", profileIds)

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))
    const authUserMap = new Map(authData.users.map((u) => [u.id, u]))

    const users = userSettings.map((setting) => {
      const authUser = authUserMap.get(setting.profile_id)
      const profile = profileMap.get(setting.profile_id)
      return {
        id: setting.profile_id,
        name: profile?.full_name ?? `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() ?? authUser?.email ?? "",
        email: authUser?.email ?? "",
        username: setting.username,
        role: setting.pharmacy_role,
        permissions: setting.permissions ?? [],
        isActive: setting.is_active,
        createdAt: setting.created_at,
      }
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error("Get users error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getPharmacySession()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (!isPharmacyAdmin(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tenantId = session.profile.tenant_id
    if (!tenantId) return NextResponse.json({ error: "Tenant not found" }, { status: 400 })

    const { name, email, username, role, permissions } = await request.json()

    if (!name || !email || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Map old roles to new pharmacy roles
    const roleMap: Record<string, string> = {
      ADMIN: "pharmacy_admin",
      CEO: "pharmacy_ceo",
      STAFF: "pharmacy_staff",
      pharmacy_admin: "pharmacy_admin",
      pharmacy_ceo: "pharmacy_ceo",
      pharmacy_staff: "pharmacy_staff",
    }
    const pharmacyRole = roleMap[role] ?? "pharmacy_staff"

    // Check if email is already taken in Supabase Auth
    const { data: existingAuthUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    const emailTaken = existingAuthUsers?.users.some((u) => u.email === email)
    if (emailTaken) {
      return NextResponse.json({ error: "User with this email already exists" }, { status: 400 })
    }

    // Check if username is taken in this tenant
    if (username) {
      const { data: existingUsername } = await supabaseAdmin
        .from("pharmacy_user_settings")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("username", username.toLowerCase())
        .maybeSingle()

      if (existingUsername) {
        return NextResponse.json({ error: "Username is already taken" }, { status: 400 })
      }
    }

    // Generate password
    const password = generatePassword()

    // Create user in Supabase Auth
    const { data: newAuthUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name },
    })

    if (createError || !newAuthUser.user) {
      console.error("Error creating auth user:", createError)
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 })
    }

    const newUserId = newAuthUser.user.id

    // Insert pharmacy_user_settings
    const { error: settingsError } = await supabaseAdmin
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
      })

    if (settingsError) {
      console.error("Error inserting user settings:", settingsError)
      // Rollback: delete the auth user
      await supabaseAdmin.auth.admin.deleteUser(newUserId)
      return NextResponse.json({ error: "Failed to create user settings" }, { status: 500 })
    }

    // Send welcome email
    const emailResult = await sendEmail({
      to: email,
      subject: "Welcome to SYNAPSE Pharm - Your Account Details",
      html: generateWelcomeEmail(name, email, password, pharmacyRole),
    })

    if (!emailResult.success) {
      console.error("Failed to send welcome email:", emailResult.error)
    }

    // Create audit log
    await supabaseAdmin.from("pharmacy_audit_logs").insert({
      tenant_id: tenantId,
      profile_id: session.user.id,
      action: "CREATE_USER",
      entity: "USER",
      entity_id: newUserId,
      details: `Created user: ${name} (${email})`,
    })

    return NextResponse.json({
      success: true,
      user: {
        id: newUserId,
        name,
        email,
        role: pharmacyRole,
      },
    })
  } catch (error) {
    console.error("Create user error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getPharmacySession()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (!isPharmacyAdmin(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tenantId = session.profile.tenant_id
    if (!tenantId) return NextResponse.json({ error: "Tenant not found" }, { status: 400 })

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("id")

    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 })
    }

    // Prevent self-deletion
    if (userId === session.user.id) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 })
    }

    // Check target user exists in this tenant
    const { data: targetSettings, error: targetError } = await supabaseAdmin
      .from("pharmacy_user_settings")
      .select("pharmacy_role, profile_id")
      .eq("tenant_id", tenantId)
      .eq("profile_id", userId)
      .single()

    if (targetError || !targetSettings) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Get name for audit log
    const { data: targetAuthUser } = await supabaseAdmin.auth.admin.getUserById(userId)
    const targetName = targetAuthUser?.user?.user_metadata?.full_name ?? targetAuthUser?.user?.email ?? userId

    // Delete notifications
    await supabaseAdmin
      .from("pharmacy_notifications")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("profile_id", userId)

    // Delete audit logs
    await supabaseAdmin
      .from("pharmacy_audit_logs")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("profile_id", userId)

    // Nullify order references
    await supabaseAdmin
      .from("pharmacy_orders")
      .update({ processed_by: null })
      .eq("tenant_id", tenantId)
      .eq("processed_by", userId)

    await supabaseAdmin
      .from("pharmacy_orders")
      .update({ claimed_by: null, claimed_at: null })
      .eq("tenant_id", tenantId)
      .eq("claimed_by", userId)

    // Keep transactions — do not delete them

    // Delete user settings
    await supabaseAdmin
      .from("pharmacy_user_settings")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("profile_id", userId)

    // Delete from Supabase Auth
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (deleteAuthError) {
      console.error("Error deleting auth user:", deleteAuthError)
      return NextResponse.json({ error: "Failed to delete user from auth" }, { status: 500 })
    }

    // Create audit log
    await supabaseAdmin.from("pharmacy_audit_logs").insert({
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

export async function PATCH(request: NextRequest) {
  try {
    const session = await getPharmacySession()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (!isPharmacyAdmin(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tenantId = session.profile.tenant_id
    if (!tenantId) return NextResponse.json({ error: "Tenant not found" }, { status: 400 })

    const { id, name, username, role, permissions, isActive, resetPassword } = await request.json()

    if (!id) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 })
    }

    // Handle password reset
    if (resetPassword) {
      const { data: authUserData, error: authFetchError } = await supabaseAdmin.auth.admin.getUserById(id)
      if (authFetchError || !authUserData.user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 })
      }

      const userEmail = authUserData.user.email
      const userName = authUserData.user.user_metadata?.full_name ?? userEmail ?? id

      const newPassword = generatePassword()

      const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(id, {
        password: newPassword,
      })

      if (updateAuthError) {
        console.error("Error resetting password:", updateAuthError)
        return NextResponse.json({ error: "Failed to reset password" }, { status: 500 })
      }

      // Mark must_change_password = true
      await supabaseAdmin
        .from("pharmacy_user_settings")
        .update({ must_change_password: true, updated_at: new Date().toISOString() })
        .eq("tenant_id", tenantId)
        .eq("profile_id", id)

      // Send password reset email
      const emailResult = await sendEmail({
        to: userEmail ?? "",
        subject: "Password Reset - SYNAPSE Pharm",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #059669;">Password Reset</h2>
            <p>Hello ${userName},</p>
            <p>Your password has been reset by an administrator. Here are your new login credentials:</p>
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Email:</strong> ${userEmail}</p>
              <p><strong>New Password:</strong> ${newPassword}</p>
            </div>
            <p style="color: #dc2626;"><strong>Important:</strong> You will be required to change this password on your next login.</p>
            <p>Login at: <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://synapseos.tech"}/login">Login</a></p>
            <br>
            <p>Best regards,<br>SYNAPSE Pharm</p>
          </div>
        `,
      })

      // Create audit log
      await supabaseAdmin.from("pharmacy_audit_logs").insert({
        tenant_id: tenantId,
        profile_id: session.user.id,
        action: "RESET_PASSWORD",
        entity: "USER",
        entity_id: id,
        details: `Reset password for user: ${userName} (${userEmail})`,
      })

      return NextResponse.json({
        success: true,
        message: "Password reset successfully. New credentials sent via email.",
        emailSent: emailResult.success,
      })
    }

    // Check username uniqueness within tenant
    if (username) {
      const { data: existingUsername } = await supabaseAdmin
        .from("pharmacy_user_settings")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("username", username.toLowerCase())
        .neq("profile_id", id)
        .maybeSingle()

      if (existingUsername) {
        return NextResponse.json({ error: "Username is already taken" }, { status: 400 })
      }
    }

    // Map roles
    const roleMap: Record<string, string> = {
      ADMIN: "pharmacy_admin",
      CEO: "pharmacy_ceo",
      STAFF: "pharmacy_staff",
      pharmacy_admin: "pharmacy_admin",
      pharmacy_ceo: "pharmacy_ceo",
      pharmacy_staff: "pharmacy_staff",
    }
    const pharmacyRole = role ? (roleMap[role] ?? role) : undefined

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (username !== undefined) updateData.username = username ? username.toLowerCase() : null
    if (pharmacyRole) updateData.pharmacy_role = pharmacyRole
    if (permissions !== undefined) {
      updateData.permissions =
        pharmacyRole === "pharmacy_admin" || pharmacyRole === "pharmacy_ceo" ? [] : permissions ?? []
    }
    if (isActive !== undefined) updateData.is_active = isActive

    const { error: updateError } = await supabaseAdmin
      .from("pharmacy_user_settings")
      .update(updateData)
      .eq("tenant_id", tenantId)
      .eq("profile_id", id)

    if (updateError) {
      console.error("Error updating user settings:", updateError)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    // Update full_name in Supabase Auth metadata if name provided
    if (name) {
      await supabaseAdmin.auth.admin.updateUserById(id, {
        user_metadata: { full_name: name },
      })
    }

    // Create audit log
    await supabaseAdmin.from("pharmacy_audit_logs").insert({
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
