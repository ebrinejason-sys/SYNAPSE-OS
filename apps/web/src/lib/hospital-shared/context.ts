import 'server-only'

import { NextResponse } from 'next/server'

export interface HospitalContext {
  userId: string
  email: string
  role: string
  tenantId: string
  hospitalId: string
  facilityType: string
  fullName: string | null
}

export function isContextError(
  value: HospitalContext | NextResponse,
): value is NextResponse {
  return value instanceof NextResponse
}
