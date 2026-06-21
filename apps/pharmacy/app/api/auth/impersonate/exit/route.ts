import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE } from "@synapse/config/constants"
import { verifyToken } from "@synapse/auth/tokens"
import { revokeSession } from "@synapse/auth"
import { supabaseAdmin } from "@/lib/supabase/admin"

export async function POST(_req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value

  if (token) {
    try {
      const payload = await verifyToken(token)
      if (payload.is_impersonation && payload.impersonator_id) {
        await supabaseAdmin.from("audit_log").insert({
          table_name: "impersonation",
          action: "IMPERSONATION_END",
          record_id: payload.sub,
          user_id: payload.impersonator_id,
          user_role: "platform_admin",
          new_value: { target_user_id: payload.sub, tenant_id: payload.tenant_id },
          tenant_id: payload.tenant_id ?? null,
          created_by: payload.impersonator_id,
          created_at: new Date().toISOString(),
        })
      }
      await revokeSession(token).catch(() => {})
    } catch {
      // invalid token — clear it anyway
    }
  }

  cookieStore.delete(SESSION_COOKIE)
  return NextResponse.json({ ok: true })
}
