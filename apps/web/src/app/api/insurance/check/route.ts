import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/getCurrentUser"
import { checkEligibility, runCoverageCheck } from "@/lib/insurance/copilot"

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!user.tenantId) return NextResponse.json({ error: "No tenant context" }, { status: 403 })

  const body = (await req.json().catch(() => ({}))) as {
    patientId?: string
    policyId?: string
    benefitKey?: string
    serviceCode?: string
    encounterId?: string
    tenantId?: string
  }

  if (body.tenantId && body.tenantId !== user.tenantId) {
    return NextResponse.json({ error: "Caller-supplied tenantId is not accepted" }, { status: 403 })
  }

  const patientId = body.patientId?.trim()
  if (!patientId) {
    return NextResponse.json({ error: "patientId is required" }, { status: 400 })
  }

  if (body.policyId && body.benefitKey) {
    const coverage = await runCoverageCheck({
      tenantId: user.tenantId,
      patientId,
      policyId: body.policyId,
      benefitKey: body.benefitKey,
      serviceCode: body.serviceCode,
      checkedBy: user.id,
      encounterId: body.encounterId,
    })
    return NextResponse.json({ type: "coverage", coverage, autoSubmit: false })
  }

  const eligibility = await checkEligibility({
    tenantId: user.tenantId,
    patientId,
    checkedBy: user.id,
    encounterId: body.encounterId,
  })
  return NextResponse.json({ type: "eligibility", eligibility, autoSubmit: false })
}
