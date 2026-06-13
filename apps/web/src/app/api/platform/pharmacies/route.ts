import { NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase/server";
import { getCurrentUser } from "../../../../lib/auth/getCurrentUser";
import { provisionVercelProjectDomain } from "../../../../lib/vercel-domains";
import { logPlatformEvent } from "../../../platform/_lib/platform-data";
import { sendPharmacyInviteEmail } from "../../../../lib/resend";

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

function pharmacyRouteForSlug(slug: string) {
  const tenantSlug = slug.replace(/^pharm-/, "");
  return `https://pharm.synapseos.tech/${tenantSlug}`;
}

async function insertTenantWithFallback(supabaseAdmin: ReturnType<typeof createServiceClient>, row: Record<string, unknown>) {
  const attempts = [
    row,
    {
      id: row.id,
      slug: row.slug,
      name: row.name,
      custom_domain: row.custom_domain,
      facility_type: row.facility_type,
      district: row.district,
      is_active: row.is_active,
      plan: row.plan,
      email: row.email,
      phone: row.phone,
    },
    {
      id: row.id,
      slug: row.slug,
      name: row.name,
      facility_type: row.facility_type,
    },
    {
      id: row.id,
      slug: row.slug,
      name: row.name,
    },
  ];

  let lastError: { message?: string } | null = null;
  for (const attempt of attempts) {
    const { error } = await (supabaseAdmin as any).from("tenants").insert(attempt);
    if (!error) return null;
    lastError = error;
  }
  return lastError;
}

export async function GET(request: Request) {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "platform_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slug = slugify(new URL(request.url).searchParams.get("slug") ?? "");
  if (!slug) {
    return NextResponse.json({ available: false }, { status: 400 });
  }

  const supabaseAdmin = createServiceClient();
  const tenantSlug = `pharm-${slug}`;
  const { data } = await (supabaseAdmin as any).from("tenants").select("id").eq("slug", tenantSlug).maybeSingle();
  return NextResponse.json({ available: !data, defaultDomain: pharmacyRouteForSlug(tenantSlug) });
}

export async function POST(request: Request) {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "platform_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const actorId = actor.id;

  const body = await request.json();
  const pharmacyName = String(body.pharmacyName ?? "").trim();
  const adminEmail = String(body.adminEmail ?? "").trim().toLowerCase();
  const slug = `pharm-${slugify(body.slug || pharmacyName)}`;

  if (!pharmacyName || !adminEmail || slug.length < 8) {
    return NextResponse.json({ error: "Pharmacy name, slug, and admin email are required." }, { status: 400 });
  }

  const tenantId = crypto.randomUUID();
  const supabaseAdmin = createServiceClient();
  const defaultDomain = pharmacyRouteForSlug(slug);
  const customDomain = String(body.customDomain ?? "").trim().toLowerCase() || null;
  const domainProvisioning = customDomain ? await provisionVercelProjectDomain(customDomain) : null;

  const tenantError = await insertTenantWithFallback(supabaseAdmin, {
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
    default_subdomain: slug,
    modules_enabled: Array.isArray(body.modules) && body.modules.length > 0 ? body.modules : ["inventory", "dispensing", "network", "staff", "reports"],
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
      custom_domain_verified: Boolean(domainProvisioning?.verified),
      custom_domain_verified_at: domainProvisioning?.verified ? new Date().toISOString() : null,
      vercel_domain_id: domainProvisioning?.vercelDomainId ?? null,
      domain_status: domainProvisioning?.status ?? "default",
      domain_verification: domainProvisioning?.verification ?? null,
      domain_error: domainProvisioning?.error ?? null,
      domain_configured_at: customDomain ? new Date().toISOString() : null,
      last_domain_check_at: customDomain ? new Date().toISOString() : null,
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

  try {
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
  } catch {}

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
    const fullName = body.contactName || "Pharmacy Admin";
    const [firstName, ...restName] = fullName.split(" ");
    // The handle_new_user() trigger already created the profile row on auth.users insert.
    // We only need to UPDATE it with tenant_id and role — INSERT would duplicate-key error.
    await (supabaseAdmin as any)
      .from("profiles")
      .update({
        tenant_id: tenantId,
        role: "pharmacy_admin",
        full_name: fullName,
        first_name: firstName || "Pharmacy",
        last_name: restName.join(" ") || "Admin",
        email: adminEmail,
      })
      .eq("id", adminUser.user.id);
  }

  // Create pharmacy_user_settings for the admin user (required for role checks in pharmacy app)
  if (adminUser?.user?.id) {
    try {
      await (supabaseAdmin as any)
        .from("pharmacy_user_settings")
        .upsert(
          {
            tenant_id: tenantId,
            profile_id: adminUser.user.id,
            pharmacy_role: "pharmacy_admin",
            permissions: [],
            is_active: true,
            must_change_password: true,
            created_by: actorId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "tenant_id,profile_id" }
        );
    } catch {}
  }

  // Create pharmacy_onboarding record — generates invite_token automatically
  let inviteToken: string | null = null;
  try {
    const { data: onboarding } = await (supabaseAdmin as any)
      .from("pharmacy_onboarding")
      .upsert(
        {
          tenant_id: tenantId,
          current_step: 0,
          enrolled_by: actorId,
          invite_sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id" }
      )
      .select("invite_token")
      .single();
    inviteToken = onboarding?.invite_token ?? null;
  } catch {}

  // Send invite email to the pharmacy admin
  if (inviteToken) {
    try {
      await sendPharmacyInviteEmail({
        to: adminEmail,
        pharmacyName,
        adminName: body.contactName || "Pharmacy Admin",
        inviteToken,
      });
    } catch (emailErr) {
      // Log but don't fail the enrollment if email sending fails
      await logPlatformEvent({
        actorId,
        action: "pharmacy.invite_email_failed",
        entityType: "tenant",
        entityId: tenantId,
        tenantId,
        metadata: { error: String(emailErr), admin_email: adminEmail },
      });
    }
  }

  await logPlatformEvent({
    actorId,
    action: "pharmacy.onboarded",
    entityType: "tenant",
    entityId: tenantId,
    tenantId,
    metadata: {
      default_domain: defaultDomain,
      custom_domain: customDomain,
      domain_status: domainProvisioning?.status ?? "default",
      domain_error: domainProvisioning?.error ?? null,
      migration_source: body.migrationSource || "pending",
      invite_email_sent: Boolean(inviteToken),
    },
  });

  return NextResponse.json({ id: tenantId, slug, defaultDomain, customDomain, domainProvisioning, inviteEmailSent: Boolean(inviteToken) });
}
