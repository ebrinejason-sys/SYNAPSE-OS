import { NextRequest, NextResponse } from "next/server"
import { listPathways, suggestPathwaysFromContext } from "@synapse/db/pathways"
import { isContextError, requireHospitalCapability } from "@/lib/hospital-shared"
import { requireHospitalStaffContext } from "@/lib/hospital-dept"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx
  const cap = await requireHospitalCapability(ctx, "encounter", "create", "opd")
  if (cap) return cap
  const countryPack = req.nextUrl.searchParams.get("country_pack") ?? "UG"
  const presenting = req.nextUrl.searchParams.get("presenting") ?? ""
  const pathways = listPathways({ countryPack, status: "active" })
  const suggested = presenting
    ? suggestPathwaysFromContext({ presentingComplaint: presenting, countryPack })
    : []
  return NextResponse.json({
    tenantId: ctx.tenantId,
    countryPack,
    pathways: pathways.map((item) => ({
      id: item.id,
      name: item.name,
      specialty: item.specialty,
      version: item.version,
      source: item.source,
      countryPack: item.countryPack,
      triggers: item.triggers,
      steps: item.steps,
    })),
    suggested,
  })
}
