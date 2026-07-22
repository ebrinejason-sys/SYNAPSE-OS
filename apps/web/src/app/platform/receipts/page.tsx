export const dynamic = "force-dynamic";

import Link from "next/link";
import { requirePlatformAdmin } from "../../../lib/platform/auth";
import { formatDateTime, formatUGX } from "../_lib/platform-data";
import { listSubscriptionInvoices } from "@synapse/auth/billing";

function kindOf(invoiceNo: string, metadata: Record<string, unknown>) {
  if (invoiceNo.startsWith("TRIAL-") || metadata?.type === "free_trial") return "trial";
  return "payment";
}

function kindClass(kind: string) {
  if (kind === "trial") return "border-amber-500/25 bg-amber-500/10 text-amber-300";
  return "border-green-500/25 bg-green-500/10 text-green-300";
}

export default async function PlatformReceiptsPage() {
  await requirePlatformAdmin();
  const invoices = await listSubscriptionInvoices(250);

  const paid = invoices.filter((row) => kindOf(row.invoice_no, row.metadata) === "payment");
  const trials = invoices.filter((row) => kindOf(row.invoice_no, row.metadata) === "trial");
  const collected = paid.reduce((sum, row) => sum + Number(row.amount_ugx ?? 0), 0);

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#E8B84B]">Money</p>
        <h1 className="mt-2 font-display text-2xl font-bold">Receipts</h1>
        <p className="mt-1 text-sm text-slate-400">
          Official Synapse receipts for completed subscription payments and free-trial registrations.
          Paid sales auto-issue after Flutterwave confirmation; trials auto-issue on successful registration.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ["All receipts", invoices.length.toLocaleString()],
          ["Paid collected", formatUGX(collected)],
          ["Trial receipts", trials.length.toLocaleString()],
        ].map(([label, value]) => (
          <article key={label} className="rounded-xl border border-slate-800 bg-[#111117] p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-2 text-xl font-bold text-[#F97316]">{value}</p>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-800 bg-[#111117]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-4">
          <div>
            <h2 className="text-sm font-semibold">Ledger</h2>
            <p className="mt-1 text-xs text-slate-500">
              Open any row for a printable receipt with the company logo.
            </p>
          </div>
          <Link
            href="/platform/billing"
            className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-slate-500"
          >
            Revenue & Billing
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[#07070A] text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Receipt</th>
                <th className="px-4 py-3">Facility</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Issued</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {invoices.map((invoice) => {
                const kind = kindOf(invoice.invoice_no, invoice.metadata);
                const facility =
                  invoice.tenant_name ??
                  (invoice.metadata?.facility_name as string | undefined) ??
                  "Unknown facility";
                const plan =
                  invoice.plan_name ??
                  (invoice.metadata?.plan_name as string | undefined) ??
                  "—";
                return (
                  <tr key={invoice.id}>
                    <td className="px-4 py-3 font-mono text-xs text-slate-200">{invoice.invoice_no}</td>
                    <td className="px-4 py-3 font-medium text-slate-100">{facility}</td>
                    <td className="px-4 py-3 text-slate-300">{plan}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {kind === "trial" ? "UGX 0" : formatUGX(Number(invoice.amount_ugx ?? 0))}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDateTime(invoice.issued_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-xs ${kindClass(kind)}`}>
                        {kind === "trial" ? "Free trial" : "Payment"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/platform/receipts/${invoice.id}`}
                        className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-[#E8B84B] hover:border-[#E8B84B]/40"
                      >
                        View receipt
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    No receipts yet. They appear automatically after paid subscriptions or free-trial
                    registrations.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
