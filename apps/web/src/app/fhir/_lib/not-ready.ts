import { NextResponse } from 'next/server'

/** Honest FHIR stub — resources are not production-ready (Release 0 truth). */
export async function GET() {
  return NextResponse.json(
    {
      resourceType: 'OperationOutcome',
      issue: [
        {
          severity: 'information',
          code: 'not-supported',
          diagnostics:
            'FHIR R4 endpoints are planned. This stub is not a live interoperability surface.',
        },
      ],
    },
    { status: 501 },
  )
}

export async function POST() {
  return GET()
}
