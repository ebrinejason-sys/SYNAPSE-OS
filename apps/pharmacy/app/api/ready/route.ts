import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

async function probeDatabase() {
  const started = Date.now()
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any).from("tenants").select("id").limit(1)
    return { ok: !error, latencyMs: Date.now() - started, detail: error?.message ?? "tenants query succeeded" }
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      detail: error instanceof Error ? error.message : "db probe failed",
    }
  }
}

/** Readiness — can this Pharmacy deployment serve requests? */
export async function GET() {
  const database = await probeDatabase()
  const ready = database.ok
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? null
  return NextResponse.json(
    {
      status: ready ? "ready" : "not_ready",
      checkedAt: new Date().toISOString(),
      commitSha,
      checks: { database },
    },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  )
}
