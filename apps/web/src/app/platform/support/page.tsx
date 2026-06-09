export const dynamic = "force-dynamic";

import { requirePlatformAdmin } from "../../../lib/platform/auth";
import { formatDateTime, safeRows } from "../_lib/platform-data";

type TicketRow = {
  id?: string;
  title?: string | null;
  description?: string | null;
  priority?: string | null;
  status?: string | null;
  tenant_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const columns = [
  { key: "open", label: "Open" },
  { key: "in_progress", label: "In Progress" },
  { key: "resolved", label: "Resolved" },
  { key: "closed", label: "Closed" },
];

function priorityClass(priority: string | null | undefined) {
  if (priority === "critical") return "border-red-500/25 bg-red-500/10 text-red-300";
  if (priority === "high") return "border-[#F97316]/25 bg-[#F97316]/10 text-[#F97316]";
  if (priority === "low") return "border-slate-700 bg-slate-800 text-slate-300";
  return "border-[#E8B84B]/25 bg-[#E8B84B]/10 text-[#E8B84B]";
}

export default async function PlatformSupportPage() {
  await requirePlatformAdmin();
  const tickets = await safeRows<TicketRow>(
    "support_tickets",
    "id, title, description, priority, status, tenant_id, created_at, updated_at",
    { orderBy: "created_at", limit: 200 }
  );

  const activeTickets = tickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status ?? ""));
  const highRisk = tickets.filter((ticket) => ["high", "critical"].includes(ticket.priority ?? "")).length;

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#E8B84B]">Tenant Support</p>
          <h1 className="mt-2 text-2xl font-bold">Support Tickets</h1>
          <p className="mt-1 text-sm text-slate-400">Track facility support, priorities, assignments, internal notes, and SLA risk.</p>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ["Open workload", activeTickets.length],
          ["High/Critical", highRisk],
          ["Total tickets", tickets.length],
        ].map(([label, value]) => (
          <article key={String(label)} className="rounded-xl border border-slate-800 bg-[#111117] p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-[#F97316]">{Number(value).toLocaleString()}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
        {columns.map((column) => {
          const columnTickets = tickets.filter((ticket) => (ticket.status ?? "open") === column.key);
          return (
            <div key={column.key} className="rounded-xl border border-slate-800 bg-[#111117]">
              <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
                <h2 className="text-sm font-semibold">{column.label}</h2>
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">{columnTickets.length}</span>
              </div>
              <div className="space-y-3 p-3">
                {columnTickets.length === 0 ? <p className="rounded-lg border border-slate-800 bg-[#07070A] p-4 text-sm text-slate-500">No tickets.</p> : null}
                {columnTickets.map((ticket) => (
                  <article key={ticket.id ?? ticket.title ?? crypto.randomUUID()} className="rounded-lg border border-slate-800 bg-[#07070A] p-3">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-100">{ticket.title ?? "Untitled ticket"}</h3>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase ${priorityClass(ticket.priority)}`}>
                        {ticket.priority ?? "medium"}
                      </span>
                    </div>
                    <p className="line-clamp-3 text-xs text-slate-500">{ticket.description ?? "No description supplied."}</p>
                    <p className="mt-3 text-[11px] text-slate-600">Opened {formatDateTime(ticket.created_at)}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300">Assign</button>
                      <button type="button" className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300">Reply</button>
                      <button type="button" className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300">Close</button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
