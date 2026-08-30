"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Brain, Play, RefreshCw } from "lucide-react";
import { PlatformPageHeader } from "../_components/platform-page-header";

type ProviderProbe = {
  configured: boolean;
  status: string;
  detail: string;
  lastProbeMs?: number | null;
};

type IntelligencePayload = {
  providers: {
    openRouter: ProviderProbe;
    gemini: ProviderProbe;
    deepseek: ProviderProbe;
  };
  metrics: {
    available: boolean;
    sampleSize?: number;
    successRate?: number | null;
    avgLatencyMs?: number | null;
    lastCallAt?: string | null;
    detail?: string;
  };
  checkedAt: string;
};

type EvalResult = {
  status: "PASS" | "FAIL";
  malariaMentioned: boolean;
  inventedIcdStripped: boolean;
  suggestedPathwayId: string | null;
  icd11Candidates: Array<{ stemCode: string; title: string }>;
};

function providerTone(status: string) {
  if (status === "HEALTHY" || status === "OPERATIONAL") return "text-emerald-300";
  if (status === "CONFIGURED") return "text-amber-300";
  return "text-red-300";
}

export default function IntelligenceObservabilityPage() {
  const [data, setData] = useState<IntelligencePayload | null>(null);
  const [evalResult, setEvalResult] = useState<EvalResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/platform/intelligence", { cache: "no-store" });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.message ?? "load_failed");
    setData(payload);
  }, []);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "load_failed"));
  }, [load]);

  async function runEval() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/platform/intelligence", { method: "POST" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message ?? "eval_failed");
      setEvalResult(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "eval_failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        eyebrow="Intelligence"
        title="Provider observability"
        description="OpenRouter is live-probed. Gemini and DeepSeek show key presence only — key present ≠ healthy. No live patient data."
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
              onClick={() => load().catch((err) => setError(err.message))}
              className="inline-flex items-center gap-2 rounded-xl border border-[#E8B84B]/30 bg-[#E8B84B]/10 px-4 py-2.5 text-sm font-semibold text-[#E8B84B]"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </>
        }
      />

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
      ) : null}

      <section className="grid gap-3 md:grid-cols-3">
        {data
          ? (["openRouter", "gemini", "deepseek"] as const).map((key) => {
              const provider = data.providers[key];
              const label = key === "openRouter" ? "OpenRouter" : key === "gemini" ? "Gemini" : "DeepSeek";
              return (
                <article key={key} className="rounded-xl border border-subtle bg-surface p-4">
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-[#E8B84B]" />
                    <p className="text-sm font-semibold text-primary-color">{label}</p>
                  </div>
                  <p className={`mt-2 text-lg font-bold ${providerTone(provider.status)}`}>{provider.status}</p>
                  <p className="mt-1 text-xs text-muted-color">{provider.detail}</p>
                  {provider.lastProbeMs != null ? (
                    <p className="mt-2 text-[11px] text-secondary-color">Last probe {provider.lastProbeMs}ms</p>
                  ) : null}
                </article>
              );
            })
          : null}
      </section>

      <section className="rounded-xl border border-subtle bg-surface p-4">
        <h2 className="text-sm font-semibold text-primary-color">ai_call_logs metrics</h2>
        {!data?.metrics.available ? (
          <p className="mt-2 text-sm text-muted-color">
            {data?.metrics.detail ?? "No telemetry — table empty or unavailable"}
          </p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-subtle bg-base px-3 py-2">
              <p className="text-[10px] uppercase text-muted-color">Sample size</p>
              <p className="text-xl font-bold text-primary-color">{data.metrics.sampleSize}</p>
            </div>
            <div className="rounded-lg border border-subtle bg-base px-3 py-2">
              <p className="text-[10px] uppercase text-muted-color">Success rate</p>
              <p className="text-xl font-bold text-[#F97316]">{data.metrics.successRate ?? "—"}%</p>
            </div>
            <div className="rounded-lg border border-subtle bg-base px-3 py-2">
              <p className="text-[10px] uppercase text-muted-color">Avg latency</p>
              <p className="text-xl font-bold text-primary-color">{data.metrics.avgLatencyMs ?? "—"}ms</p>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-[#F97316]/25 bg-[#F97316]/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-primary-color">Synthetic malaria eval</h2>
            <p className="mt-1 text-xs text-muted-color">
              Fixed case through buildRecommendation kernel — checks malaria mention and FAKECODE strip.
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={runEval}
            className="inline-flex items-center gap-2 rounded-xl bg-[#F97316] px-4 py-2 text-sm font-bold text-black disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            Run eval
          </button>
        </div>
        {evalResult ? (
          <div className="mt-4 space-y-2 text-sm">
            <p>
              Status:{" "}
              <span className={evalResult.status === "PASS" ? "text-emerald-300" : "text-red-300"}>
                {evalResult.status}
              </span>
            </p>
            <p className="text-secondary-color">
              Malaria mentioned: {evalResult.malariaMentioned ? "yes" : "no"} · Invented ICD stripped:{" "}
              {evalResult.inventedIcdStripped ? "yes" : "no"}
            </p>
            <p className="text-secondary-color">Suggested pathway: {evalResult.suggestedPathwayId ?? "—"}</p>
            <div className="mt-2 space-y-1">
              {evalResult.icd11Candidates.map((hit) => (
                <p key={hit.stemCode} className="font-mono text-xs text-[#E8B84B]">
                  {hit.stemCode} — {hit.title}
                </p>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
