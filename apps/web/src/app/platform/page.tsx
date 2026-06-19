export const dynamic = "force-dynamic";

import Link from "next/link";
import { requirePlatformAdmin } from "../../lib/platform/auth";
import {
  checkDatabaseLatency,
  dailyCountsFromRows,
  formatDateTime,
  formatUGX,
  lastNDays,
  percentDelta,
  safeCount,
  safeRows,
} from "./_lib/platform-data";
import { OverviewCommandCenter, type OverviewCommandCenterData } from "./_components/overview-command-center";

type TenantRow = {
  id?: string;
  created_at?: string | null;
  status?: string | null;
  facility_type?: string | null;
  district?: string | null;
};
type ProfileRow = { id?: string; created_at?: string | null; role?: string | null };
type SubscriptionRow = { monthly_amount_ugx?: number | string | null; status?: string | null };
type AuditRow = {
  id?: string;
  action?: string | null;
  entity_type?: string | null;
  resource_type?: string | null;
  actor_id?: string | null;
  tenant_id?: string | null;
  created_at?: string | null;
  metadata?: Record<string, unknown> | null;
};
type ApplicationRow = {
  id?: string;
  organization?: string | null;
  full_name?: string | null;
  email?: string | null;
  district?: string | null;
  status?: string | null;
  created_at?: string | null;
  tenant_id?: string | null;
};
type LeadRow = {
  id?: string;
  full_name?: string;
  email?: string;
  hospital_name?: string | null;
  role?: string;
  location?: string | null;
  status?: string;
  created_at?: string;
};
type OnboardingRow = { tenant_id?: string | null; current_step?: number | null };
type TicketRow = { id?: string; subject?: string | null; status?: string | null; created_at?: string | null };

function sumWindow(values: number[], start: number, end: number) {
  return values.slice(start, end).reduce((sum, value) => sum + value, 0);
}

