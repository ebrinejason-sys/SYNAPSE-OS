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
import { createPlatformBillingDocument, parseAmountUgx } from "./_lib/documents";

const MAX_SIGNATURE_BYTES = 900_000;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

function db() {
  return createServiceClient() as any;
}

function failCreate(kind: string, code: string, detail?: string) {
  const q = new URLSearchParams({ kind, error: code });
  if (detail) q.set("detail", detail.slice(0, 180));
  redirect(`/platform/receipts/new?${q.toString()}`);
}

export async function uploadAuthorizedSignature(formData: FormData) {
  const profile = await requirePlatformAdmin();
  const file = formData.get("signature") as File | null;
  const signerName = String(formData.get("signer_name") ?? "").trim() || DEFAULT_SIGNER_NAME;
  const signerTitle = String(formData.get("signer_title") ?? "").trim() || DEFAULT_SIGNER_TITLE;

  if (!file || file.size === 0) {
    redirect("/platform/receipts?error=signature_required");
  }
  if (!ALLOWED_MIME.has(file.type)) {
    redirect("/platform/receipts?error=signature_type");
  }
  if (file.size > MAX_SIGNATURE_BYTES) {
    redirect("/platform/receipts?error=signature_too_large");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const dataUrl = `data:${file.type};base64,${buffer.toString("base64")}`;

  const { error } = await db()
    .from("platform_document_settings")
    .upsert(
      {
        id: "default",
        signature_data_url: dataUrl,
        signer_name: signerName,
        signer_title: signerTitle,
        updated_at: new Date().toISOString(),
        updated_by: profile.id,
      },
      { onConflict: "id" },
    );

  if (error) {
    console.error("[receipts] signature upload failed:", error.message);
    redirect("/platform/receipts?error=signature_save");
  }

  await logPlatformEvent({
    actorId: profile.id,
    action: "receipts.signature_updated",
    entityType: "platform_document_settings",
    entityId: "default",
    metadata: { signer_name: signerName, signer_title: signerTitle },
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
  const amount = parseAmountUgx(formData.get("amount_ugx"));

  if (!facilityName) failCreate(kind, "facility");
  if (!customerName) failCreate(kind, "customer");
  if (amount == null) failCreate(kind, "amount");
  if (kind === "receipt" && amount <= 0) failCreate(kind, "amount");

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
    amountUgx: amount!,
    method: method || (kind === "receipt" ? "Manual / offline" : null),
    notes: notes || null,
    dueDate: dueDate || null,
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
