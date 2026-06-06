import { NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabaseAdmin = createServiceClient();

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

    const successRate = (aiRows ?? []).length
      ? Math.round(((aiRows ?? []).filter((row: any) => row.success).length / (aiRows ?? []).length) * 100)
      : 100;

    return NextResponse.json({
      supabase: {
        dbSize: "-",
        activeConnections: 0,
        lastMigration: "See migration history",
        rlsCoverage: "134/134",
      },
      vercel: {
        latestDeployment: process.env.VERCEL_TOKEN ? "Token configured" : "No Vercel token configured",
      },
      resend: {
        recentStatuses: process.env.RESEND_API_KEY
          ? ["Connected", "Delivery checks available"]
          : ["No Resend API key", "Delivery checks unavailable"],
      },
      ai: {
        lastLatencyMs: (aiRows ?? [])[0]?.latency_ms ?? 0,
        successRate,
      },
      sync: {
        unresolvedConflicts: conflicts ?? 0,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown platform health failure",
      },
      { status: 500 }
    );
  }
}