async function getOverviewData(): Promise<OverviewCommandCenterData> {
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const [
    dbHealth,
    activeFacilities,
    totalUsers,
    liveSessions,
    pendingKyc,
    openTickets,
    pendingApplications,
    tenants,
    recentTenants,
    recentProfiles,
    transactionRows,
    subscriptions,
    auditRows,
    applications,
    professionalLeads,
    onboardingRows,
    openTicketRows,
  ] = await Promise.all([
    checkDatabaseLatency(),
    safeCount("tenants", [["status", "active"]]),
    safeCount("profiles"),
    safeCount("synapse_sessions"),
    safeCount("verification_documents", [["status", "pending_review"]]),
    safeCount("support_tickets", [["status", "open"]]),
    safeCount("beta_access_requests", [["status", "pending"]]),
    safeRows<TenantRow>("tenants", "id, created_at, status, facility_type, district", { orderBy: "created_at", limit: 500 }),
    safeRows<TenantRow>("tenants", "id, created_at", { orderBy: "created_at", limit: 500 }),
    safeRows<ProfileRow>("profiles", "id, created_at", { orderBy: "created_at", limit: 500 }),
    safeRows<{ created_at?: string | null }>("pharmacy_transactions", "created_at", {
      orderBy: "created_at",
      limit: 500,
    }),
    safeRows<SubscriptionRow>("facility_subscriptions", "monthly_amount_ugx, status", {
      filters: [["status", "active"]],
      limit: 5000,
    }),
    safeRows<AuditRow>(
      "audit_log",
      "id, action, entity_type, resource_type, actor_id, tenant_id, created_at, metadata",
      { orderBy: "created_at", limit: 20 }
    ),
    safeRows<ApplicationRow>(
      "beta_access_requests",
      "id, organization, full_name, email, district, status, created_at, tenant_id",
      { orderBy: "created_at", limit: 8 }
    ),
    safeRows<LeadRow>(
      "professional_leads",
      "id, full_name, email, hospital_name, role, location, status, created_at",
      { orderBy: "created_at", limit: 8 }
    ),
    safeRows<OnboardingRow>("pharmacy_onboarding", "tenant_id, current_step", { limit: 500 }),
    safeRows<TicketRow>("support_tickets", "id, subject, status, created_at", {
      filters: [["status", "open"]],
      orderBy: "created_at",
      limit: 5,
    }),
  ]);

  const mrr = subscriptions.reduce((sum, row) => sum + Number(row.monthly_amount_ugx ?? 0), 0);
  const since = new Date(fourteenDaysAgo).getTime();
  const recentTenantRows = recentTenants.filter((row) => row.created_at && new Date(row.created_at).getTime() >= since);
  const recentProfileRows = recentProfiles.filter((row) => row.created_at && new Date(row.created_at).getTime() >= since);
  const facilitySparkline = dailyCountsFromRows(recentTenantRows);
  const userSparkline = dailyCountsFromRows(recentProfileRows);
  const salesSparkline = dailyCountsFromRows(transactionRows);
  const salesPeriod = transactionRows.length;
  const salesRecent = transactionRows.filter(
    (row) => row.created_at && new Date(row.created_at) >= new Date(fourteenDaysAgo)
  ).length;

  const facilityDelta = percentDelta(sumWindow(facilitySparkline, 7, 14), sumWindow(facilitySparkline, 0, 7));
  const userDelta = percentDelta(sumWindow(userSparkline, 7, 14), sumWindow(userSparkline, 0, 7));
  const salesDelta = percentDelta(sumWindow(salesSparkline, 7, 14), sumWindow(salesSparkline, 0, 7));

  const onboardingInProgress = onboardingRows.filter((row) => {
    const step = row.current_step ?? 0;
    return step > 0 && step < 5;
  }).length;

  const activityFromAudit = auditRows.map((row) => ({
    id: row.id ?? crypto.randomUUID(),
    kind: "audit" as const,
    title: row.action ?? "System event",
    subtitle: row.entity_type ?? row.resource_type ?? "platform",
    href: "/platform/audit-log",
    createdAt: formatDateTime(row.created_at),
  }));

  const activityFromApplications = applications.slice(0, 4).map((row) => ({
    id: `app-${row.id}`,
    kind: "application" as const,
    title: `New application from ${row.organization ?? row.full_name ?? "Unknown facility"}`,
    subtitle: `${row.district ?? "Unknown district"} · ${row.status ?? "pending"}`,
    href: "/platform/applications",
    createdAt: formatDateTime(row.created_at),
  }));

  const activityFromLeads = professionalLeads.slice(0, 3).map((row) => ({
    id: `lead-${row.id}`,
    kind: "lead" as const,
    title: `Professional lead: ${row.full_name}`,
    subtitle: `${row.role} · ${row.location ?? "Unknown"}`,
    href: "/platform/applications",
    createdAt: formatDateTime(row.created_at),
  }));

  const activity = [...activityFromApplications, ...activityFromLeads, ...activityFromAudit]
    .slice(0, 12);

  const attentionItems = [
    pendingApplications > 0
      ? {
          id: "applications",
          label: "Pending applications",
          count: pendingApplications,
          href: "/platform/applications",
          detail: "Review and qualify new facility interest",
        }
      : null,
    pendingKyc > 0
      ? {
          id: "kyc",
          label: "Unverified professionals",
          count: pendingKyc,
          href: "/platform/approvals",
          detail: "Documents awaiting review",
        }
      : null,
    openTickets > 0
      ? {
          id: "tickets",
          label: "Open support tickets",
          count: openTickets,
          href: "/platform/support",
          detail: "Customer issues need response",
        }
      : null,
    onboardingInProgress > 0
      ? {
          id: "onboarding",
          label: "Pharmacies onboarding",
          count: onboardingInProgress,
          href: "/platform/pharmacy-network",
          detail: "Tenants mid-setup — nudge to complete",
        }
      : null,
  ].filter(Boolean) as OverviewCommandCenterData["attentionItems"];

  const topApplications = applications
    .filter((row) => (row.status ?? "pending") === "pending")
    .slice(0, 3)
    .map((row) => ({
      id: row.id ?? "",
      name: row.organization ?? row.full_name ?? "Unnamed",
      email: row.email ?? "",
      district: row.district ?? "—",
    }));

  return {
    metrics: [
      {
        label: "Active facilities",
        value: activeFacilities.toLocaleString(),
        href: "/platform/hospitals",
        sparkline: facilitySparkline,
        delta: facilityDelta,
        deltaLabel: "vs prior 7 days",
      },
      {
        label: "Total users",
        value: totalUsers.toLocaleString(),
        href: "/platform/users",
        sparkline: userSparkline,
        delta: userDelta,
        deltaLabel: "vs prior 7 days",
      },
      {
        label: "MRR (UGX)",
        value: formatUGX(mrr),
        href: "/platform/billing",
        sparkline: Array.from({ length: 14 }, (_, i) => Math.round((mrr / 14) * (i + 1))),
        delta: null,
        deltaLabel: `${subscriptions.length} active subscriptions`,
      },
      {
        label: "Sales volume",
        value: salesPeriod.toLocaleString(),
        href: "/platform/analytics",
        sparkline: salesSparkline,
        delta: salesDelta,
        deltaLabel: `${salesRecent} in last 14 days`,
      },
      {
        label: "Active sessions",
        value: liveSessions.toLocaleString(),
        href: "/platform/security",
        sparkline: Array.from({ length: 14 }, () => liveSessions),
        delta: null,
        deltaLabel: "Live synapse_sessions",
      },
    ],
    health: [
      {
        label: "Database",
        value: dbHealth.ok ? `${dbHealth.latencyMs}ms` : "Unreachable",
        status: dbHealth.ok ? (dbHealth.latencyMs < 500 ? "green" : "amber") : "red",
      },
      {
        label: "Auth",
        value: process.env.NEXT_PUBLIC_SUPABASE_URL ? "Operational" : "Missing config",
        status: process.env.NEXT_PUBLIC_SUPABASE_URL ? "green" : "red",
      },
      {
        label: "Email (Resend)",
        value: process.env.RESEND_API_KEY ? "Connected" : "Not configured",
        status: process.env.RESEND_API_KEY ? "green" : "amber",
      },
      {
        label: "Payments",
        value: process.env.FLUTTERWAVE_SECRET_KEY || process.env.STRIPE_SECRET_KEY ? "Configured" : "Pending",
        status: process.env.FLUTTERWAVE_SECRET_KEY || process.env.STRIPE_SECRET_KEY ? "green" : "amber",
      },
      {
        label: "Deploy",
        value: process.env.VERCEL ? "Vercel live" : "Local / unknown",
        status: process.env.VERCEL ? "green" : "amber",
      },
    ],
    activity,
    attentionItems,
    topApplications,
    openTickets: openTicketRows.map((row) => ({
      id: row.id ?? "",
      subject: row.subject ?? "Support ticket",
      createdAt: formatDateTime(row.created_at),
    })),
    ecosystemSummary: {
      pharmacyTenants: tenants.filter((t) => t.facility_type === "pharmacy" && t.status !== "deleted").length,
      hospitalTenants: tenants.filter((t) => t.facility_type !== "pharmacy" && t.status !== "deleted").length,
      districts: new Set(tenants.map((t) => t.district).filter(Boolean)).size,
    },
  };
}

export default async function PlatformOverviewPage() {
  await requirePlatformAdmin();
  const data = await getOverviewData();
  return <OverviewCommandCenter data={data} />;
}
