import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/getCurrentUser"
import {
  CLINICAL_AI_POLICIES,
  clinicalAiUnauthorized,
  clinicalAiUnavailable,
} from "@/lib/ai/clinical-ai-gateway"

export async function POST() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json(clinicalAiUnauthorized(), { status: 401 })
  if (!user.tenantId) return NextResponse.json({ error: "Tenant context required", advisory: true }, { status: 403 })
  return NextResponse.json({
    ...clinicalAiUnavailable("soap"),
    policy: CLINICAL_AI_POLICIES.soap,
  }, { status: 503 })
}
