import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, validateSession } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any

async function authUser(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return null

  const payload = await verifyToken(token).catch(() => null)
  if (!payload) return null

  const { valid } = await validateSession(token)
  if (!valid) return null

  return {
    userId: payload.sub as string,
    role: (payload.role as string) ?? '',
    tenantId: (payload.tenant_id as string) || null,
  }
}

export async function POST(req: NextRequest) {
  const user = await authUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as { token?: string; deviceId?: string } | null
  if (!body?.token || !body?.deviceId) {
    return NextResponse.json({ error: 'token and deviceId are required' }, { status: 400 })
  }

  const { error } = await db()
    .from('mobile_push_tokens')
    .upsert(
      {
        user_id: user.userId,
        tenant_id: user.tenantId,
        device_id: body.deviceId,
        token: body.token,
        role: user.role,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,device_id' }
    )

  if (error) {
    return NextResponse.json({ error: 'Failed to register push token' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const user = await authUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as { deviceId?: string } | null
  if (!body?.deviceId) {
    return NextResponse.json({ error: 'deviceId is required' }, { status: 400 })
  }

  await db()
    .from('mobile_push_tokens')
    .delete()
    .eq('user_id', user.userId)
    .eq('device_id', body.deviceId)

  return NextResponse.json({ success: true })
}
