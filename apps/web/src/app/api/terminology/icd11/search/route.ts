import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/getCurrentUser"
import { searchWhoIcd11 } from "@synapse/interop"

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!user.tenantId) return NextResponse.json({ error: "Tenant context required" }, { status: 403 })

  const q = req.nextUrl.searchParams.get("q") ?? ""
  if (!q.trim()) {
    return NextResponse.json({ error: "q is required" }, { status: 400 })
  }

  const result = await searchWhoIcd11(q)
  return NextResponse.json({
    release: "2026-01",
    linearization: "mms",
    source: result.source,
    degraded: result.degraded,
    hits: result.hits,
  })
}
