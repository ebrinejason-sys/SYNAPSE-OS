import { cache } from "react";
import { createServiceClient } from "./supabase/server";
import { isTenantScopeAllowed } from "./tenant-scope";

export { isTenantScopeAllowed } from "./tenant-scope";

export type TenantContext = {
  tenantId: string;
  hospitalId: string;
  hospitalName: string;
  subdomain: string;
  plan: string;
  facilityType: string;
};

type HospitalRow = {
  id: string;
  name: string;
  subdomain: string;
  settings: Record<string, string> | null;
};

type TenantRow = {
  id: string;
  plan: string;
  facility_type: string | null;
};

export async function userCanAccessTenant(userId: string, tenant: TenantContext, role?: string) {
  const supabase = createServiceClient();

  // Platform access never grants implicit hospital PHI access. Non-hospital
  // facilities retain the existing scoped control-plane bypass.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = (await (supabase as any)
    .from("profiles")
    .select("tenant_id")
    .eq("id", userId)
    .maybeSingle()) as { data: { tenant_id: string | null } | null };

  // Scope assignments are authoritative for staff whose profile predates the
  // tenant column or whose role is explicitly scoped.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: assignments } = (await (supabase as any)
    .from("staff_scope_assignments")
    .select("tenant_id")
    .eq("profile_id", userId)
    .eq("is_active", true)) as { data: { tenant_id: string | null }[] | null };

  return isTenantScopeAllowed(
    profile?.tenant_id ?? null,
    assignments ?? [],
    tenant.tenantId,
    role,
    tenant.facilityType,
  );
}

export const resolveTenant = cache(async (subdomain: string): Promise<TenantContext | null> => {
  if (!subdomain) return null;
  const supabase = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: hospital } = (await (supabase as any)
    .from("hospitals")
    .select("id, name, subdomain, settings")
    .eq("subdomain", subdomain)
    .single()) as { data: HospitalRow | null; error: unknown };

  if (!hospital) return null;

  const tenantId: string = (hospital.settings as Record<string, string>)?.tenant_id ?? "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenant } = (await (supabase as any)
    .from("tenants")
    .select("id, plan, facility_type")
    .eq("id", tenantId)
    .single()) as { data: TenantRow | null; error: unknown };

  return {
    tenantId: tenant?.id ?? tenantId,
    hospitalId: hospital.id,
    hospitalName: hospital.name,
    subdomain: hospital.subdomain,
    plan: tenant?.plan ?? "trial",
    facilityType: tenant?.facility_type ?? "hospital",
  };
});
