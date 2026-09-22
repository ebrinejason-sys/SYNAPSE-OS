import { Suspense } from "react"
import {
  FALLBACK_PUBLIC_PLANS,
  findPlanBySlug,
  CANONICAL_PLAN_SLUGS,
  type CommercialPlan,
} from "@synapse/db/commercial-pricing"
import RegisterForm from "./register-form"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Register · Synapse Pharm",
  description: "Start a 7-day free trial of Synapse Pharm for your Ugandan pharmacy.",
}

type PlanOption = {
  slug: string
  name: string
  price_ugx: number
  billing_cycle: string
}

function mapCommercialPlan(plan: CommercialPlan): PlanOption {
  return {
    slug: plan.slug,
    name: plan.name,
    price_ugx: plan.priceUgx ?? 0,
    billing_cycle: plan.billingCycle,
  }
}

export default async function RegisterPage() {
  const canonicalPlan = findPlanBySlug(FALLBACK_PUBLIC_PLANS, CANONICAL_PLAN_SLUGS.pharmacy)
  const plans: PlanOption[] = canonicalPlan ? [mapCommercialPlan(canonicalPlan)] : []
  
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
