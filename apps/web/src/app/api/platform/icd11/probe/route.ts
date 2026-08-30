import { NextResponse } from "next/server";
import { requirePlatformAdminApi } from "@/lib/platform/auth";
import { getProductionTruth } from "@/lib/platform/production-truth";
import { searchIcd11, searchWhoIcd11, ICD11_RELEASE, whoApiConfigured } from "@synapse/interop";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requirePlatformAdminApi();
  if (!auth.ok) return auth.response;

  const truth = await getProductionTruth();
  return NextResponse.json({
    release: ICD11_RELEASE,
    credentials: truth.icd11.credentials,
    status: truth.icd11.status,
    latencyMs: truth.icd11.latencyMs,
    source: truth.icd11.source,
    cacheSearch: searchIcd11("malaria").slice(0, 5).map((hit) => ({
      stemCode: hit.stemCode,
      title: hit.title,
      score: hit.score,
    })),
    checkedAt: truth.checkedAt,
  });
}

export async function POST(request: Request) {
  const auth = await requirePlatformAdminApi();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as { query?: string };
  const query = (body.query ?? "malaria").trim();
  if (!query) {
    return NextResponse.json({ error: "query required" }, { status: 400 });
  }

  const started = Date.now();
  const whoConfigured = whoApiConfigured();
  const result = whoConfigured ? await searchWhoIcd11(query) : { hits: searchIcd11(query), source: "cache" as const, degraded: true };

  return NextResponse.json({
    release: ICD11_RELEASE,
    query,
    credentials: whoConfigured ? "Configured" : "Missing",
    source: result.source,
    degraded: result.degraded,
    latencyMs: Date.now() - started,
    hits: result.hits.slice(0, 10).map((hit) => ({
      stemCode: hit.stemCode,
      title: hit.title,
      score: hit.score,
    })),
    checkedAt: new Date().toISOString(),
  });
}
