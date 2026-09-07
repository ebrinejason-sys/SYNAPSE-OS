import { cache } from "react";
import { headers } from "next/headers";
import { facilitySlugFromHost, RESERVED_HOSTS } from "./tenant-routing";
import { createServiceClient } from "./supabase/server";

export type TenantContext = {
  tenantId: string;
  hospitalId: string;
  hospitalName: string;
  subdomain: string;
  plan: string;
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
  is_active: boolean;
  status: string;
};

export const resolveTenant = cache(async (subdomain: string): Promise<TenantContext | null> => {
  if (!subdomain || RESERVED_HOSTS.has(subdomain)) return null;
  const hostSlug = facilitySlugFromHost((await headers()).get("host") ?? "");
  if (hostSlug && hostSlug !== subdomain) return null;
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
    .select("id, plan, is_active, status")
    .eq("id", tenantId)
    .single()) as { data: TenantRow | null; error: unknown };

  if (!tenant?.id || tenant.is_active !== true || tenant.status !== "active") return null;

  return {
    tenantId: tenant?.id ?? tenantId,
    hospitalId: hospital.id,
    hospitalName: hospital.name,
    subdomain: hospital.subdomain,
    plan: tenant?.plan ?? "trial",
  };
});
