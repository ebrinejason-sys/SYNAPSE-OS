export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "../../../../lib/platform/auth";
import { formatDate } from "../../_lib/platform-data";
import { PlatformReceiptDocument } from "../../_components/ReceiptDocument";
import {
  DEFAULT_SIGNATURE_SRC,
  getDocumentSettings,
} from "../_lib/document-settings";
import { formatMoneyUGX, getPlatformBillingDocument } from "../_lib/documents";
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
  const [doc, settings] = await Promise.all([
    getPlatformBillingDocument(id),
    getDocumentSettings(),
  ]);
  if (!doc) notFound();

  const kind = doc.kind;
  const issuedAtLabel = kampalaLabel(doc.issued_at) ?? "—";
  const metaSig = doc.metadata?.signature_data_url as string | undefined;
  const signatureSrc = metaSig || settings.signatureSrc || DEFAULT_SIGNATURE_SRC;
  const signerName = (doc.metadata?.signer_name as string | undefined) ?? settings.signerName;
  const signerTitle = (doc.metadata?.signer_title as string | undefined) ?? settings.signerTitle;

  const periodLabel =
    doc.period_start && doc.period_end
      ? `${kampalaLabel(doc.period_start)} – ${kampalaLabel(doc.period_end)}`
      : null;

  const methodLabel =
    kind === "trial"
      ? "Free trial registration"
      : kind === "invoice"
        ? "Pay by MTN MoMo, Airtel Money, bank transfer, or card"
        : doc.method ?? "Flutterwave / Mobile money";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <Link href="/platform/receipts" className="text-xs font-semibold text-slate-400 hover:text-slate-200">
            ← All documents
          </Link>
          <h1 className="mt-2 font-display text-2xl font-bold">
            {kind === "invoice" ? "Invoice" : "Receipt"} {doc.document_no}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Printable official document — signed by {signerName}, {signerTitle}.
          </p>
        </div>
        <PrintReceiptButton />
      </div>

      <PlatformReceiptDocument
        receipt={{
          receiptNo: doc.document_no,
          kind,
          facilityName: doc.facility_name,
          planName: doc.description ?? (kind === "invoice" ? "Invoice" : "Receipt"),
          amountLabel:
            kind === "trial" ? "UGX 0 (free trial)" : formatMoneyUGX(Number(doc.amount_ugx ?? 0)),
          customerName: doc.customer_name,
          customerEmail: doc.customer_email,
          periodLabel,
          methodLabel,
          notes: doc.notes,
          issuedAtLabel,
          dueDateLabel: doc.due_date ? formatDate(doc.due_date) : kampalaLabel(doc.period_end),
          signatureSrc,
          signerName,
          signerTitle,
          signedAtLabel: issuedAtLabel,
        }}
      />
    </div>
  );
}
