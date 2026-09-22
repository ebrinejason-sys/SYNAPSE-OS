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

  it('fails when lead update fails after insert conflict', async () => {
    insertLead.mockResolvedValueOnce({ data: null, error: { message: 'unique violation' } })
    selectLead.mockResolvedValueOnce({ data: { id: 'existing-lead' } })
    updateLead.mockResolvedValueOnce({ error: { message: 'update failed' } })

    const res = await POST(req({ name: 'Bob', workEmail: 'bob@test.ug' }))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toContain('Could not update lead record')
    expect(insertMeeting).not.toHaveBeenCalled()
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

  it('escapes HTML in outbound notification email', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    const mockSend = vi.fn(async () => ({ data: { id: 'sent' }, error: null }))
    const { resend } = await import('@/lib/resend')
    vi.mocked(resend.emails.send).mockImplementation(mockSend)

    const res = await POST(
      req({
        name: '<script>alert(1)</script>',
        workEmail: 'test@clinic.ug',
        organization: '<img src=x onerror=alert(1)>',
        facilityName: '<b>Evil</b>',
        facilityType: '<i>Phish</i>',
        message: '<script>document.location="http://evil.com"</script>',
        preferredMeetingAt: '<a href="javascript:void(0)">click</a>',
      }),
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.emailStatus).toBe('sent')

    expect(mockSend).toHaveBeenCalledTimes(2)
    const [notifyCall] = mockSend.mock.calls
    const notifyHtml = notifyCall[0].html as string
    expect(notifyHtml).not.toContain('<script>')
    expect(notifyHtml).not.toMatch(/<img[^>]*src=/i)
    expect(notifyHtml).not.toMatch(/<a[^>]*href=["']?javascript:/i)
    expect(notifyHtml).toContain('&lt;script&gt;')
    expect(notifyHtml).toContain('&lt;img')
    expect(notifyHtml).toContain('&lt;b&gt;Evil&lt;&#x2F;b&gt;')
  })

  it('escapes HTML in user confirmation email', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    const mockSend = vi.fn(async () => ({ data: { id: 'sent' }, error: null }))
    const { resend } = await import('@/lib/resend')
    vi.mocked(resend.emails.send).mockImplementation(mockSend)

    const res = await POST(
      req({
        name: '<script>xss</script>',
        workEmail: 'user@test.ug',
      }),
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.emailStatus).toBe('sent')

    expect(mockSend).toHaveBeenCalledTimes(2)
    const [, confirmCall] = mockSend.mock.calls
    const confirmHtml = confirmCall[0].html as string
    expect(confirmHtml).not.toContain('<script>')
    expect(confirmHtml).toContain('&lt;script&gt;')
  })
})
