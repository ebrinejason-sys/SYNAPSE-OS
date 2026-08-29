import { NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase/server";
import { requirePlatformAdminApi } from "../../../../lib/platform/auth";
import { checkDatabaseLatency } from "../../../platform/_lib/platform-data";

export const dynamic = "force-dynamic";

type ProbeStatus =
  | "OPERATIONAL"
  | "DEGRADED"
  | "OUTAGE"
  | "CONFIGURED"
  | "NOT_CONFIGURED"
  | "NO_TELEMETRY";

function probe(status: ProbeStatus, detail: string, extra: Record<string, unknown> = {}) {
  return { status, detail, ...extra };
}

export async function GET() {
  const auth = await requirePlatformAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const supabaseAdmin = createServiceClient();
    const dbHealth = await checkDatabaseLatency();

    const [{ data: aiRows }, { count: conflicts }] = await Promise.all([
      (supabaseAdmin as any)
        .from("ai_call_logs")
        .select("latency_ms, success, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      (supabaseAdmin as any)
        .from("sync_conflicts")
        .select("id", { count: "exact", head: true })
        .eq("resolved", false),
    ]);

    const aiSample = aiRows ?? [];
    const aiSuccessRate = aiSample.length
      ? Math.round((aiSample.filter((row: { success?: boolean }) => row.success).length / aiSample.length) * 100)
      : null;

    const dbStatus: ProbeStatus = !dbHealth.ok
      ? "OUTAGE"
      : dbHealth.latencyMs < 500
        ? "OPERATIONAL"
        : "DEGRADED";

    return NextResponse.json({
      database: probe(dbStatus, dbHealth.ok ? `${dbHealth.latencyMs}ms latency` : "Unreachable", {
        latencyMs: dbHealth.latencyMs,
      }),
      supabase: {
        connectivity: probe(dbStatus, dbHealth.ok ? "Tenant probe succeeded" : "Tenant probe failed"),
        dbSize: probe("NO_TELEMETRY", "Size metrics not wired to provider API"),
        activeConnections: probe("NO_TELEMETRY", "Connection count not available"),
        lastMigration: probe("NO_TELEMETRY", "Migration registry not yet in control plane"),
        rlsCoverage: probe("NO_TELEMETRY", "Do not treat static counts as live RLS proof"),
      },
      vercel: process.env.VERCEL_TOKEN
        ? probe("CONFIGURED", "Token present — deployment list not yet wired")
        : probe("NOT_CONFIGURED", "No VERCEL_TOKEN — cannot read deployments"),
      resend: process.env.RESEND_API_KEY
        ? probe("CONFIGURED", "API key present — delivery probe not yet wired")
        : probe("NOT_CONFIGURED", "No RESEND_API_KEY"),
      ai:
        aiSample.length === 0
          ? probe("NO_TELEMETRY", "No recent ai_call_logs rows")
          : probe(
              (aiSuccessRate ?? 0) >= 90 ? "OPERATIONAL" : (aiSuccessRate ?? 0) >= 70 ? "DEGRADED" : "OUTAGE",
              `Last ${aiSample.length} calls · ${aiSuccessRate}% success · ${aiSample[0]?.latency_ms ?? "—"}ms last latency`,
              {
                lastLatencyMs: aiSample[0]?.latency_ms ?? null,
                successRate: aiSuccessRate,
                sampleSize: aiSample.length,
              }
            ),
      sync: probe(
        (conflicts ?? 0) > 0 ? "DEGRADED" : "OPERATIONAL",
        `${conflicts ?? 0} unresolved sync conflicts`,
        { unresolvedConflicts: conflicts ?? 0 }
      ),
    });
  } catch (error) {
    return NextResponse.json(
      {
        code: "LIVE_PROBE_FAILED",
        message: error instanceof Error ? error.message : "Unknown platform health failure",
        request_id: crypto.randomUUID(),
      },
      { status: 500 }
    );
  }
}
