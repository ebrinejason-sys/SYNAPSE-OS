/**
 * Canonical commercial pricing domain.
 *
 * Public website and Platform Admin read/write through this module.
 * Subscriptions must snapshot agreed prices — never silently rewrite history.
 */

export const PRICING_STATES = [
  'PUBLIC_FIXED',
  'STARTING_AT',
  'CUSTOM_QUOTE',
  'INCLUDED',
  'ADD_ON',
  'COMING_SOON',
  'HIDDEN',
] as const

export type PricingState = (typeof PRICING_STATES)[number]

export const CANONICAL_PLAN_SLUGS = {
  pharmacy: 'synapse_pharmacy_annual',
  lab: 'synapse_lab_annual',
  osBasic: 'synapse_os_basic_annual',
  osLabAddon: 'synapse_os_lab_addon_annual',
  enterprise: 'synapse_enterprise',
  intelligence: 'synapse_intelligence',
  exchange: 'synapse_exchange',
} as const

/** Safe fallback catalog when the pricing service / DB is unavailable. */
export const FALLBACK_PUBLIC_PLANS: CommercialPlan[] = [
  {
    id: null,
    slug: CANONICAL_PLAN_SLUGS.pharmacy,
    name: 'SYNAPSE Pharmacy',
    facilityType: 'pharmacy',
    priceUgx: 240_000,
    currency: 'UGX',
    billingPeriod: 'annual',
    billingCycle: 'yearly',
    pricingState: 'PUBLIC_FIXED',
    description: 'Standalone pharmacy management for independent and community pharmacies.',
    standaloneAvailable: true,
    addonAvailable: false,
    parentPlanSlugs: [],
    publicVisible: true,
    isActive: true,
    displayOrder: 10,
    featureList: [
      'Inventory management',
      'Purchasing & goods receipt',
      'Supplier management',
      'Dispensing',
      'POS / billing',
      'Stock, batch & expiry tracking',
      'Reports',
      'Users & roles',
      'Mobile / Expo access where supported',
    ],
    highlightedFeatures: ['Inventory', 'Purchasing', 'POS'],
    ctaLabel: 'Get Started',
    ctaHref: '/book-meeting?product=pharmacy',
    customQuote: false,
    previousPriceUgx: null,
    version: 1,
  },
  {
    id: null,
    slug: CANONICAL_PLAN_SLUGS.lab,
    name: 'SYNAPSE Lab',
    facilityType: 'laboratory',
    priceUgx: 1_000_000,
    currency: 'UGX',
    billingPeriod: 'annual',
    billingCycle: 'yearly',
    pricingState: 'PUBLIC_FIXED',
    description: 'Standalone laboratory and diagnostic facility operations.',
    standaloneAvailable: true,
    addonAvailable: false,
    parentPlanSlugs: [],
    publicVisible: true,
    isActive: true,
    displayOrder: 20,
    featureList: [
      'Laboratory workflow',
      'Orders',
      'Specimen management',
      'Results',
      'Verification & release',
      'Analyzer / device connectivity where supported',
      'Lab Edge',
      'AI-assisted interpretation where supported',
      'Reporting',
      'Users & roles',
    ],
    highlightedFeatures: ['Workflow', 'Devices', 'Results'],
    ctaLabel: 'Get Started',
    ctaHref: '/book-meeting?product=lab',
    customQuote: false,
    previousPriceUgx: null,
    version: 1,
  },
  {
    id: null,
    slug: CANONICAL_PLAN_SLUGS.osBasic,
    name: 'SYNAPSE OS Basic',
    facilityType: 'hospital',
    priceUgx: 1_500_000,
    currency: 'UGX',
    billingPeriod: 'annual',
    billingCycle: 'yearly',
    pricingState: 'STARTING_AT',
    description: 'Core clinical and facility platform for hospitals and clinics.',
    standaloneAvailable: true,
    addonAvailable: false,
    parentPlanSlugs: [],
    publicVisible: true,
    isActive: true,
    displayOrder: 30,
    featureList: [
      'Patient registration',
      'Synapse ID',
      'Reception',
      'Triage',
      'Encounters',
      'Clinical documentation',
      'Diagnoses',
      'Orders',
      'Billing',
      'Referrals',
      'Consent',
      'Clinical documents',
      'Pathways',
      'Basic reporting',
      'Role & capability management',
    ],
    highlightedFeatures: ['Encounters', 'Billing', 'Referrals'],
    ctaLabel: 'Get Started',
    ctaHref: '/book-meeting?product=os',
    customQuote: false,
    previousPriceUgx: null,
    version: 1,
  },
  {
    id: null,
    slug: CANONICAL_PLAN_SLUGS.osLabAddon,
    name: 'Lab add-on for SYNAPSE OS',
    facilityType: 'hospital',
    priceUgx: 500_000,
    currency: 'UGX',
    billingPeriod: 'annual',
    billingCycle: 'yearly',
    pricingState: 'ADD_ON',
    description:
      'Add laboratory module to an existing SYNAPSE OS facility. Distinct from standalone Lab pricing.',
    standaloneAvailable: false,
    addonAvailable: true,
    parentPlanSlugs: [CANONICAL_PLAN_SLUGS.osBasic],
    publicVisible: true,
    isActive: true,
    displayOrder: 40,
    featureList: [
      'Laboratory workflow integrated with SYNAPSE OS',
      'Orders from clinical encounters',
      'Specimen lifecycle',
      'Results & verification',
      'Device connectivity where supported',
    ],
    highlightedFeatures: ['OS-integrated Lab'],
    ctaLabel: 'Add Lab',
    ctaHref: '/book-meeting?product=os-lab-addon',
    customQuote: false,
    previousPriceUgx: null,
    version: 1,
  },
  {
    id: null,
    slug: CANONICAL_PLAN_SLUGS.enterprise,
    name: 'SYNAPSE Enterprise',
    facilityType: 'hospital',
    priceUgx: null,
    currency: 'UGX',
    billingPeriod: 'annual',
    billingCycle: 'yearly',
    pricingState: 'CUSTOM_QUOTE',
    description:
      'Custom pricing for large hospitals, groups, multisite organizations, and complex deployments.',
    standaloneAvailable: true,
    addonAvailable: false,
    parentPlanSlugs: [],
    publicVisible: true,
    isActive: true,
    displayOrder: 50,
    featureList: [
      'Multisite organizations',
      'Custom modules & integrations',
      'Data migration support',
      'Implementation & training',
      'Infrastructure options',
      'Support agreements by arrangement',
    ],
    highlightedFeatures: ['Custom quote', 'Book a Meeting'],
    ctaLabel: 'Book a Meeting',
    ctaHref: '/book-meeting?product=enterprise',
    customQuote: true,
    previousPriceUgx: null,
    version: 1,
  },
]

