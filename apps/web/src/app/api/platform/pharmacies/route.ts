import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "../../../../lib/supabase/server";
import { logPlatformEvent } from "../../../platform/_lib/platform-data";

const PHARMACY_FEATURES = [
  "pharmacy_network",
  "in_app_orders",
  "prescription_fulfillment",
  "inventory_migration",
  "offline_first_pos",
  "sms_refill_reminders",
];

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48);
}

async function requirePlatformAdminId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const supabaseAdmin = createServiceClient();
  const { data: profile } = await (supabaseAdmin as any).from("profiles").select("role").eq("id", user.id).maybeSingle();
  return profile?.role === "platform_admin" ? user.id : null;
}

export async function GET(request: Request) {
  const slug = slugify(new URL(request.url).searchParams.get("slug") ?? "");
  if (!slug) {
    return NextResponse.json({ available: false }, { status: 400 });
  }

  const supabaseAdmin = createServiceClient();
  const { data } = await (supabaseAdmin as any).from("tenants").select("id").eq("slug", `pharm-${slug}`).maybeSingle();
  return NextResponse.json({ available: !data, defaultDomain: `pharm-${slug}.synapseos.tech` });
}

export async function POST(request: Request) {
  const actorId = await requirePlatformAdminId();
  if (!actorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const pharmacyName = String(body.pharmacyName ?? "").trim();
  const adminEmail = String(body.adminEmail ?? "").trim().toLowerCase();
  const slug = `pharm-${slugify(body.slug || pharmacyName)}`;

  if (!pharmacyName || !adminEmail || slug.length < 8) {
    return NextResponse.json({ error: "Pharmacy name, slug, and admin email are required." }, { status: 400 });
  }

  const tenantId = crypto.randomUUID();
  const supabaseAdmin = createServiceClient();
  const defaultDomain = `${slug}.synapseos.tech`;
  const customDomain = String(body.customDomain ?? "").trim().toLowerCase() || null;

  const { error: tenantError } = await (supabaseAdmin as any).from("tenants").insert({
    id: tenantId,
    slug,
    name: pharmacyName,
    custom_domain: customDomain,
    facility_type: "pharmacy",
    district: body.district || null,
    is_active: true,
    plan: body.plan || "starter",
    email: adminEmail,
    phone: body.contactPhone || null,
    address: body.physicalAddress || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (tenantError) {
    return NextResponse.json({ error: tenantError.message }, { status: 400 });
  }

  try {
    await (supabaseAdmin as any).from("pharmacy_profiles").insert({
      tenant_id: tenantId,
      pharmacy_name: pharmacyName,
      license_number: body.licenseNumber || null,
      license_expiry: body.licenseExpiry || null,
      district: body.district || null,
      physical_address: body.physicalAddress || null,
      contact_person: body.contactName || null,
      contact_phone: body.contactPhone || null,
      contact_email: adminEmail,
      custom_domain: customDomain,
      default_domain: defaultDomain,
      is_network_visible: Boolean(body.networkVisible ?? true),
      delivery_available: Boolean(body.deliveryAvailable),
      delivery_radius_km: Number(body.deliveryRadiusKm || 0) || null,
      migrated_from: body.migrationSource || "pending",
      migration_status: "ready",
      network_joined_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  } catch {}

  const features = new Set<string>(Array.isArray(body.modules) ? body.modules : PHARMACY_FEATURES);
  await (supabaseAdmin as any).from("feature_flags").upsert(
    Array.from(features).map((featureKey) => ({
      tenant_id: tenantId,
      feature_key: featureKey,
      is_enabled: true,
      enabled_by: actorId,
      enabled_at: new Date().toISOString(),
      notes: "Enabled during pharmacy onboarding.",
    })),
    { onConflict: "tenant_id,feature_key" }
  );

  const { data: adminUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
    email: adminEmail,
    email_confirm: true,
    user_metadata: {
      full_name: body.contactName || "Pharmacy Admin",
      pharmacy_name: pharmacyName,
    },
  });

  if (createUserError) {
    await logPlatformEvent({
      actorId,
      action: "pharmacy.onboarding_admin_user_failed",
      entityType: "tenant",
      entityId: tenantId,
      tenantId,
      metadata: { error: createUserError.message, admin_email: adminEmail },
    });
  } else {
    await (supabaseAdmin as any).from("profiles").insert({
      id: adminUser.user.id,
      role: "pharmacy_admin",
      tenant_id: tenantId,
      email: adminEmail,
      full_name: body.contactName || "Pharmacy Admin",
    });
  }

  await logPlatformEvent({
    actorId,
    action: "pharmacy.onboarded",
    entityType: "tenant",
    entityId: tenantId,
    tenantId,
    metadata: { default_domain: defaultDomain, custom_domain: customDomain, migration_source: body.migrationSource || "pending" },
  });

  return NextResponse.json({ id: tenantId, slug, defaultDomain, customDomain });
}
