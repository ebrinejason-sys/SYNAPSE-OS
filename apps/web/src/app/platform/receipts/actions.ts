"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { kampalaDateYMD } from "@synapse/auth/billing";
import { requirePlatformAdmin } from "../../../lib/platform/auth";
import { createServiceClient } from "../../../lib/supabase/server";
import { logPlatformEvent } from "../_lib/platform-data";
import {
  DEFAULT_SIGNER_NAME,
  DEFAULT_SIGNER_TITLE,
  DEFAULT_SIGNATURE_SRC,
} from "./_lib/document-settings";

const MAX_SIGNATURE_BYTES = 900_000; // ~900KB raw → fine as data URL
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

function db() {
  return createServiceClient() as any;
}

async function nextDocumentNo(prefix: "RCT" | "INV"): Promise<string> {
  const ymd = kampalaDateYMD();
  const like = `${prefix}-${ymd}-%`;
  const { count } = await db()
    .from("subscription_invoices")
    .select("id", { count: "exact", head: true })
    .like("invoice_no", like);
  return `${prefix}-${ymd}-${String((count ?? 0) + 1).padStart(4, "0")}`;
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
  const amount = Number(formData.get("amount_ugx") ?? 0);

  if (!facilityName) redirect(`/platform/receipts/new?kind=${kind}&error=facility`);
  if (!customerName) redirect(`/platform/receipts/new?kind=${kind}&error=customer`);
  if (!Number.isFinite(amount) || amount < 0) {
    redirect(`/platform/receipts/new?kind=${kind}&error=amount`);
  }
  if (kind === "receipt" && amount <= 0) {
    redirect(`/platform/receipts/new?kind=${kind}&error=amount`);
  }

  const prefix = kind === "invoice" ? "INV" : "RCT";
  let documentNo = await nextDocumentNo(prefix);

  const settings = await db()
    .from("platform_document_settings")
    .select("signature_data_url, signer_name, signer_title")
    .eq("id", "default")
    .maybeSingle();

  const now = new Date();
  const periodEnd = dueDate ? new Date(`${dueDate}T12:00:00+03:00`) : null;

  const metadata = {
    type: kind === "invoice" ? "manual_invoice" : "manual_receipt",
    document_kind: kind,
    facility_name: facilityName,
    customer_name: customerName,
    customer_email: customerEmail || null,
    plan_name: description || (kind === "invoice" ? "Invoice" : "Receipt"),
    description: description || null,
    method: method || (kind === "receipt" ? "Manual / offline" : null),
    notes: notes || null,
    due_date: dueDate || null,
    created_by: profile.id,
    created_by_email: profile.email,
    signer_name: settings.data?.signer_name ?? DEFAULT_SIGNER_NAME,
    signer_title: settings.data?.signer_title ?? DEFAULT_SIGNER_TITLE,
    // Snapshot so historical docs keep the signature used at issue time
    signature_data_url: settings.data?.signature_data_url ?? null,
    signature_src: settings.data?.signature_data_url ? null : DEFAULT_SIGNATURE_SRC,
    signed_at: now.toISOString(),
  };

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate =
      attempt === 0 ? documentNo : `${prefix}-${kampalaDateYMD()}-${String(Date.now()).slice(-4)}`;
    const { data, error } = await db()
      .from("subscription_invoices")
      .insert({
        tenant_id: tenantIdRaw || null,
        payment_id: null,
        plan_id: null,
        invoice_no: candidate,
        amount_ugx: amount,
        currency: "UGX",
        period_start: now.toISOString(),
        period_end: periodEnd && !Number.isNaN(periodEnd.getTime()) ? periodEnd.toISOString() : null,
        metadata,
        issued_at: now.toISOString(),
      })
      .select("id")
      .single();

    if (!error && data?.id) {
      await logPlatformEvent({
        actorId: profile.id,
        action: kind === "invoice" ? "receipts.invoice_created" : "receipts.receipt_created",
        entityType: "subscription_invoices",
        entityId: data.id,
        tenantId: tenantIdRaw || null,
        metadata: { invoice_no: candidate, amount_ugx: amount, facility_name: facilityName },
      });
      revalidatePath("/platform/receipts");
      redirect(`/platform/receipts/${data.id}`);
    }

    if (error?.code !== "23505") {
      console.error("[receipts] create failed:", error?.message);
      redirect(`/platform/receipts/new?kind=${kind}&error=save`);
    }
    documentNo = candidate;
  }

  redirect(`/platform/receipts/new?kind=${kind}&error=save`);
}
