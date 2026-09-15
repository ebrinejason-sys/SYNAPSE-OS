import { NextResponse } from 'next/server'
import { hospitalOutboxWrapMaterial, isContextError } from '@/lib/hospital-shared'
import { requireHospitalStaffContext } from '@/lib/hospital-dept'

export const dynamic = 'force-dynamic'

/** Authenticated identity for offline SyncCommand construction. Never trust client-supplied tenant/actor on apply. */
export async function GET() {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx
  return NextResponse.json({
    syncContext: {
      tenantId: ctx.tenantId,
      facilityId: ctx.hospitalId,
      actorId: ctx.userId,
      role: ctx.role,
      outboxWrapMaterial: hospitalOutboxWrapMaterial(ctx.tenantId, ctx.userId),
    },
  }, { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization' } })
}
