import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/** Process liveness — no DB dependency. */
export async function GET() {
  return NextResponse.json(
    { status: "live", checkedAt: new Date().toISOString() },
    { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } },
  )
}
