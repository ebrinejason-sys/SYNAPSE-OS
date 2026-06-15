'use server'

import { revalidatePath } from "next/cache";
import { createServiceClient } from "../../../lib/supabase/server";
import { requirePlatformAdmin } from "../../../lib/platform/auth";
import { provisionVercelProjectDomain, verifyVercelProjectDomain } from "../../../lib/vercel-domains";
import { sendPharmacyInviteEmail } from "../../../lib/resend";
import { logPlatformEvent } from "../_lib/platform-data";

export async function updatePharmacyDomain(formData: FormData) {
  const profile = await requirePlatformAdmin();
  const tenantId = String(formData.get("tenant_id") ?? "");
  const customDomain = String(formData.get("custom_domain") ?? "").trim().toLowerCase();
  if (!tenantId || !customDomain) return;

  const supabaseAdmin = createServiceClient();
  const provisioning = await provisionVercelProjectDomain(customDomain);
  try {
    await (supabaseAdmin as any).from("pharmacy_profiles").upsert(
      {
        tenant_id: tenantId,
        custom_domain: customDomain,
        custom_domain_verified: provisioning.verified,
        custom_domain_verified_at: provisioning.verified ? new Date().toISOString() : null,
        vercel_domain_id: provisioning.vercelDomainId,
        domain_status: provisioning.status,
        domain_verification: provisioning.verification,
        domain_error: provisioning.error,
        domain_configured_at: new Date().toISOString(),
        last_domain_check_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id" }
    );
  } catch {}

  await logPlatformEvent({
    actorId: profile.id, action: "pharmacy.custom_domain_requested",
    entityType: "tenant", entityId: tenantId, tenantId,
    metadata: { custom_domain: customDomain, domain_status: provisioning.status },
  });
  revalidatePath("/platform/pharmacy-network");
}

export async function removePharmacyDomain(formData: FormData) {
  const profile = await requirePlatformAdmin();
  const tenantId = String(formData.get("tenant_id") ?? "");
  if (!tenantId) return;

  const supabaseAdmin = createServiceClient();
  await (supabaseAdmin as any).from("pharmacy_profiles")
    .update({
      custom_domain: null,
      custom_domain_verified: false,
      custom_domain_verified_at: null,
      vercel_domain_id: null,
      domain_status: null,
      domain_verification: null,
      domain_error: null,
      domain_configured_at: null,
      last_domain_check_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId);

  await logPlatformEvent({
    actorId: profile.id, action: "pharmacy.custom_domain_removed",
    entityType: "tenant", entityId: tenantId, tenantId,
  });
  revalidatePath("/platform/pharmacy-network");
}

export async function verifyPharmacyDomain(formData: FormData) {
  const profile = await requirePlatformAdmin();
  const tenantId = String(formData.get("tenant_id") ?? "");
  const customDomain = String(formData.get("custom_domain") ?? "").trim().toLowerCase();
  if (!tenantId || !customDomain) return;

  const verification = await verifyVercelProjectDomain(customDomain);
  const supabaseAdmin = createServiceClient();
  try {
    await (supabaseAdmin as any).from("pharmacy_profiles").upsert(
      {
        tenant_id: tenantId,
        custom_domain: customDomain,
        custom_domain_verified: verification.verified,
        custom_domain_verified_at: verification.verified ? new Date().toISOString() : null,
        vercel_domain_id: verification.vercelDomainId,
        domain_status: verification.status,
        domain_verification: verification.verification,
        domain_error: verification.error,
        last_domain_check_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id" }
    );
  } catch {}

  await logPlatformEvent({
    actorId: profile.id, action: "pharmacy.custom_domain_verified",
    entityType: "tenant", entityId: tenantId, tenantId,
    metadata: { custom_domain: customDomain, domain_status: verification.status },
  });
  revalidatePath("/platform/pharmacy-network");
}

export async function markMigrationReady(formData: FormData) {
  const profile = await requirePlatformAdmin();
  const tenantId = String(formData.get("tenant_id") ?? "");
  const source = String(formData.get("migration_source") ?? "csv_excel");
  if (!tenantId) return;

  const supabaseAdmin = createServiceClient();
  try {
    await (supabaseAdmin as any).from("pharmacy_profiles").upsert(
      { tenant_id: tenantId, migrated_from: source, migration_status: "ready_for_upload", updated_at: new Date().toISOString() },
      { onConflict: "tenant_id" }
    );
  } catch {}

  await logPlatformEvent({
    actorId: profile.id, action: "pharmacy.migration_ready",
    entityType: "tenant", entityId: tenantId, tenantId,
    metadata: { migration_source: source },
  });
  revalidatePath("/platform/pharmacy-network");
}

export async function forceInventorySync(formData: FormData) {
  const profile = await requirePlatformAdmin();
  const tenantId = String(formData.get("tenant_id") ?? "");
  if (!tenantId) return;

  const supabaseAdmin = createServiceClient();
  try {
    await (supabaseAdmin as any).from("pharmacy_network_inventory")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("pharmacy_tenant_id", tenantId);
  } catch {}

  await logPlatformEvent({
    actorId: profile.id, action: "pharmacy.inventory_sync_requested",
    entityType: "tenant", entityId: tenantId, tenantId,
  });
  revalidatePath("/platform/pharmacy-network");
}

export async function updatePharmacyDetails(formData: FormData) {
  const profile = await requirePlatformAdmin();
  const tenantId = String(formData.get("tenant_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const district = String(formData.get("district") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const plan = String(formData.get("plan") ?? "starter").trim();
  const networkListingName = String(formData.get("network_listing_name") ?? "").trim();
  const isNetworkMember = formData.get("is_network_member") === "on";
  const acceptsRefillRequests = formData.get("accepts_refill_requests") === "on";
  const deliveryAvailable = formData.get("delivery_available") === "on";
  if (!tenantId || !name) return;

  const supabaseAdmin = createServiceClient();
  await (supabaseAdmin as any).from("tenants").update({
    name, district: district || null, phone: phone || null,
    email: email || null, plan: plan || "starter",
    is_network_member: isNetworkMember, accepts_refill_requests: acceptsRefillRequests,
    network_listing_name: networkListingName || null, updated_at: new Date().toISOString(),
  }).eq("id", tenantId).eq("facility_type", "pharmacy");

  await (supabaseAdmin as any).from("pharmacy_profiles").upsert(
    {
      tenant_id: tenantId, pharmacy_name: name, district: district || null,
      contact_phone: phone || null, contact_email: email || null,
      is_network_visible: isNetworkMember, delivery_available: deliveryAvailable,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id" }
  );

  await logPlatformEvent({
    actorId: profile.id, action: "pharmacy.updated",
    entityType: "tenant", entityId: tenantId, tenantId,
    metadata: { name, plan, is_network_member: isNetworkMember },
  });
  revalidatePath("/platform/pharmacy-network");
}

export async function setPharmacyOperationalStatus(formData: FormData) {
  const profile = await requirePlatformAdmin();
  const tenantId = String(formData.get("tenant_id") ?? "");
  const nextStatus = String(formData.get("status") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!tenantId || !["active", "suspended"].includes(nextStatus)) return;

  const isActive = nextStatus === "active";
  const supabaseAdmin = createServiceClient();
  const tenantUpdate: Record<string, unknown> = {
    status: nextStatus, is_active: isActive, updated_at: new Date().toISOString(),
  };
  if (!isActive) { tenantUpdate.is_network_member = false; tenantUpdate.accepts_refill_requests = false; }

  await (supabaseAdmin as any).from("tenants").update(tenantUpdate).eq("id", tenantId).eq("facility_type", "pharmacy");

  if (!isActive) {
    await (supabaseAdmin as any).from("pharmacy_profiles").upsert(
      { tenant_id: tenantId, is_network_visible: false, delivery_available: false, updated_at: new Date().toISOString() },
      { onConflict: "tenant_id" }
    );
  }

  await logPlatformEvent({
    actorId: profile.id, action: isActive ? "pharmacy.reactivated" : "pharmacy.suspended",
    entityType: "tenant", entityId: tenantId, tenantId,
    metadata: { reason: reason || null },
  });
  revalidatePath("/platform/pharmacy-network");
}

export async function resendPharmacySetupInvite(formData: FormData) {
  const profile = await requirePlatformAdmin();
  const tenantId = String(formData.get("tenant_id") ?? "");
  if (!tenantId) return;

  const supabaseAdmin = createServiceClient();
  const { data: tenant } = await (supabaseAdmin as any).from("tenants")
    .select("name, email").eq("id", tenantId).eq("facility_type", "pharmacy").maybeSingle();
  if (!tenant) return;

  const { data: adminSettings } = await (supabaseAdmin as any).from("pharmacy_user_settings")
    .select("profile_id").eq("tenant_id", tenantId).eq("pharmacy_role", "pharmacy_admin")
    .eq("is_active", true).limit(1).maybeSingle();

  let adminEmail = tenant.email as string | null;
  let adminName = "Pharmacy Admin";
  if (adminSettings?.profile_id) {
    const { data: profileRow } = await (supabaseAdmin as any).from("profiles")
      .select("email, full_name").eq("id", adminSettings.profile_id).maybeSingle();
    adminEmail = profileRow?.email ?? adminEmail;
    adminName = profileRow?.full_name ?? adminName;
  }
  if (!adminEmail) return;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: onboarding } = await (supabaseAdmin as any).from("pharmacy_onboarding")
    .upsert(
      { tenant_id: tenantId, invite_sent_at: now.toISOString(), invite_expires_at: expiresAt, updated_at: now.toISOString() },
      { onConflict: "tenant_id" }
    ).select("invite_token").single();

  if (onboarding?.invite_token) {
    await sendPharmacyInviteEmail({ to: adminEmail, pharmacyName: tenant.name ?? "Your pharmacy", adminName, inviteToken: onboarding.invite_token });
  }

  await logPlatformEvent({
    actorId: profile.id, action: "pharmacy.invite_resent",
    entityType: "tenant", entityId: tenantId, tenantId,
    metadata: { admin_email: adminEmail },
  });
  revalidatePath("/platform/pharmacy-network");
}

export async function deletePharmacy(formData: FormData) {
  const profile = await requirePlatformAdmin();
  const tenantId = String(formData.get("tenant_id") ?? "");
  if (!tenantId) return;

  const db = createServiceClient() as any;

  // Verify it's a pharmacy before deleting
  const { data: tenant } = await db
    .from("tenants")
    .select("id, facility_type")
    .eq("id", tenantId)
    .eq("facility_type", "pharmacy")
    .maybeSingle();

  if (!tenant) return;

  // Delete child tables first (not all have ON DELETE CASCADE on tenants)
  await db.from("pharmacy_onboarding").delete().eq("tenant_id", tenantId);
  await db.from("pharmacy_profiles").delete().eq("tenant_id", tenantId);
  await db.from("pharmacy_user_settings").delete().eq("tenant_id", tenantId);
  await db.from("tenant_subscriptions").delete().eq("tenant_id", tenantId);
  // profiles cascade via ON DELETE CASCADE on tenant_id FK
  // Delete the tenant itself
  const { error } = await db
    .from("tenants")
    .delete()
    .eq("id", tenantId)
    .eq("facility_type", "pharmacy");

  if (error) {
    console.error("[deletePharmacy] failed:", error.message);
    throw new Error(`Could not delete pharmacy: ${error.message}`);
  }

  await logPlatformEvent({
    actorId: profile.id, action: "pharmacy.deleted",
    entityType: "tenant", entityId: tenantId, tenantId,
    metadata: { deleted_at: new Date().toISOString() },
  });
  revalidatePath("/platform/pharmacy-network");
}
