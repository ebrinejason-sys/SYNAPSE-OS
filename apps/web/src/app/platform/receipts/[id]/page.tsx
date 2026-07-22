export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { getSubscriptionInvoice } from "@synapse/auth/billing";
import { requirePlatformAdmin } from "../../../../lib/platform/auth";
import { formatDate, formatUGX } from "../../_lib/platform-data";
import { PlatformReceiptDocument } from "../../_components/ReceiptDocument";
import { PrintReceiptButton } from "./print-button";

function kampalaLabel(iso: string | null | undefined) {
  if (!iso) return null;
  return formatDate(iso);
}

export default async function PlatformReceiptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePlatformAdmin();
  const { id } = await params;
  const invoice = await getSubscriptionInvoice(id);
  if (!invoice) notFound();

  const isTrial =
    invoice.invoice_no.startsWith("TRIAL-") || invoice.metadata?.type === "free_trial";
  const facilityName =
    invoice.tenant_name ??
    (invoice.metadata?.facility_name as string | undefined) ??
    "Unknown facility";
  const planName =
    invoice.plan_name ?? (invoice.metadata?.plan_name as string | undefined) ?? "Subscription";
  const periodLabel =
    invoice.period_start && invoice.period_end
      ? `${kampalaLabel(invoice.period_start)} – ${kampalaLabel(invoice.period_end)}`
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <Link href="/platform/receipts" className="text-xs font-semibold text-slate-400 hover:text-slate-200">
            ← All receipts
          </Link>
          <h1 className="mt-2 font-display text-2xl font-bold">Receipt {invoice.invoice_no}</h1>
          <p className="mt-1 text-sm text-slate-400">Printable official receipt with Synapse branding.</p>
        </div>
        <PrintReceiptButton />
      </div>

      <PlatformReceiptDocument
        receipt={{
          receiptNo: invoice.invoice_no,
          kind: isTrial ? "trial" : "payment",
          facilityName,
          planName,
          amountLabel: isTrial ? "UGX 0 (free trial)" : formatUGX(Number(invoice.amount_ugx ?? 0)),
          customerName: (invoice.metadata?.customer_name as string | undefined) ?? null,
          customerEmail: (invoice.metadata?.customer_email as string | undefined) ?? null,
          periodLabel,
          methodLabel: isTrial ? "Free trial registration" : "Flutterwave / Mobile money",
          issuedAtLabel: kampalaLabel(invoice.issued_at) ?? "—",
        }}
      />
    </div>
  );
}
