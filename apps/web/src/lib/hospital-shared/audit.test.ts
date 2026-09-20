import { describe, expect, it } from 'vitest'
import { hospitalAuditInsertPayload } from './audit-payload'

const TENANT = '0edb651a-232a-4289-9b3d-ae5bb1bac2cb'
const PROFILE = '81456280-e996-4ff3-84ba-cada261d5061'
const ORDER = '998140bc-e556-458d-8987-669df275f35d'

describe('hospital audit insert payload', () => {
  it('scopes by tenant and actor profile without auth.users created_by', () => {
    const row = hospitalAuditInsertPayload({
      ctx: {
        tenantId: TENANT,
        userId: PROFILE,
        role: 'lab_scientist',
      } as Parameters<typeof hospitalAuditInsertPayload>[0]['ctx'],
      action: 'LAB_RESULT_VERIFIED',
      tableName: 'lab_orders',
      recordId: ORDER,
      newValue: { resultId: 'result-1' },
    })
    expect(row.tenant_id).toBe(TENANT)
    expect(row.user_id).toBe(PROFILE)
    expect(row.user_role).toBe('lab_scientist')
    expect(row.action).toBe('LAB_RESULT_VERIFIED')
    expect(row.table_name).toBe('lab_orders')
    expect(row.record_id).toBe(ORDER)
    expect(row).not.toHaveProperty('created_by')
  })
})
