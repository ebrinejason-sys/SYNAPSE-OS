import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildMeetingLeadRow,
  buildMeetingRow,
  canTransitionStage,
  leadToProvisioningDraft,
  normalizeCrmStage,
  validateMeetingRequest,
} from './commercial-crm.ts'

describe('commercial CRM domain', () => {
  it('validates and sanitizes meeting requests', () => {
    const ok = validateMeetingRequest({
      name: '  Jane Doe  ',
      workEmail: 'jane@hospital.ug',
      phone: '+256700000000',
      organization: 'Mulago',
      facilityType: 'hospital',
      productsInterested: ['os', 'lab'],
      message: 'Need enterprise rollout',
    })
    assert.equal(ok.ok, true)
    if (ok.ok) {
      assert.equal(ok.value.name, 'Jane Doe')
      assert.equal(ok.value.workEmail, 'jane@hospital.ug')
      assert.deepEqual(ok.value.productsInterested, ['os', 'lab'])
    }

    const bad = validateMeetingRequest({ name: 'x', workEmail: 'not-an-email' })
    assert.equal(bad.ok, false)

    const inject = validateMeetingRequest({
      name: 'Eve',
      workEmail: 'eve@evil.com\nBcc: hacked@x.com',
    })
    assert.equal(inject.ok, false)
  })

  it('normalizes legacy and modern CRM stages', () => {
    assert.equal(normalizeCrmStage('interest'), 'LEAD')
    assert.equal(normalizeCrmStage('DEMO_BOOKED'), 'DEMO_BOOKED')
    assert.equal(normalizeCrmStage('lost'), 'LOST')
    assert.equal(normalizeCrmStage('nope'), null)
  })

  it('allows safe stage transitions', () => {
    assert.equal(canTransitionStage('LEAD', 'CONTACTED'), true)
    assert.equal(canTransitionStage('QUALIFIED', 'CONTACTED'), true)
    assert.equal(canTransitionStage('QUALIFIED', 'LEAD'), false)
    assert.equal(canTransitionStage('ACTIVE', 'LOST'), false)
    assert.equal(canTransitionStage('LOST', 'LEAD'), true)
  })

  it('builds lead and meeting persistence rows', () => {
    const validated = validateMeetingRequest({
      name: 'Sam',
      workEmail: 'sam@clinic.ug',
      organization: 'Clinic A',
      facilityName: 'Clinic A Main',
      preferredMeetingAt: '2026-10-01T10:00:00+03:00',
    })
    assert.equal(validated.ok, true)
    if (!validated.ok) return
    const lead = buildMeetingLeadRow(validated.value)
    assert.equal(lead.stage, 'LEAD')
    assert.equal(lead.status, 'meeting_requested')
    assert.equal(lead.facility_name, 'Clinic A Main')
    assert.equal(typeof lead.meeting_preferred_at, 'string')
    assert.ok(lead.meeting_preferred_at?.startsWith('2026-10-01'))
    const meeting = buildMeetingRow(validated.value, 'lead-1')
    assert.equal(meeting.status, 'requested')
    assert.equal(meeting.lead_id, 'lead-1')
    assert.equal(typeof meeting.preferred_at, 'string')
    assert.ok(meeting.preferred_at?.startsWith('2026-10-01'))
  })

  it('handles free-text preferredMeetingAt without breaking timestamptz', () => {
    const validated = validateMeetingRequest({
      name: 'Alex',
      workEmail: 'alex@lab.ug',
      message: 'Interested in Lab module',
      preferredMeetingAt: 'weekday mornings',
    })
    assert.equal(validated.ok, true)
    if (!validated.ok) return
    const lead = buildMeetingLeadRow(validated.value)
    assert.equal(lead.meeting_preferred_at, null)
    assert.ok(lead.notes?.includes('Preferred meeting: weekday mornings'))
    assert.ok(lead.notes?.includes('Interested in Lab module'))
    const meeting = buildMeetingRow(validated.value, 'lead-2')
    assert.equal(meeting.preferred_at, null)
    assert.ok(meeting.message?.includes('Preferred meeting: weekday mornings'))
    assert.ok(meeting.message?.includes('Interested in Lab module'))
  })

  it('parses valid ISO timestamp into timestamptz', () => {
    const validated = validateMeetingRequest({
      name: 'Taylor',
      workEmail: 'taylor@hospital.ug',
      preferredMeetingAt: '2026-11-15T14:30:00Z',
    })
    assert.equal(validated.ok, true)
    if (!validated.ok) return
    const lead = buildMeetingLeadRow(validated.value)
    assert.equal(lead.meeting_preferred_at, '2026-11-15T14:30:00.000Z')
    const meeting = buildMeetingRow(validated.value, 'lead-3')
    assert.equal(meeting.preferred_at, '2026-11-15T14:30:00.000Z')
  })

  it('converts a lead into a provisioning draft without retyping', () => {
    const draft = leadToProvisioningDraft({
      id: 'lead-9',
      organization_name: 'Acme Health',
      facility_name: 'Acme Hospital',
      facility_type: 'hospital',
      contact_name: 'Pat',
      contact_email: 'pat@acme.ug',
      contact_phone: '+256711',
      country: 'UG',
      district: 'Kampala',
      requested_products: ['os', 'lab'],
    })
    assert.equal(draft.organizationName, 'Acme Health')
    assert.equal(draft.facilityName, 'Acme Hospital')
    assert.equal(draft.contactEmail, 'pat@acme.ug')
    assert.deepEqual(draft.requestedProducts, ['os', 'lab'])
  })
})
