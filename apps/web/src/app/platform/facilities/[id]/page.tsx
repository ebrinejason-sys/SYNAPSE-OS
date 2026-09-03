export const dynamic = "force-dynamic"

import Link from "next/link"
import type { ReactNode } from "react"
import { requirePlatformAdmin } from "../../../../lib/platform/auth"
import { formatDate, safeRows } from "../../_lib/platform-data"
import { FacilityResumeButton } from "./resume-button"

type TenantRow = {
  id?: string
  name?: string | null
  slug?: string | null
  facility_type?: string | null
  status?: string | null
  is_active?: boolean | null
  plan?: string | null
  email?: string | null
  phone?: string | null
  district?: string | null
  default_subdomain?: string | null
  custom_domain?: string | null
  modules_enabled?: string[] | null
  created_at?: string | null
}

type RunRow = {
  id?: string
  status?: string | null
  failure_code?: string | null
  current_step?: string | null
  correlation_id?: string | null
  mode?: string | null
  created_at?: string | null
  metadata?: Record<string, unknown> | null
}

type StepRow = {
  step?: string | null
  status?: string | null
  error_code?: string | null
  safe_error_message?: string | null
}

export default async function FacilityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ runId?: string }>
}) {
  await requirePlatformAdmin()
  const { id } = await params
  const sp = (await searchParams) ?? {}

  const [tenants, runs] = await Promise.all([
    safeRows<TenantRow>(
      "tenants",
      "id, name, slug, facility_type, status, is_active, plan, email, phone, district, default_subdomain, custom_domain, modules_enabled, created_at",
      { filters: [["id", id]], limit: 1 },
    ),
    safeRows<RunRow>(
      "facility_provisioning_runs",
      "id, status, failure_code, current_step, correlation_id, mode, created_at, metadata, tenant_id",
      { filters: [["tenant_id", id]], orderBy: "created_at", limit: 10 },
    ),
  ])

  const facility = tenants[0]
  if (!facility) {
    return <div className="text-sm text-slate-400">Facility not found.</div>
  }

  const run = (sp.runId ? runs.find((r) => r.id === sp.runId) : runs[0]) ?? runs[0]
  const steps = run?.id
    ? await safeRows<StepRow>(
        "facility_provisioning_steps",
        "step, status, error_code, safe_error_message",
        { filters: [["run_id", run.id]], limit: 50 },
      )
    : []

  const domain =
    facility.custom_domain ||
    (facility.facility_type === "pharmacy"
      ? `pharm.synapseos.tech/login?tenant=${(facility.slug ?? "").replace(/^pharm-/, "")}`
      : `${facility.default_subdomain || facility.slug}.synapseos.tech`)

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#E8B84B]">Facility</p>
          <h1 className="mt-1 text-2xl font-bold text-white">{facility.name}</h1>
          <p className="mt-1 text-sm capitalize text-slate-400">
            {facility.facility_type?.replace(/_/g, " ")} · {facility.status}
            {facility.is_active === false ? " · inactive" : ""}
          </p>
        </div>
        <Link href="/platform/facilities" className="text-sm text-[#E8B84B] hover:underline">
          ← Facilities
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <InfoCard title="Identity">
          <Row label="Slug" value={facility.slug} mono />
          <Row label="Email" value={facility.email} />
          <Row label="District" value={facility.district} />
          <Row label="Created" value={formatDate(facility.created_at)} />
        </InfoCard>
        <InfoCard title="Domain & subscription">
          <Row label="Domain" value={domain} mono />
          <Row label="Plan" value={facility.plan} />
          <Row label="Active" value={String(facility.is_active)} />
        </InfoCard>
      </div>

      <InfoCard title="Modules">
        <p className="font-mono text-xs text-slate-300">
          {(facility.modules_enabled ?? []).join(", ") || "—"}
        </p>
      </InfoCard>

      <InfoCard title="Provisioning run">
        {run ? (
          <div className="space-y-3">
            <Row label="Run ID" value={run.id} mono />
            <Row label="Status" value={run.status} />
            <Row label="Failure code" value={run.failure_code} />
            <Row label="Correlation" value={run.correlation_id} mono />
            <Row label="Mode" value={run.mode} />
            {(run.status === "FAILED" || run.status === "RUNNING") && run.id ? (
              <FacilityResumeButton runId={run.id} />
            ) : null}
            <div className="space-y-1 border-t border-slate-800 pt-3">
              {steps.map((s) => (
                <div key={s.step} className="flex justify-between text-xs">
                  <span className="font-mono text-slate-400">{s.step}</span>
                  <span
                    className={
                      s.status === "COMPLETE"
                        ? "text-green-400"
                        : s.status === "FAILED"
                          ? "text-red-400"
                          : "text-slate-500"
                    }
                  >
                    {s.status}
                    {s.error_code ? ` · ${s.error_code}` : ""}
                    {s.safe_error_message ? ` — ${s.safe_error_message}` : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No provisioning run recorded.</p>
        )}
      </InfoCard>

      {facility.facility_type === "pharmacy" ? (
        <InfoCard title="Pharmacy">
          <p className="text-sm text-slate-400">
            Workspace via <code className="text-[#E8B84B]">pharm.synapseos.tech/login?tenant=…</code>. POS and
            inventory remain on the Synapse Pharm product surface.
          </p>
        </InfoCard>
      ) : null}
      {facility.facility_type === "laboratory" ? (
        <InfoCard title="Laboratory">
          <p className="text-sm text-slate-400">
            Laboratory foundation modules only — analyzer transport is out of scope for this control-plane
            milestone.
          </p>
        </InfoCard>
      ) : null}
      {(facility.facility_type === "hospital" || !facility.facility_type) && (
        <InfoCard title="Hospital">
          <Link href={`/platform/hospitals/${facility.id}`} className="text-sm text-[#E8B84B] hover:underline">
            Open specialized hospital view
          </Link>
        </InfoCard>
      )}

      <InfoCard title="Test Center">
        <Link href="/platform/test-center" className="text-sm text-[#E8B84B] hover:underline">
          Open Test Center suites
        </Link>
      </InfoCard>
    </div>
  )
}

function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
      <h2 className="mb-3 text-sm font-semibold text-slate-200">{title}</h2>
      {children}
    </section>
  )
}

function Row({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={`text-right text-slate-200 ${mono ? "font-mono text-xs" : ""}`}>{value ?? "—"}</span>
    </div>
  )
}