export type CommercialPlan = {
  id: string | null
  slug: string
  name: string
  facilityType: string
  priceUgx: number | null
  currency: string
  billingPeriod: string
  billingCycle: string
  pricingState: PricingState
  description: string | null
  standaloneAvailable: boolean
  addonAvailable: boolean
  parentPlanSlugs: string[]
  publicVisible: boolean
  isActive: boolean
  displayOrder: number
  featureList: string[]
  highlightedFeatures: string[]
  ctaLabel: string | null
  ctaHref: string | null
  customQuote: boolean
  previousPriceUgx: number | null
  version: number
}

export type CommercialPlanRow = {
  id?: string | null
  slug?: string | null
  name?: string | null
  facility_type?: string | null
  price_ugx?: number | string | null
  currency?: string | null
  billing_period?: string | null
  billing_cycle?: string | null
  pricing_state?: string | null
  description?: string | null
  standalone_available?: boolean | null
  addon_available?: boolean | null
  parent_plan_slugs?: string[] | null
  public_visible?: boolean | null
  is_active?: boolean | null
  display_order?: number | null
  feature_list?: unknown
  highlighted_features?: unknown
  cta_label?: string | null
  cta_href?: string | null
  custom_quote?: boolean | null
  previous_price_ugx?: number | string | null
  version?: number | null
}

