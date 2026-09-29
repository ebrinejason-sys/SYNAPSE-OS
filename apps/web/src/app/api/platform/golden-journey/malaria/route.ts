import { NextResponse } from "next/server";
import { requirePlatformAdminApi } from "@/lib/platform/auth";
import { logPlatformEvent } from "@/app/platform/_lib/platform-data";
import {
  persistGoldenJourneyBestEffort,
  runMalariaGoldenJourneyForPlatform,
} from "@/lib/platform/simulation-runtime";

export const dynamic = "force-dynamic";

/**
 * Alternate trigger (Simulation Lab / API clients). Prefer Test Center route for UI.
 * Uses live DB platform-admin gate — not JWT-role alone.
 */
export async function POST(request: Request) {
  const auth = await requirePlatformAdminApi("tenant.manage");
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const tenantId = String(body.tenantId ?? "");
  if (!tenantId) {
    return NextResponse.json(
      { code: "TENANT_REQUIRED", message: "tenantId required", request_id: crypto.randomUUID() },
      { status: 400 }
    );
  }
  const seed = Number(body.seed ?? 20260829);

  try {
    const result = runMalariaGoldenJourneyForPlatform({
      tenantId,
      clinicianId: auth.profile.id,
      seed: Number.isFinite(seed) ? seed : 20260829,
    });
    await persistGoldenJourneyBestEffort(result);
    await logPlatformEvent({
      actorId: auth.profile.id,
      action: "golden_journey.malaria",
      entityType: "synapse_domain_events",
      entityId: result.runId,
      tenantId,
      metadata: {
        correlationId: result.correlationId,
        status: result.status,
        synthetic: true,
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "golden_journey_failed";
    return NextResponse.json(
      { code: "GOLDEN_JOURNEY_FAILED", message, request_id: crypto.randomUUID() },
      { status: 400 }
    );
  }
}
