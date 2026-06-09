"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Building2,
  ClipboardCheck,
  LifeBuoy,
  Mail,
  Radio,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Stat = {
  label: string;
  value: string;
  detail: string;
  href: string;
};

type ChartPoint = {
  label: string;
  facilities: number;
  mrr: number;
  target: number;
};

type RolePoint = {
  role: string;
  count: number;
};

type DiagnosisPoint = {
  code: string;
  label: string;
  count: number;
};

type ActivityItem = {
  id: string;
  action: string;
  entity: string;
  actor: string;
  createdAt: string;
};

type HealthItem = {
  label: string;
  value: string;
  status: "green" | "amber" | "red";
};

export type OverviewCommandCenterData = {
  stats: Stat[];
  growth: ChartPoint[];
  roles: RolePoint[];
  diagnoses: DiagnosisPoint[];
  activity: ActivityItem[];
  health: HealthItem[];
  quickCounts: {
    pendingKyc: number;
    openTickets: number;
  };
};

const roleColors = ["#F97316", "#E8B84B", "#22C55E", "#3B82F6", "#A855F7", "#EF4444", "#64748B"];

function statusClass(status: HealthItem["status"]) {
  if (status === "green") return "border-green-500/25 bg-green-500/10 text-green-300";
  if (status === "amber") return "border-amber-500/25 bg-amber-500/10 text-amber-300";
  return "border-red-500/25 bg-red-500/10 text-red-300";
}

