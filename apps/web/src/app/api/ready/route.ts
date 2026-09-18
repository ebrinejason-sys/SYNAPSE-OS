import { NextResponse } from "next/server"
import { supabaseAdmin } from "@synapse/db/admin"
import { repoMigrationHeadFromFiles } from "@/lib/platform/sha-alignment"
import { readdirSync } from "node:fs"
import { join } from "node:path"
import { whoApiConfigured } from "@synapse/interop"
import { isOpenRouterConfigured } from "@/lib/ai/openrouter"

export const dynamic = "force-dynamic"

async function probeDatabase() {
  const started = Date.now()
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any).from("tenants").select("id", { count: "exact", head: true })
    return { ok: !error, latencyMs: Date.now() - started, detail: error?.message ?? "tenants query succeeded" }
  } catch (error) {
    return { ok: false, latencyMs: Date.now() - started, detail: error instanceof Error ? error.message : "db probe failed" }
  }
}

function repoMigrationHead() {
  try {
    const files = readdirSync(join(process.cwd(), "supabase/migrations")).filter((name) => name.endsWith(".sql"))
    return repoMigrationHeadFromFiles(files)
  } catch {
    return null
  }
}

export async function GET() {
  const db = await probeDatabase()
  const migrationHead = repoMigrationHead()
  const icdConfigured = whoApiConfigured()
  const aiConfigured = isOpenRouterConfigured()
  const ready = db.ok
  return NextResponse.json({
    status: ready ? "ready" : "not_ready",
    checkedAt: new Date().toISOString(),
    checks: {
      database: db,
      migrationHead: { ok: Boolean(migrationHead), version: migrationHead },
      icd11: { ok: true, optional: true, configured: icdConfigured, degraded: !icdConfigured },
      ai: { ok: true, optional: true, configured: aiConfigured, degraded: !aiConfigured },
    },
  }, { status: ready ? 200 : 503 })
}
