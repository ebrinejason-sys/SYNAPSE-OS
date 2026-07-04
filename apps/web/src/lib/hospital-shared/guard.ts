import 'server-only'

import { NextResponse } from 'next/server'
import { requireCapability, CapabilityError } from '@synapse/auth/capability'
import type { HospitalContext } from './context'

export async function requireHospitalCapability(
  ctx: HospitalContext,
  resource: string,
  action: string,
  module = 'config',
): Promise<NextResponse | null> {
  try {
    await requireCapability(
      { role: ctx.role },
      module,
      resource,
      action,
      ctx.facilityType === 'hospital' ? 'hospital' : 'any',
    )
    return null
  } catch (e) {
    if (e instanceof CapabilityError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    throw e
  }
}
