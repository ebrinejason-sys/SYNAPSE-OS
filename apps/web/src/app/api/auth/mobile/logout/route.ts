import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, revokeSession } from '@synapse/auth'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null

  if (!token) {
    return NextResponse.json({ error: 'No token provided' }, { status: 400 })
  }

  try {
    await verifyToken(token)
    await revokeSession(token)
  } catch {
    // Invalid or already-expired token — still clear client-side
  }

  return NextResponse.json({ ok: true })
}
