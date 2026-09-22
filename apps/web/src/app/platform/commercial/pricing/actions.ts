'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@synapse/db/admin'
import {
  getCommercialPlanBySlug,
  isPricingState,
  updateCommercialPlan,
} from '@synapse/db/commercial-pricing'
import { requirePlatformAccess } from '../../../../lib/platform/auth'

export async function updatePlanAction(formData: FormData) {
  const admin = await requirePlatformAccess('platform.pricing.manage')
  const slug = String(formData.get('slug') ?? '').trim()
  if (!slug) return

  const priceRaw = String(formData.get('priceUgx') ?? '').trim()
  const priceUgx =
    priceRaw === '' || formData.get('customQuote') === 'on' ? null : Number(priceRaw.replace(/,/g, ''))
  if (priceUgx !== null && (!Number.isFinite(priceUgx) || priceUgx < 0)) {
    return
  }

  const pricingState = String(formData.get('pricingState') ?? '').trim()
  if (pricingState && !isPricingState(pricingState)) {
    return
  }

  const featuresRaw = String(formData.get('featureList') ?? '')
  const featureList = featuresRaw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const current = await getCommercialPlanBySlug(supabaseAdmin as never, slug)
  if (!current) return

  await updateCommercialPlan(
    supabaseAdmin as never,
    current,
    {
      name: String(formData.get('name') ?? current.name).trim() || current.name,
      description: String(formData.get('description') ?? '') || null,
      priceUgx,
      pricingState: pricingState ? (pricingState as never) : undefined,
      featureList,
      publicVisible: formData.get('publicVisible') === 'on',
      isActive: formData.get('isActive') === 'on',
      displayOrder: Number(formData.get('displayOrder') ?? current.displayOrder),
      ctaLabel: String(formData.get('ctaLabel') ?? '') || null,
      ctaHref: String(formData.get('ctaHref') ?? '') || null,
      customQuote: formData.get('customQuote') === 'on',
      changeReason: String(formData.get('changeReason') ?? '') || 'admin_ui_update',
    },
    admin.id,
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  await db.from('platform_audit_events').insert({
    actor_id: admin.id,
    actor_role: admin.platformRole,
    action: 'COMMERCIAL_PRICE_UPDATED',
    resource_type: 'subscription_plans',
    resource_id: current.id,
    metadata: { slug, priceUgx, pricingState },
    source: 'platform_pricing',
  })

  revalidatePath('/platform/commercial/pricing')
  revalidatePath('/pricing')
}
