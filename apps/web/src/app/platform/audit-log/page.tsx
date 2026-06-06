export const dynamic = "force-dynamic";

import { requirePlatformAdmin } from "../../../lib/platform/auth";
import { createServiceClient } from "../../../lib/supabase/server";

export default async function PlatformAuditLogPage() {
  await requirePlatformAdmin();
  const supabaseAdmin = createServiceClient();
  const { data: logs } = await (supabaseAdmin as any)
    .from("audit_log")
    .select("id, action, entity_type, actor_id, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <main className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="text-sm text-slate-400">Unified activity stream across all tenants.</p>
      </div>
      <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
        {(logs ?? []).map((log: any) => (
          <article key={log.id} className="rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-sm">
            <p className="font-medium text-slate-100">{log.action}</p>
            <p className="text-xs text-slate-400">{log.entity_type} · {log.actor_id?.slice(0, 8) ?? "system"}</p>
            <p className="text-xs text-slate-500">{new Date(log.created_at).toLocaleString()}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
