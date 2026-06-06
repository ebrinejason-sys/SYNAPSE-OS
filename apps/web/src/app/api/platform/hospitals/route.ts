import { NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase/server";

const DEFAULT_DEPARTMENTS = ["Administration", "Front Desk", "Pharmacy", "Lab", "Finance"];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ available: false }, { status: 400 });
  }

  const supabaseAdmin = createServiceClient();
  const { data } = await (supabaseAdmin as any)
    .from("hospitals")
    .select("id")
    .eq("subdomain", slug)
    .maybeSingle();

  return NextResponse.json({ available: !data });
}

export async function POST(request: Request) {
  const body = await request.json();
  const supabaseAdmin = createServiceClient();

  const tenantId = crypto.randomUUID();

  const { error: tenantError } = await (supabaseAdmin as any).from("tenants").insert({
    id: tenantId,
    slug: body.subdomain,
    name: body.hospitalName,
    status: "active",
    subscription_tier: body.tier,
  });

  if (tenantError) {
    return NextResponse.json({ error: tenantError.message }, { status: 400 });
  }

  const { error: hospitalError } = await (supabaseAdmin as any).from("hospitals").insert({
    id: tenantId,
    tenant_id: tenantId,
    name: body.hospitalName,
    subdomain: body.subdomain,
    type: body.hospitalType,
    city: body.city,
    district: body.district,
    beds_count: body.bedsCount,
    contact_email: body.contactEmail,
    contact_name: body.contactName,
    contact_phone: body.contactPhone,
    status: "active",
    subscription_tier: body.tier,
  });

  if (hospitalError) {
    return NextResponse.json({ error: hospitalError.message }, { status: 400 });
  }

  if (Array.isArray(body.modules) && body.modules.length > 0) {
    const moduleRows = body.modules.map((moduleKey: string) => ({
      hospital_id: tenantId,
      tenant_id: tenantId,
      module_key: moduleKey,
      is_active: true,
    }));
    await (supabaseAdmin as any).from("hospital_modules").upsert(moduleRows, { onConflict: "hospital_id,module_key" });
  }

  const departmentRows = DEFAULT_DEPARTMENTS.map((name) => ({
    hospital_id: tenantId,
    tenant_id: tenantId,
    name,
  }));
  await (supabaseAdmin as any).from("departments").insert(departmentRows);

  const { data: adminUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
    email: body.adminEmail,
    email_confirm: true,
    user_metadata: {
      full_name: body.contactName || "Hospital Admin",
      hospital_name: body.hospitalName,
    },
  });

  if (createUserError) {
    return NextResponse.json({ error: createUserError.message }, { status: 400 });
  }

  await (supabaseAdmin as any).from("profiles").insert({
    id: adminUser.user.id,
    role: "hospital_admin",
    tenant_id: tenantId,
    hospital_id: tenantId,
    email: body.adminEmail,
    full_name: body.contactName || "Hospital Admin",
  });

  return NextResponse.json({ id: tenantId });
}
