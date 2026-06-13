// apps/web/src/lib/reasoning/types.ts

export type EvidenceSource = 'symptom' | 'sign' | 'lab' | 'imaging' | 'history' | 'vital'
export type HypothesisStatus = 'active' | 'confirmed' | 'overridden' | 'rejected'
export type SessionStatus = 'active' | 'completed' | 'abandoned'
export type ClinicalAction = 'confirm' | 'override' | 'reject'

export interface ReasoningSession {
  id:          string
  encounterId: string
  tenantId:    string
  createdBy:   string
  status:      SessionStatus
  createdAt:   string
  updatedAt:   string
}

export interface ReasoningHypothesis {
  id:                   string
  sessionId:            string
  tenantId:             string
  conditionName:        string
  icd11Code:            string | null
  icd11Uri:             string | null
  priorProbability:     number
  posteriorProbability: number | null
  harmIfMissed:         number
  expectedHarm:         number | null
  cantMiss:             boolean
  status:               HypothesisStatus
  aiReasoning:          string | null
  confidence:           number | null
  rank:                 number | null
}

export interface ReasoningEvidence {
  id:          string
  sessionId:   string
  source:      EvidenceSource
  description: string
  value:       string | null
  present:     boolean
  addedBy:     string
  createdAt:   string
}

export interface EvidenceImpact {
  hypothesisId:    string
  evidenceId:      string
  likelihoodRatio: number
}

export interface ReasoningAction {
  id:           string
  sessionId:    string
  hypothesisId: string
  action:       ClinicalAction
  clinicianId:  string
  reason:       string | null
  diagnosisId:  string | null
  createdAt:    string
}

export interface SessionState {
  session:     ReasoningSession
  hypotheses:  ReasoningHypothesis[]
  evidence:    ReasoningEvidence[]
  actions:     ReasoningAction[]
}

// --- AI proposal types ---

export interface AIHypothesisProposal {
  conditionName:     string
  icd11Code:         string | null
  icd11Uri:          string | null
  priorProbability:  number
  harmIfMissed:      number
  cantMiss:          boolean
  aiReasoning:       string
  confidence:        number
  evidenceImpacts:   Array<{
    evidenceDescription: string
    likelihoodRatio:     number
  }>
}

export interface AIProposalResponse {
  hypotheses:       AIHypothesisProposal[]
  suggestedWorkup:  string[]
  redFlags:         string[]
  clinicalNote:     string
  ucgReference:     string | null
}
