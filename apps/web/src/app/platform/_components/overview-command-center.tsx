"use client";

import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Building2,
  ClipboardCheck,
  LifeBuoy,
  Mail,
  MapPin,
  Pill,
  ShieldCheck,
} from "lucide-react";
import { EmptyState } from "./empty-state";
import { MetricCard } from "./metric-card";
import { PlatformPageHeader } from "./platform-page-header";

type Metric = {
  label: string;
  value: string;
  href: string;
  sparkline?: number[];
  delta?: number | null;
  deltaLabel?: string;
};

type HealthItem = {
  label: string;
  value: string;
  status: "green" | "amber" | "red";
};

type ActivityItem = {
  id: string;
  kind: "audit" | "application" | "lead";
  title: string;
  subtitle: string;
  href: string;
  createdAt: string;
};

type AttentionItem = {
  id: string;
  label: string;
  count: number;
  href: string;
  detail: string;
};

type ApplicationPreview = {
  id: string;
  name: string;
  email: string;
  district: string;
};

export type OverviewCommandCenterData = {
  metrics: Metric[];
  health: HealthItem[];
  activity: ActivityItem[];
  attentionItems: AttentionItem[];
  topApplications: ApplicationPreview[];
  openTickets: Array<{ id: string; subject: string; createdAt: string }>;
  subscriptions: {
    mrr: string;
    trialing: number;
    active: number;
    pastDue: number;
    suspended: number;
  };
  ecosystemSummary: {
    pharmacyTenants: number;
    hospitalTenants: number;
    districts: number;
  };
};

const SUB_STAGES = [
  { key: "trialing", label: "Trialing", tone: "text-amber-300", dot: "bg-amber-400" },
  { key: "active", label: "Active", tone: "text-green-300", dot: "bg-green-400" },
  { key: "pastDue", label: "Past due", tone: "text-orange-300", dot: "bg-orange-400" },
  { key: "suspended", label: "Suspended", tone: "text-red-300", dot: "bg-red-400" },
] as const;

function healthDot(status: HealthItem["status"]) {
  if (status === "green") return "bg-green-400";
  if (status === "amber") return "bg-amber-400";
  return "bg-red-400";
}

function activityIcon(kind: ActivityItem["kind"]) {
  if (kind === "application") return Building2;
  if (kind === "lead") return ClipboardCheck;
  return Activity;
}

