import { Suspense } from "react"
import { supabaseAdmin } from "@/lib/supabase/admin"
import RegisterForm from "./register-form"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Register · Synapse Pharm",
  description: "Start a 7-day free trial of Synapse Pharm for your Ugandan pharmacy.",
}

async function loadPlans() {
  const { data } = await supabaseAdmin
    .from("subscription_plans")
    .select("slug, name, price_ugx, billing_cycle")
    .eq("facility_type", "pharmacy")
    .eq("is_active", true)
    .order("price_ugx", { ascending: true })

  return ((data ?? []) as Array<{
    slug: string
    name: string
    price_ugx: number | string | null
    billing_cycle: string
  }>).map((p) => ({
    slug: String(p.slug),
    name: String(p.name),
    price_ugx: Number(p.price_ugx ?? 0),
    billing_cycle: String(p.billing_cycle),
  }))
}

export default async function RegisterPage() {
  const plans = await loadPlans()
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#07070A] text-zinc-400">
          Loading…
        </div>
      }
    >
      <RegisterForm plans={plans} />
    </Suspense>
  )
}
