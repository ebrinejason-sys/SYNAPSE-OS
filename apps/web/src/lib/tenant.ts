import { cache } from "react";
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
};

export const resolveTenant = cache(async (subdomain: string): Promise<TenantContext | null> => {
  if (!subdomain) return null;
  const supabase = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: hospital } = (await (supabase as any)
    .from("hospitals")
    .select("id, name, subdomain, settings")
    .eq("subdomain", subdomain)
    .eq("is_deleted", false)
    .single()) as { data: HospitalRow | null; error: unknown };

  if (!hospital) return null;

  const tenantId: string = (hospital.settings as Record<string, string>)?.tenant_id ?? "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenant } = (await (supabase as any)
    .from("tenants")
    .select("id, plan")
    .eq("id", tenantId)
    .single()) as { data: TenantRow | null; error: unknown };

  return {
    tenantId: tenant?.id ?? tenantId,
    hospitalId: hospital.id,
    hospitalName: hospital.name,
    subdomain: hospital.subdomain,
    plan: tenant?.plan ?? "trial",
  };
});
