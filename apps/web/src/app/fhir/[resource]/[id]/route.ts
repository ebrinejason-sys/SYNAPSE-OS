import { NextRequest } from "next/server"
import { handleFhirRead } from "../../_lib/serve"

type Params = { resource: string; id: string }

export async function GET(req: NextRequest, context: { params: Promise<Params> }) {
  const { resource, id } = await context.params
  return handleFhirRead(req, resource, id)
}
