import { NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

const PROFILE_SELECT =
  "id, full_name, first_name, last_name, email, phone, role, tenant_id, hospital_id, department_id, verification_status, is_admin, updated_at";

function cleanText(value: unknown, maxLength = 120) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, maxLength) : null;
}

async function getSignedInUser() {
  return await getCurrentUser();
}

export async function GET() {
  const user = await getSignedInUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = createServiceClient();
  const { data: profile, error } = await (supabaseAdmin as any)
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const tenantId = profile?.tenant_id ?? profile?.hospital_id ?? null;
  let tenant = null;
  if (tenantId) {
    const { data } = await (supabaseAdmin as any)
      .from("tenants")
      .select("id, name, slug, facility_type, plan, is_active, custom_domain, district")
      .eq("id", tenantId)
      .maybeSingle();
    tenant = data ?? null;
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
    },
    profile,
    tenant,
  });
}

export async function PATCH(request: Request) {
  const user = await getSignedInUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const fullName = cleanText(body.fullName);
  const firstName = cleanText(body.firstName, 80);
  const lastName = cleanText(body.lastName, 80);
  const phone = cleanText(body.phone, 40);

  const update = {
    full_name: fullName,
    first_name: firstName,
    last_name: lastName,
    phone,
    updated_at: new Date().toISOString(),
  };

  const supabaseAdmin = createServiceClient();
  const { data: profile, error } = await (supabaseAdmin as any)
    .from("profiles")
    .update(update)
    .eq("id", user.id)
    .select(PROFILE_SELECT)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ profile });
}
