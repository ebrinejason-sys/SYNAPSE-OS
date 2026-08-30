"use client";

import { useEffect, useState } from "react";

type Probe = {
  status: string;
  detail: string;
  latencyMs?: number;
  lastLatencyMs?: number | null;
  successRate?: number | null;
  sampleSize?: number;
  unresolvedConflicts?: number;
};

type HealthPayload = {
  checkedAt?: string;
  productionTruth?: {
    githubMain: { status: string; shortSha: string | null; detail: string };
    processDeploy: { shortSha: string | null; environment: string | null; detail: string };
    shaComparison: { status: string; detail: string };
    synapseProduction: { status: string; shortSha: string | null; match: string; detail: string };
    database: { status: string; latencyMs: number; detail: string };
    openRouter: { status: string; detail: string; latencyMs?: number };
    icd11: { status: string; detail: string; source: string; release: string };
    modules: Array<{ id: string; label: string; status: string }>;
  };
  database: Probe;
  supabase: {
    connectivity: Probe;
    dbSize: Probe;
    activeConnections: Probe;
    lastMigration: Probe;
    rlsCoverage: Probe;
  };
  vercel: Probe;
  github: Probe;
  openRouter: Probe;
  icd11: Probe;
  resend: Probe;
  ai: Probe;
  sync: Probe;
};

function statusClass(status: string) {
  if (status === "OPERATIONAL") return "text-emerald-300";
  if (status === "DEGRADED" || status === "CONFIGURED") return "text-amber-300";
  if (status === "OUTAGE" || status === "NOT_CONFIGURED") return "text-red-300";
  return "text-slate-400";
}

function ProbeRow({ label, probe }: { label: string; probe: Probe }) {
  return (
    <p className="text-sm text-secondary-color">
      <span className="text-slate-300">{label}: </span>
      <span className={`font-medium ${statusClass(probe.status)}`}>{probe.status}</span>
      <span className="text-muted-color"> — {probe.detail}</span>
    </p>
  );
}

export function PlatformHealthClient() {
  const [data, setData] = useState<HealthPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch("/api/platform/health", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message ?? payload.error ?? "Unable to fetch health metrics");
        }
        if (active) {
          setData(payload);
          setError(null);
        }
      } catch (fetchError) {
        if (active) {
          setError(fetchError instanceof Error ? fetchError.message : "Unknown error");
        }
      }
    }

    load();
    const timer = window.setInterval(load, 30_000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  if (error) {
    return <p className="text-sm text-red-300">{error}</p>;
  }

  if (!data) {
    return <p className="text-sm text-muted-color">Loading probes…</p>;
  }

  return (
    <div className="space-y-4">
      {data.productionTruth ? (
        <article className="rounded-xl border border-[#F97316]/25 bg-[#F97316]/5 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#F97316]">Production truth</h2>
          <div className="mt-2 grid gap-1 sm:grid-cols-2">
            <ProbeRow label="GitHub main" probe={{ status: data.productionTruth.githubMain.status, detail: data.productionTruth.githubMain.detail }} />
            <ProbeRow label="Process SHA" probe={{ status: data.productionTruth.processDeploy.shortSha ?? "UNKNOWN", detail: data.productionTruth.processDeploy.detail }} />
            <ProbeRow label="SHA drift" probe={{ status: data.productionTruth.shaComparison.status, detail: data.productionTruth.shaComparison.detail }} />
            <ProbeRow label="OpenRouter" probe={{ status: data.productionTruth.openRouter.status, detail: data.productionTruth.openRouter.detail, latencyMs: data.productionTruth.openRouter.latencyMs }} />
            <ProbeRow label="ICD-11" probe={{ status: data.productionTruth.icd11.status, detail: data.productionTruth.icd11.detail }} />
            <ProbeRow label="Database" probe={{ status: data.productionTruth.database.status, detail: data.productionTruth.database.detail, latencyMs: data.productionTruth.database.latencyMs }} />
          </div>
        </article>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
      <article className="rounded-xl border border-subtle bg-surface p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-color">Database</h2>
        <div className="mt-2 space-y-1">
          <ProbeRow label="Connectivity" probe={data.database} />
          <ProbeRow label="DB size" probe={data.supabase.dbSize} />
          <ProbeRow label="Connections" probe={data.supabase.activeConnections} />
          <ProbeRow label="Migrations" probe={data.supabase.lastMigration} />
          <ProbeRow label="RLS coverage" probe={data.supabase.rlsCoverage} />
        </div>
      </article>

      <article className="rounded-xl border border-subtle bg-surface p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-color">Deploy & GitHub</h2>
        <div className="mt-2 space-y-1">
          <ProbeRow label="Vercel" probe={data.vercel} />
          <ProbeRow label="GitHub" probe={data.github} />
        </div>
      </article>

      <article className="rounded-xl border border-subtle bg-surface p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-color">Intelligence</h2>
        <div className="mt-2 space-y-1">
          <ProbeRow label="OpenRouter" probe={data.openRouter} />
          <ProbeRow label="ICD-11" probe={data.icd11} />
          <ProbeRow label="AI logs" probe={data.ai} />
        </div>
      </article>

      <article className="rounded-xl border border-subtle bg-surface p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-color">Resend & Sync</h2>
        <div className="mt-2 space-y-1">
          <ProbeRow label="Email" probe={data.resend} />
          <ProbeRow label="Sync" probe={data.sync} />
        </div>
      </article>
      </div>
    </div>
  );
}
