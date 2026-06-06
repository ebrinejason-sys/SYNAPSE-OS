"use client";

import { useEffect, useState } from "react";

type HealthPayload = {
  supabase: {
    dbSize: string;
    activeConnections: number;
    lastMigration: string;
    rlsCoverage: string;
  };
  vercel: {
    latestDeployment: string;
  };
  resend: {
    recentStatuses: string[];
  };
  ai: {
    lastLatencyMs: number;
    successRate: number;
  };
  sync: {
    unresolvedConflicts: number;
  };
};

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
          throw new Error(payload.error ?? "Unable to fetch health metrics");
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
    return <p className="text-sm text-slate-400">Loading metrics...</p>;
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <article className="rounded-xl border border-slate-700 bg-slate-950/70 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Supabase</h2>
        <p className="mt-2 text-sm text-slate-200">DB Size: {data.supabase.dbSize}</p>
        <p className="text-sm text-slate-200">Active connections: {data.supabase.activeConnections}</p>
        <p className="text-sm text-slate-200">Last migration: {data.supabase.lastMigration}</p>
        <p className="text-sm text-slate-200">RLS coverage: {data.supabase.rlsCoverage}</p>
      </article>

      <article className="rounded-xl border border-slate-700 bg-slate-950/70 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Vercel</h2>
        <p className="mt-2 text-sm text-slate-200">Latest deployment: {data.vercel.latestDeployment}</p>
      </article>

      <article className="rounded-xl border border-slate-700 bg-slate-950/70 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Resend</h2>
        <div className="mt-2 space-y-1">
          {data.resend.recentStatuses.map((status, index) => (
            <p key={index} className="text-sm text-slate-200">{status}</p>
          ))}
        </div>
      </article>

      <article className="rounded-xl border border-slate-700 bg-slate-950/70 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">AI and Sync</h2>
        <p className="mt-2 text-sm text-slate-200">Last AI latency: {data.ai.lastLatencyMs}ms</p>
        <p className="text-sm text-slate-200">AI success rate: {data.ai.successRate}%</p>
        <p className="text-sm text-slate-200">Unresolved sync conflicts: {data.sync.unresolvedConflicts}</p>
      </article>
    </div>
  );
}
