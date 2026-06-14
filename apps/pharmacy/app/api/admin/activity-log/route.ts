import { NextRequest, NextResponse } from "next/server"
import { getPharmacySession, isPharmacyAdmin } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase/admin"

// GET - List all activity logs (admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await getPharmacySession()

    if (!session || !isPharmacyAdmin(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: logs, error } = await (supabaseAdmin as any)
      .from("pharmacy_audit_logs")
      .select("*, profiles(full_name, first_name, last_name)")
      .eq("tenant_id", session.profile.tenant_id)
      .order("created_at", { ascending: false })
      .limit(1000)

    if (error) throw error

    return NextResponse.json(logs)
  } catch (error) {
    console.error("Error fetching activity logs:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
