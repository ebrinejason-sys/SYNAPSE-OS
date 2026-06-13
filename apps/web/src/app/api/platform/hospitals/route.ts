import { NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase/server";
import { getCurrentUser } from "../../../../lib/auth/getCurrentUser";
import { logPlatformEvent } from "../../../platform/_lib/platform-data";

const DEFAULT_DEPARTMENTS = ["Administration", "Front Desk", "Pharmacy", "Lab", "Finance"];
const HOSPITAL_TYPES = new Set(["national", "referral", "teaching", "general"]);

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48);
}

function normalizeHospitalType(value: unknown) {
  const normalized = String(value ?? "general").trim().toLowerCase();
  return HOSPITAL_TYPES.has(normalized) ? normalized : "general";
}

async function insertTenantWithFallback(supabaseAdmin: ReturnType<typeof createServiceClient>, row: Record<string, unknown>) {
  const attempts = [
    row,
    {
      id: row.id,
      slug: row.slug,
      name: row.name,
      country: row.country,
      district: row.district,
      facility_type: row.facility_type,
      phone: row.phone,
      email: row.email,
      plan: row.plan,
      is_active: row.is_active,
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

  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ available: false }, { status: 400 });
  }

  const supabaseAdmin = createServiceClient();
  const { data } = await (supabaseAdmin as any)
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  return NextResponse.json({ available: !data });
}

export async function POST(request: Request) {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "platform_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const supabaseAdmin = createServiceClient();

  const tenantId = crypto.randomUUID();
  const slug = slugify(body.subdomain || body.hospitalName || "");
  const facilityType = String(body.hospitalType ?? "clinic").toLowerCase();
  const plan = String(body.tier ?? "trial");

  if (!slug || !body.hospitalName || !body.adminEmail) {
    return NextResponse.json({ error: "Hospital name, subdomain, and admin email are required." }, { status: 400 });
  }

  const tenantError = await insertTenantWithFallback(supabaseAdmin, {
    id: tenantId,
    slug,
    name: body.hospitalName,
    country: "UG",
    district: body.district || null,
    facility_type: facilityType || "clinic",
    bed_capacity: Number(body.bedsCount || 0) || null,
    phone: body.contactPhone || null,
    email: body.contactEmail || body.adminEmail,
    plan,
    is_active: true,
    onboarding_completed: false,
    onboarding_step: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (tenantError) {
    return NextResponse.json({ error: tenantError.message }, { status: 400 });
  }

  try {
    await (supabaseAdmin as any).from("hospitals").insert({
      id: tenantId,
      name: body.hospitalName,
      subdomain: slug,
      type: normalizeHospitalType(body.hospitalType),
      settings: {
        tenant_id: tenantId,
        city: body.city || null,
        district: body.district || null,
        beds_count: Number(body.bedsCount || 0) || null,
        contact_email: body.contactEmail || body.adminEmail,
        contact_name: body.contactName || null,
        contact_phone: body.contactPhone || null,
        subscription_tier: plan,
        source: "platform_onboarding",
      },
    });
  } catch {}

  if (Array.isArray(body.modules) && body.modules.length > 0) {
    const featureRows = body.modules.map((moduleKey: string) => ({
      tenant_id: tenantId,
      feature_key: moduleKey,
      is_enabled: true,
      enabled_at: new Date().toISOString(),
      notes: "Enabled during hospital onboarding.",
    }));
    try {
      await (supabaseAdmin as any).from("feature_flags").upsert(featureRows, { onConflict: "tenant_id,feature_key" });
    } catch {}

    try {
      const moduleRows = body.modules.map((moduleKey: string) => ({
        hospital_id: tenantId,
        tenant_id: tenantId,
        module_key: moduleKey,
        is_active: true,
      }));
      await (supabaseAdmin as any).from("hospital_modules").upsert(moduleRows, { onConflict: "hospital_id,module_key" });
    } catch {}
  }

  const departmentRows = DEFAULT_DEPARTMENTS.map((name) => ({
    hospital_id: tenantId,
    tenant_id: tenantId,
    name,
    dept_type: name === "Pharmacy" ? "pharmacy" : "administrative",
    is_active: true,
  }));
  try {
    await (supabaseAdmin as any).from("departments").insert(departmentRows);
  } catch {}

  const { data: adminUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
    email: body.adminEmail,
    email_confirm: true,
    user_metadata: {
      full_name: body.contactName || "Hospital Admin",
      hospital_name: body.hospitalName,
    },
  });

  if (createUserError) {
    await logPlatformEvent({
      actorId: actor.id,
      action: "hospital.admin_user_failed",
      entityType: "tenant",
      entityId: tenantId,
      tenantId,
      metadata: { error: createUserError.message, admin_email: body.adminEmail },
    });
    return NextResponse.json({ id: tenantId, warning: createUserError.message });
  }

  const fullName = body.contactName || "Hospital Admin";
  const [firstName, ...restName] = fullName.split(" ");
  const profileAttempts = [
    {
      id: adminUser.user.id,
      role: "hospital_admin",
      tenant_id: tenantId,
      hospital_id: tenantId,
      email: body.adminEmail,
      full_name: fullName,
    },
    {
      tenant_id: tenantId,
      user_id: adminUser.user.id,
      role: "facility_admin",
      first_name: firstName || "Hospital",
      last_name: restName.join(" ") || "Admin",
      email: body.adminEmail,
      phone: body.contactPhone || null,
      is_active: true,
    },
  ];

  for (const profile of profileAttempts) {
    const { error } = await (supabaseAdmin as any).from("profiles").insert(profile);
    if (!error) break;
  }

  await logPlatformEvent({
    actorId: actor.id,
    action: "hospital.onboarded",
    entityType: "tenant",
    entityId: tenantId,
    tenantId,
    metadata: { slug, plan, facility_type: facilityType },
  });

  return NextResponse.json({ id: tenantId, slug });
}
