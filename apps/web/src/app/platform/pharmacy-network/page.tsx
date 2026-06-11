export const dynamic = "force-dynamic";

import Link from "next/link";
import { Fragment } from "react";
import { revalidatePath } from "next/cache";
import { Download, Globe2, Mail, MapPinned, Pill, Power, RefreshCcw, Save, UploadCloud } from "lucide-react";
import { createServiceClient } from "../../../lib/supabase/server";
import { requirePlatformAdmin } from "../../../lib/platform/auth";
import { provisionVercelProjectDomain, verifyVercelProjectDomain } from "../../../lib/vercel-domains";
import { sendPharmacyInviteEmail } from "../../../lib/resend";
import { formatDateTime, logPlatformEvent, safeCount, safeRows } from "../_lib/platform-data";

type PharmacyRow = {
  id?: string;
  name?: string | null;
  slug?: string | null;
  facility_type?: string | null;
  district?: string | null;
  email?: string | null;
  phone?: string | null;
  plan?: string | null;
  status?: string | null;
  is_active?: boolean | null;
  is_network_member?: boolean | null;
  accepts_refill_requests?: boolean | null;
  network_listing_name?: string | null;
  updated_at?: string | null;
};

type PharmacyProfileRow = {
  tenant_id?: string | null;
  custom_domain?: string | null;
  custom_domain_verified?: boolean | null;
  default_domain?: string | null;
  domain_status?: string | null;
  domain_error?: string | null;
  domain_verification?: unknown[] | null;
  migrated_from?: string | null;
  migration_status?: string | null;
  migration_completed_at?: string | null;
  is_network_visible?: boolean | null;
  delivery_available?: boolean | null;
  contact_person?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
};

type InventoryRow = {
  id?: string;
  pharmacy_tenant_id?: string | null;
  drug_name?: string | null;
  generic_name?: string | null;
  dosage_form?: string | null;
  strength?: string | null;
  quantity_in_stock?: number | null;
  last_synced_at?: string | null;
};

type OnboardingRow = {
  tenant_id?: string | null;
  current_step?: number | null;
  invite_token?: string | null;
  invite_sent_at?: string | null;
  invite_expires_at?: string | null;
};

async function updatePharmacyDomain(formData: FormData) {
  "use server";
  const profile = await requirePlatformAdmin();
  const tenantId = String(formData.get("tenant_id") ?? "");
  const customDomain = String(formData.get("custom_domain") ?? "").trim().toLowerCase();
  if (!tenantId || !customDomain) return;

  const supabaseAdmin = createServiceClient();
  const provisioning = await provisionVercelProjectDomain(customDomain);
  try {
    await (supabaseAdmin as any)
      .from("pharmacy_profiles")
      .upsert(
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
    actorId: profile.id,
    action: "pharmacy.custom_domain_requested",
    entityType: "tenant",
    entityId: tenantId,
    tenantId,
    metadata: {
      custom_domain: customDomain,
      domain_status: provisioning.status,
      domain_error: provisioning.error,
      dns_instruction: `Add TXT record _synapse.${customDomain} with value synapse-domain-verification=${tenantId.slice(0, 8)}`,
    },
  });
  revalidatePath("/platform/pharmacy-network");
}

async function verifyPharmacyDomain(formData: FormData) {
  "use server";
  const profile = await requirePlatformAdmin();
  const tenantId = String(formData.get("tenant_id") ?? "");
  const customDomain = String(formData.get("custom_domain") ?? "").trim().toLowerCase();
  if (!tenantId || !customDomain) return;

  const verification = await verifyVercelProjectDomain(customDomain);
  const supabaseAdmin = createServiceClient();
  try {
    await (supabaseAdmin as any)
      .from("pharmacy_profiles")
      .upsert(
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
    actorId: profile.id,
    action: "pharmacy.custom_domain_verified",
    entityType: "tenant",
    entityId: tenantId,
    tenantId,
    metadata: { custom_domain: customDomain, domain_status: verification.status, domain_error: verification.error },
  });
  revalidatePath("/platform/pharmacy-network");
}

