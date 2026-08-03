import { NextRequest, NextResponse } from "next/server"
import { requirePharmacyPermission } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase/admin"

const db = supabaseAdmin as any

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePharmacyPermission("audit.read")
    if (!auth.ok) return auth.response
    const { session, tenantId } = auth

    const { data: logs, error } = await db
      .from("pharmacy_audit_logs")
      .select("id, profile_id, action, entity, entity_id, details, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(1000)

    if (error) throw error
    if (!logs || logs.length === 0) return NextResponse.json([])

    const profileIds = [...new Set(logs.map((l: any) => l.profile_id).filter(Boolean))]
    const { data: profiles } = await db
      .from("profiles")
      .select("id, full_name, first_name, last_name, email")
      .in("id", profileIds)

    const { data: userSettings } = await db
      .from("pharmacy_user_settings")
      .select("profile_id, pharmacy_role")
      .eq("tenant_id", tenantId)
      .in("profile_id", profileIds)

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]))
    const settingsMap = new Map((userSettings ?? []).map((s: any) => [s.profile_id, s]))

    const normalized = logs.map((log: any) => {
      const profile: any = profileMap.get(log.profile_id)
      const settings: any = settingsMap.get(log.profile_id)
      const name =
        profile?.full_name ||
        [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
        profile?.email?.split("@")[0] ||
        "System"
      return {
        id: log.id,
        userId: log.profile_id,
        action: log.action,
        entity: log.entity,
        entityId: log.entity_id,
        details: log.details,
        createdAt: log.created_at,
        user: {
          name,
          email: profile?.email ?? "",
          role: settings?.pharmacy_role?.replace("pharmacy_", "").toUpperCase() ?? "STAFF",
        },
      }
    })

    return NextResponse.json(normalized)
  } catch (error) {
    console.error("Error fetching activity logs:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
