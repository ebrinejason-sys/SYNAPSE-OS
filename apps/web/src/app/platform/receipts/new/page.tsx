export const dynamic = "force-dynamic";

import Link from "next/link";
import { requirePlatformAdmin } from "../../../../lib/platform/auth";
import { safeRows } from "../../_lib/platform-data";
import { createManualDocument } from "../actions";
import { getDocumentSettings } from "../_lib/document-settings";

type TenantOption = { id?: string; name?: string | null };

const ERRORS: Record<string, string> = {
  facility: "Facility / customer organization is required.",
  customer: "Customer name is required.",
  amount: "Enter a valid amount in UGX.",
  save: "Could not save the document. Try again.",
};

export default async function CreateDocumentPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; error?: string }>;
}) {
  await requirePlatformAdmin();
  const params = await searchParams;
  const kind = params.kind === "invoice" ? "invoice" : "receipt";
  const error = params.error ? ERRORS[params.error] ?? "Something went wrong." : null;
  const [tenants, settings] = await Promise.all([
    safeRows<TenantOption>("tenants", "id, name", { orderBy: "name", ascending: true, limit: 2000 }),
    getDocumentSettings(),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/platform/receipts" className="text-xs font-semibold text-slate-400 hover:text-slate-200">
          ← Receipts
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold">
          {kind === "invoice" ? "Create invoice" : "Create receipt"}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {kind === "invoice"
            ? "Issue a bill for an amount due. The authorized signature on file will be stamped on the document."
            : "Record a payment received (online or offline). The authorized signature on file will be stamped on the receipt."}
        </p>
      </div>

      <div className="flex gap-2 print:hidden">
        <Link
          href="/platform/receipts/new?kind=receipt"
          className={`rounded-xl px-3 py-2 text-xs font-semibold ${
            kind === "receipt"
              ? "border border-[#F97316]/40 bg-[#F97316]/10 text-[#F97316]"
              : "border border-slate-700 text-slate-400"
          }`}
        >
          Receipt
        </Link>
        <Link
          href="/platform/receipts/new?kind=invoice"
          className={`rounded-xl px-3 py-2 text-xs font-semibold ${
            kind === "invoice"
              ? "border border-[#F97316]/40 bg-[#F97316]/10 text-[#F97316]"
              : "border border-slate-700 text-slate-400"
          }`}
        >
          Invoice
        </Link>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {!settings.signatureSrc ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          No authorized signature available.{" "}
          <Link href="/platform/receipts#signature" className="underline">
            Upload signature
          </Link>
        </p>
      ) : (
        <p className="rounded-xl border border-slate-700 bg-[#111117] px-4 py-3 text-sm text-slate-400">
          Will be signed by <span className="text-slate-200">{settings.signerName}</span>
          {" — "}
          <span className="text-slate-200">{settings.signerTitle}</span>
          . Date under the signature is set automatically on issue.
        </p>
      )}

      <form action={createManualDocument} className="space-y-4 rounded-xl border border-slate-800 bg-[#111117] p-5">
        <input type="hidden" name="kind" value={kind} />

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Link facility (optional)
          </span>
          <select
            name="tenant_id"
            className="w-full rounded-xl border border-slate-700 bg-[#07070A] px-3 py-2.5 text-sm text-slate-200"
            defaultValue=""
          >
            <option value="">External / not linked</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name ?? tenant.id}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Facility / organization *
          </span>
          <input
            name="facility_name"
            required
            placeholder="e.g. Kampala Care Pharmacy"
            className="w-full rounded-xl border border-slate-700 bg-[#07070A] px-3 py-2.5 text-sm text-slate-200"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Customer name *</span>
            <input
              name="customer_name"
              required
              placeholder="Full name"
              className="w-full rounded-xl border border-slate-700 bg-[#07070A] px-3 py-2.5 text-sm text-slate-200"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Customer email</span>
            <input
              name="customer_email"
              type="email"
              placeholder="billing@example.com"
              className="w-full rounded-xl border border-slate-700 bg-[#07070A] px-3 py-2.5 text-sm text-slate-200"
            />
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {kind === "invoice" ? "Description / line item" : "Plan / service"}
          </span>
          <input
            name="description"
            placeholder={kind === "invoice" ? "Synapse Pharm — Professional quarterly" : "Subscription renewal"}
            className="w-full rounded-xl border border-slate-700 bg-[#07070A] px-3 py-2.5 text-sm text-slate-200"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Amount (UGX) *</span>
            <input
              name="amount_ugx"
              type="number"
              min={kind === "receipt" ? 1 : 0}
              step={1000}
              required
              placeholder="150000"
              className="w-full rounded-xl border border-slate-700 bg-[#07070A] px-3 py-2.5 text-sm text-slate-200"
            />
          </label>
          {kind === "invoice" ? (
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Due date</span>
              <input
                name="due_date"
                type="date"
                className="w-full rounded-xl border border-slate-700 bg-[#07070A] px-3 py-2.5 text-sm text-slate-200"
              />
            </label>
          ) : (
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment method</span>
              <select
                name="method"
                defaultValue="Manual / offline"
                className="w-full rounded-xl border border-slate-700 bg-[#07070A] px-3 py-2.5 text-sm text-slate-200"
              >
                <option>Manual / offline</option>
                <option>MTN MoMo</option>
                <option>Airtel Money</option>
                <option>Bank transfer</option>
                <option>Cash</option>
                <option>Card</option>
                <option>Flutterwave</option>
              </select>
            </label>
          )}
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</span>
          <textarea
            name="notes"
            rows={3}
            placeholder="Optional note printed on the document"
            className="w-full rounded-xl border border-slate-700 bg-[#07070A] px-3 py-2.5 text-sm text-slate-200"
          />
        </label>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            className="rounded-xl bg-gradient-to-r from-[#F97316] to-[#E8B84B] px-5 py-2.5 text-sm font-bold text-[#07070A]"
          >
            {kind === "invoice" ? "Issue invoice" : "Issue receipt"}
          </button>
          <Link
            href="/platform/receipts"
            className="rounded-xl border border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-300"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