export function OverviewCommandCenter({ data }: { data: OverviewCommandCenterData }) {
  return (
    <div className="space-y-6">
      <PlatformPageHeader
        eyebrow="Overview"
        title="Command Center"
        description="Executive cockpit for the Synapse ecosystem — facilities, users, revenue, sessions, and what needs your attention right now."
        actions={
          <>
            <Link
              href="/platform/hospitals/new"
              className="inline-flex items-center gap-2 rounded-xl bg-[#F97316] px-4 py-2.5 text-sm font-semibold text-[#07070A] transition hover:opacity-90"
            >
              <Building2 className="h-4 w-4" />
              Add facility
            </Link>
            <Link
              href="/platform/broadcasts"
              className="inline-flex items-center gap-2 rounded-xl border border-[#E8B84B]/30 bg-[#E8B84B]/10 px-4 py-2.5 text-sm font-semibold text-[#E8B84B]"
            >
              <Mail className="h-4 w-4" />
              Publish bulletin
            </Link>
          </>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {data.metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <section className="rounded-xl border border-subtle bg-surface p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-primary-color">Network health</h2>
          <Link href="/platform/health" className="text-xs font-medium text-[#F97316] hover:underline">
            Speed Insights →
          </Link>
        </div>
        <div className="flex flex-wrap gap-3">
          {data.health.map((item) => (
            <div
              key={item.label}
              className="inline-flex min-w-[140px] flex-1 items-center gap-2 rounded-lg border border-subtle bg-base px-3 py-2"
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${healthDot(item.status)}`} aria-hidden />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-color">{item.label}</p>
                <p className="truncate text-xs font-medium text-primary-color">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <article className="rounded-xl border border-subtle bg-surface">
          <div className="flex items-center justify-between border-b border-subtle px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-primary-color">Ecosystem activity</h2>
              <p className="text-xs text-muted-color">Applications, leads, and platform events</p>
            </div>
            <Activity className="h-4 w-4 text-[#E8B84B]" />
          </div>
          <div className="divide-y divide-subtle">
            {data.activity.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={Activity}
                  title="No activity yet"
                  description="As facilities apply, onboard, and operate, events will stream here in real time."
                  action={
                    <Link href="/platform/applications" className="text-sm font-semibold text-[#F97316]">
                      Open applications pipeline →
                    </Link>
                  }
                />
              </div>
            ) : (
              data.activity.map((item) => {
                const Icon = activityIcon(item.kind);
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="flex items-start gap-3 px-4 py-3 transition hover:bg-elevated/50"
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-subtle bg-base">
                      <Icon className="h-4 w-4 text-[#E8B84B]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-primary-color">{item.title}</p>
                      <p className="mt-0.5 text-xs text-muted-color">{item.subtitle}</p>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-color">{item.createdAt}</span>
                  </Link>
                );
              })
            )}
          </div>
        </article>

        <aside className="space-y-4">
          <section className="rounded-xl border border-subtle bg-surface p-4">
            <h2 className="text-sm font-semibold text-primary-color">Needs your attention</h2>
            <p className="mt-1 text-xs text-muted-color">One-click actions for operational queues</p>
            <div className="mt-4 space-y-2">
              {data.attentionItems.length === 0 ? (
                <p className="rounded-lg border border-subtle bg-base px-3 py-4 text-sm text-muted-color">
                  All clear — no urgent queues right now.
                </p>
              ) : (
                data.attentionItems.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="flex items-center justify-between gap-3 rounded-lg border border-subtle bg-base px-3 py-2.5 transition hover:border-[#F97316]/30"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-primary-color">{item.label}</p>
                      <p className="text-xs text-muted-color">{item.detail}</p>
                    </div>
                    <span className="rounded-full bg-[#F97316]/15 px-2.5 py-0.5 text-xs font-bold tabular-nums text-[#F97316]">
                      {item.count}
                    </span>
                  </Link>
                ))
              )}
            </div>

            {data.topApplications.length > 0 ? (
              <div className="mt-4 border-t border-subtle pt-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-color">Top applications</p>
                <div className="mt-2 space-y-2">
                  {data.topApplications.map((app) => (
                    <Link
                      key={app.id}
                      href="/platform/applications"
                      className="block rounded-lg border border-subtle bg-base px-3 py-2 transition hover:border-[#F97316]/25"
                    >
                      <p className="truncate text-sm font-medium text-primary-color">{app.name}</p>
                      <p className="truncate text-xs text-muted-color">
                        {app.district} · {app.email}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section className="rounded-xl border border-subtle bg-surface p-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-primary-color">
                <Pill className="h-4 w-4 text-[#E8B84B]" />
                Subscriptions
              </h2>
              <Link href="/platform/billing" className="text-xs font-medium text-[#F97316] hover:underline">
                Billing →
              </Link>
            </div>
            <div className="mt-3 rounded-lg border border-subtle bg-base px-3 py-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-color">Monthly recurring revenue</p>
              <p className="mt-0.5 font-mono text-xl font-bold text-[#F97316]">{data.subscriptions.mrr}</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {SUB_STAGES.map((stage) => (
                <div
                  key={stage.key}
                  className="flex items-center justify-between rounded-lg border border-subtle bg-base px-3 py-2"
                >
                  <span className="flex items-center gap-2 text-xs text-secondary-color">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${stage.dot}`} aria-hidden />
                    {stage.label}
                  </span>
                  <span className={`text-sm font-semibold tabular-nums ${stage.tone}`}>
                    {data.subscriptions[stage.key]}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-subtle bg-surface p-4">
            <h2 className="text-sm font-semibold text-primary-color">Ecosystem snapshot</h2>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between rounded-lg border border-subtle bg-base px-3 py-2">
                <span className="flex items-center gap-2 text-sm text-secondary-color">
                  <Pill className="h-3.5 w-3.5 text-[#E8B84B]" />
                  Pharmacy tenants
                </span>
                <span className="font-semibold tabular-nums text-primary-color">
                  {data.ecosystemSummary.pharmacyTenants}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-subtle bg-base px-3 py-2">
                <span className="flex items-center gap-2 text-sm text-secondary-color">
                  <Building2 className="h-3.5 w-3.5 text-[#E8B84B]" />
                  Hospital / clinic tenants
                </span>
                <span className="font-semibold tabular-nums text-primary-color">
                  {data.ecosystemSummary.hospitalTenants}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-subtle bg-base px-3 py-2">
                <span className="flex items-center gap-2 text-sm text-secondary-color">
                  <MapPin className="h-3.5 w-3.5 text-[#E8B84B]" />
                  Districts covered
                </span>
                <span className="font-semibold tabular-nums text-primary-color">
                  {data.ecosystemSummary.districts}
                </span>
              </div>
            </div>
            <Link
              href="/platform/analytics"
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#F97316]"
            >
              Full analytics <ArrowRight className="h-3 w-3" />
            </Link>
          </section>

          {data.openTickets.length > 0 ? (
            <section className="rounded-xl border border-subtle bg-surface p-4">
              <div className="flex items-center gap-2">
                <LifeBuoy className="h-4 w-4 text-[#E8B84B]" />
                <h2 className="text-sm font-semibold text-primary-color">Open tickets</h2>
              </div>
              <div className="mt-3 space-y-2">
                {data.openTickets.slice(0, 3).map((ticket) => (
                  <Link
                    key={ticket.id}
                    href="/platform/support"
                    className="block rounded-lg border border-subtle bg-base px-3 py-2 text-sm transition hover:border-[#F97316]/25"
                  >
                    <p className="truncate font-medium text-primary-color">{ticket.subject}</p>
                    <p className="text-xs text-muted-color">{ticket.createdAt}</p>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-xl border border-[#E8B84B]/25 bg-[#E8B84B]/10 p-4">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#E8B84B]" />
              <div>
                <h2 className="text-sm font-semibold text-[#E8B84B]">Platform admin secured</h2>
                <p className="mt-1 text-xs text-secondary-color">
                  All routes require platform_admin role and MFA assurance.
                </p>
              </div>
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
