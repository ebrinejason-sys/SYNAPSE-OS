import { NextRequest, NextResponse } from "next/server"

/**
 * Legacy non-atomic POS path — permanently disabled.
 * Use POST /api/admin/pos/complete-sale (complete_pharmacy_sale RPC) instead.
 */
function gone() {
  return NextResponse.json(
    {
      error:
        "This sale endpoint has been retired. Use POST /api/admin/pos/complete-sale.",
      code: "POS_LEGACY_RETIRED",
      successor: "/api/admin/pos/complete-sale",
    },
    { status: 410 },
  )
}

export async function GET() {
  return gone()
}

export async function POST(_request: NextRequest) {
  return gone()
}

export async function PUT() {
  return gone()
}

export async function PATCH() {
  return gone()
}

export async function DELETE() {
  return gone()
}