export function isPricingState(value: string): value is PricingState {
  return (PRICING_STATES as readonly string[]).includes(value)
}

export function parseFeatureList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean)
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown
      return parseFeatureList(parsed)
    } catch {
      return value ? [value] : []
    }
  }
  return []
}

export function mapPlanRow(row: CommercialPlanRow): CommercialPlan {
  const state = row.pricing_state && isPricingState(row.pricing_state) ? row.pricing_state : 'HIDDEN'
  const priceRaw = row.price_ugx
  const price =
    priceRaw === null || priceRaw === undefined || priceRaw === ''
      ? null
      : Number(priceRaw)
  return {
    id: row.id ?? null,
    slug: String(row.slug ?? ''),
    name: String(row.name ?? ''),
    facilityType: String(row.facility_type ?? ''),
    priceUgx: Number.isFinite(price as number) ? (price as number) : null,
    currency: String(row.currency ?? 'UGX'),
    billingPeriod: String(row.billing_period ?? 'annual'),
    billingCycle: String(row.billing_cycle ?? 'yearly'),
    pricingState: state,
    description: row.description ?? null,
    standaloneAvailable: row.standalone_available !== false,
    addonAvailable: row.addon_available === true,
    parentPlanSlugs: Array.isArray(row.parent_plan_slugs) ? row.parent_plan_slugs.map(String) : [],
    publicVisible: row.public_visible !== false,
    isActive: row.is_active !== false,
    displayOrder: Number(row.display_order ?? 100),
    featureList: parseFeatureList(row.feature_list),
    highlightedFeatures: parseFeatureList(row.highlighted_features),
    ctaLabel: row.cta_label ?? null,
    ctaHref: row.cta_href ?? null,
    customQuote: row.custom_quote === true || state === 'CUSTOM_QUOTE',
    previousPriceUgx:
      row.previous_price_ugx === null || row.previous_price_ugx === undefined
        ? null
        : Number(row.previous_price_ugx),
    version: Number(row.version ?? 1),
  }
}

export function formatUgxAnnual(priceUgx: number | null, state: PricingState): string {
  if (state === 'CUSTOM_QUOTE' || state === 'COMING_SOON' || priceUgx === null) {
    if (state === 'COMING_SOON') return 'Coming soon'
    return 'Custom pricing'
  }
  const formatted = `UGX ${Math.round(priceUgx).toLocaleString('en-UG')}`
  if (state === 'STARTING_AT') return `Starting at ${formatted} / year`
  if (state === 'ADD_ON') return `+ ${formatted} / year`
  return `${formatted} / year`
}

export function publicPlansOnly(plans: CommercialPlan[]): CommercialPlan[] {
  return plans
    .filter(
      (plan) =>
        plan.isActive &&
        plan.publicVisible &&
        plan.pricingState !== 'HIDDEN' &&
        Boolean(plan.slug),
    )
    .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name))
}

export function findPlanBySlug(plans: CommercialPlan[], slug: string): CommercialPlan | null {
  return plans.find((plan) => plan.slug === slug) ?? null
}

export function osWithLabBundlePrice(plans: CommercialPlan[]): {
  os: CommercialPlan | null
  labAddon: CommercialPlan | null
  standaloneLab: CommercialPlan | null
  combinedUgx: number | null
} {
  const os = findPlanBySlug(plans, CANONICAL_PLAN_SLUGS.osBasic)
  const labAddon = findPlanBySlug(plans, CANONICAL_PLAN_SLUGS.osLabAddon)
  const standaloneLab = findPlanBySlug(plans, CANONICAL_PLAN_SLUGS.lab)
  const combined =
    os?.priceUgx != null && labAddon?.priceUgx != null ? os.priceUgx + labAddon.priceUgx : null
  return { os, labAddon, standaloneLab, combinedUgx: combined }
}

