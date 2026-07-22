import Image from "next/image";

export type ReceiptViewModel = {
  receiptNo: string;
  kind: "payment" | "trial";
  facilityName: string;
  planName: string;
  amountLabel: string;
  customerName?: string | null;
  customerEmail?: string | null;
  periodLabel?: string | null;
  methodLabel?: string | null;
  issuedAtLabel: string;
  currency?: string;
};

export function PlatformReceiptDocument({ receipt }: { receipt: ReceiptViewModel }) {
  const isTrial = receipt.kind === "trial";

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
            className={`inline-block rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${
              isTrial
                ? "border-amber-300 bg-amber-50 text-amber-700"
                : "border-emerald-300 bg-emerald-50 text-emerald-700"
            }`}
          >
            {isTrial ? "Free trial" : "Paid"}
          </span>
          <p className="mt-3 font-mono text-sm font-semibold text-slate-800">{receipt.receiptNo}</p>
          <p className="mt-1 text-xs text-slate-500">Issued {receipt.issuedAtLabel}</p>
        </div>
      </header>

      <div className="px-8 py-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
          {isTrial ? "Trial registration receipt" : "Official payment receipt"}
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
          {isTrial
            ? "This confirms a successful free-trial registration on Synapse Pharm. No payment was charged."
            : "This confirms a successful subscription payment received by Synapse Health Technologies Ltd."}
        </p>

        <dl className="mt-8 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Facility</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-900">{receipt.facilityName}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Plan</dt>
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
                {isTrial ? "Trial period" : "Billing period"}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">{receipt.periodLabel}</dd>
            </div>
          ) : null}
          {receipt.methodLabel ? (
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Payment method</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">{receipt.methodLabel}</dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-8 flex items-end justify-between gap-4 border-t border-dashed border-slate-200 pt-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Amount</p>
            <p className="mt-1 font-display text-3xl font-bold tracking-tight text-[#F97316]">
              {receipt.amountLabel}
            </p>
          </div>
          <p className="max-w-[220px] text-right text-xs leading-relaxed text-slate-400">
            Synapse Health Technologies Ltd
            <br />
            Official receipt · Keep for your records
          </p>
        </div>
      </div>

      <footer className="border-t border-slate-100 bg-slate-50 px-8 py-4 text-xs text-slate-500">
        Questions? support@synapseos.tech · Ebrine&apos;s Residence; Katuuso Crescent; Buziga
      </footer>
    </article>
  );
}
