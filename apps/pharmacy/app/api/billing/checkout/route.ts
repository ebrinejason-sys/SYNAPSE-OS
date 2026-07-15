// Canonical checkout endpoint per the SaaS brief (POST /api/billing/checkout).
// Same handler as /api/billing/subscribe, which predates the brief and is kept
// for the existing billing page — both accept { planSlug } (tenant admin only)
// and compute the amount server-side from subscription_plans.
export { POST, dynamic } from '../subscribe/route'