export type SubscriptionCommercialSnapshot = {
  planId: string | null
  planSlug: string
  agreedPriceUgx: number | null
  agreedCurrency: string
  agreedBillingPeriod: string
  addonSlugs: string[]
  addonTotalUgx: number
  discountUgx: number
  customNegotiatedUgx: number | null
}

/**
 * Snapshot commercial terms at purchase/renewal time.
 * Never mutate this snapshot when catalog prices later change.
 */
export function snapshotSubscriptionTerms(input: {
  plan: CommercialPlan
  addons?: CommercialPlan[]
  discountUgx?: number
  customNegotiatedUgx?: number | null
}): SubscriptionCommercialSnapshot {
  const addons = input.addons ?? []
  const addonTotal = addons.reduce((sum, plan) => sum + (plan.priceUgx ?? 0), 0)
  const base = input.customNegotiatedUgx ?? input.plan.priceUgx
  return {
    planId: input.plan.id,
    planSlug: input.plan.slug,
    agreedPriceUgx: base,
    agreedCurrency: input.plan.currency || 'UGX',
    agreedBillingPeriod: input.plan.billingPeriod || 'annual',
    addonSlugs: addons.map((plan) => plan.slug),
    addonTotalUgx: addonTotal,
    discountUgx: Math.max(0, Number(input.discountUgx) || 0),
    customNegotiatedUgx: input.customNegotiatedUgx ?? null,
  }
}

export type PlanUpdateInput = {
  name?: string
  description?: string | null
  priceUgx?: number | null
  pricingState?: PricingState
  featureList?: string[]
  highlightedFeatures?: string[]
  publicVisible?: boolean
  isActive?: boolean
  displayOrder?: number
  standaloneAvailable?: boolean
  addonAvailable?: boolean
  parentPlanSlugs?: string[]
  ctaLabel?: string | null
  ctaHref?: string | null
  customQuote?: boolean
  changeReason?: string
}

export function buildPlanUpdatePayload(
  current: CommercialPlan,
  input: PlanUpdateInput,
  actorId?: string | null,
): {
  planPatch: Record<string, unknown>
  historyRow: Record<string, unknown> | null
} {
  const nextState = input.pricingState ?? current.pricingState
  const nextPrice = input.priceUgx !== undefined ? input.priceUgx : current.priceUgx
  const nextFeatures = input.featureList ?? current.featureList
  const priceChanged = nextPrice !== current.priceUgx
  const stateChanged = nextState !== current.pricingState
  const featuresChanged = JSON.stringify(nextFeatures) !== JSON.stringify(current.featureList)

  const planPatch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    version: current.version + (priceChanged || stateChanged || featuresChanged ? 1 : 0),
  }
  if (actorId) planPatch.updated_by = actorId
  if (input.name !== undefined) planPatch.name = input.name
  if (input.description !== undefined) planPatch.description = input.description
  if (input.priceUgx !== undefined) {
    planPatch.price_ugx = input.priceUgx
    planPatch.previous_price_ugx = current.priceUgx
  }
  if (input.pricingState !== undefined) planPatch.pricing_state = input.pricingState
  if (input.featureList !== undefined) planPatch.feature_list = input.featureList
  if (input.highlightedFeatures !== undefined) {
    planPatch.highlighted_features = input.highlightedFeatures
  }
  if (input.publicVisible !== undefined) planPatch.public_visible = input.publicVisible
  if (input.isActive !== undefined) planPatch.is_active = input.isActive
  if (input.displayOrder !== undefined) planPatch.display_order = input.displayOrder
  if (input.standaloneAvailable !== undefined) {
    planPatch.standalone_available = input.standaloneAvailable
  }
  if (input.addonAvailable !== undefined) planPatch.addon_available = input.addonAvailable
  if (input.parentPlanSlugs !== undefined) planPatch.parent_plan_slugs = input.parentPlanSlugs
  if (input.ctaLabel !== undefined) planPatch.cta_label = input.ctaLabel
  if (input.ctaHref !== undefined) planPatch.cta_href = input.ctaHref
  if (input.customQuote !== undefined) planPatch.custom_quote = input.customQuote

  const historyRow =
    priceChanged || stateChanged || featuresChanged
      ? {
          plan_id: current.id,
          plan_slug: current.slug,
          previous_price_ugx: current.priceUgx,
          new_price_ugx: nextPrice,
          previous_pricing_state: current.pricingState,
          new_pricing_state: nextState,
          previous_feature_list: current.featureList,
          new_feature_list: nextFeatures,
          change_reason: input.changeReason ?? null,
          changed_by: actorId ?? null,
        }
      : null

  return { planPatch, historyRow }
}

