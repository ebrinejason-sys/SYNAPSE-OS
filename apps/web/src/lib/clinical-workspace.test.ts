import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { canDo } from './capability-map.ts'

describe('clinical workspace authorization (P1-009/P1-010)', () => {
  it('P1-009 permits doctors to open queues, order care, and sign encounters', () => {
    assert.equal(canDo('doctor', 'opd', 'queue', 'read'), true)
    assert.equal(canDo('doctor', 'opd', 'encounter', 'create'), true)
    assert.equal(canDo('doctor', 'opd', 'prescription', 'create'), true)
  })

  it('P1-009 rejects receptionist encounter signing through the mirror', () => {
    assert.equal(canDo('receptionist', 'opd', 'encounter', 'sign'), false)
  })

  it('P1-010 allows nurses to record observations but not prescribe', () => {
    assert.equal(canDo('nurse', 'ward', 'round', 'write'), true)
    assert.equal(canDo('nurse', 'opd', 'prescription', 'create'), false)
    assert.equal(canDo('receptionist', 'ward', 'round', 'write'), false)
  })
})