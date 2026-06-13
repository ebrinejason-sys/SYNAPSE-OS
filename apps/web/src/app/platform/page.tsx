export const dynamic = "force-dynamic";

import { requirePlatformAdmin } from "../../lib/platform/auth";
import { formatDateTime, formatUGX, safeCount, safeRows } from "./_lib/platform-data";
import { OverviewCommandCenter, type OverviewCommandCenterData } from "./_components/overview-command-center";

type TenantRow = {
  id?: string;
  created_at?: string;
  status?: string;
};

type SubscriptionRow = {
  monthly_amount_ugx?: number | string | null;
  status?: string | null;
};

type ProfileRow = {
  role?: string | null;
};

type DiagnosisRow = {
  code?: string | null;
  icd_code?: string | null;
  description?: string | null;
  diagnosis?: string | null;
  name?: string | null;
  created_at?: string | null;
};

type AuditRow = {
  id?: string;
  action?: string | null;
  entity_type?: string | null;
  resource_type?: string | null;
  actor_id?: string | null;
  created_at?: string | null;
};

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("en-GB", { month: "short", timeZone: "Africa/Kampala" });
}

function lastTwelveMonths() {
  const now = new Date();
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (11 - index), 1));
    return { key: monthKey(date), label: monthLabel(date), date };
  });
}

async function getOverviewData(): Promise<OverviewCommandCenterData> {
  const [
    activeFacilities,
    totalUsers,
    liveSessions,
    pendingKyc,
    openTickets,
    tenants,
    subscriptions,
    profiles,
    diagnoses,
    auditRows,
  ] = await Promise.all([
    safeCount("tenants", [["status", "active"]]),
    safeCount("profiles"),
    safeCount("telemedicine_sessions", [["status", "live"]]),
    safeCount("verification_documents", [["status", "pending_review"]]),
    safeCount("support_tickets", [["status", "open"]]),
    safeRows<TenantRow>("tenants", "id, created_at, status", { limit: 5000 }),
    safeRows<SubscriptionRow>("facility_subscriptions", "monthly_amount_ugx, status", {
      filters: [["status", "active"]],
      limit: 5000,
    }),
    safeRows<ProfileRow>("profiles", "role", { limit: 5000 }),
    safeRows<DiagnosisRow>("diagnoses", "code, icd_code, description, diagnosis, name, created_at", {
      orderBy: "created_at",
      limit: 1000,
    }),
    safeRows<AuditRow>("audit_log", "id, action, entity_type, resource_type, actor_id, created_at", {
      orderBy: "created_at",
      limit: 10,
    }),
  ]);

  const mrr = subscriptions.reduce((sum, row) => sum + Number(row.monthly_amount_ugx ?? 0), 0);
  const months = lastTwelveMonths();
  let cumulativeFacilities = 0;
  const growth = months.map((month) => {
    const count = tenants.filter((tenant) => {
      if (!tenant.created_at) return false;
      return monthKey(new Date(tenant.created_at)) === month.key;
    }).length;
    cumulativeFacilities += count;
    return {
      label: month.label,
      facilities: cumulativeFacilities,
      mrr: Math.round((mrr / 12) * (months.indexOf(month) + 1)),
      target: Math.round((Number(process.env.PLATFORM_MRR_TARGET_UGX ?? 0) || mrr || 1) * 0.9),
    };
  });

  const roleCounts = new Map<string, number>();
  for (const profile of profiles) {
    const role = profile.role || "unknown";
    roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1);
  }

  const diagnosisCounts = new Map<string, { code: string; label: string; count: number }>();
  for (const diagnosis of diagnoses) {
    const code = diagnosis.icd_code || diagnosis.code || "uncoded";
    const label = diagnosis.description || diagnosis.diagnosis || diagnosis.name || code;
    const key = `${code}:${label}`;
    const current = diagnosisCounts.get(key) ?? { code, label, count: 0 };
    current.count += 1;
    diagnosisCounts.set(key, current);
  }

  return {
    stats: [
      { label: "Active facilities", value: activeFacilities.toLocaleString(), detail: "Tenants currently active", href: "/platform/hospitals" },
      { label: "Registered users", value: totalUsers.toLocaleString(), detail: "All roles across Synapse", href: "/platform/users" },
      { label: "MRR", value: formatUGX(mrr), detail: "Active subscriptions", href: "/platform/billing" },
      { label: "Live telemedicine", value: liveSessions.toLocaleString(), detail: "Sessions in progress", href: "/platform/health" },
    ],
    growth,
    roles: Array.from(roleCounts.entries())
      .map(([role, count]) => ({ role: role.replaceAll("_", " "), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 7),
    diagnoses: Array.from(diagnosisCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    activity: auditRows.map((row) => ({
      id: row.id ?? crypto.randomUUID(),
      action: row.action ?? "System event",
      entity: row.entity_type ?? row.resource_type ?? "platform",
      actor: row.actor_id ? row.actor_id.slice(0, 8) : "system",
      createdAt: formatDateTime(row.created_at),
    })),
    health: [
      {
        label: "Supabase",
        value: process.env.NEXT_PUBLIC_SUPABASE_URL ? "Configured" : "Missing",
        status: process.env.NEXT_PUBLIC_SUPABASE_URL ? "green" : "red",
      },
      {
        label: "Vercel",
        value: process.env.VERCEL_TOKEN ? "Token ready" : "Token missing",
        status: process.env.VERCEL_TOKEN ? "green" : "amber",
      },
      {
        label: "DHIS2",
        value: process.env.DHIS2_URL ? "Configured" : "Pending",
        status: process.env.DHIS2_URL ? "green" : "amber",
      },
      {
        label: "SMS",
        value: process.env.AFRICAS_TALKING_API_KEY ? "Configured" : "Pending",
        status: process.env.AFRICAS_TALKING_API_KEY ? "green" : "amber",
      },
      {
        label: "Resend",
        value: process.env.RESEND_API_KEY ? "Connected" : "Missing",
        status: process.env.RESEND_API_KEY ? "green" : "amber",
      },
    ],
    quickCounts: { pendingKyc, openTickets },
  };
}

export default async function PlatformOverviewPage() {
  await requirePlatformAdmin();
  const data = await getOverviewData();
  return <OverviewCommandCenter data={data} />;
}
