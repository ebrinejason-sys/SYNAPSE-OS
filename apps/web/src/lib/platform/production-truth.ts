import "server-only";

import { PRODUCT_MANIFEST, statusLabel } from "@synapse/config/manifest";
import {
  ICD11_RELEASE,
  searchIcd11,
  searchWhoIcd11,
  whoApiConfigured,
} from "@synapse/interop";
import { isOpenRouterConfigured } from "../ai/openrouter";
import { checkDatabaseLatency } from "../../app/platform/_lib/platform-data";

const GITHUB_REPO = "ebrinejason-sys/SYNAPSE-OS";
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

export type TruthStatus =
  | "HEALTHY"
  | "OPERATIONAL"
  | "DEGRADED"
  | "OUTAGE"
  | "FAILED"
  | "NOT_CONFIGURED"
  | "CONFIGURED"
  | "CONFIGURED_CACHE_ONLY"
  | "FALLBACK_CACHE"
  | "NO_TELEMETRY"
  | "MATCH"
  | "BEHIND"
  | "UNKNOWN";

export type GitHubMainTruth = {
  status: TruthStatus;
  sha: string | null;
  shortSha: string | null;
  detail: string;
};

export type ProcessDeployTruth = {
  sha: string | null;
  shortSha: string | null;
  environment: string | null;
  detail: string;
};

export type ShaComparisonTruth = {
  status: "MATCH" | "BEHIND" | "UNKNOWN";
  detail: string;
};

export type VercelDeploymentTruth = {
  status: TruthStatus;
  deployments: Array<{
    projectId: string;
    sha: string | null;
    shortSha: string | null;
    state: string | null;
    url: string | null;
    createdAt: string | null;
  }>;
  detail: string;
};

export type DatabaseTruth = {
  status: "OPERATIONAL" | "DEGRADED" | "OUTAGE";
  latencyMs: number;
  detail: string;
};

export type OpenRouterTruth = {
  status: "HEALTHY" | "FAILED" | "NOT_CONFIGURED";
  detail: string;
  modelCount?: number;
  latencyMs?: number;
};

export type Icd11Truth = {
  status: "HEALTHY" | "CONFIGURED_CACHE_ONLY" | "FALLBACK_CACHE" | "NOT_CONFIGURED";
  release: string;
  credentials: "Configured" | "Missing";
  cacheHit: boolean;
  latencyMs: number;
  source: "who" | "cache" | "none";
  topHit: string | null;
  detail: string;
};

export type ModuleReadinessItem = {
  id: string;
  label: string;
  status: string;
  href: string;
};

export type ProductionTruth = {
  githubMain: GitHubMainTruth;
  processDeploy: ProcessDeployTruth;
  shaComparison: ShaComparisonTruth;
  vercelDeployments: VercelDeploymentTruth;
  database: DatabaseTruth;
  openRouter: OpenRouterTruth;
  icd11: Icd11Truth;
  modules: ModuleReadinessItem[];
  checkedAt: string;
};

function shortSha(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.slice(0, 7);
}

function githubToken(): string | null {
  return process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim() || null;
}

