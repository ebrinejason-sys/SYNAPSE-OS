import { createServiceClient } from "../../../lib/supabase/server";
import { listSubscriptionInvoices, type SubscriptionInvoiceRow } from "@synapse/auth/billing";
import { kampalaDateYMD } from "@synapse/auth/billing";

export type PlatformDocKind = "receipt" | "invoice" | "payment" | "trial";

export type PlatformBillingDocument = {
  id: string;
  document_no: string;
  kind: PlatformDocKind;
  tenant_id: string | null;
  facility_name: string;
  customer_name: string | null;
  customer_email: string | null;
  description: string | null;
  amount_ugx: number;
  currency: string;
  method: string | null;
  notes: string | null;
  due_date: string | null;
  period_start: string | null;
  period_end: string | null;
  issued_at: string;
  metadata: Record<string, unknown>;
  source: "platform" | "subscription";
};

function db() {
  return createServiceClient() as any;
}

/** Parse UGX amounts from form input — accepts decimals, commas, spaces. */
export function parseAmountUgx(raw: unknown): number | null {
  if (raw == null) return null;
  let cleaned = String(raw)
    .trim()
    .replace(/ugx/gi, "")
    .replace(/\s+/g, "");
  if (!cleaned) return null;

  if (cleaned.includes(",") && cleaned.includes(".")) {
    cleaned = cleaned.replace(/,/g, "");
  } else if (cleaned.includes(",")) {
    if (/^-?\d+,\d{1,2}$/.test(cleaned)) cleaned = cleaned.replace(",", ".");
    else cleaned = cleaned.replace(/,/g, "");
  }

  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

export function formatMoneyUGX(value: number): string {
  const abs = Math.abs(value);
  const hasCents = Math.round(abs * 100) % 100 !== 0;
  return `UGX ${value.toLocaleString("en-UG", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

const EXTERNAL_TENANT_SLUG = "synapse-billing-external";

/**
 * Production `subscription_invoices.tenant_id` is NOT NULL.
 * When the admin leaves facility unlinked, we attach docs to this sink tenant.
 */
export async function resolveBillingTenantId(preferred: string | null | undefined): Promise<string> {
  if (preferred) return preferred;

  const { data: existing } = await db()
    .from("tenants")
    .select("id")
    .eq("slug", EXTERNAL_TENANT_SLUG)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const { error } = await db().from("tenants").insert({
    id,
    slug: EXTERNAL_TENANT_SLUG,
    name: "External / Walk-in billing",
    facility_type: "pharmacy",
    status: "active",
    is_active: true,
    plan: "enterprise",
    onboarding_completed: true,
    onboarding_step: 5,
    country_code: "UG",
    country: "Uganda",
    modules_enabled: [],
    created_at: now,
    updated_at: now,
  });

  if (error) {
    // Race: another request may have created it
    const { data: again } = await db()
      .from("tenants")
      .select("id")
      .eq("slug", EXTERNAL_TENANT_SLUG)
      .maybeSingle();
    if (again?.id) return again.id as string;
    throw new Error(`Unable to resolve billing tenant: ${error.message}`);
  }

  return id;
}

async function nextNo(table: "platform_billing_documents" | "subscription_invoices", column: string, prefix: string) {
  const ymd = kampalaDateYMD();
  const like = `${prefix}-${ymd}-%`;
  const { count } = await db()
    .from(table)
    .select("id", { count: "exact", head: true })
    .like(column, like);
  return `${prefix}-${ymd}-${String((count ?? 0) + 1).padStart(4, "0")}`;
}

function mapPlatformRow(row: Record<string, unknown>): PlatformBillingDocument {
  return {
    id: String(row.id),
    document_no: String(row.document_no),
    kind: (row.kind as PlatformDocKind) ?? "receipt",
    tenant_id: (row.tenant_id as string | null) ?? null,
    facility_name: String(row.facility_name ?? "Facility"),
    customer_name: (row.customer_name as string | null) ?? null,
    customer_email: (row.customer_email as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    amount_ugx: Number(row.amount_ugx ?? 0),
    currency: String(row.currency ?? "UGX"),
    method: (row.method as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    due_date: (row.due_date as string | null) ?? null,
    period_start: (row.period_start as string | null) ?? null,
    period_end: (row.period_end as string | null) ?? null,
    issued_at: String(row.issued_at ?? new Date().toISOString()),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    source: "platform",
  };
}

function mapSubscriptionRow(row: SubscriptionInvoiceRow): PlatformBillingDocument {
  const meta = row.metadata ?? {};
  const metaType = String(meta.type ?? "");
  const metaKind = String(meta.document_kind ?? "");
  let kind: PlatformDocKind = "payment";
  if (row.invoice_no.startsWith("TRIAL-") || metaType === "free_trial") kind = "trial";
  else if (row.invoice_no.startsWith("RCT-") || metaType === "manual_receipt" || metaKind === "receipt") {
    kind = "receipt";
  } else if (metaType === "manual_invoice" || metaKind === "invoice") kind = "invoice";

  return {
    id: row.id,
    document_no: row.invoice_no,
    kind,
    tenant_id: row.tenant_id,
    facility_name:
      row.tenant_name ??
      (meta.facility_name as string | undefined) ??
      "Unknown facility",
    customer_name: (meta.customer_name as string | undefined) ?? null,
    customer_email: (meta.customer_email as string | undefined) ?? null,
    description:
      row.plan_name ??
      (meta.plan_name as string | undefined) ??
      (meta.description as string | undefined) ??
      null,
    amount_ugx: Number(row.amount_ugx ?? 0),
    currency: row.currency ?? "UGX",
    method: (meta.method as string | undefined) ?? null,
    notes: (meta.notes as string | undefined) ?? null,
    due_date: (meta.due_date as string | undefined) ?? null,
    period_start: row.period_start,
    period_end: row.period_end,
    issued_at: row.issued_at,
    metadata: meta,
    source: "subscription",
  };
}

export type CreatePlatformDocumentInput = {
  kind: "receipt" | "invoice";
  tenantId?: string | null;
  facilityName: string;
  customerName: string;
  customerEmail?: string | null;
  description?: string | null;
  amountUgx: number;
  method?: string | null;
  notes?: string | null;
  dueDate?: string | null;
  createdBy: string;
  createdByEmail?: string | null;
  signerName: string;
  signerTitle: string;
  signatureDataUrl?: string | null;
  signatureSrc?: string | null;
};

export async function createPlatformBillingDocument(
  input: CreatePlatformDocumentInput,
): Promise<{ id: string; documentNo: string } | { error: string }> {
  const prefix = input.kind === "invoice" ? "INV" : "RCT";
  const now = new Date();
  const periodEnd = input.dueDate ? new Date(`${input.dueDate}T12:00:00+03:00`) : null;
  const tenantId = await resolveBillingTenantId(input.tenantId).catch((err) => {
    console.error("[receipts] resolveBillingTenantId failed:", err);
    return null;
  });

  if (!tenantId) {
    return { error: "Could not resolve a facility tenant for this document." };
  }

  const metadata = {
    type: input.kind === "invoice" ? "manual_invoice" : "manual_receipt",
    document_kind: input.kind,
    facility_name: input.facilityName,
    customer_name: input.customerName,
    customer_email: input.customerEmail ?? null,
    plan_name: input.description || (input.kind === "invoice" ? "Invoice" : "Receipt"),
    description: input.description ?? null,
    method: input.method ?? null,
    notes: input.notes ?? null,
    due_date: input.dueDate ?? null,
    created_by: input.createdBy,
    created_by_email: input.createdByEmail ?? null,
    signer_name: input.signerName,
    signer_title: input.signerTitle,
    signature_data_url: input.signatureDataUrl ?? null,
    signature_src: input.signatureSrc ?? null,
    signed_at: now.toISOString(),
  };

  // 1) Prefer dedicated platform_billing_documents (numeric amounts, nullable tenant OK)
  {
    let documentNo = await nextNo("platform_billing_documents", "document_no", prefix).catch(
      () => `${prefix}-${kampalaDateYMD()}-0001`,
    );

    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate =
        attempt === 0 ? documentNo : `${prefix}-${kampalaDateYMD()}-${String(Date.now()).slice(-4)}`;

      const { data, error } = await db()
        .from("platform_billing_documents")
        .insert({
          document_no: candidate,
          kind: input.kind,
          tenant_id: tenantId,
          facility_name: input.facilityName,
          customer_name: input.customerName,
          customer_email: input.customerEmail || null,
          description: input.description || null,
          amount_ugx: input.amountUgx,
          currency: "UGX",
          method: input.method || null,
          notes: input.notes || null,
          due_date: input.dueDate || null,
          period_start: now.toISOString(),
          period_end: periodEnd && !Number.isNaN(periodEnd.getTime()) ? periodEnd.toISOString() : null,
          issued_at: now.toISOString(),
          metadata,
          created_by: input.createdBy,
        })
        .select("id, document_no")
        .single();

      if (!error && data?.id) {
        return { id: data.id as string, documentNo: data.document_no as string };
      }

      if (error?.code === "23505") {
        documentNo = candidate;
        continue;
      }

      // Table missing on this project — fall through to subscription_invoices
      const missing =
        error?.code === "42P01" ||
        /does not exist|schema cache|Could not find the table/i.test(error?.message ?? "");
      if (missing) {
        console.warn("[receipts] platform_billing_documents unavailable, falling back:", error?.message);
        break;
      }

      console.error("[receipts] platform insert failed:", error?.message, error?.code);
      return { error: error?.message ?? "insert_failed" };
    }
  }

  // 2) Fallback: subscription_invoices (production currently has this table)
  {
    let documentNo = await nextNo("subscription_invoices", "invoice_no", prefix).catch(
      () => `${prefix}-${kampalaDateYMD()}-0001`,
    );

    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate =
        attempt === 0 ? documentNo : `${prefix}-${kampalaDateYMD()}-${String(Date.now()).slice(-4)}`;

      const { data, error } = await db()
        .from("subscription_invoices")
        .insert({
          tenant_id: tenantId,
          payment_id: null,
          plan_id: null,
          invoice_no: candidate,
          amount_ugx: input.amountUgx,
          currency: "UGX",
          period_start: now.toISOString(),
          period_end: periodEnd && !Number.isNaN(periodEnd.getTime()) ? periodEnd.toISOString() : null,
          metadata,
          issued_at: now.toISOString(),
        })
        .select("id, invoice_no")
        .single();

      if (!error && data?.id) {
        return { id: data.id as string, documentNo: (data.invoice_no as string) ?? candidate };
      }

      if (error?.code === "23505") {
        documentNo = candidate;
        continue;
      }

      console.error("[receipts] subscription_invoices insert failed:", error?.message, error?.code, error?.details);
      return { error: error?.message ?? "insert_failed" };
    }
  }

  return { error: "unique_exhausted" };
}

export async function getPlatformBillingDocument(
  id: string,
): Promise<PlatformBillingDocument | null> {
  try {
    const { data, error } = await db()
      .from("platform_billing_documents")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!error && data) return mapPlatformRow(data);
  } catch (err) {
    console.error("[receipts] get platform doc failed:", err);
  }

  try {
    const { getSubscriptionInvoice } = await import("@synapse/auth/billing");
    const sub = await getSubscriptionInvoice(id);
    return sub ? mapSubscriptionRow(sub) : null;
  } catch {
    return null;
  }
}

export async function listPlatformBillingDocuments(limit = 250): Promise<PlatformBillingDocument[]> {
  const platformDocs: PlatformBillingDocument[] = [];
  try {
    const { data, error } = await db()
      .from("platform_billing_documents")
      .select("*")
      .order("issued_at", { ascending: false })
      .limit(limit);
    if (!error && data) {
      for (const row of data) platformDocs.push(mapPlatformRow(row));
    }
  } catch (err) {
    console.error("[receipts] list platform docs failed:", err);
  }

  let subDocs: PlatformBillingDocument[] = [];
  try {
    const subs = await listSubscriptionInvoices(limit);
    subDocs = subs.map(mapSubscriptionRow);
  } catch {
    subDocs = [];
  }

  const seen = new Set(platformDocs.map((d) => d.document_no));
  const merged = [...platformDocs];
  for (const doc of subDocs) {
    if (seen.has(doc.document_no)) continue;
    merged.push(doc);
  }

  merged.sort((a, b) => new Date(b.issued_at).getTime() - new Date(a.issued_at).getTime());
  return merged.slice(0, limit);
}
