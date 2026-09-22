import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { listPublicPricingPlans, osWithLabBundlePrice } from '@synapse/db/commercial-pricing'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/** Public commercial pricing catalog — single server-side source. */
export async function GET() {
  const result = await listPublicPricingPlans(supabaseAdmin as never)
  const bundle = osWithLabBundlePrice(result.plans)

  return NextResponse.json({
    currency: 'UGX',
    billingPeriod: 'annual',
    source: result.source,
    fallback: result.source === 'fallback',
    error: result.error ?? null,
    plans: result.plans.map((plan) => ({
      slug: plan.slug,
      name: plan.name,
      facilityType: plan.facilityType,
      priceUgx: plan.priceUgx,
      pricingState: plan.pricingState,
      description: plan.description,
      standaloneAvailable: plan.standaloneAvailable,
      addonAvailable: plan.addonAvailable,
      parentPlanSlugs: plan.parentPlanSlugs,
      displayOrder: plan.displayOrder,
      featureList: plan.featureList,
      highlightedFeatures: plan.highlightedFeatures,
      ctaLabel: plan.ctaLabel,
      ctaHref: plan.ctaHref,
      customQuote: plan.customQuote,
    })),
    bundle: {
      osPlusLabAddonUgx: bundle.combinedUgx,
      standaloneLabUgx: bundle.standaloneLab?.priceUgx ?? null,
      labAddonUgx: bundle.labAddon?.priceUgx ?? null,
    },
  })
}
