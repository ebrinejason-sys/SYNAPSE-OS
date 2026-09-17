import { NextRequest, NextResponse } from "next/server"
import { signToken } from "@synapse/auth/tokens"

const ROLES = new Set(["reception", "nurse", "doctor", "lab", "pharmacist", "cashier", "admin"])
const DEMO_TENANT = "00000000-0000-4000-8000-000000000001"
const DEMO_FACILITY = "00000000-0000-4000-8000-000000000010"

function isApprovedHost(request: NextRequest): boolean {
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ?? request.headers.get("host") ?? ""
  return process.env.NODE_ENV !== "production" ? host.startsWith("localhost") || host.startsWith("127.0.0.1") || host === "demo.synapseos.tech" : host === "demo.synapseos.tech"
}

export async function POST(request: NextRequest) {
  if (!isApprovedHost(request) || process.env.DEMO_MODE === "false") return NextResponse.json({ error: "Demo sessions are unavailable" }, { status: 403 })
  const body = await request.json().catch(() => ({})) as { role?: string }
  const role = body.role?.toLowerCase()
  if (!role || !ROLES.has(role)) return NextResponse.json({ error: "Unsupported demo role" }, { status: 400 })
  try {
    const token = await signToken({
      sub: `demo-${role}`,
      email: `demo.${role}@synthetic.synapseos.tech`,
      role,
      tenant_id: DEMO_TENANT,
      site_id: DEMO_FACILITY,
      app: "web",
      synapse_id: `DEMO-${role.toUpperCase()}`,
    }, "30m")
    const response = NextResponse.json({ ok: true, role, tenant: "SYNAPSE Demo Hospital", facility: "SYNAPSE Demo Hospital" })
    response.cookies.set("synapse_demo_session", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 1800 })
    return response
  } catch {
    return NextResponse.json({ error: "Demo authentication is not configured" }, { status: 503 })
  }
}
