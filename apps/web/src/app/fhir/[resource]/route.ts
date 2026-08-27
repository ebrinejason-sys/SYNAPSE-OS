import { NextRequest } from "next/server"
import { handleFhirSearch } from "../_lib/serve"

type Params = { resource: string }

export async function GET(req: NextRequest, context: { params: Promise<Params> }) {
  const { resource } = await context.params
  return handleFhirSearch(req, resource)
}

export async function POST() {
  const { NextResponse } = await import("next/server")
  return NextResponse.json(
    {
      resourceType: "OperationOutcome",
      issue: [{ severity: "information", code: "not-supported", diagnostics: "FHIR write is not enabled." }],
    },
    { status: 405 },
  )
}
