import { createServiceClient } from "../../../../lib/supabase/server";
import { listSubscriptionInvoices, type SubscriptionInvoiceRow } from "@synapse/auth/billing";
import { kampalaDateYMD } from "@synapse/auth/billing";
import { formatMoneyUGX as formatMoneyUGXShared, parseAmountUgx as parseAmountUgxShared } from "./money";

export type PlatformDocKind = "receipt" | "invoice" | "payment" | "trial";
export { formatMoneyUGXShared as formatMoneyUGX, parseAmountUgxShared as parseAmountUgx };

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

function isMissingRelationError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  const msg = error.message ?? "";
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    code === "PGRST204" ||
    /does not exist|schema cache|Could not find the table|relation .* does not exist/i.test(msg)
  );
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

  // Try a few plan values — live CHECK constraints vary by migration era.
  for (const plan of ["trial", "starter", "enterprise"] as const) {
    const { error } = await db().from("tenants").insert({
      id,
      slug: EXTERNAL_TENANT_SLUG,
      name: "External / Walk-in billing",
      facility_type: "pharmacy",
      status: "active",
      is_active: true,
      plan,
      onboarding_completed: true,
      onboarding_step: 5,
      country_code: "UG",
      country: "Uganda",
      modules_enabled: [],
      created_at: now,
      updated_at: now,
    });

    if (!error) return id;

    const { data: raced } = await db()
      .from("tenants")
      .select("id")
      .eq("slug", EXTERNAL_TENANT_SLUG)
      .maybeSingle();
    if (raced?.id) return raced.id as string;

    // Plan check failed — try next plan value
    if (/plan|check|constraint/i.test(error.message ?? "")) continue;

    console.error("[receipts] create external tenant failed:", error.message);
    break;
  }

  // Last resort: any existing tenant so NOT NULL tenant_id inserts can proceed
  const { data: anyTenant } = await db().from("tenants").select("id").limit(1).maybeSingle();
  if (anyTenant?.id) {
    console.warn("[receipts] using fallback existing tenant for external billing doc");
    return anyTenant.id as string;
  }

  throw new Error("Unable to resolve a billing tenant for this document.");
}

async function nextNo(
  table: "platform_billing_documents" | "subscription_invoices",
  column: string,
  prefix: string,
): Promise<string> {
  const ymd = kampalaDateYMD();
  const like = `${prefix}-${ymd}-%`;
  const { count, error } = await db()
    .from(table)
    .select("id", { count: "exact", head: true })
    .like(column, like);
  if (error) {
    if (isMissingRelationError(error)) throw new Error(error.message);
    // Non-fatal — still produce a number
  }
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
  paymentRef?: string | null;
  paymentInstructions?: string | null;
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

  let tenantId: string;
  try {
    tenantId = await resolveBillingTenantId(input.tenantId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "tenant_resolve_failed";
    console.error("[receipts] resolveBillingTenantId failed:", message);
    return { error: message };
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
    payment_ref: input.paymentRef ?? null,
    payment_instructions: input.paymentInstructions ?? null,
    created_by: input.createdBy,
    created_by_email: input.createdByEmail ?? null,
    signer_name: input.signerName,
    signer_title: input.signerTitle,
    signature_data_url: input.signatureDataUrl ?? null,
    signature_src: input.signatureSrc ?? null,
    signed_at: now.toISOString(),
  };

  // 1) Prefer dedicated platform_billing_documents when the table exists
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

      // Table missing / not in schema cache — fall through to subscription_invoices
      if (isMissingRelationError(error)) {
        console.warn("[receipts] platform_billing_documents unavailable, falling back:", error?.message);
        break;
      }

      // Any other failure on the preferred table: still try the legacy ledger
      console.warn("[receipts] platform insert failed, trying subscription_invoices:", error?.message, error?.code);
      break;
    }
  }

  // 2) Fallback: subscription_invoices (live production ledger)
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

      console.error(
        "[receipts] subscription_invoices insert failed:",
        error?.message,
        error?.code,
        error?.details,
      );
      return { error: error?.message ?? "insert_failed" };
    }
  }

  return { error: "unique_exhausted" };
}

