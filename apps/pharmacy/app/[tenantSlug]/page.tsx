import Link from "next/link"
import { notFound } from "next/navigation"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

type TenantRow = {
  name: string
  slug: string | null
  default_subdomain: string | null
  district: string | null
  address: string | null
  phone: string | null
  is_active: boolean | null
  status: string | null
}

function cleanSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

async function getTenantByRouteSlug(routeSlug: string): Promise<TenantRow | null> {
  const slug = cleanSlug(routeSlug)
  if (!slug) return null

  const candidates = Array.from(new Set([slug, `pharm-${slug}`]))
  const { data } = await supabaseAdmin
    .from("tenants")
    .select("name, slug, default_subdomain, district, address, phone, is_active, status")
    .eq("facility_type", "pharmacy")
    .eq("is_active", true)
    .in("slug", candidates)
    .maybeSingle()

  if (data) return data as TenantRow

  const { data: bySubdomain } = await supabaseAdmin
    .from("tenants")
    .select("name, slug, default_subdomain, district, address, phone, is_active, status")
    .eq("facility_type", "pharmacy")
    .eq("is_active", true)
    .in("default_subdomain", candidates)
    .maybeSingle()

  return (bySubdomain as TenantRow | null) ?? null
}

export default async function PharmacyTenantPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>
}) {
  const { tenantSlug } = await params
  const tenant = await getTenantByRouteSlug(tenantSlug)
  if (!tenant) notFound()

  const loginTenant = tenant.slug ?? tenant.default_subdomain ?? cleanSlug(tenantSlug)

  return (
    <main className="min-h-screen bg-[#07070A] px-4 py-10 text-white">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-2xl flex-col justify-center">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#F97316] to-[#E8B84B] text-xl font-black">
            S
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#E8B84B]">
              Synapse Pharmacy
            </p>
            <h1 className="text-3xl font-bold tracking-tight">{tenant.name}</h1>
          </div>
        </div>

        <div className="rounded-2xl border border-[#2A2A36] bg-[#111117] p-6 shadow-xl">
          <p className="text-sm uppercase tracking-[0.18em] text-zinc-500">Tenant portal</p>
          <h2 className="mt-3 text-2xl font-bold">Pharmacy workspace is ready</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Sign in to manage inventory, dispensing, staff access, migration uploads, customer refills,
            and Synapse network visibility for this pharmacy.
          </p>

          <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-xl border border-[#2A2A36] bg-[#07070A] p-3">
              <dt className="text-xs uppercase tracking-wide text-zinc-500">District</dt>
              <dd className="mt-1 text-zinc-200">{tenant.district || "Not set"}</dd>
            </div>
            <div className="rounded-xl border border-[#2A2A36] bg-[#07070A] p-3">
              <dt className="text-xs uppercase tracking-wide text-zinc-500">Phone</dt>
              <dd className="mt-1 text-zinc-200">{tenant.phone || "Not set"}</dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/login?tenant=${encodeURIComponent(loginTenant)}`}
              className="rounded-lg bg-[#F97316] px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
            >
              Sign in
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-[#2A2A36] px-5 py-2.5 text-sm font-semibold text-zinc-300 hover:border-[#E8B84B]/50"
            >
              Staff login
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
