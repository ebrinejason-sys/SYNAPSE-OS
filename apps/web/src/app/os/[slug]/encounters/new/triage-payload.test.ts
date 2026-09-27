import { describe, expect, it } from 'vitest'
import { buildTriagePayload, triageErrorMessage } from './triage-payload'

describe('new encounter triage payload (D1 regression)', () => {
  it('never sends a diagnosis as clinical_stage', () => {
    const body = buildTriagePayload({ patientId: 'p', complaint: ' Fever ', temperature: '38.4', heartRate: '', spo2: 'x' })
    expect(body).toEqual({ patient_id: 'p', chief_complaint: 'Fever', clinical_stage: undefined, temperature_c: 38.4, heart_rate: undefined, bp_systolic: undefined, bp_diastolic: undefined, spo2: undefined })
    expect(Object.keys(buildTriagePayload({ patientId: 'p', complaint: 'x' }))).not.toContain('diagnosis')
  })
  it('passes an explicit triage acuity through', () => {
    expect(buildTriagePayload({ patientId: 'p', complaint: 'x', stage: 'RED' }).clinical_stage).toBe('RED')
  })
  it('turns API errors into a visible message instead of failing silently', () => {
    expect(triageErrorMessage(403, { error: 'Forbidden' })).toBe('Forbidden')
    expect(triageErrorMessage(400, { error: { fieldErrors: { clinical_stage: ['Invalid enum value'] } } })).toBe('clinical_stage: Invalid enum value')
    expect(triageErrorMessage(402, { error: 'feature_not_available', message: 'Upgrade' })).toBe('feature_not_available: Upgrade')
    expect(triageErrorMessage(500, null)).toBe('Could not save encounter (HTTP 500)')
  })
})
