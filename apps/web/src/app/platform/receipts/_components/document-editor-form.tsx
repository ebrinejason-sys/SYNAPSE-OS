"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { PlatformReceiptDocument } from "../../_components/ReceiptDocument";
import { createManualDocument, updateManualDocument } from "../actions";
import { amountInWordsUGX, formatMoneyUGX, parseAmountUgx } from "../_lib/money";

export type TenantOption = { id: string; name: string };

type DocKind = "receipt" | "invoice" | "payment" | "trial";

export type DocumentFormInitial = {
  id?: string;
  source?: "platform" | "subscription";
  documentNo?: string;
  kind: DocKind;
  tenantId?: string | null;
  facilityName?: string;
  customerName?: string;
  customerEmail?: string | null;
  description?: string | null;
  amountUgx?: number;
  dueDate?: string | null;
  method?: string | null;
  paymentRef?: string | null;
  paymentInstructions?: string | null;
  notes?: string | null;
  issuedAtLabel?: string;
};

type Props = {
  mode: "create" | "edit";
  initial: DocumentFormInitial;
  error: string | null;
  tenants: TenantOption[];
  signerName: string;
  signerTitle: string;
  signatureSrc: string;
};

function todayLabel() {
  return new Date().toLocaleDateString("en-UG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Kampala",
  });
}

function ymdPlusDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toDateInput(value: string | null | undefined): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDueLabel(ymd: string) {
  if (!ymd) return null;
  const d = new Date(`${ymd}T12:00:00+03:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString("en-UG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Kampala",
  });
}

const inputClass =
  "w-full rounded-xl border border-slate-700 bg-[#07070A] px-3 py-2.5 text-sm text-slate-200 outline-none transition focus:border-[#F97316]/50";
const labelClass = "text-xs font-semibold uppercase tracking-wide text-slate-500";

function SubmitButton({ mode, kind }: { mode: "create" | "edit"; kind: string }) {
  const { pending } = useFormStatus();
  const isInvoice = kind === "invoice";
  let label = isInvoice ? "Issue invoice" : "Issue receipt";
  if (mode === "edit") label = isInvoice ? "Save invoice" : "Save receipt";
  if (pending) label = mode === "edit" ? "Saving…" : "Issuing…";

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl bg-gradient-to-r from-[#F97316] to-[#E8B84B] px-5 py-2.5 text-sm font-bold text-[#07070A] disabled:opacity-60"
    >
      {label}
    </button>
  );
}

function asFormKind(kind: DocKind): "receipt" | "invoice" {
  return kind === "invoice" ? "invoice" : "receipt";
}

export function DocumentEditorForm({
  mode,
  initial,
  error,
  tenants,
  signerName,
  signerTitle,
  signatureSrc,
}: Props) {
  const router = useRouter();
  const lockedKind = mode === "edit";
  const [kind, setKind] = useState<"receipt" | "invoice">(asFormKind(initial.kind));
  const [tenantId, setTenantId] = useState(initial.tenantId ?? "");
  const [facilityName, setFacilityName] = useState(initial.facilityName ?? "");
  const [customerName, setCustomerName] = useState(initial.customerName ?? "");
  const [customerEmail, setCustomerEmail] = useState(initial.customerEmail ?? "");
  const [description, setDescription] = useState(initial.description ?? "");
  const [amountRaw, setAmountRaw] = useState(
    initial.amountUgx != null && initial.amountUgx > 0 ? String(initial.amountUgx) : "",
  );
  const [dueDate, setDueDate] = useState(toDateInput(initial.dueDate) || ymdPlusDays(14));
  const [method, setMethod] = useState(initial.method || "Manual / offline");
  const [paymentRef, setPaymentRef] = useState(initial.paymentRef ?? "");
  const [paymentInstructions, setPaymentInstructions] = useState(
    initial.paymentInstructions ||
      "Pay via MTN MoMo, Airtel Money, bank transfer, or card. Include the invoice number as the payment reference.",
  );
  const [notes, setNotes] = useState(initial.notes ?? "");

  const amount = parseAmountUgx(amountRaw);
  const fallbackIssued = useMemo(() => todayLabel(), []);
  const issuedAtLabel = initial.issuedAtLabel || fallbackIssued;
  const previewKind = lockedKind ? initial.kind : kind;
  const isInvoiceUi = previewKind === "invoice";

  const preview = useMemo(() => {
    const amountLabel =
      amount == null
        ? "UGX —"
        : previewKind === "trial"
          ? "UGX 0 (free trial)"
          : formatMoneyUGX(amount);
    return {
      receiptNo: initial.documentNo || (isInvoiceUi ? "INV-PREVIEW" : "RCT-PREVIEW"),
      kind: previewKind,
      facilityName,
      planName: description,
      amountLabel,
      amountWords: amount != null && amount > 0 ? amountInWordsUGX(amount) : null,
      customerName: customerName || null,
      customerEmail: customerEmail || null,
      methodLabel: isInvoiceUi ? "Net terms — settle by due date" : method,
      paymentRef: !isInvoiceUi && paymentRef ? paymentRef : null,
      paymentInstructions: isInvoiceUi && paymentInstructions.trim() ? paymentInstructions : null,
      notes: notes || null,
      issuedAtLabel,
      dueDateLabel: isInvoiceUi ? formatDueLabel(dueDate) : null,
      signatureSrc,
      signerName,
      signerTitle,
      signedAtLabel: issuedAtLabel,
      preview: mode === "create",
    } as const;
  }, [
    amount,
    previewKind,
    isInvoiceUi,
    facilityName,
    description,
    customerName,
    customerEmail,
    method,
    paymentRef,
    paymentInstructions,
    notes,
    issuedAtLabel,
    dueDate,
    signatureSrc,
    signerName,
    signerTitle,
    initial.documentNo,
    mode,
  ]);

  function onTenantChange(id: string) {
    setTenantId(id);
    if (!id) return;
    const tenant = tenants.find((t) => t.id === id);
    if (tenant?.name) setFacilityName(tenant.name);
  }

  function switchKind(next: "receipt" | "invoice") {
    if (lockedKind) return;
    setKind(next);
    router.replace(`/platform/receipts/new?kind=${next}`, { scroll: false });
  }

  const formAction = mode === "edit" ? updateManualDocument : createManualDocument;
  const backHref = mode === "edit" && initial.id ? `/platform/receipts/${initial.id}` : "/platform/receipts";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href={backHref} className="text-xs font-semibold text-slate-400 hover:text-slate-200">
            ← {mode === "edit" ? "Back to document" : "Receipts"}
          </Link>
          <h1 className="mt-2 font-display text-2xl font-bold">
            {mode === "edit"
              ? `Edit ${isInvoiceUi ? "invoice" : "receipt"} ${initial.documentNo ?? ""}`
              : isInvoiceUi
                ? "Create invoice"
                : "Create receipt"}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate-400">
            {mode === "edit"
              ? "Update fields — the preview refreshes as you type. Document number stays the same."
              : `Fill the form — the document updates live on the right. Signed by ${signerName} — ${signerTitle}.`}
          </p>
        </div>
        {!lockedKind ? (
          <div className="flex gap-2 print:hidden">
            <button
              type="button"
              onClick={() => switchKind("receipt")}
              className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                kind === "receipt"
                  ? "border border-[#F97316]/40 bg-[#F97316]/10 text-[#F97316]"
                  : "border border-slate-700 text-slate-400"
              }`}
            >
              Receipt
            </button>
            <button
              type="button"
              onClick={() => switchKind("invoice")}
              className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                kind === "invoice"
                  ? "border border-[#F97316]/40 bg-[#F97316]/10 text-[#F97316]"
                  : "border border-slate-700 text-slate-400"
              }`}
            >
              Invoice
            </button>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <form action={formAction} className="space-y-4 rounded-xl border border-slate-800 bg-[#111117] p-5">
          <input type="hidden" name="kind" value={isInvoiceUi ? "invoice" : "receipt"} />
          {mode === "edit" && initial.id ? (
            <>
              <input type="hidden" name="id" value={initial.id} />
              <input type="hidden" name="source" value={initial.source ?? "platform"} />
            </>
          ) : null}

          <label className="block space-y-1.5">
            <span className={labelClass}>Link facility (optional)</span>
            <select
              name="tenant_id"
              value={tenantId}
              onChange={(e) => onTenantChange(e.target.value)}
              className={inputClass}
            >
              <option value="">External / not linked</option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className={labelClass}>Facility / organization *</span>
            <input
              name="facility_name"
              required
              value={facilityName}
              onChange={(e) => setFacilityName(e.target.value)}
              placeholder="e.g. Kampala Care Pharmacy"
              className={inputClass}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className={labelClass}>Customer name *</span>
              <input
                name="customer_name"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Full name"
                className={inputClass}
              />
            </label>
            <label className="block space-y-1.5">
              <span className={labelClass}>Customer email</span>
              <input
                name="customer_email"
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="billing@example.com"
                className={inputClass}
              />
            </label>
          </div>

          <label className="block space-y-1.5">
            <span className={labelClass}>{isInvoiceUi ? "Description / line item" : "Plan / service"}</span>
            <input
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                isInvoiceUi ? "Synapse Pharm — Professional quarterly" : "Subscription renewal"
              }
              className={inputClass}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className={labelClass}>Amount (UGX) *</span>
              <input
                name="amount_ugx"
                type="text"
                inputMode="decimal"
                required
                value={amountRaw}
                onChange={(e) => setAmountRaw(e.target.value)}
                placeholder="150,000 or 150000.50"
                className={`${inputClass} font-mono`}
              />
              <span className="text-[11px] text-slate-500">
                {amount != null ? (
                  <>
                    Preview: <span className="font-mono text-slate-300">{formatMoneyUGX(amount)}</span>
                  </>
                ) : (
                  "Decimals and commas allowed."
                )}
              </span>
            </label>

            {isInvoiceUi ? (
              <label className="block space-y-1.5">
                <span className={labelClass}>Due date</span>
                <input
                  name="due_date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={inputClass}
                />
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {[7, 14, 30].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setDueDate(ymdPlusDays(days))}
                      className="rounded-lg border border-slate-700 px-2 py-1 text-[10px] font-semibold text-slate-400 hover:border-slate-500 hover:text-slate-200"
                    >
                      +{days}d
                    </button>
                  ))}
                </div>
              </label>
            ) : (
              <label className="block space-y-1.5">
                <span className={labelClass}>Payment method</span>
                <select
                  name="method"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className={inputClass}
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

          {!isInvoiceUi ? (
            <label className="block space-y-1.5">
              <span className={labelClass}>Payment reference</span>
              <input
                name="payment_ref"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                placeholder="MoMo / bank / Flutterwave reference"
                className={inputClass}
              />
            </label>
          ) : (
            <label className="block space-y-1.5">
              <span className={labelClass}>Payment instructions</span>
              <textarea
                name="payment_instructions"
                rows={3}
                value={paymentInstructions}
                onChange={(e) => setPaymentInstructions(e.target.value)}
                className={inputClass}
              />
            </label>
          )}

          <label className="block space-y-1.5">
            <span className={labelClass}>Notes</span>
            <textarea
              name="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional note printed on the document"
              className={inputClass}
            />
          </label>

          <div className="flex flex-wrap gap-3 pt-2">
            <SubmitButton mode={mode} kind={isInvoiceUi ? "invoice" : "receipt"} />
            <Link
              href={backHref}
              className="rounded-xl border border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-300"
            >
              Cancel
            </Link>
          </div>
        </form>

        <div className="print:hidden xl:sticky xl:top-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#E8B84B]">Live preview</p>
            <p className="text-[11px] text-slate-500">Updates as you type</p>
          </div>
          <div className="origin-top scale-[0.92] sm:scale-100">
            <PlatformReceiptDocument receipt={preview} />
          </div>
        </div>
      </div>
    </div>
  );
}