async function fetchGitHubMainSha(fetchImpl: typeof fetch = fetch): Promise<GitHubMainTruth> {
  const token = githubToken();
  if (!token) {
    return {
      status: "NOT_CONFIGURED",
      sha: null,
      shortSha: null,
      detail: "No GITHUB_TOKEN or GH_TOKEN — cannot read main SHA",
    };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetchImpl(`https://api.github.com/repos/${GITHUB_REPO}/commits/main`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      return {
        status: "FAILED",
        sha: null,
        shortSha: null,
        detail: `GitHub API returned ${res.status}`,
      };
    }

    const body = (await res.json()) as { sha?: string };
    const sha = body.sha ?? null;
    return {
      status: "HEALTHY",
      sha,
      shortSha: shortSha(sha),
      detail: sha ? `main @ ${shortSha(sha)}` : "GitHub returned no SHA",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "GitHub fetch failed";
    return {
      status: "FAILED",
      sha: null,
      shortSha: null,
      detail: message,
    };
  }
}

function compareShas(githubSha: string | null, processSha: string | null): ShaComparisonTruth {
  if (!githubSha || !processSha) {
    return { status: "UNKNOWN", detail: "Need both GitHub main and process SHA to compare" };
  }
  const match =
    githubSha === processSha ||
    githubSha.startsWith(processSha) ||
    processSha.startsWith(githubSha) ||
    shortSha(githubSha) === shortSha(processSha);
  if (match) {
    return { status: "MATCH", detail: "Process SHA matches GitHub main" };
  }
  return { status: "BEHIND", detail: `Process ${shortSha(processSha)} ≠ main ${shortSha(githubSha)}` };
}

async function fetchVercelDeployments(fetchImpl: typeof fetch = fetch): Promise<VercelDeploymentTruth> {
  const token = process.env.VERCEL_TOKEN?.trim();
  const projectId = process.env.VERCEL_PROJECT_ID?.trim();
  const teamId = process.env.VERCEL_TEAM_ID?.trim();

  if (!token || !projectId) {
    return {
      status: "NOT_CONFIGURED",
      deployments: [],
      detail: "VERCEL_TOKEN and VERCEL_PROJECT_ID required for deployment list",
    };
  }

  try {
    const params = new URLSearchParams({
      projectId,
      target: "production",
      limit: "1",
    });
    const teamQuery = teamId ? `&teamId=${encodeURIComponent(teamId)}` : "";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetchImpl(`https://api.vercel.com/v6/deployments?${params}${teamQuery}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      return {
        status: "FAILED",
        deployments: [],
        detail: `Vercel API returned ${res.status}`,
      };
    }

    const body = (await res.json()) as {
      deployments?: Array<{
        uid?: string;
        url?: string;
        state?: string;
        created?: number;
        meta?: { githubCommitSha?: string };
      }>;
    };

    const rows = (body.deployments ?? []).map((row) => ({
      projectId,
      sha: row.meta?.githubCommitSha ?? null,
      shortSha: shortSha(row.meta?.githubCommitSha),
      state: row.state ?? null,
      url: row.url ? `https://${row.url}` : null,
      createdAt: row.created ? new Date(row.created).toISOString() : null,
    }));

    return {
      status: rows.length > 0 ? "HEALTHY" : "NO_TELEMETRY",
      deployments: rows,
      detail: rows.length
        ? `Latest production: ${rows[0]?.state ?? "unknown"} @ ${rows[0]?.shortSha ?? "—"}`
        : "No production deployments returned",
    };
  } catch (error) {
    return {
      status: "FAILED",
      deployments: [],
      detail: error instanceof Error ? error.message : "Vercel fetch failed",
    };
  }
}

async function probeOpenRouter(fetchImpl: typeof fetch = fetch): Promise<OpenRouterTruth> {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!isOpenRouterConfigured() || !key) {
    return { status: "NOT_CONFIGURED", detail: "No OPENROUTER_API_KEY" };
  }

  const started = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetchImpl(OPENROUTER_MODELS_URL, {
      headers: { Authorization: `Bearer ${key}` },
      signal: controller.signal,
    });
    clearTimeout(timer);
    const latencyMs = Date.now() - started;

    if (!res.ok) {
      return {
        status: "FAILED",
        detail: `Models endpoint returned ${res.status}`,
        latencyMs,
      };
    }

    const body = (await res.json()) as { data?: unknown[] };
    const modelCount = Array.isArray(body.data) ? body.data.length : 0;
    if (modelCount === 0) {
      return {
        status: "FAILED",
        detail: "Models endpoint returned empty list",
        latencyMs,
        modelCount: 0,
      };
    }

    return {
      status: "HEALTHY",
      detail: `${modelCount} models · ${latencyMs}ms`,
      modelCount,
      latencyMs,
    };
  } catch (error) {
    return {
      status: "FAILED",
      detail: error instanceof Error ? error.message : "OpenRouter probe failed",
      latencyMs: Date.now() - started,
    };
  }
}

