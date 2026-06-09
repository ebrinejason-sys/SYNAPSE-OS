import { NextRequest, NextResponse } from "next/server"
import { getPharmacySession } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

// Returns staff members for POS staff selection.
// Available to any authenticated user.
export async function GET(request: NextRequest) {
  try {
    const session = await getPharmacySession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from("pharmacy_user_settings")
      .select(
        "profile_id, username, pharmacy_role, is_active, profiles(id, full_name, first_name, last_name)"
      )
      .eq("is_active", true)

    if (error) throw error

    type StaffRow = {
      profile_id: string
      username: string | null
      pharmacy_role: string | null
      is_active: boolean | null
      profiles: {
        id: string
        full_name: string | null
        first_name: string | null
        last_name: string | null
      } | null
    }

    const staff = ((data ?? []) as unknown as StaffRow[]).map((pu) => {
      const profile = pu.profiles
      const name =
        profile?.full_name ??
        [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ??
        pu.username ??
        "Unknown"
      return {
        id: pu.profile_id,
        name,
        role: pu.pharmacy_role,
      }
    })

    return NextResponse.json(staff)
  } catch (error) {
    console.error("Get staff list error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