export type UpdatePlatformDocumentInput = {
  id: string;
  source: "platform" | "subscription";
  kind: PlatformDocKind;
  tenantId?: string | null;
  facilityName: string;
  customerName: string;
  customerEmail?: string | null;
  description?: string | null;
  amountUgx: number;
  method?: string | null;
  notes?: string | null;
  dueDate?: string | null;
  paymentRef?: string | null;
  paymentInstructions?: string | null;
  updatedBy: string;
  updatedByEmail?: string | null;
  existingMetadata?: Record<string, unknown>;
};

export async function updatePlatformBillingDocument(
  input: UpdatePlatformDocumentInput,
): Promise<{ id: string; documentNo: string } | { error: string }> {
  const now = new Date();
  const periodEnd = input.dueDate ? new Date(`${input.dueDate}T12:00:00+03:00`) : null;

  let tenantId: string | null = input.tenantId ?? null;
  if (tenantId === "") tenantId = null;
  try {
    if (!tenantId) tenantId = await resolveBillingTenantId(null);
  } catch (err) {
    const message = err instanceof Error ? err.message : "tenant_resolve_failed";
    return { error: message };
  }

  const prev = input.existingMetadata ?? {};
  const metadata = {
    ...prev,
    type:
      input.kind === "invoice"
        ? "manual_invoice"
        : input.kind === "receipt"
          ? "manual_receipt"
          : (prev.type as string | undefined) ?? input.kind,
    document_kind: input.kind,
    facility_name: input.facilityName,
    customer_name: input.customerName,
    customer_email: input.customerEmail ?? null,
    plan_name: input.description || (input.kind === "invoice" ? "Invoice" : "Receipt"),
    description: input.description ?? null,
    method: input.method ?? null,
    notes: input.notes ?? null,
    due_date: input.dueDate ?? null,
    payment_ref: input.paymentRef ?? null,
    payment_instructions: input.paymentInstructions ?? null,
    updated_by: input.updatedBy,
    updated_by_email: input.updatedByEmail ?? null,
    updated_at: now.toISOString(),
  };

  if (input.source === "platform") {
    const { data, error } = await db()
      .from("platform_billing_documents")
      .update({
        tenant_id: tenantId,
        facility_name: input.facilityName,
        customer_name: input.customerName,
        customer_email: input.customerEmail || null,
        description: input.description || null,
        amount_ugx: input.amountUgx,
        method: input.method || null,
        notes: input.notes || null,
        due_date: input.dueDate || null,
        period_end: periodEnd && !Number.isNaN(periodEnd.getTime()) ? periodEnd.toISOString() : null,
        metadata,
      })
      .eq("id", input.id)
      .select("id, document_no")
      .single();

    if (!error && data?.id) {
      return { id: data.id as string, documentNo: data.document_no as string };
    }

    if (!isMissingRelationError(error)) {
      console.error("[receipts] platform update failed:", error?.message, error?.code);
      return { error: error?.message ?? "update_failed" };
    }
    // Fall through to subscription table if platform table missing
  }

  const { data, error } = await db()
    .from("subscription_invoices")
    .update({
      tenant_id: tenantId,
      amount_ugx: input.amountUgx,
      period_end: periodEnd && !Number.isNaN(periodEnd.getTime()) ? periodEnd.toISOString() : null,
      metadata,
    })
    .eq("id", input.id)
    .select("id, invoice_no")
    .single();

  if (!error && data?.id) {
    return { id: data.id as string, documentNo: (data.invoice_no as string) ?? input.id };
  }

  console.error("[receipts] subscription update failed:", error?.message, error?.code);
  return { error: error?.message ?? "update_failed" };
}

export async function deletePlatformBillingDocument(
  id: string,
  sourceHint?: "platform" | "subscription" | null,
): Promise<{ ok: true; documentNo: string } | { error: string }> {
  const existing = await getPlatformBillingDocument(id);
  if (!existing) return { error: "Document not found" };

  const source = sourceHint || existing.source;
  const documentNo = existing.document_no;

  if (source === "platform") {
    const { error } = await db().from("platform_billing_documents").delete().eq("id", id);
    if (!error) return { ok: true, documentNo };
    if (!isMissingRelationError(error)) {
      // Try subscription fallback in case the row lived there
      console.warn("[receipts] platform delete failed, trying subscription:", error.message);
    }
  }

  const { error } = await db().from("subscription_invoices").delete().eq("id", id);
  if (!error) return { ok: true, documentNo };

  console.error("[receipts] delete failed:", error?.message, error?.code);
  return { error: error?.message ?? "delete_failed" };
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
