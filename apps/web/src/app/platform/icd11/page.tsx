"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search, RefreshCw } from "lucide-react";
import { PlatformPageHeader } from "../_components/platform-page-header";

type ProbePayload = {
  release: string;
  credentials: "Configured" | "Missing";
  status: string;
  latencyMs: number;
  source: string;
  cacheSearch: Array<{ stemCode: string; title: string; score: number }>;
  checkedAt: string;
};

type SearchResult = {
  query: string;
  source: string;
  degraded: boolean;
  latencyMs: number;
  hits: Array<{ stemCode: string; title: string; score: number }>;
};

function statusTone(status: string) {
  if (status === "HEALTHY") return "text-emerald-300";
  if (status === "CONFIGURED_CACHE_ONLY" || status === "FALLBACK_CACHE") return "text-amber-300";
  return "text-red-300";
}

export default function Icd11AdminPage() {
  const [probe, setProbe] = useState<ProbePayload | null>(null);
  const [query, setQuery] = useState("malaria");
  const [search, setSearch] = useState<SearchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProbe = useCallback(async () => {
    const res = await fetch("/api/platform/icd11/probe", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message ?? "probe_failed");
    setProbe(data);
  }, []);

  useEffect(() => {
    loadProbe().catch((err) => setError(err instanceof Error ? err.message : "load_failed"));
  }, [loadProbe]);

  async function runSearch() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/platform/icd11/probe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "search_failed");
      setSearch(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "search_failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        eyebrow="Terminology"
        title="ICD-11 MMS"
        description="WHO ICD-11 release 2026-01. Credentials and cache status only — no patient data, no secrets in responses."
        actions={
          <>
            <Link
              href="/platform/test-center"
              className="rounded-xl border border-subtle px-4 py-2.5 text-sm font-semibold text-secondary-color"
            >
              Test Center
            </Link>
            <button
              type="button"
              onClick={() => loadProbe().catch((err) => setError(err.message))}
              className="inline-flex items-center gap-2 rounded-xl border border-[#E8B84B]/30 bg-[#E8B84B]/10 px-4 py-2.5 text-sm font-semibold text-[#E8B84B]"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh probe
            </button>
          </>
        }
      />

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Release", probe?.release ?? "—"],
          ["WHO credentials", probe?.credentials ?? "—"],
          ["Probe status", probe?.status ?? "loading…"],
          ["Cache latency", probe ? `${probe.latencyMs}ms · ${probe.source}` : "—"],
        ].map(([label, value]) => (
          <article key={label} className="rounded-xl border border-subtle bg-surface p-4">
            <p className="text-xs uppercase text-muted-color">{label}</p>
            <p className={`mt-2 text-sm font-semibold ${label === "Probe status" ? statusTone(String(value)) : "text-primary-color"}`}>
              {value}
            </p>
          </article>
        ))}
      </section>

      <section className="rounded-xl border border-subtle bg-surface p-4">
        <h2 className="text-sm font-semibold text-primary-color">Cache search test — malaria</h2>
        <div className="mt-3 space-y-2">
          {(probe?.cacheSearch ?? []).map((hit) => (
            <div key={hit.stemCode} className="flex items-center justify-between rounded-lg border border-subtle bg-base px-3 py-2">
              <div>
                <p className="font-mono text-sm text-[#F97316]">{hit.stemCode}</p>
                <p className="text-xs text-muted-color">{hit.title}</p>
              </div>
              <span className="text-xs text-muted-color">score {hit.score.toFixed(2)}</span>
            </div>
          ))}
          {!probe?.cacheSearch?.length ? (
            <p className="text-sm text-muted-color">No cache hits for malaria.</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-subtle bg-surface p-4">
        <h2 className="text-sm font-semibold text-primary-color">Live search probe</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-[200px] flex-1 rounded-lg border border-subtle bg-base px-3 py-2 text-sm text-primary-color"
            placeholder="Search term (no PHI)"
          />
          <button
            type="button"
            disabled={busy}
            onClick={runSearch}
            className="inline-flex items-center gap-2 rounded-lg bg-[#F97316] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
          >
            <Search className="h-4 w-4" />
            Probe
          </button>
        </div>
        {search ? (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-muted-color">
              Source: {search.source} · {search.latencyMs}ms
              {search.degraded ? " · degraded" : ""}
            </p>
            {search.hits.map((hit) => (
              <div key={hit.stemCode} className="rounded-lg border border-subtle bg-base px-3 py-2">
                <p className="font-mono text-sm text-[#E8B84B]">{hit.stemCode}</p>
                <p className="text-xs text-secondary-color">{hit.title}</p>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
