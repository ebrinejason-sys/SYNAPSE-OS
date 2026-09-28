import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { createMemoryDb } from '../../../../../../test-utils/memory-postgrest'

const state = vi.hoisted(() => ({ db: null as any, cap: null as Response | null }))

vi.mock('@synapse/db/admin', () => ({
  supabaseAdmin: { from: (table: string) => state.db.from(table) },
}))
vi.mock('@/lib/hospital-dept', () => ({
  requireHospitalStaffContext: async () => ({
    userId: '00000000-0000-4000-8000-0000000000c1',
    tenantId: '00000000-0000-4000-8000-0000000000t1',
    hospitalId: '00000000-0000-4000-8000-0000000000h1',
    role: 'doctor',
  }),
}))
vi.mock('@/lib/hospital-shared', () => ({
  isContextError: (value: unknown) => value instanceof NextResponse,
  requireHospitalCapability: async () => state.cap,
  gateHospitalModule: async () => null,
  logHospitalAudit: async () => undefined,
}))

import { GET, POST } from './route'

const ENCOUNTER = '00000000-0000-4000-8000-0000000000e1'
const TENANT = '00000000-0000-4000-8000-0000000000t1'

function seed() {
  state.cap = null
  state.db = createMemoryDb({
    encounters: [{ id: ENCOUNTER, tenant_id: TENANT, patient_id: '00000000-0000-4000-8000-0000000000p1', is_signed: false }],
    encounter_diagnoses: [],
  })
}

describe('encounter ICD-11 diagnosis', () => {
  beforeEach(seed)

  it('persists a cache selection and reloads it without a duplicate row', async () => {
    const post = await POST(new NextRequest('http://localhost/api', { method: 'POST', body: JSON.stringify({ stem_code: '1F40' }) }), { params: Promise.resolve({ id: ENCOUNTER }) })
    expect(post.status).toBe(201)
    const created = await post.json()
    expect(created.diagnosis.stem_code).toBe('1F40')
    expect(created.diagnosis.title).toMatch(/Malaria/i)
    expect(created.diagnosis.tenant_id).toBe(TENANT)
    expect(created.idempotent).toBe(false)

    const again = await POST(new NextRequest('http://localhost/api', { method: 'POST', body: JSON.stringify({ stem_code: '1F40' }) }), { params: Promise.resolve({ id: ENCOUNTER }) })
    expect(again.status).toBe(200)
    expect((await again.json()).idempotent).toBe(true)
    expect(state.db.tables.encounter_diagnoses).toHaveLength(1)

    const listed = await GET(new NextRequest('http://localhost/api'), { params: Promise.resolve({ id: ENCOUNTER }) })
    const body = await listed.json()
    expect(body.diagnoses.map((row: { stem_code: string }) => row.stem_code)).toEqual(['1F40'])
  })

  it('does not persist an invented code or a reception denial', async () => {
    const unknown = await POST(new NextRequest('http://localhost/api', { method: 'POST', body: JSON.stringify({ stem_code: 'ZZZZ' }) }), { params: Promise.resolve({ id: ENCOUNTER }) })
    expect(unknown.status).toBe(422)
    state.cap = NextResponse.json({ error: 'forbidden' }, { status: 403 })
    const denied = await POST(new NextRequest('http://localhost/api', { method: 'POST', body: JSON.stringify({ stem_code: '1F40' }) }), { params: Promise.resolve({ id: ENCOUNTER }) })
    expect(denied.status).toBe(403)
    expect(state.db.tables.encounter_diagnoses).toHaveLength(0)
  })
})
