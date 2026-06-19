import { NextRequest, NextResponse } from "next/server"
import { getPharmacySession } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { hashPassword, verifyPassword, validatePasswordStrength } from "@synapse/auth"

export async function POST(request: NextRequest) {
  try {
    const session = await getPharmacySession()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { currentPassword, newPassword } = await request.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const strength = validatePasswordStrength(newPassword)
    if (!strength.valid) {
      return NextResponse.json({ error: strength.errors.join(". ") }, { status: 400 })
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("password_hash")
      .eq("id", session.userId)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (profile.password_hash) {
      const valid = await verifyPassword(currentPassword, profile.password_hash)
      if (!valid) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 })
      }
    } else {
      // Lazy migration: user still on Supabase Auth — verify via admin
      const { error: verifyError } = await supabaseAdmin.auth.signInWithPassword({
        email: session.email,
        password: currentPassword,
      })
      if (verifyError) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 })
      }
    }

    const newHash = await hashPassword(newPassword)

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ password_hash: newHash, must_change_password: false })
      .eq("id", session.userId)

    if (updateError) {
      console.error("Update password error:", updateError)
      return NextResponse.json({ error: "Failed to update password" }, { status: 500 })
    }

    await supabaseAdmin
      .from("pharmacy_user_settings")
      .update({ must_change_password: false })
      .eq("profile_id", session.userId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Change password error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