export function OverviewCommandCenter({ data }: { data: OverviewCommandCenterData }) {
  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#E8B84B]">Platform Command Center</p>
          <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">Synapse OS Operations</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Live operating picture across tenants, users, revenue, public health signals, support, and infrastructure.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/platform/hospitals/new" className="inline-flex items-center gap-2 rounded-xl bg-[#F97316] px-4 py-2 text-sm font-bold text-[#07070A]">
            <Building2 className="h-4 w-4" />
            Add facility
          </Link>
          <Link href="/platform/broadcasts" className="inline-flex items-center gap-2 rounded-xl border border-[#E8B84B]/30 bg-[#E8B84B]/10 px-4 py-2 text-sm font-semibold text-[#E8B84B]">
            <Mail className="h-4 w-4" />
            Publish bulletin
          </Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {data.stats.map((stat) => (
          <Link key={stat.label} href={stat.href} className="rounded-xl border border-slate-800 bg-[#111117] p-4 transition hover:border-[#F97316]/40 hover:bg-[#141419]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">{stat.label}</p>
                <p className="mt-2 text-2xl font-bold text-white">{stat.value}</p>
                <p className="mt-1 text-xs text-slate-400">{stat.detail}</p>
              </div>
              <ArrowUpRight className="h-4 w-4 text-[#E8B84B]" />
            </div>
          </Link>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-xl border border-slate-800 bg-[#111117] p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Facility Growth</h2>
              <span className="text-xs text-slate-500">Last 12 months</span>
            </div>
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={data.growth}>
                  <CartesianGrid stroke="#1E1E28" vertical={false} />
                  <XAxis dataKey="label" stroke="#60607A" fontSize={11} />
                  <YAxis stroke="#60607A" fontSize={11} />
                  <Tooltip contentStyle={{ background: "#111117", border: "1px solid #1E1E28", borderRadius: 8 }} />
                  <Line type="monotone" dataKey="facilities" stroke="#F97316" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="rounded-xl border border-slate-800 bg-[#111117] p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">MRR Trend</h2>
              <span className="text-xs text-slate-500">UGX</span>
            </div>
            <div className="h-64">
              <ResponsiveContainer>
                <AreaChart data={data.growth}>
                  <CartesianGrid stroke="#1E1E28" vertical={false} />
                  <XAxis dataKey="label" stroke="#60607A" fontSize={11} />
                  <YAxis stroke="#60607A" fontSize={11} />
                  <Tooltip contentStyle={{ background: "#111117", border: "1px solid #1E1E28", borderRadius: 8 }} />
                  <Area type="monotone" dataKey="mrr" stroke="#E8B84B" fill="#E8B84B" fillOpacity={0.15} />
                  <Line type="monotone" dataKey="target" stroke="#64748B" strokeDasharray="4 4" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="rounded-xl border border-slate-800 bg-[#111117] p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">User Role Distribution</h2>
              <Users className="h-4 w-4 text-[#E8B84B]" />
            </div>
            <div className="grid gap-4 md:grid-cols-[180px_1fr]">
              <div className="h-44">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={data.roles} dataKey="count" nameKey="role" innerRadius={44} outerRadius={72} paddingAngle={2}>
                      {data.roles.map((entry, index) => (
                        <Cell key={entry.role} fill={roleColors[index % roleColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#111117", border: "1px solid #1E1E28", borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {data.roles.length === 0 ? <p className="text-sm text-slate-500">No role data yet.</p> : null}
                {data.roles.map((role, index) => (
                  <div key={role.role} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2 text-slate-300">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: roleColors[index % roleColors.length] }} />
                      {role.role}
                    </span>
                    <span className="font-semibold text-white">{role.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-slate-800 bg-[#111117] p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Top Diagnoses</h2>
              <Radio className="h-4 w-4 text-[#E8B84B]" />
            </div>
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={data.diagnoses} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid stroke="#1E1E28" horizontal={false} />
                  <XAxis type="number" stroke="#60607A" fontSize={11} />
                  <YAxis dataKey="label" type="category" stroke="#A0A0B8" fontSize={11} width={92} />
                  <Tooltip contentStyle={{ background: "#111117", border: "1px solid #1E1E28", borderRadius: 8 }} />
                  <Bar dataKey="count" fill="#F97316" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>
        </div>

        <aside className="space-y-4">
          <section className="rounded-xl border border-slate-800 bg-[#111117] p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Live Activity</h2>
              <Activity className="h-4 w-4 text-[#E8B84B]" />
            </div>
            <div className="space-y-2">
              {data.activity.length === 0 ? <p className="text-sm text-slate-500">No audit events yet.</p> : null}
              {data.activity.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-800 bg-[#07070A] p-3">
                  <p className="text-sm font-medium text-slate-100">{item.action}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.entity} by {item.actor}</p>
                  <p className="mt-1 text-[11px] text-slate-600">{item.createdAt}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-slate-800 bg-[#111117] p-4">
            <h2 className="mb-3 text-sm font-semibold text-white">Quick Actions</h2>
            <div className="grid gap-2">
              <Link href="/platform/approvals" className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#07070A] px-3 py-2 text-sm text-slate-200">
                <span className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-[#E8B84B]" /> Review KYC queue</span>
                <span className="rounded-full bg-[#F97316]/15 px-2 py-0.5 text-xs text-[#F97316]">{data.quickCounts.pendingKyc}</span>
              </Link>
              <Link href="/platform/support" className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#07070A] px-3 py-2 text-sm text-slate-200">
                <span className="flex items-center gap-2"><LifeBuoy className="h-4 w-4 text-[#E8B84B]" /> View open tickets</span>
                <span className="rounded-full bg-[#F97316]/15 px-2 py-0.5 text-xs text-[#F97316]">{data.quickCounts.openTickets}</span>
              </Link>
              <Link href="/platform/billing" className="flex items-center gap-2 rounded-lg border border-slate-800 bg-[#07070A] px-3 py-2 text-sm text-slate-200">
                <Wallet className="h-4 w-4 text-[#E8B84B]" /> Revenue control
              </Link>
            </div>
          </section>

          <section className="rounded-xl border border-slate-800 bg-[#111117] p-4">
            <h2 className="mb-3 text-sm font-semibold text-white">Platform Health</h2>
            <div className="space-y-2">
              {data.health.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-[#07070A] px-3 py-2">
                  <span className="text-sm text-slate-300">{item.label}</span>
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${statusClass(item.status)}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-red-500/25 bg-red-500/10 p-4">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
              <div>
                <h2 className="text-sm font-semibold text-red-200">Outbreak Watch</h2>
                <p className="mt-1 text-xs text-red-100/80">
                  Cluster detection panel is ready for district-level signals once diagnosis volume increases.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-[#E8B84B]/25 bg-[#E8B84B]/10 p-4">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#E8B84B]" />
              <div>
                <h2 className="text-sm font-semibold text-[#E8B84B]">Admin MFA enforced</h2>
                <p className="mt-1 text-xs text-slate-300">Platform routes require Supabase assurance level aal2.</p>
              </div>
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
