// apps/web/src/lib/reasoning/engine.ts
// Server-side reasoning engine — all DB operations.
// DECISION SUPPORT ONLY. The engine proposes; licensed clinicians decide.

import { supabaseAdmin } from '@synapse/db/admin'
import type {
  SessionState, ReasoningSession, ReasoningHypothesis, ReasoningEvidence,
  AIHypothesisProposal, ClinicalAction, EvidenceSource,
} from './types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabaseAdmin as any

// ── Session management ──────────────────────────────────────────────────────

export async function startReasoningSession(params: {
  encounterId: string
  clinicianId: string
  tenantId:    string
}): Promise<ReasoningSession> {
  const { data, error } = await db
    .from('reasoning_sessions')
    .insert({
      encounter_id: params.encounterId,
      tenant_id:    params.tenantId,
      created_by:   params.clinicianId,
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to start reasoning session: ${error.message}`)

  await auditEvent(data.id, params.tenantId, 'session_started', params.clinicianId, {
    encounter_id: params.encounterId,
  })

  return mapSession(data)
}

export async function getSessionByEncounter(
  encounterId: string,
  tenantId: string,
): Promise<ReasoningSession | null> {
  const { data } = await db
    .from('reasoning_sessions')
    .select()
    .eq('encounter_id', encounterId)
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data ? mapSession(data) : null
}

export async function getSessionState(sessionId: string): Promise<SessionState> {
  const [sessRes, hypRes, evidRes, actRes] = await Promise.all([
    db.from('reasoning_sessions').select().eq('id', sessionId).single(),
    db.from('reasoning_hypotheses').select().eq('session_id', sessionId)
       .order('rank', { ascending: true }).order('created_at', { ascending: true }),
    db.from('reasoning_evidence').select().eq('session_id', sessionId)
       .order('created_at', { ascending: true }),
    db.from('reasoning_actions').select().eq('session_id', sessionId)
       .order('created_at', { ascending: false }),
  ])

  if (sessRes.error) throw new Error(`Session not found: ${sessRes.error.message}`)

  return {
    session:    mapSession(sessRes.data),
    hypotheses: (hypRes.data ?? []).map(mapHypothesis),
    evidence:   (evidRes.data ?? []).map(mapEvidence),
    actions:    (actRes.data ?? []).map(mapAction),
  }
}

// ── Evidence ────────────────────────────────────────────────────────────────

export async function addEvidence(params: {
  sessionId:   string
  tenantId:    string
  source:      EvidenceSource
  description: string
  value?:      string
  present:     boolean
  addedBy:     string
}): Promise<ReasoningEvidence> {
  const { data: evidence, error } = await db
    .from('reasoning_evidence')
    .insert({
      session_id:  params.sessionId,
      tenant_id:   params.tenantId,
      source:      params.source,
      description: params.description,
      value:       params.value ?? null,
      present:     params.present,
      added_by:    params.addedBy,
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to add evidence: ${error.message}`)

  await auditEvent(params.sessionId, params.tenantId, 'evidence_added', params.addedBy, {
    evidence_id:  evidence.id,
    description:  params.description,
    present:      params.present,
  })

  return mapEvidence(evidence)
}

// ── Hypotheses ──────────────────────────────────────────────────────────────

export async function addHypothesis(params: {
  sessionId:        string
  tenantId:         string
  conditionName:    string
  icd11Code?:       string
  icd11Uri?:        string
  priorProbability: number
  harmIfMissed:     number
  cantMiss?:        boolean
  aiReasoning?:     string
  confidence?:      number
}): Promise<ReasoningHypothesis> {
  const { data: hyp, error } = await db
    .from('reasoning_hypotheses')
    .insert({
      session_id:        params.sessionId,
      tenant_id:         params.tenantId,
      condition_name:    params.conditionName,
      icd11_code:        params.icd11Code ?? null,
      icd11_uri:         params.icd11Uri ?? null,
      prior_probability: params.priorProbability,
      harm_if_missed:    params.harmIfMissed,
      cant_miss:         params.cantMiss ?? false,
      ai_reasoning:      params.aiReasoning ?? null,
      confidence:        params.confidence ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to add hypothesis: ${error.message}`)

  await auditEvent(params.sessionId, params.tenantId, 'hypothesis_added', null, {
    hypothesis_id:  hyp.id,
    condition_name: params.conditionName,
    cant_miss:      params.cantMiss ?? false,
  })

  return mapHypothesis(hyp)
}

export async function setEvidenceImpact(params: {
  sessionId:       string
  hypothesisId:    string
  evidenceId:      string
  likelihoodRatio: number
}): Promise<void> {
  const { error } = await db
    .from('reasoning_evidence_impact')
    .upsert({
      session_id:       params.sessionId,
      hypothesis_id:    params.hypothesisId,
      evidence_id:      params.evidenceId,
      likelihood_ratio: params.likelihoodRatio,
      computed_at:      new Date().toISOString(),
    }, { onConflict: 'hypothesis_id,evidence_id' })

  if (error) throw new Error(`Failed to set evidence impact: ${error.message}`)
}

export async function recomputeDifferential(sessionId: string): Promise<void> {
  const { error } = await db.rpc('recompute_differential', { p_session_id: sessionId })
  if (error) throw new Error(`Recompute failed: ${error.message}`)
}

// ── Clinical actions ─────────────────────────────────────────────────────────

export async function takeClinicalAction(params: {
  sessionId:    string
  hypothesisId: string
  tenantId:     string
  action:       ClinicalAction
  clinicianId:  string
  reason?:      string
  encounterId?: string
}): Promise<void> {
  let diagnosisId: string | null = null

  if (params.action === 'confirm' && params.encounterId) {
    // Confirmed diagnosis → write to encounter_diagnoses
    const { data: hyp } = await db
      .from('reasoning_hypotheses')
      .select('condition_name, icd11_code, icd11_uri, posterior_probability')
      .eq('id', params.hypothesisId)
      .single()

    if (hyp) {
      const { data: dx } = await db
        .from('encounter_diagnoses')
        .insert({
          encounter_id:   params.encounterId,
          tenant_id:      params.tenantId,
          title:          hyp.condition_name,
          stem_code:      hyp.icd11_code ?? null,
          foundation_uri: hyp.icd11_uri ?? null,
          certainty:      'confirmed',
          diagnosis_type: 'primary',
          created_by:     params.clinicianId,
        })
        .select('id')
        .single()
      diagnosisId = dx?.id ?? null
    }
  }

  // Update hypothesis status
  await db
    .from('reasoning_hypotheses')
    .update({ status: params.action === 'confirm' ? 'confirmed' : params.action, updated_at: new Date().toISOString() })
    .eq('id', params.hypothesisId)

  // Record action
  await db.from('reasoning_actions').insert({
    session_id:    params.sessionId,
    hypothesis_id: params.hypothesisId,
    tenant_id:     params.tenantId,
    action:        params.action,
    clinician_id:  params.clinicianId,
    reason:        params.reason ?? null,
    diagnosis_id:  diagnosisId,
  })

  await auditEvent(params.sessionId, params.tenantId, 'action_taken', params.clinicianId, {
    action:        params.action,
    hypothesis_id: params.hypothesisId,
    diagnosis_id:  diagnosisId,
  })
}

// ── AI proposal integration ─────────────────────────────────────────────────

export async function applyAIProposal(params: {
  sessionId:   string
  tenantId:    string
  proposals:   AIHypothesisProposal[]
  evidence:    ReasoningEvidence[]
}): Promise<void> {
  for (const proposal of params.proposals) {
    const hyp = await addHypothesis({
      sessionId:        params.sessionId,
      tenantId:         params.tenantId,
      conditionName:    proposal.conditionName,
      icd11Code:        proposal.icd11Code ?? undefined,
      icd11Uri:         proposal.icd11Uri ?? undefined,
      priorProbability: Math.max(0.0001, Math.min(0.9999, proposal.priorProbability)),
      harmIfMissed:     Math.max(0, Math.min(1, proposal.harmIfMissed)),
      cantMiss:         proposal.cantMiss,
      aiReasoning:      proposal.aiReasoning,
      confidence:       proposal.confidence,
    })

    // Match AI evidence impacts to existing evidence by description
    for (const impact of proposal.evidenceImpacts) {
      const matchedEvidence = params.evidence.find(e =>
        e.description.toLowerCase().includes(impact.evidenceDescription.toLowerCase()) ||
        impact.evidenceDescription.toLowerCase().includes(e.description.toLowerCase())
      )
      if (matchedEvidence) {
        await setEvidenceImpact({
          sessionId:       params.sessionId,
          hypothesisId:    hyp.id,
          evidenceId:      matchedEvidence.id,
          likelihoodRatio: Math.max(0.001, impact.likelihoodRatio),
        })
      }
    }
  }

  await recomputeDifferential(params.sessionId)
}

// ── Audit helper ─────────────────────────────────────────────────────────────

async function auditEvent(
  sessionId: string,
  tenantId:  string,
  eventType: string,
  actorId:   string | null,
  payload:   Record<string, unknown>,
): Promise<void> {
  await db.from('reasoning_audit').insert({
    session_id: sessionId,
    tenant_id:  tenantId,
    event_type: eventType,
    actor_id:   actorId,
    payload,
  })
}

// ── Row mappers ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSession(r: any): ReasoningSession {
  return {
    id:          r.id,
    encounterId: r.encounter_id,
    tenantId:    r.tenant_id,
    createdBy:   r.created_by,
    status:      r.status,
    createdAt:   r.created_at,
    updatedAt:   r.updated_at,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapHypothesis(r: any): ReasoningHypothesis {
  return {
    id:                   r.id,
    sessionId:            r.session_id,
    tenantId:             r.tenant_id,
    conditionName:        r.condition_name,
    icd11Code:            r.icd11_code,
    icd11Uri:             r.icd11_uri,
    priorProbability:     Number(r.prior_probability),
    posteriorProbability: r.posterior_probability != null ? Number(r.posterior_probability) : null,
    harmIfMissed:         Number(r.harm_if_missed),
    expectedHarm:         r.expected_harm != null ? Number(r.expected_harm) : null,
    cantMiss:             r.cant_miss,
    status:               r.status,
    aiReasoning:          r.ai_reasoning,
    confidence:           r.confidence != null ? Number(r.confidence) : null,
    rank:                 r.rank,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapEvidence(r: any): ReasoningEvidence {
  return {
    id:          r.id,
    sessionId:   r.session_id,
    source:      r.source,
    description: r.description,
    value:       r.value,
    present:     r.present,
    addedBy:     r.added_by,
    createdAt:   r.created_at,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAction(r: any): ReasoningAction {
  return {
    id:           r.id,
    sessionId:    r.session_id,
    hypothesisId: r.hypothesis_id,
    action:       r.action,
    clinicianId:  r.clinician_id,
    reason:       r.reason,
    diagnosisId:  r.diagnosis_id,
    createdAt:    r.created_at,
  }
}

// ── Re-export for convenience ─────────────────────────────────────────────────
import type { ReasoningAction } from './types'
export type { SessionState, ReasoningSession, ReasoningHypothesis, ReasoningEvidence, ReasoningAction }
