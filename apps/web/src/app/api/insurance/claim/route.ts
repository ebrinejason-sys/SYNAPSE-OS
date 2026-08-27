import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/getCurrentUser"
import { generateClaimDraft, scoreRejectionRisk } from "@/lib/insurance/copilot"
import { scrubClaim } from "@synapse/interop"

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!user.tenantId) return NextResponse.json({ error: "No tenant context" }, { status: 403 })

  const body = (await req.json().catch(() => ({}))) as {
    patientId?: string
    encounterId?: string
    policyId?: string
    tenantId?: string
    diagnoses?: Array<{ display: string; stemCode?: string | null; verified?: boolean; release?: string | null }>
    procedures?: string[]
    medications?: string[]
    charges?: number
    eligibilityCovered?: boolean
  }

  if (body.tenantId && body.tenantId !== user.tenantId) {
    return NextResponse.json({ error: "Caller-supplied tenantId is not accepted" }, { status: 403 })
  }

  if (!body.patientId || !body.encounterId || !body.policyId) {
    return NextResponse.json({ error: "patientId, encounterId and policyId are required" }, { status: 400 })
  }

  const draft = await generateClaimDraft({
    tenantId: user.tenantId,
    patientId: body.patientId,
    encounterId: body.encounterId,
    policyId: body.policyId,
    actorId: user.id,
  })

  const diagnoses = body.diagnoses ?? []
  const scrub = scrubClaim({
    diagnoses: diagnoses.map((row) => ({
      display: row.display,
      stemCode: row.stemCode,
      verified: Boolean(row.verified),
      release: row.release,
    })),
    procedures: body.procedures ?? [],
    medications: body.medications ?? [],
    charges: body.charges ?? draft.totalAmount,
    eligibilityCovered: body.eligibilityCovered ?? false,
  })

  const risk = await scoreRejectionRisk({
    tenantId: user.tenantId,
    policyId: body.policyId,
    diagnosisCodes: diagnoses.map((row) => row.stemCode).filter((code): code is string => Boolean(code)),
    procedureCodes: body.procedures ?? [],
    estimatedCost: body.charges ?? 0,
    actorId: user.id,
  })

  return NextResponse.json({
    draft,
    scrub,
    risk,
    autoSubmit: false,
    status: "human_review_required",
  })
}
