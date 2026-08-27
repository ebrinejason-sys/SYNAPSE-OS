import { NextResponse } from "next/server"
import { buildCapabilityStatement } from "@synapse/interop"

export async function GET() {
  return NextResponse.json(buildCapabilityStatement())
}
