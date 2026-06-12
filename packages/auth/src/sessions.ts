// packages/auth/src/sessions.ts
// Uses synapse_sessions table (created by DB migration 20260612000001)
// No Next.js imports — safe for all runtimes

import { createHash } from 'node:crypto'
import { supabaseAdmin } from '@synapse/db/admin'
import { SESSION_DURATION_DAYS } from '@synapse/config/constants'

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function createSession(params: {
  userId: string
  token: string
  app: 'web' | 'pharmacy' | 'mobile'
  ip?: string
  userAgent?: string
}): Promise<void> {
  const tokenHash = hashToken(params.token)
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS)

  const { error } = await supabaseAdmin.from('synapse_sessions').insert({
    user_id: params.userId,
    token_hash: tokenHash,
    app: params.app,
    ip_address: params.ip,
    user_agent: params.userAgent,
    expires_at: expiresAt.toISOString(),
  })

  if (error) throw new Error(`Session creation failed: ${error.message}`)
}

export async function validateSession(
  token: string
): Promise<{ valid: boolean; userId?: string }> {
  const tokenHash = hashToken(token)
  const { data } = await supabaseAdmin
    .from('synapse_sessions')
    .select('user_id, expires_at, revoked_at')
    .eq('token_hash', tokenHash)
    .single()

  if (!data) return { valid: false }
  if (data.revoked_at) return { valid: false }
  if (new Date(data.expires_at as string) < new Date()) return { valid: false }

  return { valid: true, userId: data.user_id as string }
}

export async function revokeSession(token: string): Promise<void> {
  const tokenHash = hashToken(token)
  const { error } = await supabaseAdmin
    .from('synapse_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('token_hash', tokenHash)
  if (error) console.error('[SESSION] Failed to revoke session:', error.message)
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('synapse_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('revoked_at', null)
  if (error) console.error('[SESSION] Failed to revoke all sessions for user:', userId, error.message)
}
