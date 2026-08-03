import { NextRequest, NextResponse } from 'next/server'

/**
 * Legacy parallel encounter create — gated closed in Release 0.
 * Canonical hospital OPD write path: POST /api/opd/triage
 * (capability + module + audit).
 */
export async function POST(_req: NextRequest) {
  return NextResponse.json(
    {
      error: 'gone',
      message:
        'POST /api/encounters is retired. Use POST /api/opd/triage for hospital OPD encounters.',
      canonical: '/api/opd/triage',
    },
    { status: 410 },
  )
}
