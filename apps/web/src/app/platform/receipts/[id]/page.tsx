export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { getSubscriptionInvoice } from "@synapse/auth/billing";
import { requirePlatformAdmin } from "../../../../lib/platform/auth";
import { formatDate, formatUGX } from "../../_lib/platform-data";
import { PlatformReceiptDocument } from "../../_components/ReceiptDocument";
import {
  DEFAULT_SIGNATURE_SRC,
  getDocumentSettings,
} from "../_lib/document-settings";
import { PrintReceiptButton } from "./print-button";

function kampalaLabel(iso: string | null | undefined) {
  if (!iso) return null;
  return formatDate(iso);
}

function resolveKind(invoiceNo: string, metadata: Record<string, unknown>) {
  const metaType = String(metadata?.type ?? "");
  const metaKind = String(metadata?.document_kind ?? "");
  if (invoiceNo.startsWith("TRIAL-") || metaType === "free_trial") return "trial" as const;
  if (invoiceNo.startsWith("RCT-") || metaType === "manual_receipt" || metaKind === "receipt") {
    return "receipt" as const;
  }
  if (metaType === "manual_invoice" || metaKind === "invoice") return "invoice" as const;
  return "payment" as const;
}

export default async function PlatformReceiptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePlatformAdmin();
  const { id } = await params;
  const [invoice, settings] = await Promise.all([
    getSubscriptionInvoice(id),
    getDocumentSettings(),
  ]);
  if (!invoice) notFound();

  const kind = resolveKind(invoice.invoice_no, invoice.metadata);
  const facilityName =
    invoice.tenant_name ??
    (invoice.metadata?.facility_name as string | undefined) ??
    "Unknown facility";
  const planName =
    invoice.plan_name ??
    (invoice.metadata?.plan_name as string | undefined) ??
    (invoice.metadata?.description as string | undefined) ??
    (kind === "invoice" ? "Invoice" : "Subscription");
  const periodLabel =
    invoice.period_start && invoice.period_end
      ? `${kampalaLabel(invoice.period_start)} – ${kampalaLabel(invoice.period_end)}`
      : null;

  const issuedAtLabel = kampalaLabel(invoice.issued_at) ?? "—";
  const metaSig = invoice.metadata?.signature_data_url as string | undefined;
  const signatureSrc = metaSig || settings.signatureSrc || DEFAULT_SIGNATURE_SRC;
  const signerName = (invoice.metadata?.signer_name as string | undefined) ?? settings.signerName;
  const signerTitle = (invoice.metadata?.signer_title as string | undefined) ?? settings.signerTitle;

  const methodLabel =
    kind === "trial"
      ? "Free trial registration"
      : kind === "invoice"
        ? "Pay by MTN MoMo, Airtel Money, bank transfer, or card"
        : ((invoice.metadata?.method as string | undefined) ?? "Flutterwave / Mobile money");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <Link href="/platform/receipts" className="text-xs font-semibold text-slate-400 hover:text-slate-200">
            ← All documents
          </Link>
          <h1 className="mt-2 font-display text-2xl font-bold">
            {kind === "invoice" ? "Invoice" : "Receipt"} {invoice.invoice_no}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Printable official document — signed by {signerName}, {signerTitle}.
          </p>
        </div>
        <PrintReceiptButton />
      </div>

      <PlatformReceiptDocument
        receipt={{
          receiptNo: invoice.invoice_no,
          kind,
          facilityName,
          planName,
          amountLabel:
            kind === "trial" ? "UGX 0 (free trial)" : formatUGX(Number(invoice.amount_ugx ?? 0)),
          customerName: (invoice.metadata?.customer_name as string | undefined) ?? null,
          customerEmail: (invoice.metadata?.customer_email as string | undefined) ?? null,
          periodLabel,
          methodLabel,
          notes: (invoice.metadata?.notes as string | undefined) ?? null,
          issuedAtLabel,
          dueDateLabel: invoice.metadata?.due_date
            ? formatDate(String(invoice.metadata.due_date))
            : kampalaLabel(invoice.period_end),
          signatureSrc,
          signerName,
          signerTitle,
          signedAtLabel: issuedAtLabel,
        }}
      />
    </div>
  );
}
