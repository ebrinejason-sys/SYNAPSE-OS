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
  database: Probe;
  supabase: {
    connectivity: Probe;
    dbSize: Probe;
    activeConnections: Probe;
    lastMigration: Probe;
    rlsCoverage: Probe;
  };
  vercel: Probe;
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
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-color">Vercel</h2>
        <div className="mt-2">
          <ProbeRow label="Integration" probe={data.vercel} />
        </div>
      </article>

      <article className="rounded-xl border border-subtle bg-surface p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-color">Resend</h2>
        <div className="mt-2">
          <ProbeRow label="Email" probe={data.resend} />
        </div>
      </article>

      <article className="rounded-xl border border-subtle bg-surface p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-color">AI and Sync</h2>
        <div className="mt-2 space-y-1">
          <ProbeRow label="AI" probe={data.ai} />
          <ProbeRow label="Sync" probe={data.sync} />
        </div>
      </article>
    </div>
  );
}
