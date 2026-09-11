import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/getCurrentUser"
import { hasPlatformAdminAccess, requirePlatformAdminApi } from "@/lib/platform/auth"
import { getSimulationEngine, serializeRun } from "@/lib/platform/simulation-runtime"
import { requireHospitalStaffContext } from "@/lib/hospital-dept"
import { isContextError, requireHospitalCapability, gateHospitalModule } from "@/lib/hospital-shared"
import { fetchHospitalLabWorklist } from "@/lib/hospital-lab-db"

export const dynamic = "force-dynamic"

export async function GET() {
  const admin = await requirePlatformAdminApi()
  if (admin.ok) {
    const engine = getSimulationEngine()
    const orders = engine.lab.snapshot().orders.map((order) => {
      const run = engine.runs.find((item) => item.labOrder?.id === order.id)
      return {
        ...order,
        patientName: run?.patient?.demographics.fullName ?? null,
        synapseId: run?.patient?.synapseId ?? null,
      }
    })
    return NextResponse.json({
      orders,
      results: engine.lab.snapshot().results,
      runs: engine.runs.map(serializeRun),
      source: "simulation",
    })
  }

  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, "order", "read", "lab")
  if (cap) return cap

  const moduleBlock = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, "lab")
  if (moduleBlock) return moduleBlock

  const { orders, error } = await fetchHospitalLabWorklist(ctx)
  if (error) return NextResponse.json({ error }, { status: 500 })

  return NextResponse.json({ orders, results: [], runs: [], source: "database" })
}
