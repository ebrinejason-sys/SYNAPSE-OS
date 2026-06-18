import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'
import { draftAppeal } from '@/lib/insurance/copilot'

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!user.tenantId) {
    return NextResponse.json({ error: 'No tenant context' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as {
    claimId?: string
    claimNumber?: string
    insurerName?: string
    billedAmount?: number
    denialReason?: string
    icd11?: string
  }

  const claimId = typeof body.claimId === 'string' ? body.claimId.trim() : ''
  if (!claimId) {
    return NextResponse.json({ error: 'claimId is required' }, { status: 400 })
  }

  const extraNotes = [
    body.claimNumber ? `Claim number: ${body.claimNumber}` : null,
    body.insurerName ? `Insurer: ${body.insurerName}` : null,
    body.denialReason ? `Denial reason: ${body.denialReason}` : null,
    body.icd11 ? `ICD-11: ${body.icd11}` : null,
    body.billedAmount != null ? `Billed amount: ${body.billedAmount}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  try {
    const letter = await draftAppeal({
      tenantId: user.tenantId,
      claimId,
      actorId: user.id,
      extraNotes: extraNotes || undefined,
    })
    return NextResponse.json({ letter })
  } catch (error) {
    console.error('[insurance/appeal]', error)
    return NextResponse.json({ error: 'Could not generate appeal draft.' }, { status: 500 })
  }
}
