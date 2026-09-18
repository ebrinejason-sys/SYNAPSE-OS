import { NextResponse } from "next/server"
import { supabaseAdmin } from "@synapse/db/admin"

export const dynamic = "force-dynamic"

export async function GET() {
  const started = Date.now()
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any).from("tenants").select("id").limit(1)
    if (error) {
      return NextResponse.json({ status: "dead", detail: error.message, latencyMs: Date.now() - started }, { status: 503 })
    }
    return NextResponse.json({ status: "live", latencyMs: Date.now() - started })
  } catch (error) {
    return NextResponse.json({
      status: "dead",
      detail: error instanceof Error ? error.message : "probe failed",
      latencyMs: Date.now() - started,
    }, { status: 503 })
  }
}
