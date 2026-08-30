import { NextResponse } from "next/server";
import { requirePlatformAdminApi } from "@/lib/platform/auth";
import { runMalariaGoldenJourney } from "@/lib/platform/golden-journey";
import {
  goldenResultToStoredRun,
  getTestRun,
  persistTestRun,
} from "@/lib/platform/test-center-store";
import { createDemoTenant } from "@/lib/platform/simulation-runtime";

export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await requirePlatformAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const tenant = await createDemoTenant({
      kind: "hospital",
      name: "TEST CENTER MALARIA DEMO",
      actorId: auth.profile.id,
    });

    const result = await runMalariaGoldenJourney({
      tenantId: tenant.id,
      clinicianId: auth.profile.id,
    });

    const stored = goldenResultToStoredRun(result, auth.profile.id);
    await persistTestRun(stored, auth.profile.id);

    return NextResponse.json({
      run: getTestRun(result.testRunId) ?? stored,
      steps: result.steps,
      correlationId: result.correlationId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        code: "GOLDEN_JOURNEY_FAILED",
        message: error instanceof Error ? error.message : "Golden journey failed",
        request_id: crypto.randomUUID(),
      },
      { status: 500 }
    );
  }
}
