import { NextResponse } from "next/server"
import { requirePharmacyTenant } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase/admin"

const db = supabaseAdmin as any

// Returns active staff members for POS staff selection.
export async function GET() {
  try {
    const auth = await requirePharmacyTenant()
  if (!auth.ok) return auth.response
  const { session, tenantId } = auth

    const { data: settings, error: settingsErr } = await db
      .from("pharmacy_user_settings")
      .select("profile_id, username, pharmacy_role")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)

    if (settingsErr) throw settingsErr
    if (!settings || settings.length === 0) return NextResponse.json([])

    const profileIds = settings.map((s: any) => s.profile_id)

    const { data: profiles } = await db
      .from("profiles")
      .select("id, full_name, first_name, last_name")
      .in("id", profileIds)

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]))

    const staff = settings.map((s: any) => {
      const profile: any = profileMap.get(s.profile_id)
      const name =
        profile?.full_name ||
        [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
        s.username ||
        "Unknown"
      return { id: s.profile_id, name, role: s.pharmacy_role }
    })

    return NextResponse.json(staff)
  } catch (error) {
    console.error("Get staff list error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
