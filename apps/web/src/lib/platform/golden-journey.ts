import "server-only";

import {
  persistGoldenJourneyBestEffort,
  runMalariaGoldenJourneyForPlatform,
} from "@/lib/platform/simulation-runtime";
import type { GoldenStepEvidence } from "@synapse/db/malaria-golden-journey";

export type GoldenJourneyStep = {
  id: string;
  label: string;
  status: "PASS" | "FAIL" | "SKIPPED" | "BLOCKED" | "NOT_CONFIGURED";
  durationMs: number;
  evidence: Record<string, unknown>;
  error?: string;
};

export type GoldenJourneyResult = {
  testRunId: string;
  correlationId: string;
  status: "PASS" | "FAIL";
  durationMs: number;
  commitSha: string | null;
  steps: GoldenJourneyStep[];
  summary: Record<string, unknown>;
  isSynthetic: true;
};

function stepLabel(step: string): string {
  return step.replace(/_/g, " ");
}

function mapStep(step: GoldenStepEvidence): GoldenJourneyStep {
  return {
    id: step.step,
    label: stepLabel(step.step),
    status: step.status,
    durationMs: step.durationMs,
    evidence: step.artifacts ?? {},
    error: step.detail,
  };
}

/**
 * Universal Test Center entrypoint for the Malaria Golden Journey.
 * Authoritative runner: `@synapse/db/malaria-golden-journey` (Clinical → Intelligence →
 * ICD-11 → Pathway → Lab → Timeline → Rx → Pharm → FHIR) with one correlation_id.
 */
export async function runMalariaGoldenJourney(params: {
  tenantId: string;
  clinicianId: string;
  testRunId?: string;
  seed?: number;
}): Promise<GoldenJourneyResult> {
  const testRunId = params.testRunId ?? crypto.randomUUID();
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA?.trim() ?? null;
  const started = Date.now();

  const result = runMalariaGoldenJourneyForPlatform({
    tenantId: params.tenantId,
    clinicianId: params.clinicianId,
    seed: params.seed ?? 20260829,
  });

  await persistGoldenJourneyBestEffort(result);

  const steps = result.steps.map(mapStep);
  // SKIPPED must never count as PASS toward overall success (already enforced in db runner).
  const failed = result.status === "FAIL" || steps.some((s) => s.status === "FAIL");

  return {
    testRunId: result.runId || testRunId,
    correlationId: result.correlationId,
    status: failed ? "FAIL" : "PASS",
    durationMs: Date.now() - started,
    commitSha,
    steps,
    summary: {
      seed: result.seed,
      patient: result.patient ?? null,
      error: result.error ?? null,
      stepCount: steps.length,
      passCount: steps.filter((s) => s.status === "PASS").length,
      failCount: steps.filter((s) => s.status === "FAIL").length,
      skippedCount: steps.filter((s) => s.status === "SKIPPED").length,
    },
    isSynthetic: true,
  };
}
