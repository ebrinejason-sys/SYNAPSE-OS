import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const insertLead = vi.fn()
const insertMeeting = vi.fn()
const insertActivity = vi.fn()
const selectLead = vi.fn()
const updateLead = vi.fn()

vi.mock('@synapse/db/admin', () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === 'hospital_leads') {
        return {
          insert: (row: unknown) => ({
            select: () => ({
              maybeSingle: async () => insertLead(row),
            }),
          }),
          select: () => ({
            eq: () => ({
              maybeSingle: async () => selectLead(),
            }),
          }),
          update: (row: unknown) => ({
            eq: async () => updateLead(row),
          }),
        }
      }
      if (table === 'commercial_meetings') {
        return {
          insert: (row: unknown) => ({
            select: () => ({
              maybeSingle: async () => insertMeeting(row),
            }),
          }),
        }
      }
      if (table === 'commercial_lead_activities') {
        return {
          insert: async (row: unknown) => insertActivity(row),
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimiters: { meeting: {} },
  checkRateLimit: vi.fn(async () => ({ success: true, remaining: 5 })),
}))

vi.mock('@/lib/resend', () => ({
  resend: { emails: { send: vi.fn(async () => ({ data: { id: '1' }, error: null })) } },
  FROM_EMAIL: 'noreply@synapseos.tech',
  FROM_NAME: 'Synapse OS',
  brandedEmail: ({ body }: { body: string }) => body,
}))

import { POST } from './route'
import { checkRateLimit } from '@/lib/rate-limit'

function req(body: unknown) {
  return new NextRequest('https://synapseos.tech/api/commercial/meetings', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/commercial/meetings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    insertLead.mockResolvedValue({ data: { id: 'lead-1' }, error: null })
    insertMeeting.mockResolvedValue({ data: { id: 'meet-1' }, error: null })
    insertActivity.mockResolvedValue({ error: null })
    selectLead.mockResolvedValue({ data: null })
    updateLead.mockResolvedValue({ error: null })
    vi.mocked(checkRateLimit).mockResolvedValue({ success: true, remaining: 5 })
    delete process.env.RESEND_API_KEY
  })

  it('rejects missing fields', async () => {
    const res = await POST(req({ name: 'A' }))
    expect(res.status).toBe(400)
    expect(insertMeeting).not.toHaveBeenCalled()
  })

  it('rejects invalid email', async () => {
    const res = await POST(req({ name: 'A', workEmail: 'not-an-email' }))
    expect(res.status).toBe(400)
  })

  it('rejects header-injection email', async () => {
    const res = await POST(req({ name: 'A', workEmail: 'a@b.com\nBcc: x@y.com' }))
    expect(res.status).toBe(400)
  })

  it('rejects oversized locations count', async () => {
    const res = await POST(req({ name: 'A', workEmail: 'a@b.com', locationsCount: 999999 }))
    expect(res.status).toBe(400)
  })

  it('rate limits rapid submissions', async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ success: false, remaining: 0 })
    const res = await POST(req({ name: 'A', workEmail: 'a@b.com' }))
    expect(res.status).toBe(429)
  })

  it('persists meeting when email provider is not configured', async () => {
    const res = await POST(
      req({
        name: 'Jane',
        workEmail: 'jane@clinic.ug',
        organization: 'Clinic',
        message: '<script>alert(1)</script>',
        productsInterested: ['os'],
      }),
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.emailStatus).toBe('skipped')
    expect(insertLead).toHaveBeenCalled()
    expect(insertMeeting).toHaveBeenCalled()
    expect(insertActivity).toHaveBeenCalled()
  })
})
