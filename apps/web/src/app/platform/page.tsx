export const dynamic = "force-dynamic";

import Link from "next/link";
import { requirePlatformAdmin } from "../../lib/platform/auth";
import {
  checkDatabaseLatency,
  dailyCountsFromRows,
  formatDateTime,
  formatUGX,
  lastNDays,
  loadSubscriptionData,
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
type AuditRow = {
  id?: string;
  action?: string | null;
  table_name?: string | null;
  record_id?: string | null;
  user_id?: string | null;
  user_role?: string | null;
  tenant_id?: string | null;
  created_at?: string | null;
  new_value?: Record<string, unknown> | null;
};
type ApplicationRow = {
  id?: string;
  hospital_name?: string | null;
  facility_type?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  location?: string | null;
  status?: string | null;
  created_at?: string | null;
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
    subData,
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
    safeCount("hospital_leads", [["status", "new"]]),
    safeRows<TenantRow>("tenants", "id, created_at, status, facility_type, district", { orderBy: "created_at", limit: 500 }),
    safeRows<TenantRow>("tenants", "id, created_at", { orderBy: "created_at", limit: 500 }),
    safeRows<ProfileRow>("profiles", "id, created_at", { orderBy: "created_at", limit: 500 }),
    safeRows<{ created_at?: string | null; total_amount?: number | string | null }>(
      "pharmacy_pos_sales",
      "created_at, total_amount",
      { orderBy: "created_at", limit: 500 }
    ),
    loadSubscriptionData(),
    safeRows<AuditRow>(
      "audit_log",
      "id, action, table_name, record_id, user_id, user_role, tenant_id, created_at, new_value",
      { orderBy: "created_at", limit: 20 }
    ),
    safeRows<ApplicationRow>(
      "hospital_leads",
      "id, hospital_name, facility_type, contact_name, contact_email, location, status, created_at",
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

  const mrr = subData.mrr;
  const activeSubCount = subData.counts.active ?? 0;
  const pastDueCount = subData.counts.past_due ?? 0;
  const suspendedCount = (subData.counts.suspended ?? 0) + (subData.counts.cancelled ?? 0) + (subData.counts.canceled ?? 0);
  const trialCount = (subData.counts.trial ?? 0) + (subData.counts.trialing ?? 0);
  const since = new Date(fourteenDaysAgo).getTime();
  const recentTenantRows = recentTenants.filter((row) => row.created_at && new Date(row.created_at).getTime() >= since);
  const recentProfileRows = recentProfiles.filter((row) => row.created_at && new Date(row.created_at).getTime() >= since);
  const facilitySparkline = dailyCountsFromRows(recentTenantRows);
  const userSparkline = dailyCountsFromRows(recentProfileRows);
  const salesSparkline = dailyCountsFromRows(transactionRows);
  const salesPeriod = transactionRows.length;
  const salesRecentRows = transactionRows.filter(
    (row) => row.created_at && new Date(row.created_at) >= new Date(fourteenDaysAgo)
  );
  const salesRecent = salesRecentRows.length;
  const salesRecentUGX = salesRecentRows.reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0);

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
    subtitle: row.table_name ?? "platform",
    href: "/platform/audit-log",
    createdAt: formatDateTime(row.created_at),
  }));

  const activityFromApplications = applications.slice(0, 4).map((row) => ({
    id: `app-${row.id}`,
    kind: "application" as const,
    title: `New ${row.facility_type === "pharmacy" ? "pharmacy" : "hospital"} application from ${row.hospital_name ?? row.contact_name ?? "Unknown facility"}`,
    subtitle: `${row.location ?? "Unknown district"} · ${row.status ?? "new"}`,
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
    pastDueCount > 0
      ? {
          id: "past_due",
          label: "Past-due subscriptions",
          count: pastDueCount,
          href: "/platform/billing",
          detail: "Within grace — collect payment before suspension",
        }
      : null,
    suspendedCount > 0
      ? {
          id: "suspended",
          label: "Suspended subscriptions",
          count: suspendedCount,
          href: "/platform/billing",
          detail: "Tenants locked out — reactivate after payment",
        }
      : null,
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
    .filter((row) => (row.status ?? "new") === "new")
    .slice(0, 3)
    .map((row) => ({
      id: row.id ?? "",
      name: row.hospital_name ?? row.contact_name ?? "Unnamed",
      email: row.contact_email ?? "",
      district: row.location ?? "—",
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
        deltaLabel: `${activeSubCount} active · ${trialCount} trial`,
      },
      {
        label: "POS sales",
        value: salesPeriod.toLocaleString(),
        href: "/platform/analytics",
        sparkline: salesSparkline,
        delta: salesDelta,
        deltaLabel: `${salesRecent} in last 14 days · ${formatUGX(salesRecentUGX)}`,
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
