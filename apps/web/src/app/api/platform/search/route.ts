import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

type Result = {
  title: string;
  subtitle: string;
  href: string;
  type: string;
};

async function isPlatformAdmin(userId: string) {
  const supabaseAdmin = createServiceClient();
  const { data } = await (supabaseAdmin as any)
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return data?.role === "platform_admin";
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const user = await getCurrentUser();

  if (!user || !(await isPlatformAdmin(user.id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = createServiceClient();
  const results: Result[] = [];

  const [hospitals, users, tickets, audit] = await Promise.allSettled([
    (supabaseAdmin as any)
      .from("hospitals")
      .select("id, name, subdomain, contact_email")
      .or(`name.ilike.%${q}%,contact_email.ilike.%${q}%,subdomain.ilike.%${q}%`)
      .limit(6),
    (supabaseAdmin as any)
      .from("profiles")
      .select("id, full_name, email, role")
      .or(`full_name.ilike.%${q}%,email.ilike.%${q}%,role.ilike.%${q}%`)
      .limit(6),
    (supabaseAdmin as any)
      .from("support_tickets")
      .select("id, title, priority, status")
      .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
      .limit(6),
    (supabaseAdmin as any)
      .from("audit_log")
      .select("id, action, entity_type, actor_id")
      .or(`action.ilike.%${q}%,entity_type.ilike.%${q}%`)
      .limit(6),
  ]);

  if (hospitals.status === "fulfilled" && !hospitals.value.error) {
    for (const row of hospitals.value.data ?? []) {
      results.push({
        title: row.name ?? "Unnamed facility",
        subtitle: row.subdomain ? `${row.subdomain}.synapseos.tech` : row.contact_email ?? "Facility",
        href: `/platform/hospitals/${row.id}`,
        type: "Facility",
      });
    }
  }

  if (users.status === "fulfilled" && !users.value.error) {
    for (const row of users.value.data ?? []) {
      results.push({
        title: row.full_name ?? row.email ?? "Unnamed user",
        subtitle: `${row.role ?? "user"} · ${row.email ?? "no email"}`,
        href: `/platform/users?user=${row.id}`,
        type: "User",
      });
    }
  }

  if (tickets.status === "fulfilled" && !tickets.value.error) {
    for (const row of tickets.value.data ?? []) {
      results.push({
        title: row.title ?? "Support ticket",
        subtitle: `${row.priority ?? "medium"} · ${row.status ?? "open"}`,
        href: `/platform/support?ticket=${row.id}`,
        type: "Ticket",
      });
    }
  }

  if (audit.status === "fulfilled" && !audit.value.error) {
    for (const row of audit.value.data ?? []) {
      results.push({
        title: row.action ?? "Audit event",
        subtitle: `${row.entity_type ?? "platform"} · ${row.actor_id?.slice(0, 8) ?? "system"}`,
        href: `/platform/audit-log?event=${row.id}`,
        type: "Audit",
      });
    }
  }

  return NextResponse.json({ results: results.slice(0, 20) });
}
