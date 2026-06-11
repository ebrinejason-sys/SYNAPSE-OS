import Link from "next/link"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

const APP_HOSTS = new Set([
  "pharm.synapseos.tech",
  "www.pharm.synapseos.tech",
])

function cleanHost(host: string | null) {
  return (host ?? "").split(":")[0]?.toLowerCase() ?? ""
}

export default async function Page() {
  const headerStore = await headers()
  const host = cleanHost(headerStore.get("host"))

  if (!host || APP_HOSTS.has(host) || host.endsWith(".vercel.app") || host === "localhost" || host === "127.0.0.1") {
    redirect("/login")
  }

  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("name, slug, district, phone")
    .eq("facility_type", "pharmacy")
    .eq("is_active", true)
    .eq("custom_domain", host)
    .maybeSingle()

  if (!tenant) redirect("/login")

  const loginTenant = tenant.slug ?? host

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
          <p className="text-sm uppercase tracking-[0.18em] text-zinc-500">Custom domain</p>
          <h2 className="mt-3 text-2xl font-bold">Your pharmacy portal is connected</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Sign in to manage dispensing, inventory, staff access, refill follow-ups, and your Synapse network listing.
          </p>
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