async function markMigrationReady(formData: FormData) {
  "use server";
  const profile = await requirePlatformAdmin();
  const tenantId = String(formData.get("tenant_id") ?? "");
  const source = String(formData.get("migration_source") ?? "csv_excel");
  if (!tenantId) return;

  const supabaseAdmin = createServiceClient();
  try {
    await (supabaseAdmin as any)
      .from("pharmacy_profiles")
      .upsert(
        {
          tenant_id: tenantId,
          migrated_from: source,
          migration_status: "ready_for_upload",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id" }
      );
  } catch {}

  await logPlatformEvent({
    actorId: profile.id,
    action: "pharmacy.migration_ready",
    entityType: "tenant",
    entityId: tenantId,
    tenantId,
    metadata: { migration_source: source },
  });
  revalidatePath("/platform/pharmacy-network");
}

async function forceInventorySync(formData: FormData) {
  "use server";
  const profile = await requirePlatformAdmin();
  const tenantId = String(formData.get("tenant_id") ?? "");
  if (!tenantId) return;

  const supabaseAdmin = createServiceClient();
  try {
    await (supabaseAdmin as any)
      .from("pharmacy_network_inventory")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("pharmacy_tenant_id", tenantId);
  } catch {}

  await logPlatformEvent({
    actorId: profile.id,
    action: "pharmacy.inventory_sync_requested",
    entityType: "tenant",
    entityId: tenantId,
    tenantId,
  });
  revalidatePath("/platform/pharmacy-network");
}

async function updatePharmacyDetails(formData: FormData) {
  "use server";
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
  await (supabaseAdmin as any)
    .from("tenants")
    .update({
      name,
      district: district || null,
      phone: phone || null,
      email: email || null,
      plan: plan || "starter",
      is_network_member: isNetworkMember,
      accepts_refill_requests: acceptsRefillRequests,
      network_listing_name: networkListingName || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tenantId)
    .eq("facility_type", "pharmacy");

  await (supabaseAdmin as any)
    .from("pharmacy_profiles")
    .upsert(
      {
        tenant_id: tenantId,
        pharmacy_name: name,
        district: district || null,
        contact_phone: phone || null,
        contact_email: email || null,
        is_network_visible: isNetworkMember,
        delivery_available: deliveryAvailable,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id" }
    );

  await logPlatformEvent({
    actorId: profile.id,
    action: "pharmacy.updated",
    entityType: "tenant",
    entityId: tenantId,
    tenantId,
    metadata: {
      name,
      plan,
      is_network_member: isNetworkMember,
      accepts_refill_requests: acceptsRefillRequests,
      delivery_available: deliveryAvailable,
    },
  });

  revalidatePath("/platform/pharmacy-network");
}

async function setPharmacyOperationalStatus(formData: FormData) {
  "use server";
  const profile = await requirePlatformAdmin();
  const tenantId = String(formData.get("tenant_id") ?? "");
  const nextStatus = String(formData.get("status") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!tenantId || !["active", "suspended"].includes(nextStatus)) return;

  const isActive = nextStatus === "active";
  const supabaseAdmin = createServiceClient();
  const tenantUpdate: Record<string, unknown> = {
    status: nextStatus,
    is_active: isActive,
    updated_at: new Date().toISOString(),
  };

  if (!isActive) {
    tenantUpdate.is_network_member = false;
    tenantUpdate.accepts_refill_requests = false;
  }

  await (supabaseAdmin as any)
    .from("tenants")
    .update(tenantUpdate)
    .eq("id", tenantId)
    .eq("facility_type", "pharmacy");

  if (!isActive) {
    await (supabaseAdmin as any)
      .from("pharmacy_profiles")
      .upsert(
        {
          tenant_id: tenantId,
          is_network_visible: false,
          delivery_available: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id" }
      );
  }

  await logPlatformEvent({
    actorId: profile.id,
    action: isActive ? "pharmacy.reactivated" : "pharmacy.suspended",
    entityType: "tenant",
    entityId: tenantId,
    tenantId,
    metadata: { reason: reason || null },
  });

  revalidatePath("/platform/pharmacy-network");
}

async function resendPharmacySetupInvite(formData: FormData) {
  "use server";
  const profile = await requirePlatformAdmin();
  const tenantId = String(formData.get("tenant_id") ?? "");
  if (!tenantId) return;

  const supabaseAdmin = createServiceClient();
  const { data: tenant } = await (supabaseAdmin as any)
    .from("tenants")
    .select("name, email")
    .eq("id", tenantId)
    .eq("facility_type", "pharmacy")
    .maybeSingle();

  if (!tenant) return;

  const { data: adminSettings } = await (supabaseAdmin as any)
    .from("pharmacy_user_settings")
    .select("profile_id")
    .eq("tenant_id", tenantId)
    .eq("pharmacy_role", "pharmacy_admin")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  let adminEmail = tenant.email as string | null;
  let adminName = "Pharmacy Admin";
  if (adminSettings?.profile_id) {
    const { data: profileRow } = await (supabaseAdmin as any)
      .from("profiles")
      .select("email, full_name")
      .eq("id", adminSettings.profile_id)
      .maybeSingle();
    adminEmail = profileRow?.email ?? adminEmail;
    adminName = profileRow?.full_name ?? adminName;
  }

  if (!adminEmail) return;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: onboarding } = await (supabaseAdmin as any)
    .from("pharmacy_onboarding")
    .upsert(
      {
        tenant_id: tenantId,
        invite_sent_at: now.toISOString(),
        invite_expires_at: expiresAt,
        updated_at: now.toISOString(),
      },
      { onConflict: "tenant_id" }
    )
    .select("invite_token")
    .single();

  if (onboarding?.invite_token) {
    await sendPharmacyInviteEmail({
      to: adminEmail,
      pharmacyName: tenant.name ?? "Your pharmacy",
      adminName,
      inviteToken: onboarding.invite_token,
    });
  }

  await logPlatformEvent({
    actorId: profile.id,
    action: "pharmacy.invite_resent",
    entityType: "tenant",
    entityId: tenantId,
    tenantId,
    metadata: { admin_email: adminEmail },
  });

  revalidatePath("/platform/pharmacy-network");
}

function pharmacyRouteForSlug(slug?: string | null) {
  const cleanSlug = (slug || "pharmacy").replace(/^pharm-/, "");
  return `https://pharm.synapseos.tech/${cleanSlug}`;
}

export default async function PharmacyNetworkPage() {
  await requirePlatformAdmin();

  const [pharmacies, profiles, inventory, syncedRecently, onboardingRows] = await Promise.all([
    safeRows<PharmacyRow>("tenants", "id, name, slug, facility_type, district, email, phone, plan, status, is_active, is_network_member, accepts_refill_requests, network_listing_name, updated_at", {
      filters: [["facility_type", "pharmacy"]],
      orderBy: "updated_at",
      limit: 200,
    }),
    safeRows<PharmacyProfileRow>(
      "pharmacy_profiles",
      "tenant_id, custom_domain, custom_domain_verified, default_domain, domain_status, domain_error, domain_verification, migrated_from, migration_status, migration_completed_at, is_network_visible, delivery_available, contact_person, contact_phone, contact_email",
      { limit: 1000 }
    ),
    safeRows<InventoryRow>(
      "pharmacy_network_inventory",
      "id, pharmacy_tenant_id, drug_name, generic_name, dosage_form, strength, quantity_in_stock, last_synced_at",
      { orderBy: "last_synced_at", limit: 200 }
    ),
    safeCount("pharmacy_network_inventory"),
    safeRows<OnboardingRow>(
      "pharmacy_onboarding",
      "tenant_id, current_step, invite_token, invite_sent_at, invite_expires_at",
      { limit: 1000 }
    ),
  ]);

  const inventoryByPharmacy = new Map<string, InventoryRow[]>();
  const profileByTenant = new Map(profiles.map((profile) => [profile.tenant_id, profile]));
  const onboardingByTenant = new Map(onboardingRows.map((row) => [row.tenant_id, row]));
  for (const item of inventory) {
    const key = item.pharmacy_tenant_id ?? "unknown";
    inventoryByPharmacy.set(key, [...(inventoryByPharmacy.get(key) ?? []), item]);
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#E8B84B]">Synapse Pharm Network</p>
          <h1 className="mt-2 text-2xl font-bold">Pharmacy Network Monitor</h1>
          <p className="mt-1 text-sm text-slate-400">Monitor standalone pharmacies, inventory sync health, and network-wide drug availability.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/platform/pharmacies/onboard" className="inline-flex items-center gap-2 rounded-xl bg-[#F97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#EA6C0A]">
            <UploadCloud className="h-4 w-4" />
            Onboard pharmacy
          </Link>
          <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-[#E8B84B]/30 bg-[#E8B84B]/10 px-4 py-2 text-sm font-semibold text-[#E8B84B]">
            <Download className="h-4 w-4" />
            Export inventory
          </button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Pharmacies", pharmacies.length],
          ["Network drug rows", inventory.length],
          ["Synced rows", syncedRecently],
          ["Visible to patients", profiles.filter((profile) => profile.is_network_visible !== false).length],
        ].map(([label, value]) => (
          <article key={String(label)} className="rounded-xl border border-slate-800 bg-[#111117] p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-[#F97316]">{Number(value).toLocaleString()}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <article className="overflow-hidden rounded-xl border border-slate-800 bg-[#111117]">
          <div className="flex items-center justify-between border-b border-slate-800 p-4">
            <h2 className="text-sm font-semibold">Connected Pharmacies</h2>
            <MapPinned className="h-4 w-4 text-[#E8B84B]" />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[#07070A] text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Pharmacy</th>
                  <th className="px-4 py-3">District</th>
                  <th className="px-4 py-3">Domain</th>
                  <th className="px-4 py-3">Drug rows</th>
                  <th className="px-4 py-3">Last sync</th>
                  <th className="px-4 py-3">Migration</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {pharmacies.map((pharmacy) => {
                  const rows = inventoryByPharmacy.get(pharmacy.id ?? "") ?? [];
                  const pharmacyProfile = profileByTenant.get(pharmacy.id ?? "");
                  const onboarding = onboardingByTenant.get(pharmacy.id ?? "");
                  const latestSync = rows[0]?.last_synced_at ?? pharmacy.updated_at;
                  const defaultDomain = pharmacyProfile?.default_domain ?? pharmacyRouteForSlug(pharmacy.slug ?? pharmacy.id);
                  const customDomain = pharmacyProfile?.custom_domain;
                  const isActive = pharmacy.is_active !== false && pharmacy.status !== "suspended";
                  const domainStatus = customDomain
                    ? pharmacyProfile?.custom_domain_verified
                      ? "verified custom"
                      : pharmacyProfile?.domain_status?.replace(/_/g, " ") ?? "DNS pending"
                    : "default route";
                  return (
                    <Fragment key={pharmacy.id ?? pharmacy.name ?? defaultDomain}>
                      <tr>
                        <td className="px-4 py-3 font-medium text-slate-100">{pharmacy.name ?? "Unnamed pharmacy"}</td>
                        <td className="px-4 py-3 text-slate-400">{pharmacy.district ?? "Unknown"}</td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <p className="font-mono text-xs text-[#E8B84B]">{customDomain || defaultDomain}</p>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] ${pharmacyProfile?.custom_domain_verified ? "border-green-500/25 bg-green-500/10 text-green-300" : "border-slate-700 bg-slate-800 text-slate-400"}`}>
                              {domainStatus}
                            </span>
                            {pharmacyProfile?.domain_error ? <p className="max-w-56 text-[11px] text-red-300">{pharmacyProfile.domain_error}</p> : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-300">{rows.length}</td>
                        <td className="px-4 py-3 text-slate-500">{formatDateTime(latestSync)}</td>
                        <td className="px-4 py-3">
                          <p className="text-xs text-slate-300">{pharmacyProfile?.migration_status ?? "not started"}</p>
                          <p className="mt-1 text-[11px] text-slate-500">{pharmacyProfile?.migrated_from ?? "source pending"}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <span className={`rounded-full border px-2 py-0.5 text-xs ${isActive ? "border-green-500/25 bg-green-500/10 text-green-300" : "border-red-500/25 bg-red-500/10 text-red-300"}`}>
                              {isActive ? pharmacy.status ?? "active" : "suspended"}
                            </span>
                            <p className="text-[11px] text-slate-500">{rows.length > 0 ? "synced" : "waiting"}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex min-w-64 flex-wrap gap-2">
                            <form action={forceInventorySync}>
                              <input type="hidden" name="tenant_id" value={pharmacy.id ?? ""} />
                              <button type="submit" className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300">
                                <RefreshCcw className="h-3 w-3" />
                                Force sync
                              </button>
                            </form>
                            <form action={resendPharmacySetupInvite}>
                              <input type="hidden" name="tenant_id" value={pharmacy.id ?? ""} />
                              <button type="submit" className="inline-flex items-center gap-1 rounded-lg border border-[#E8B84B]/30 px-2 py-1 text-xs text-[#E8B84B]">
                                <Mail className="h-3 w-3" />
                                Resend invite
                              </button>
                            </form>
                            <form action={setPharmacyOperationalStatus}>
                              <input type="hidden" name="tenant_id" value={pharmacy.id ?? ""} />
                              <input type="hidden" name="status" value={isActive ? "suspended" : "active"} />
                              <input type="hidden" name="reason" value={isActive ? "Platform admin suspended pharmacy" : "Platform admin reactivated pharmacy"} />
                              <button type="submit" className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs ${isActive ? "border-red-500/30 text-red-300" : "border-green-500/30 text-green-300"}`}>
                                <Power className="h-3 w-3" />
                                {isActive ? "Suspend" : "Reactivate"}
                              </button>
                            </form>
                          </div>
                        </td>
                      </tr>
                      <tr className="bg-[#07070A]/55">
                        <td colSpan={8} className="px-4 py-4">
                          <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr_1fr]">
                            <form action={updatePharmacyDetails} className="grid gap-3 rounded-xl border border-slate-800 bg-[#0B0B10] p-3 md:grid-cols-2">
                              <input type="hidden" name="tenant_id" value={pharmacy.id ?? ""} />
                              <label className="space-y-1">
                                <span className="text-[10px] uppercase tracking-wide text-slate-500">Name</span>
                                <input name="name" defaultValue={pharmacy.name ?? ""} className="w-full rounded-lg border border-slate-700 bg-[#07070A] px-2 py-1.5 text-xs text-slate-200" />
                              </label>
                              <label className="space-y-1">
                                <span className="text-[10px] uppercase tracking-wide text-slate-500">Plan</span>
                                <select name="plan" defaultValue={pharmacy.plan ?? "starter"} className="w-full rounded-lg border border-slate-700 bg-[#07070A] px-2 py-1.5 text-xs text-slate-200">
                                  <option value="trial">trial</option>
                                  <option value="starter">starter</option>
                                  <option value="professional">professional</option>
                                  <option value="enterprise">enterprise</option>
                                </select>
                              </label>
                              <label className="space-y-1">
                                <span className="text-[10px] uppercase tracking-wide text-slate-500">District</span>
                                <input name="district" defaultValue={pharmacy.district ?? ""} className="w-full rounded-lg border border-slate-700 bg-[#07070A] px-2 py-1.5 text-xs text-slate-200" />
                              </label>
                              <label className="space-y-1">
                                <span className="text-[10px] uppercase tracking-wide text-slate-500">Phone</span>
                                <input name="phone" defaultValue={pharmacyProfile?.contact_phone ?? pharmacy.phone ?? ""} className="w-full rounded-lg border border-slate-700 bg-[#07070A] px-2 py-1.5 text-xs text-slate-200" />
                              </label>
                              <label className="space-y-1">
                                <span className="text-[10px] uppercase tracking-wide text-slate-500">Email</span>
                                <input name="email" defaultValue={pharmacyProfile?.contact_email ?? pharmacy.email ?? ""} className="w-full rounded-lg border border-slate-700 bg-[#07070A] px-2 py-1.5 text-xs text-slate-200" />
                              </label>
                              <label className="space-y-1">
                                <span className="text-[10px] uppercase tracking-wide text-slate-500">Network name</span>
                                <input name="network_listing_name" defaultValue={pharmacy.network_listing_name ?? pharmacy.name ?? ""} className="w-full rounded-lg border border-slate-700 bg-[#07070A] px-2 py-1.5 text-xs text-slate-200" />
                              </label>
                              <label className="flex items-center gap-2 text-xs text-slate-300">
                                <input name="is_network_member" type="checkbox" defaultChecked={Boolean(pharmacy.is_network_member || pharmacyProfile?.is_network_visible)} className="accent-[#F97316]" />
                                Patient network
                              </label>
                              <label className="flex items-center gap-2 text-xs text-slate-300">
                                <input name="accepts_refill_requests" type="checkbox" defaultChecked={Boolean(pharmacy.accepts_refill_requests)} className="accent-[#F97316]" />
                                Refill requests
                              </label>
                              <label className="flex items-center gap-2 text-xs text-slate-300">
                                <input name="delivery_available" type="checkbox" defaultChecked={Boolean(pharmacyProfile?.delivery_available)} className="accent-[#F97316]" />
                                Delivery
                              </label>
                              <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#F97316] px-3 py-2 text-xs font-semibold text-white md:col-span-2">
                                <Save className="h-3.5 w-3.5" />
                                Save pharmacy
                              </button>
                            </form>

                            <div className="space-y-3 rounded-xl border border-slate-800 bg-[#0B0B10] p-3">
                              <form action={markMigrationReady} className="flex flex-wrap gap-2">
                                <input type="hidden" name="tenant_id" value={pharmacy.id ?? ""} />
                                <select name="migration_source" defaultValue={pharmacyProfile?.migrated_from ?? "csv_excel"} className="rounded-lg border border-slate-700 bg-[#07070A] px-2 py-1.5 text-xs text-slate-300">
                                  <option value="csv_excel">CSV/Excel</option>
                                  <option value="quickbooks">QuickBooks</option>
                                  <option value="legacy_system">Legacy system</option>
                                  <option value="manual">Manual</option>
                                </select>
                                <button type="submit" className="rounded-lg border border-[#E8B84B]/30 px-2 py-1.5 text-xs text-[#E8B84B]">Migration ready</button>
                              </form>
                              <div className="text-xs text-slate-500">
                                <p>Onboarding step: <span className="text-slate-300">{onboarding?.current_step ?? "not started"}</span></p>
                                <p>Invite sent: <span className="text-slate-300">{formatDateTime(onboarding?.invite_sent_at)}</span></p>
                                <p>Invite expires: <span className="text-slate-300">{formatDateTime(onboarding?.invite_expires_at)}</span></p>
                              </div>
                            </div>

                            <div className="space-y-3 rounded-xl border border-slate-800 bg-[#0B0B10] p-3">
                              <form action={updatePharmacyDomain} className="flex flex-wrap gap-2">
                                <input type="hidden" name="tenant_id" value={pharmacy.id ?? ""} />
                                <input name="custom_domain" placeholder="rx.example.ug" defaultValue={customDomain ?? ""} className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-[#07070A] px-2 py-1.5 text-xs text-slate-300" />
                                <button type="submit" className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1.5 text-xs text-slate-300">
                                  <Globe2 className="h-3 w-3" />
                                  Domain
                                </button>
                              </form>
                              {customDomain ? (
                                <form action={verifyPharmacyDomain}>
                                  <input type="hidden" name="tenant_id" value={pharmacy.id ?? ""} />
                                  <input type="hidden" name="custom_domain" value={customDomain} />
                                  <button type="submit" className="inline-flex items-center gap-1 rounded-lg border border-green-500/30 px-2 py-1.5 text-xs text-green-300">
                                    <Globe2 className="h-3 w-3" />
                                    Verify custom domain
                                  </button>
                                </form>
                              ) : null}
                            </div>
                          </div>
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
                {pharmacies.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">No pharmacy tenants found.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>

        <aside className="rounded-xl border border-slate-800 bg-[#111117] p-4">
          <div className="mb-3 flex items-center gap-2">
            <Pill className="h-4 w-4 text-[#E8B84B]" />
            <h2 className="text-sm font-semibold">Recent Inventory Rows</h2>
          </div>
          <div className="space-y-2">
            {inventory.length === 0 ? <p className="rounded-lg border border-slate-800 bg-[#07070A] p-4 text-sm text-slate-500">No network inventory yet.</p> : null}
            {inventory.slice(0, 12).map((item) => (
              <div key={item.id ?? item.drug_name ?? crypto.randomUUID()} className="rounded-lg border border-slate-800 bg-[#07070A] p-3">
                <p className="text-sm font-semibold text-slate-100">{item.drug_name ?? "Unnamed drug"}</p>
                <p className="mt-1 text-xs text-slate-500">{item.generic_name ?? "Generic not set"} · {item.strength ?? "strength n/a"}</p>
                <p className="mt-1 text-xs text-[#E8B84B]">{Number(item.quantity_in_stock ?? 0).toLocaleString()} in stock</p>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
}
