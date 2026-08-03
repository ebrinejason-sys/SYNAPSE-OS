"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "../../../lib/platform/auth";
import { createServiceClient } from "../../../lib/supabase/server";
import { logPlatformEvent } from "../_lib/platform-data";
import {
  DEFAULT_SIGNER_NAME,
  DEFAULT_SIGNER_TITLE,
  DEFAULT_SIGNATURE_SRC,
} from "./_lib/document-settings";
import {
  createPlatformBillingDocument,
  deletePlatformBillingDocument,
  getPlatformBillingDocument,
  parseAmountUgx,
  updatePlatformBillingDocument,
} from "./_lib/documents";

const MAX_SIGNATURE_BYTES = 900_000;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

function db() {
  return createServiceClient() as any;
}

function failCreate(kind: string, code: string, detail?: string): never {
  const q = new URLSearchParams({ kind, error: code });
  if (detail) q.set("detail", detail.slice(0, 180));
  redirect(`/platform/receipts/new?${q.toString()}`);
}

export async function uploadAuthorizedSignature(formData: FormData) {
  const profile = await requirePlatformAdmin();
  const file = formData.get("signature") as File | null;
  const signerName = String(formData.get("signer_name") ?? "").trim() || DEFAULT_SIGNER_NAME;
  const signerTitle = String(formData.get("signer_title") ?? "").trim() || DEFAULT_SIGNER_TITLE;
  const hasFile = Boolean(file && file.size > 0);

  let signatureDataUrl: string | undefined;

  if (hasFile && file) {
    if (!ALLOWED_MIME.has(file.type)) {
      redirect("/platform/receipts?error=signature_type");
    }
    if (file.size > MAX_SIGNATURE_BYTES) {
      redirect("/platform/receipts?error=signature_too_large");
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    signatureDataUrl = `data:${file.type};base64,${buffer.toString("base64")}`;
  }

  const payload: Record<string, unknown> = {
    id: "default",
    signer_name: signerName,
    signer_title: signerTitle,
    updated_at: new Date().toISOString(),
    updated_by: profile.id,
  };
  if (signatureDataUrl) payload.signature_data_url = signatureDataUrl;

  const { error } = await db()
    .from("platform_document_settings")
    .upsert(payload, { onConflict: "id" });

  if (error) {
    console.error("[receipts] signature upload failed:", error.message);
    redirect("/platform/receipts?error=signature_save");
  }

  await logPlatformEvent({
    actorId: profile.id,
    action: hasFile ? "receipts.signature_updated" : "receipts.signer_updated",
    entityType: "platform_document_settings",
    entityId: "default",
    metadata: { signer_name: signerName, signer_title: signerTitle, image_updated: hasFile },
  });

  revalidatePath("/platform/receipts");
  redirect("/platform/receipts?ok=signature");
}

export async function clearAuthorizedSignature() {
  const profile = await requirePlatformAdmin();
  await db()
    .from("platform_document_settings")
    .upsert(
      {
        id: "default",
        signature_data_url: null,
        signer_name: DEFAULT_SIGNER_NAME,
        signer_title: DEFAULT_SIGNER_TITLE,
        updated_at: new Date().toISOString(),
        updated_by: profile.id,
      },
      { onConflict: "id" },
    );

  await logPlatformEvent({
    actorId: profile.id,
    action: "receipts.signature_cleared",
    entityType: "platform_document_settings",
    entityId: "default",
  });

  revalidatePath("/platform/receipts");
  redirect("/platform/receipts?ok=signature_cleared");
}

export async function createManualDocument(formData: FormData) {
  const profile = await requirePlatformAdmin();

  const kind = String(formData.get("kind") ?? "receipt") === "invoice" ? "invoice" : "receipt";
  const tenantIdRaw = String(formData.get("tenant_id") ?? "").trim();
  const facilityName = String(formData.get("facility_name") ?? "").trim();
  const customerName = String(formData.get("customer_name") ?? "").trim();
  const customerEmail = String(formData.get("customer_email") ?? "").trim().toLowerCase();
  const description = String(formData.get("description") ?? "").trim();
  const method = String(formData.get("method") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const dueDate = String(formData.get("due_date") ?? "").trim();
  const paymentRef = String(formData.get("payment_ref") ?? "").trim();
  const paymentInstructions = String(formData.get("payment_instructions") ?? "").trim();
  const amount = parseAmountUgx(formData.get("amount_ugx"));

  if (!facilityName) failCreate(kind, "facility");
  if (!customerName) failCreate(kind, "customer");
  if (amount == null || amount <= 0) {
    failCreate(kind, "amount");
  }

  const settings = await db()
    .from("platform_document_settings")
    .select("signature_data_url, signer_name, signer_title")
    .eq("id", "default")
    .maybeSingle();

  const signerName = settings.data?.signer_name ?? DEFAULT_SIGNER_NAME;
  const signerTitle = settings.data?.signer_title ?? DEFAULT_SIGNER_TITLE;
  const signatureDataUrl = settings.data?.signature_data_url ?? null;

  const result = await createPlatformBillingDocument({
    kind,
    tenantId: tenantIdRaw || null,
    facilityName,
    customerName,
    customerEmail: customerEmail || null,
    description: description || null,
    amountUgx: amount,
    method:
      method ||
      (kind === "receipt"
        ? "Manual / offline"
        : paymentInstructions
          ? "Custom payment instructions"
          : "Pay by MTN MoMo, Airtel Money, bank transfer, or card"),
    notes: notes || null,
    dueDate: dueDate || null,
    paymentRef: paymentRef || null,
    paymentInstructions: paymentInstructions || null,
    createdBy: profile.id,
    createdByEmail: profile.email,
    signerName,
    signerTitle,
    signatureDataUrl,
    signatureSrc: signatureDataUrl ? null : DEFAULT_SIGNATURE_SRC,
  });

  if ("error" in result) {
    console.error("[receipts] createManualDocument failed:", result.error);
    failCreate(kind, "save", result.error);
  }

  await logPlatformEvent({
    actorId: profile.id,
    action: kind === "invoice" ? "receipts.invoice_created" : "receipts.receipt_created",
    entityType: "platform_billing_documents",
    entityId: result.id,
    tenantId: tenantIdRaw || null,
    metadata: {
      document_no: result.documentNo,
      amount_ugx: amount,
      facility_name: facilityName,
    },
  });

  revalidatePath("/platform/receipts");
  redirect(`/platform/receipts/${result.id}`);
}

function failEdit(id: string, code: string, detail?: string): never {
  const q = new URLSearchParams({ error: code });
  if (detail) q.set("detail", detail.slice(0, 180));
  redirect(`/platform/receipts/${id}/edit?${q.toString()}`);
}

export async function updateManualDocument(formData: FormData) {
  const profile = await requirePlatformAdmin();

  const id = String(formData.get("id") ?? "").trim();
  const sourceRaw = String(formData.get("source") ?? "platform");
  const source = sourceRaw === "subscription" ? "subscription" : "platform";
  if (!id) redirect("/platform/receipts?error=save");

  const existing = await getPlatformBillingDocument(id);
  if (!existing) failEdit(id, "save", "Document not found");

  const kind =
    String(formData.get("kind") ?? existing.kind) === "invoice"
      ? "invoice"
      : existing.kind === "invoice"
        ? "invoice"
        : existing.kind === "trial"
          ? "trial"
          : existing.kind === "payment"
            ? "payment"
            : "receipt";

  const tenantIdRaw = String(formData.get("tenant_id") ?? "").trim();
  const facilityName = String(formData.get("facility_name") ?? "").trim();
  const customerName = String(formData.get("customer_name") ?? "").trim();
  const customerEmail = String(formData.get("customer_email") ?? "").trim().toLowerCase();
  const description = String(formData.get("description") ?? "").trim();
  const method = String(formData.get("method") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const dueDate = String(formData.get("due_date") ?? "").trim();
  const paymentRef = String(formData.get("payment_ref") ?? "").trim();
  const paymentInstructions = String(formData.get("payment_instructions") ?? "").trim();
  const amount = parseAmountUgx(formData.get("amount_ugx"));

  if (!facilityName) failEdit(id, "facility");
  if (!customerName) failEdit(id, "customer");
  if (amount == null || (kind !== "trial" && amount <= 0)) {
    failEdit(id, "amount");
  }

  const result = await updatePlatformBillingDocument({
    id,
    source: existing.source || source,
    kind,
    tenantId: tenantIdRaw || existing.tenant_id,
    facilityName,
    customerName,
    customerEmail: customerEmail || null,
    description: description || null,
    amountUgx: amount ?? 0,
    method:
      method ||
      (kind === "receipt" || kind === "payment"
        ? existing.method || "Manual / offline"
        : paymentInstructions
          ? "Custom payment instructions"
          : existing.method || "Pay by MTN MoMo, Airtel Money, bank transfer, or card"),
    notes: notes || null,
    dueDate: dueDate || null,
    paymentRef: paymentRef || null,
    paymentInstructions: paymentInstructions || null,
    updatedBy: profile.id,
    updatedByEmail: profile.email,
    existingMetadata: existing.metadata,
  });

  if ("error" in result) {
    console.error("[receipts] updateManualDocument failed:", result.error);
    failEdit(id, "save", result.error);
  }

  await logPlatformEvent({
    actorId: profile.id,
    action: "receipts.document_updated",
    entityType: "platform_billing_documents",
    entityId: result.id,
    tenantId: tenantIdRaw || existing.tenant_id,
    metadata: {
      document_no: result.documentNo,
      amount_ugx: amount,
      facility_name: facilityName,
      kind,
    },
  });

  revalidatePath("/platform/receipts");
  revalidatePath(`/platform/receipts/${result.id}`);
  redirect(`/platform/receipts/${result.id}?ok=updated`);
}

export async function deleteManualDocument(formData: FormData) {
  const profile = await requirePlatformAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const sourceRaw = String(formData.get("source") ?? "");
  const source =
    sourceRaw === "subscription" ? "subscription" : sourceRaw === "platform" ? "platform" : null;

  if (!id) redirect("/platform/receipts?error=delete");

  const existing = await getPlatformBillingDocument(id);
  if (!existing) redirect("/platform/receipts?error=delete");

  const result = await deletePlatformBillingDocument(id, source || existing.source);
  if ("error" in result) {
    console.error("[receipts] deleteManualDocument failed:", result.error);
    redirect(`/platform/receipts/${id}?error=delete`);
  }

  await logPlatformEvent({
    actorId: profile.id,
    action: "receipts.document_deleted",
    entityType: "platform_billing_documents",
    entityId: id,
    tenantId: existing.tenant_id,
    metadata: {
      document_no: result.documentNo,
      kind: existing.kind,
      amount_ugx: existing.amount_ugx,
      facility_name: existing.facility_name,
    },
  });

  revalidatePath("/platform/receipts");
  redirect("/platform/receipts?ok=deleted");
}
