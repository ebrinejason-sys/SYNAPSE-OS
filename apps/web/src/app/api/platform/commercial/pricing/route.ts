import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@synapse/db/admin'
import {
  getCommercialPlanBySlug,
  isPricingState,
  listAllCommercialPlans,
  updateCommercialPlan,
} from '@synapse/db/commercial-pricing'
import { requirePlatformAdminApi } from '@/lib/platform/auth'

export const dynamic = 'force-dynamic'

const updateSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  priceUgx: z.number().nonnegative().nullable().optional(),
  pricingState: z.string().optional(),
  featureList: z.array(z.string()).optional(),
  highlightedFeatures: z.array(z.string()).optional(),
  publicVisible: z.boolean().optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
  standaloneAvailable: z.boolean().optional(),
  addonAvailable: z.boolean().optional(),
  parentPlanSlugs: z.array(z.string()).optional(),
  ctaLabel: z.string().nullable().optional(),
  ctaHref: z.string().nullable().optional(),
  customQuote: z.boolean().optional(),
  changeReason: z.string().max(500).optional(),
})

export async function GET() {
  const auth = await requirePlatformAdminApi('platform.pricing.read')
  if (!auth.ok) return auth.response

  try {
    const plans = await listAllCommercialPlans(supabaseAdmin as never)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any
    const { data: history } = await db
      .from('commercial_price_history')
      .select(
        'id, plan_slug, previous_price_ugx, new_price_ugx, previous_pricing_state, new_pricing_state, change_reason, changed_by, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(50)

    return NextResponse.json({ plans, history: history ?? [] })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requirePlatformAdminApi('platform.pricing.manage')
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  if (parsed.data.pricingState && !isPricingState(parsed.data.pricingState)) {
    return NextResponse.json({ error: 'Invalid pricing state' }, { status: 400 })
  }

  try {
    const current = await getCommercialPlanBySlug(supabaseAdmin as never, parsed.data.slug)
    if (!current) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    const updated = await updateCommercialPlan(
      supabaseAdmin as never,
      current,
      {
        name: parsed.data.name,
        description: parsed.data.description,
        priceUgx: parsed.data.priceUgx,
        pricingState: parsed.data.pricingState as never,
        featureList: parsed.data.featureList,
        highlightedFeatures: parsed.data.highlightedFeatures,
        publicVisible: parsed.data.publicVisible,
        isActive: parsed.data.isActive,
        displayOrder: parsed.data.displayOrder,
        standaloneAvailable: parsed.data.standaloneAvailable,
        addonAvailable: parsed.data.addonAvailable,
        parentPlanSlugs: parsed.data.parentPlanSlugs,
        ctaLabel: parsed.data.ctaLabel,
        ctaHref: parsed.data.ctaHref,
        customQuote: parsed.data.customQuote,
        changeReason: parsed.data.changeReason,
      },
      auth.profile.id,
    )

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any
    await db.from('platform_audit_events').insert({
      actor_id: auth.profile.id,
      actor_role: auth.profile.platformRole,
      action: 'COMMERCIAL_PRICE_UPDATED',
      resource_type: 'subscription_plans',
      resource_id: updated.id,
      metadata: {
        slug: updated.slug,
        before: { priceUgx: current.priceUgx, pricingState: current.pricingState },
        after: { priceUgx: updated.priceUgx, pricingState: updated.pricingState },
        reason: parsed.data.changeReason ?? null,
      },
      source: 'platform_pricing',
    })

    return NextResponse.json({ plan: updated })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