/** Loose Supabase-compatible client (service role or anon). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PricingClient = { from: (table: string) => any }

const PUBLIC_SELECT =
  'id, slug, name, facility_type, price_ugx, currency, billing_period, billing_cycle, pricing_state, description, standalone_available, addon_available, parent_plan_slugs, public_visible, is_active, display_order, feature_list, highlighted_features, cta_label, cta_href, custom_quote, previous_price_ugx, version'

export async function listPublicPricingPlans(
  client: PricingClient,
): Promise<{ plans: CommercialPlan[]; source: 'database' | 'fallback'; error?: string }> {
  try {
    const { data, error } = await client
      .from('subscription_plans')
      .select(PUBLIC_SELECT)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error) {
      return { plans: publicPlansOnly(FALLBACK_PUBLIC_PLANS), source: 'fallback', error: error.message }
    }
    const rows = Array.isArray(data) ? (data as CommercialPlanRow[]) : []
    const plans = publicPlansOnly(rows.map(mapPlanRow))
    if (plans.length === 0) {
      return { plans: publicPlansOnly(FALLBACK_PUBLIC_PLANS), source: 'fallback', error: 'empty_catalog' }
    }
    return { plans, source: 'database' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { plans: publicPlansOnly(FALLBACK_PUBLIC_PLANS), source: 'fallback', error: message }
  }
}

export async function listAllCommercialPlans(client: PricingClient): Promise<CommercialPlan[]> {
  const { data, error } = await client
    .from('subscription_plans')
    .select(PUBLIC_SELECT)
    .order('display_order', { ascending: true })
  if (error) throw new Error(error.message)
  const rows = Array.isArray(data) ? (data as CommercialPlanRow[]) : []
  return rows.map(mapPlanRow).sort((a, b) => a.displayOrder - b.displayOrder)
}

export async function getCommercialPlanBySlug(
  client: PricingClient,
  slug: string,
): Promise<CommercialPlan | null> {
  const { data, error } = await client
    .from('subscription_plans')
    .select(PUBLIC_SELECT)
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return mapPlanRow(data as CommercialPlanRow)
}

export async function updateCommercialPlan(
  client: PricingClient,
  current: CommercialPlan,
  input: PlanUpdateInput,
  actorId?: string | null,
): Promise<CommercialPlan> {
  if (!current.id) throw new Error('Cannot update a plan without a database id')
  const { planPatch, historyRow } = buildPlanUpdatePayload(current, input, actorId)

  const { data, error } = await client
    .from('subscription_plans')
    .update(planPatch)
    .eq('id', current.id)
    .select(PUBLIC_SELECT)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Plan update returned no row')

  if (historyRow) {
    const hist = await client.from('commercial_price_history').insert(historyRow)
    if (hist.error) throw new Error(hist.error.message)
  }

  return mapPlanRow(data as CommercialPlanRow)
}
