import Image from "next/image";
import {
  DEFAULT_SIGNATURE_SRC,
  DEFAULT_SIGNER_NAME,
  DEFAULT_SIGNER_TITLE,
} from "../receipts/_lib/document-settings";

export type ReceiptViewModel = {
  receiptNo: string;
  kind: "payment" | "trial" | "receipt" | "invoice";
  facilityName: string;
  planName: string;
  amountLabel: string;
  customerName?: string | null;
  customerEmail?: string | null;
  periodLabel?: string | null;
  methodLabel?: string | null;
  notes?: string | null;
  issuedAtLabel: string;
  dueDateLabel?: string | null;
  currency?: string;
  /** data URL or public path for the authorized signature image */
  signatureSrc?: string | null;
  signerName?: string | null;
  signerTitle?: string | null;
  /** ISO or display date under the signature (defaults to issuedAtLabel) */
  signedAtLabel?: string | null;
};

function badgeFor(kind: ReceiptViewModel["kind"]) {
  if (kind === "trial") {
    return { label: "Free trial", className: "border-amber-300 bg-amber-50 text-amber-700" };
  }
  if (kind === "invoice") {
    return { label: "Invoice", className: "border-sky-300 bg-sky-50 text-sky-700" };
  }
  if (kind === "receipt") {
    return { label: "Receipt", className: "border-emerald-300 bg-emerald-50 text-emerald-700" };
  }
  return { label: "Paid", className: "border-emerald-300 bg-emerald-50 text-emerald-700" };
}

function titleFor(kind: ReceiptViewModel["kind"]) {
  if (kind === "trial") return "Trial registration receipt";
  if (kind === "invoice") return "Tax invoice";
  if (kind === "receipt") return "Official payment receipt";
  return "Official payment receipt";
}

function blurbFor(kind: ReceiptViewModel["kind"]) {
  if (kind === "trial") {
    return "This confirms a successful free-trial registration on Synapse Pharm. No payment was charged.";
  }
  if (kind === "invoice") {
    return "This invoice is issued by Synapse Health Technologies Ltd. Kindly settle the amount due by the stated date.";
  }
  if (kind === "receipt") {
    return "This confirms that payment was received in full by Synapse Health Technologies Ltd.";
  }
  return "This confirms a successful subscription payment received by Synapse Health Technologies Ltd.";
}

export function PlatformReceiptDocument({ receipt }: { receipt: ReceiptViewModel }) {
  const badge = badgeFor(receipt.kind);
  const isInvoice = receipt.kind === "invoice";
  const signatureSrc = receipt.signatureSrc || DEFAULT_SIGNATURE_SRC;
  const signerName = receipt.signerName || DEFAULT_SIGNER_NAME;
  const signerTitle = receipt.signerTitle || DEFAULT_SIGNER_TITLE;
  const signedAt = receipt.signedAtLabel || receipt.issuedAtLabel;
  const isDataUrl = signatureSrc.startsWith("data:");

  return (
    <article
      className="mx-auto w-full max-w-[720px] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-xl print:max-w-none print:rounded-none print:border-0 print:shadow-none"
      id="synapse-receipt"
    >
      <div className="h-1.5 bg-gradient-to-r from-[#F97316] to-[#E8B84B]" />

      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-8 py-7">
        <div className="flex items-center gap-3">
          <Image
            src="/assets/logos/synapse-logo.png"
            alt="Synapse OS"
            width={56}
            height={56}
            className="h-14 w-14 rounded-xl object-contain"
            priority
          />
          <div>
            <p className="font-display text-xl font-bold tracking-tight">
              <span className="text-[#F97316]">Synapse</span>
              <span className="text-[#C9960A]">OS</span>
            </p>
            <p className="text-xs text-slate-500">Synapse Health Technologies Ltd</p>
            <p className="text-xs text-slate-400">Kampala, Uganda · synapseos.tech</p>
          </div>
        </div>
        <div className="text-right">
          <span
            className={`inline-block rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${badge.className}`}
          >
            {badge.label}
          </span>
          <p className="mt-3 font-mono text-sm font-semibold text-slate-800">{receipt.receiptNo}</p>
          <p className="mt-1 text-xs text-slate-500">Issued {receipt.issuedAtLabel}</p>
          {isInvoice && receipt.dueDateLabel ? (
            <p className="mt-1 text-xs font-medium text-slate-600">Due {receipt.dueDateLabel}</p>
          ) : null}
        </div>
      </header>

      <div className="px-8 py-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
          {titleFor(receipt.kind)}
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">{blurbFor(receipt.kind)}</p>

        <dl className="mt-8 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Facility</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-900">{receipt.facilityName}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {isInvoice ? "Description" : "Plan / service"}
            </dt>
            <dd className="mt-1 text-sm font-semibold text-slate-900">{receipt.planName}</dd>
          </div>
          {receipt.customerName ? (
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Customer</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">{receipt.customerName}</dd>
            </div>
          ) : null}
          {receipt.customerEmail ? (
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Email</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">{receipt.customerEmail}</dd>
            </div>
          ) : null}
          {receipt.periodLabel ? (
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {receipt.kind === "trial" ? "Trial period" : isInvoice ? "Billing window" : "Billing period"}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">{receipt.periodLabel}</dd>
            </div>
          ) : null}
          {receipt.methodLabel ? (
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {isInvoice ? "Terms" : "Payment method"}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">{receipt.methodLabel}</dd>
            </div>
          ) : null}
        </dl>

        {receipt.notes ? (
          <p className="mt-5 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {receipt.notes}
          </p>
        ) : null}

        <div className="mt-10 grid gap-8 border-t border-slate-200 pt-8 sm:grid-cols-2 sm:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {isInvoice ? "Amount due" : "Amount received"}
            </p>
            <p className="mt-1 font-display text-3xl font-bold tracking-tight text-[#F97316]">
              {receipt.amountLabel}
            </p>
            <p className="mt-3 max-w-[240px] text-xs leading-relaxed text-slate-400">
              Synapse Health Technologies Ltd
              <br />
              Official {isInvoice ? "invoice" : "receipt"} · Keep for your records
            </p>
          </div>

          <div className="sm:justify-self-end sm:text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Authorized signature
            </p>
            <div className="mt-2 inline-flex min-h-[72px] min-w-[200px] items-end justify-center border-b border-slate-300 px-2 pb-1 sm:ml-auto">
              {isDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={signatureSrc}
                  alt="Authorized signature of Ebrine Tushabe"
                  className="h-14 w-auto max-w-[220px] object-contain"
                />
              ) : (
                <Image
                  src={signatureSrc}
                  alt="Authorized signature of Ebrine Tushabe"
                  width={220}
                  height={56}
                  className="h-14 w-auto max-w-[220px] object-contain"
                  unoptimized
                />
              )}
            </div>
            <p className="mt-3 text-sm font-bold text-slate-900">{signerName}</p>
            <p className="text-xs font-medium text-slate-600">{signerTitle}</p>
            <p className="mt-2 font-mono text-[11px] text-slate-500">Date: {signedAt}</p>
          </div>
        </div>
      </div>

      <footer className="border-t border-slate-100 bg-slate-50 px-8 py-4 text-xs text-slate-500">
        Synapse Health Technologies Ltd · support@synapseos.tech · Ebrine&apos;s Residence; Katuuso Crescent;
        Buziga
      </footer>
    </article>
  );
}
