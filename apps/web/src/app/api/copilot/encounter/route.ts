// Four-copilot encounter view — DECISION SUPPORT ONLY.
// Returns: clinical differential | insurance eligibility | pharmacy stock | billing estimate.
// All outputs are advisory. No auto-confirm, no auto-submit, no auto-dispense.

import { NextRequest, NextResponse } from 'next/server'
import { getContext } from '@synapse/auth/context'
import { requireCapability } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabaseAdmin as any

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = await getContext('web', '/os').catch(() => null)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await requireCapability(ctx.user, 'clinical', 'encounter', 'read')

  const encounterId = req.nextUrl.searchParams.get('encounter_id')
  if (!encounterId) return NextResponse.json({ error: 'encounter_id required' }, { status: 400 })

  const tenantId = ctx.user.tenant_id

  const [sessionRes, patientsRes, coverageRes, stockRes] = await Promise.all([

    // 1. Clinical copilot: current reasoning session state
    db.from('reasoning_sessions')
      .select('id, status, created_at')
      .eq('encounter_id', encounterId)
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Get patient_id from encounter
    db.from('encounters')
      .select('patient_id, status, chief_complaint')
      .eq('id', encounterId)
      .eq('tenant_id', tenantId)
      .maybeSingle(),

    // 2. Insurance copilot: eligibility check (read only)
    Promise.resolve(null),  // populated below once we have patient_id

    // 3. Pharmacy availability: check if top-ranked diagnoses have linked drugs in stock
    Promise.resolve(null),  // populated below
  ])

  if (!patientsRes.data) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 })
  }

  const patientId = patientsRes.data.patient_id as string

  // Insurance: active policy
  const { data: policy } = await db
    .from('insurance_policies')
    .select('id, plan_name, status, copay_amount, expiry_date')
    .eq('patient_id', patientId)
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .order('effective_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Reasoning hypotheses (top 5 ranked)
  const sessionId = sessionRes.data?.id
  const hypotheses = sessionId ? (await db
    .from('reasoning_hypotheses')
    .select('condition_name, posterior_probability, harm_if_missed, expected_harm, cant_miss, status, rank')
    .eq('session_id', sessionId)
    .eq('status', 'active')
    .order('rank', { ascending: true })
    .limit(5)).data ?? [] : []

  // Context snapshot (latest)
  const { data: snapshot } = sessionId ? await db
    .from('reasoning_context_snapshots')
    .select('active_patterns, active_meds, insurance_context, vitals')
    .eq('session_id', sessionId)
    .order('snapshot_at', { ascending: false })
    .limit(1)
    .maybeSingle() : { data: null }

  // Pharmacy: check stock for active meds in context
  const activeMedNames: string[] = (snapshot?.active_meds ?? []).map(
    (m: Record<string, string>) => m.name
  )
  const stockSummary = activeMedNames.length > 0
    ? await db
        .from('pharmacy_products')
        .select('name, quantity_in_stock, unit')
        .eq('tenant_id', tenantId)
        .in('name', activeMedNames.slice(0, 5))
        .then((r: { data: unknown[] | null }) => (r.data ?? []))
    : []

  return NextResponse.json({
    encounterId,
    patientId,

    // Copilot 1: Clinical differential
    clinical: {
      sessionId:   sessionId ?? null,
      sessionStatus: sessionRes.data?.status ?? null,
      hypotheses:  hypotheses.map((h: Record<string, unknown>) => ({
        conditionName:       h.condition_name,
        posteriorProbability: h.posterior_probability,
        harmIfMissed:        h.harm_if_missed,
        expectedHarm:        h.expected_harm,
        cantMiss:            h.cant_miss,
        rank:                h.rank,
      })),
      activePatterns: snapshot?.active_patterns ?? [],
      vitals:         snapshot?.vitals ?? null,
    },

    // Copilot 2: Insurance
    insurance: {
      hasCoverage:  !!policy,
      planName:     policy?.plan_name ?? null,
      policyStatus: policy?.status ?? null,
      copayAmount:  policy?.copay_amount ?? null,
      expiryDate:   policy?.expiry_date ?? null,
    },

    // Copilot 3: Pharmacy availability
    pharmacy: {
      activeMeds: activeMedNames,
      stockCheck: (stockSummary as Record<string, unknown>[]).map(p => ({
        name:     p.name,
        inStock:  (p.quantity_in_stock as number) > 0,
        quantity: p.quantity_in_stock,
        unit:     p.unit,
      })),
    },

    // Copilot 4: Billing (simplified — advisory)
    billing: {
      hasInsurance: !!policy,
      estimatedCopay: policy?.copay_amount ?? null,
      note: 'Billing estimate is advisory. Review with billing department before posting.',
    },
  })
}