async function probeIcd11(): Promise<Icd11Truth> {
  const started = Date.now();
  const credentials = whoApiConfigured() ? ("Configured" as const) : ("Missing" as const);

  if (!credentials) {
    const local = searchIcd11("malaria");
    const latencyMs = Date.now() - started;
    if (local.length > 0) {
      return {
        status: "CONFIGURED_CACHE_ONLY",
        release: ICD11_RELEASE,
        credentials,
        cacheHit: true,
        latencyMs,
        source: "cache",
        topHit: local[0]?.stemCode ?? null,
        detail: `Local cache hit · ${local[0]?.title ?? "malaria"}`,
      };
    }
    return {
      status: "NOT_CONFIGURED",
      release: ICD11_RELEASE,
      credentials,
      cacheHit: false,
      latencyMs,
      source: "none",
      topHit: null,
      detail: "No WHO credentials and cache miss for malaria",
    };
  }

  try {
    const result = await searchWhoIcd11("malaria");
    const latencyMs = Date.now() - started;
    const top = result.hits[0];
    if (result.degraded && result.source === "cache") {
      return {
        status: "FALLBACK_CACHE",
        release: ICD11_RELEASE,
        credentials,
        cacheHit: result.hits.length > 0,
        latencyMs,
        source: "cache",
        topHit: top?.stemCode ?? null,
        detail: "WHO API unavailable — using local cache",
      };
    }
    return {
      status: "HEALTHY",
      release: ICD11_RELEASE,
      credentials,
      cacheHit: result.hits.length > 0,
      latencyMs,
      source: result.source,
      topHit: top?.stemCode ?? null,
      detail: `${result.source.toUpperCase()} · ${top?.stemCode ?? "no hit"}`,
    };
  } catch {
    const local = searchIcd11("malaria");
    return {
      status: "FALLBACK_CACHE",
      release: ICD11_RELEASE,
      credentials,
      cacheHit: local.length > 0,
      latencyMs: Date.now() - started,
      source: "cache",
      topHit: local[0]?.stemCode ?? null,
      detail: "WHO probe failed — local cache fallback",
    };
  }
}

function manifestStatus(id: string, fallback = "NOT IN MANIFEST"): string {
  const product = PRODUCT_MANIFEST.products.find((item) => item.id === id);
  if (product) return statusLabel(product.status).toUpperCase().replace(/\s+/g, "_");
  const platform = PRODUCT_MANIFEST.platform.find((item) => item.id === id);
  if (platform) return statusLabel(platform.status).toUpperCase().replace(/\s+/g, "_");
  const integration = PRODUCT_MANIFEST.integrations.find((item) => item.id === id);
  if (integration) return statusLabel(integration.status).toUpperCase().replace(/\s+/g, "_");
  return fallback;
}

function buildModuleReadiness(): ModuleReadinessItem[] {
  return [
    { id: "fhir", label: "FHIR", status: manifestStatus("fhir-r4"), href: "/platform/registry" },
    { id: "lab", label: "Lab", status: manifestStatus("synapse-lab"), href: "/platform/registry" },
    {
      id: "insurance",
      label: "Insurance",
      status: manifestStatus("insurers"),
      href: "/platform/registry",
    },
    {
      id: "pharm",
      label: "Pharm",
      status: manifestStatus("synapse-pharm"),
      href: "/platform/registry",
    },
    {
      id: "intelligence",
      label: "Intelligence",
      status: manifestStatus("synapse-intelligence"),
      href: "/platform/intelligence",
    },
    {
      id: "icd11",
      label: "ICD-11",
      status: manifestStatus("icd-11"),
      href: "/platform/icd11",
    },
  ];
}

export async function getProductionTruth(): Promise<ProductionTruth> {
  const [githubMain, dbHealth, openRouter, icd11, vercelDeployments] = await Promise.all([
    fetchGitHubMainSha(),
    checkDatabaseLatency(),
    probeOpenRouter(),
    probeIcd11(),
    fetchVercelDeployments(),
  ]);

  const processSha = process.env.VERCEL_GIT_COMMIT_SHA?.trim() ?? null;
  const processEnv = process.env.VERCEL_ENV?.trim() ?? null;

  const database: DatabaseTruth = !dbHealth.ok
    ? { status: "OUTAGE", latencyMs: dbHealth.latencyMs, detail: "Tenant probe failed" }
    : dbHealth.latencyMs >= 500
      ? {
          status: "DEGRADED",
          latencyMs: dbHealth.latencyMs,
          detail: `${dbHealth.latencyMs}ms latency`,
        }
      : {
          status: "OPERATIONAL",
          latencyMs: dbHealth.latencyMs,
          detail: `${dbHealth.latencyMs}ms latency`,
        };

  return {
    githubMain,
    processDeploy: {
      sha: processSha,
      shortSha: shortSha(processSha),
      environment: processEnv,
      detail: processSha
        ? `${processEnv ?? "unknown env"} · ${shortSha(processSha)}`
        : "No VERCEL_GIT_COMMIT_SHA on this process",
    },
    shaComparison: compareShas(githubMain.sha, processSha),
    vercelDeployments,
    database,
    openRouter,
    icd11,
    modules: buildModuleReadiness(),
    checkedAt: new Date().toISOString(),
  };
}
