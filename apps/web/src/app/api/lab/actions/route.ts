import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/getCurrentUser"
import { hasPlatformAdminAccess } from "@/lib/platform/auth"
import { getSimulationEngine } from "@/lib/platform/simulation-runtime"
import { requireHospitalStaffContext } from "@/lib/hospital-dept"
import { isContextError, requireHospitalCapability, gateHospitalModule } from "@/lib/hospital-shared"
import { executeHospitalLabAction } from "@/lib/hospital-lab-db"

export const dynamic = "force-dynamic"

function canUseLab(role: string | undefined, email: string | null) {
  return hasPlatformAdminAccess(role, email) || ["lab_tech", "lab_technician", "lab_scientist", "lab_admin"].includes(role ?? "") || role === "doctor"
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user || !canUseLab(user.role, user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const orderId = String(body.orderId ?? "")
  const action = String(body.action ?? "")

  if (hasPlatformAdminAccess(user.role, user.email)) {
    const engine = getSimulationEngine()
    try {
      if (action === "collect") {
        const accession = String(body.accessionNumber ?? `DEMO-${Date.now()}`)
        engine.lab.collect(orderId, accession, accession.replace(/[^A-Z0-9]/gi, ""), crypto.randomUUID())
      } else if (action === "receive") {
        engine.lab.receive(orderId)
      } else if (action === "reject") {
        engine.lab.reject(orderId, "other", String(body.reason ?? "rejected"))
      } else if (action === "enter_result") {
        engine.lab.enterResult({
          resultId: crypto.randomUUID(),
          orderId,
          value: String(body.value ?? ""),
          analyzer: typeof body.analyzer === "string" ? body.analyzer : "manual",
        })
      } else if (action === "verify") {
        engine.lab.verify(orderId, user.id)
      } else if (action === "release") {
        engine.lab.release(orderId)
      } else if (action === "acknowledge") {
        engine.lab.acknowledgeCritical({
          id: crypto.randomUUID(),
          orderId,
          acknowledgedBy: user.id,
          note: String(body.note ?? "acknowledged"),
        })
      } else {
        return NextResponse.json({ error: "Unknown action" }, { status: 400 })
      }
      const order = engine.lab.getOrder(orderId)
      const result = engine.lab.snapshot().results.find((row) => row.labOrderId === orderId) ?? null
      return NextResponse.json({ order, result, source: "simulation" })
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "lab_action_failed" },
        { status: 400 },
      )
    }
  }

  const ctx = await requireHospitalStaffContext({ allowLaboratory: true })
  if (isContextError(ctx)) return ctx

  // Role-appropriate capabilities — collect ≠ enter ≠ verify
  let cap
  if (action === "collect" || action === "receive" || action === "reject") {
    cap = await requireHospitalCapability(ctx, "specimen", "collect", "lab")
    if (cap) {
      // Fall back to result.enter for facilities that only seeded enter caps
      const enterFallback = await requireHospitalCapability(ctx, "result", "enter", "lab")
      if (enterFallback) return enterFallback
      cap = null
    }
  } else if (action === "verify" || action === "release") {
    if (["lab_tech", "lab_technician"].includes(user.role ?? "")) {
      return NextResponse.json(
        { error: "lab_tech cannot verify or release; lab_scientist required" },
        { status: 403 },
      )
    }
    cap = await requireHospitalCapability(ctx, "result", "verify", "lab")
  } else if (action === "acknowledge") {
    cap = await requireHospitalCapability(ctx, "result", "verify", "lab")
  } else {
    cap = await requireHospitalCapability(ctx, "result", "enter", "lab")
  }
  if (cap) return cap

  const moduleBlock = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, "lab")
  if (moduleBlock) return moduleBlock

  try {
    const outcome = await executeHospitalLabAction({
      ctx,
      orderId,
      action,
      actorId: ctx.userId,
      extra: body,
    })
    const response: {
      order: typeof outcome.order
      result: typeof outcome.result
      source: string
      warnings?: string[]
    } = { order: outcome.order, result: outcome.result, source: "database" }
    if (outcome.warnings.length) response.warnings = outcome.warnings
    return NextResponse.json(response)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "lab_action_failed" },
      { status: 400 },
    )
  }
}
