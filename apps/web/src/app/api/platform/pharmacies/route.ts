import { NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase/server";
import { requirePlatformAdminApi } from "../../../../lib/platform/auth";
import { provisionVercelProjectDomain } from "../../../../lib/vercel-domains";
import { logPlatformEvent } from "../../../platform/_lib/platform-data";
import { sendPharmacyCredentialsEmail } from "../../../../lib/resend";
import { hashPassword } from "@synapse/auth";

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
      is_active: row.is_active ?? true,
      status: row.status ?? "active",
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
  const auth = await requirePlatformAdminApi();
  if (!auth.ok) return auth.response;

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
  const auth = await requirePlatformAdminApi();
  if (!auth.ok) return auth.response;
  const actor = auth.profile;
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
    status: "active",
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

  // Create a default trial subscription so the tenant is entitled on day one.
  // Without a tenant_subscriptions row, has_feature() returns false and POS/admin
  // APIs respond 402. Map the platform plan choice to a pharmacy plan slug.
  try {
    const planSlugMap: Record<string, string> = {
      trial: "pharmacy_starter",
      starter: "pharmacy_starter",
      professional: "pharmacy_growth",
      enterprise: "pharmacy_multi_branch",
    };
    const targetPlanSlug = planSlugMap[String(body.plan ?? "starter")] ?? "pharmacy_starter";

    let { data: planRow } = await (supabaseAdmin as any)
      .from("subscription_plans")
      .select("id")
      .eq("slug", targetPlanSlug)
      .eq("is_active", true)
      .maybeSingle();

    // Fallback: any active pharmacy plan if the mapped slug is missing on this env.
    if (!planRow) {
      const { data: anyPharmacyPlan } = await (supabaseAdmin as any)
        .from("subscription_plans")
        .select("id")
        .eq("facility_type", "pharmacy")
        .eq("is_active", true)
        .order("price_ugx", { ascending: true })
        .limit(1)
        .maybeSingle();
      planRow = anyPharmacyPlan ?? null;
    }

    if (planRow?.id) {
      const now = new Date();
      const trialEnd = new Date(now);
      trialEnd.setDate(trialEnd.getDate() + 14);
      await (supabaseAdmin as any)
        .from("tenant_subscriptions")
        .upsert(
          {
            tenant_id: tenantId,
            plan_id: planRow.id,
            status: "trialing",
            starts_at: now.toISOString(),
            trial_ends: trialEnd.toISOString(),
            current_period_start: now.toISOString(),
            current_period_end: trialEnd.toISOString(),
          },
          { onConflict: "tenant_id" }
        );
    }
  } catch {}

  // Ensure at least one active store exists so POS never 422s with NO_STORE.
  try {
    const { data: existingStore } = await (supabaseAdmin as any)
      .from("pharmacy_stores")
      .select("id")
      .eq("tenant_id", tenantId)
      .limit(1)
      .maybeSingle();
    if (!existingStore) {
      await (supabaseAdmin as any).from("pharmacy_stores").insert({
        tenant_id: tenantId,
        name: `${pharmacyName} — Main Branch`,
        store_type: "main",
        is_active: true,
      });
    }
  } catch {}

  // Use admin-supplied temp password or auto-generate one with a CSPRNG (~107 bits entropy).
  const rawTempPassword = String(body.tempPassword ?? "").trim();
  const tempPassword = rawTempPassword.length >= 8
    ? rawTempPassword
    : Array.from(crypto.getRandomValues(new Uint8Array(18)))
        .map(b => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[b % 62])
        .join('');
  const tempPasswordHash = await hashPassword(tempPassword);

  const adminFullName = (body.contactName || "Pharmacy Admin") as string;
  const adminNameParts = adminFullName.split(" ");
  const adminFirstName = adminNameParts[0] ?? "Pharmacy";
  const adminLastName = adminNameParts.slice(1).join(" ") || "Admin";

  // Check for duplicate email before inserting
  const { data: existingProfile } = await (supabaseAdmin as any)
    .from("profiles")
    .select("id")
    .eq("email", adminEmail)
    .maybeSingle();

  if (existingProfile) {
    return NextResponse.json(
      { error: `The email ${adminEmail} is already registered in Synapse. Use a different email address for this pharmacy admin.` },
      { status: 409 }
    );
  }

  // Create the pharmacy admin profile directly with the temp password
  const adminProfileId_gen = crypto.randomUUID();
  let adminProfileId: string | null = null;
  const { data: newProfile, error: profileInsertErr } = await (supabaseAdmin as any)
    .from("profiles")
    .insert({
      id: adminProfileId_gen,
      email: adminEmail,
      full_name: adminFullName,
      first_name: adminFirstName,
      last_name: adminLastName || "Admin",
      role: "pharmacy_admin",
      tenant_id: tenantId,
      is_admin: true,
      password_hash: tempPasswordHash,
      must_change_password: true,
      email_verified_at: new Date().toISOString(),
      verification_status: "verified",
    })
    .select("id")
    .single();

  if (profileInsertErr) {
    await logPlatformEvent({
      actorId,
      action: "pharmacy.admin_profile_failed",
      entityType: "tenant",
      entityId: tenantId,
      tenantId,
      metadata: { error: profileInsertErr.message, admin_email: adminEmail },
    });
  } else {
    adminProfileId = newProfile?.id ?? null;
  }

  // Create pharmacy_user_settings linking the admin to this tenant
  if (adminProfileId) {
    try {
      await (supabaseAdmin as any).from("pharmacy_user_settings").insert({
        profile_id: adminProfileId,
        tenant_id: tenantId,
        pharmacy_role: "pharmacy_admin",
        permissions: [],
        is_active: true,
        must_change_password: true,
        created_by: actorId,
      });
    } catch {}
  }

  // Record onboarding state (step 1 = account exists)
  try {
    await (supabaseAdmin as any)
      .from("pharmacy_onboarding")
      .upsert(
        {
          tenant_id: tenantId,
          admin_email: adminEmail,
          admin_name: adminFullName,
          current_step: 1,
          enrolled_by: actorId,
          account_created_at: new Date().toISOString(),
          invite_sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id" }
      );
  } catch {}

  // Email credentials to the pharmacy admin
  let credentialsSent = false;
  try {
    await sendPharmacyCredentialsEmail({
      to: adminEmail,
      pharmacyName,
      adminName: adminFullName,
      tempPassword,
    });
    credentialsSent = true;
  } catch (emailErr) {
    await logPlatformEvent({
      actorId,
      action: "pharmacy.credentials_email_failed",
      entityType: "tenant",
      entityId: tenantId,
      tenantId,
      metadata: { error: String(emailErr), admin_email: adminEmail },
    });
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
      credentials_email_sent: credentialsSent,
      admin_profile_created: Boolean(adminProfileId),
    },
  });

  return NextResponse.json({ id: tenantId, slug, defaultDomain, customDomain, domainProvisioning, credentialsEmailSent: credentialsSent });
}
