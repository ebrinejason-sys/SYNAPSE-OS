"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FlaskConical, Play, ExternalLink } from "lucide-react";
import { PlatformPageHeader } from "../_components/platform-page-header";

type ModuleStatus = "PASS" | "FAIL" | "BLOCKED" | "NOT_CONFIGURED" | "SKIPPED";

type TestModule = {
  id: string;
  label: string;
  latestStatus: ModuleStatus;
  lastRunAt: string | null;
  href: string;
};

type TestStep = {
  id: string;
  label: string;
  status: "PASS" | "FAIL" | "SKIPPED" | "BLOCKED" | "NOT_CONFIGURED";
  durationMs: number;
  evidence: Record<string, unknown>;
  error?: string;
};

type TestRun = {
  testRunId: string;
  module: string;
  status: ModuleStatus;
  durationMs: number;
  correlationId: string;
  completedAt: string;
  steps?: TestStep[];
};

function statusClass(status: ModuleStatus | "PASS" | "FAIL" | "SKIPPED") {
  if (status === "PASS") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (status === "FAIL") return "border-red-500/30 bg-red-500/10 text-red-300";
  if (status === "BLOCKED") return "border-orange-500/30 bg-orange-500/10 text-orange-300";
  if (status === "SKIPPED") return "border-slate-600/40 bg-slate-800/60 text-slate-400 italic";
  return "border-slate-700 bg-slate-900/50 text-slate-400";
}

export default function TestCenterPage() {
  const [modules, setModules] = useState<TestModule[]>([]);
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<TestRun | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/platform/test-center", { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load test center");
    const data = (await res.json()) as { modules: TestModule[]; runs: TestRun[] };
    setModules(data.modules);
    setRuns(data.runs);
    setSelectedRun((current) => current ?? data.runs[0] ?? null);
  }, []);

  useEffect(() => {
    refresh().catch((err) => setError(err instanceof Error ? err.message : "load_failed"));
  }, [refresh]);

  async function runMalariaGolden() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/platform/test-center/golden/malaria", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? "run_failed");
      setSelectedRun(data.run);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "run_failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        eyebrow="Control Center"
        title="Universal Test Center"
        description="Module readiness with honest PASS / FAIL / NOT_CONFIGURED status. SKIPPED is not a pass. Golden journeys produce correlation IDs and step evidence."
        actions={
          <button
            type="button"
            disabled={busy}
            onClick={runMalariaGolden}
            className="inline-flex items-center gap-2 rounded-xl bg-[#F97316] px-5 py-2.5 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            {busy ? "Running…" : "Run Malaria Golden Journey"}
          </button>
        }
      />

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {modules.map((mod) => (
          <Link
            key={mod.id}
            href={mod.href}
            className="rounded-xl border border-subtle bg-surface p-4 transition hover:border-[#F97316]/30"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-primary-color">{mod.label}</p>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${statusClass(mod.latestStatus)}`}>
                {mod.latestStatus}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-color">
              {mod.lastRunAt ? `Last run ${new Date(mod.lastRunAt).toLocaleString()}` : "Never run"}
            </p>
          </Link>
        ))}
      </section>

      <section className="rounded-xl border border-subtle bg-surface p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-[#E8B84B]" />
            <h2 className="text-sm font-semibold text-primary-color">Latest golden journey</h2>
          </div>
          {runs.length > 1 ? (
            <select
              value={selectedRun?.testRunId ?? ""}
              onChange={(e) => setSelectedRun(runs.find((r) => r.testRunId === e.target.value) ?? null)}
              className="rounded-lg border border-subtle bg-base px-3 py-1.5 text-xs text-primary-color"
            >
              {runs.map((run) => (
                <option key={run.testRunId} value={run.testRunId}>
                  {run.module} · {run.status} · {new Date(run.completedAt).toLocaleString()}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        {!selectedRun ? (
          <p className="text-sm text-muted-color">
            No runs yet. Press <strong className="text-primary-color">Run Malaria Golden Journey</strong> to execute the
            overlay pipeline (Exchange → Intelligence → ICD-11 → Pathway → Lab → FHIR).
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${statusClass(selectedRun.status)}`}>
                {selectedRun.status}
              </span>
              <span className="text-muted-color">{selectedRun.durationMs}ms</span>
              <span className="font-mono text-xs text-secondary-color">correlation: {selectedRun.correlationId}</span>
              <Link
                href={`/platform/events?correlationId=${encodeURIComponent(selectedRun.correlationId)}`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#F97316] hover:underline"
              >
                Event Explorer <ExternalLink className="h-3 w-3" />
              </Link>
            </div>

            <ol className="space-y-2">
              {(selectedRun.steps ?? []).map((step, index) => (
                <li
                  key={step.id}
                  className="flex flex-wrap items-start gap-3 rounded-lg border border-subtle bg-base px-3 py-2.5"
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-subtle text-[10px] font-bold text-muted-color">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-primary-color">{step.label}</p>
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase ${statusClass(step.status)}`}>
                        {step.status}
                      </span>
                      <span className="text-[11px] text-muted-color">{step.durationMs}ms</span>
                    </div>
                    {step.error ? <p className="mt-1 text-xs text-red-300">{step.error}</p> : null}
                    {Object.keys(step.evidence).length > 0 ? (
                      <pre className="mt-2 max-h-32 overflow-auto rounded border border-subtle bg-[#07070A] p-2 text-[10px] text-slate-400">
                        {JSON.stringify(step.evidence, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>
    </div>
  );
}
