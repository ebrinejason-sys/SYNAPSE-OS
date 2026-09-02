import "server-only";

import { createServiceClient } from "../supabase/server";
import { logPlatformEvent } from "../../app/platform/_lib/platform-data";
import type { GoldenJourneyResult } from "./golden-journey";

export type TestModuleStatus = "PASS" | "FAIL" | "BLOCKED" | "NOT_CONFIGURED" | "SKIPPED";

export type TestModule = {
  id: string;
  label: string;
  latestStatus: TestModuleStatus;
  lastRunAt: string | null;
  href: string;
};

export type StoredTestRun = {
  testRunId: string;
  module: string;
  environment: string | null;
  commitSha: string | null;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  status: TestModuleStatus;
  error: string | null;
  evidence: Record<string, unknown>;
  correlationId: string;
  startedBy: string;
  isSynthetic: boolean;
  steps?: GoldenJourneyResult["steps"];
};

export const TEST_CENTER_MODULES: Array<{ id: string; label: string; href: string }> = [
  { id: "core", label: "Core", href: "/platform/registry" },
  { id: "clinical", label: "Clinical", href: "/platform/registry" },
  { id: "intelligence", label: "Intelligence", href: "/platform/intelligence" },
  { id: "icd11", label: "ICD-11", href: "/platform/icd11" },
  { id: "pathways", label: "Pathways", href: "/platform/registry" },
  { id: "lab", label: "Lab", href: "/platform/lab" },
  { id: "pharmacy", label: "Pharmacy", href: "/platform/pharmacy-network" },
  { id: "fhir", label: "FHIR", href: "/platform/registry" },
  { id: "insurance", label: "Insurance", href: "/platform/registry" },
  { id: "exchange", label: "Exchange", href: "/platform/events" },
  { id: "dhis2", label: "DHIS2", href: "/platform/dhis2" },
  { id: "offline", label: "Offline", href: "/platform/registry" },
  { id: "hospital-onboarding", label: "Hospital Onboarding", href: "/platform/hospitals/new" },
];

type GlobalStore = { runs: StoredTestRun[]; latestByModule: Map<string, StoredTestRun> };

const globalForTests = globalThis as typeof globalThis & { __synapseTestCenter?: GlobalStore };

function store(): GlobalStore {
  if (!globalForTests.__synapseTestCenter) {
    globalForTests.__synapseTestCenter = { runs: [], latestByModule: new Map() };
  }
  return globalForTests.__synapseTestCenter;
}

export function listTestModules(): TestModule[] {
  const s = store();
  return TEST_CENTER_MODULES.map((mod) => {
    const latest = s.latestByModule.get(mod.id);
    return {
      ...mod,
      latestStatus: latest?.status ?? "NOT_CONFIGURED",
      lastRunAt: latest?.completedAt ?? null,
    };
  });
}

export function listTestRuns(limit = 20): StoredTestRun[] {
  return store().runs.slice(-limit).reverse();
}

export function getTestRun(testRunId: string): StoredTestRun | undefined {
  return store().runs.find((run) => run.testRunId === testRunId);
}

export async function persistTestRun(
  run: StoredTestRun,
  actorId: string
): Promise<void> {
  const s = store();
  s.runs.push(run);
  if (s.runs.length > 200) s.runs.splice(0, s.runs.length - 200);
  s.latestByModule.set(run.module, run);

  // Golden journey updates multiple modules
  if (run.module === "golden-malaria") {
    const mapped: Array<[string, TestModuleStatus]> = [
      ["exchange", run.status],
      ["intelligence", run.status],
      ["icd11", run.status],
      ["pathways", run.status],
      ["lab", run.status],
      ["fhir", run.status],
      ["clinical", run.status],
      ["pharmacy", run.status],
    ];
    for (const [moduleId, status] of mapped) {
      s.latestByModule.set(moduleId, { ...run, module: moduleId, status });
    }
  }

  await logPlatformEvent({
    actorId,
    action: "test_center.run",
    entityType: "platform_test_runs",
    entityId: run.testRunId,
    metadata: {
      module: run.module,
      status: run.status,
      correlationId: run.correlationId,
      durationMs: run.durationMs,
      commitSha: run.commitSha,
      isSynthetic: run.isSynthetic,
      evidence: run.evidence,
    },
  });

  // Best-effort insert if platform_test_runs table exists
  try {
    const db = createServiceClient() as any;
    await db.from("platform_test_runs").insert({
      test_run_id: run.testRunId,
      module: run.module,
      environment: run.environment,
      commit_sha: run.commitSha,
      started_at: run.startedAt,
      completed_at: run.completedAt,
      duration_ms: run.durationMs,
      status: run.status,
      error: run.error,
      evidence: run.evidence,
      correlation_id: run.correlationId,
      started_by: run.startedBy,
      is_synthetic: run.isSynthetic,
    });
  } catch {
    // In-memory + audit_log is sufficient when migration is absent.
  }
}

export function goldenResultToStoredRun(
  result: GoldenJourneyResult,
  actorId: string
): StoredTestRun {
  return {
    testRunId: result.testRunId,
    module: "golden-malaria",
    environment: process.env.VERCEL_ENV ?? null,
    commitSha: result.commitSha,
    startedAt: new Date(Date.now() - result.durationMs).toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: result.durationMs,
    status: result.status,
    error: result.status === "FAIL" ? "One or more steps failed" : null,
    evidence: { summary: result.summary, steps: result.steps },
    correlationId: result.correlationId,
    startedBy: actorId,
    isSynthetic: true,
    steps: result.steps,
  };
}
