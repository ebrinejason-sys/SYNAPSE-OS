import { requirePlatformAdmin } from "../../../../lib/platform/auth";
import { supabaseAdmin } from "@synapse/db/admin";

interface Props {
  params: Promise<{ id: string }>
}

export default async function PlatformTenantPage({ params }: Props) {
  await requirePlatformAdmin();

  const { id } = await params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any

  const { data: tenant } = await db
    .from('tenants')
    .select('id, name, slug, facility_type, status, is_active, country, district, created_at')
    .eq('id', id)
    .maybeSingle()

  const { data: onboarding } = await db
    .from('pharmacy_onboarding')
    .select('current_step, invite_token, invite_expires_at')
    .eq('tenant_id', id)
    .maybeSingle()

  if (!tenant) {
    return (
      <main className="min-h-screen bg-[#07070A] text-white p-8">
        <h1 className="font-bold text-2xl">Tenant not found</h1>
        <p className="text-slate-400 mt-2">No tenant with ID: {id}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#07070A] text-white p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">{tenant.name}</h1>
          <p className="text-slate-400 text-sm mt-1 capitalize">{tenant.facility_type} · {tenant.district ?? tenant.country} · {tenant.status}</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0B0B12] p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Tenant Details</h3>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Subdomain</dt>
              <dd className="text-slate-200">{tenant.slug}.synapseos.tech</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Status</dt>
              <dd className={tenant.is_active ? 'text-green-400' : 'text-yellow-400'}>{tenant.status}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Type</dt>
              <dd className="text-slate-200 capitalize">{tenant.facility_type}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Created</dt>
              <dd className="text-slate-200">{new Date(tenant.created_at).toLocaleDateString()}</dd>
            </div>
          </dl>
        </div>

        {onboarding && (
          <div className="rounded-xl border border-slate-800 bg-[#0B0B12] p-5 mt-4">
            <h3 className="text-sm font-semibold text-white mb-4">Onboarding Progress</h3>
            <div className="flex items-center gap-1">
              {['Invite Sent', 'Account', 'Profile', 'Store', 'Products', 'Network'].map((label, i) => {
                const done = (onboarding.current_step ?? 0) > i
                const active = (onboarding.current_step ?? 0) === i
                return (
                  <div key={label} className="flex items-center gap-1 flex-1 min-w-0">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${done ? 'bg-green-500 text-black' : active ? 'bg-[#F97316] text-black' : 'bg-slate-800 text-slate-500'}`}>
                      {done ? '✓' : i + 1}
                    </div>
                    <span className="text-[9px] text-slate-500 truncate hidden sm:block">{label}</span>
                    {i < 5 && <div className="h-px flex-1 bg-slate-800 mx-1" />}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
