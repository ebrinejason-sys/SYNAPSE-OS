// packages/auth/src/otp.ts
// Uses auth_otps table (already exists in DB)
// No Next.js imports — safe for all runtimes

import { createHash, timingSafeEqual, randomInt } from 'node:crypto'
import { supabaseAdmin } from '@synapse/db/admin'

export function generateOTP(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

export function hashOTP(otp: string): string {
  return createHash('sha256').update(otp).digest('hex')
}

export function verifyOTPHash(input: string, stored: string): boolean {
  try {
    const a = Buffer.from(hashOTP(input), 'hex')
    const b = Buffer.from(stored, 'hex')
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

const OTP_TTL_MINUTES = 10
const HOURLY_RATE_LIMIT = 3

export async function createAndSendOTP(params: {
  channel: 'email' | 'sms'
  target: string
}): Promise<string> {
  const { count } = await supabaseAdmin
    .from('auth_otps')
    .select('*', { count: 'exact', head: true })
    .eq('target', params.target)
    .eq('channel', params.channel)
    .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())

  if ((count ?? 0) >= HOURLY_RATE_LIMIT) {
    throw new Error('TOO_MANY_REQUESTS')
  }

  const otp = generateOTP()
  const otpHash = hashOTP(otp)
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString()

  const { error } = await supabaseAdmin
    .from('auth_otps')
    .insert({
      channel: params.channel,
      target: params.target,
      otp_hash: otpHash,
      expires_at: expiresAt,
    })

  if (error) throw new Error(`OTP insert failed: ${error.message}`)
  return otp
}

export async function verifyOTP(params: {
  target: string
  otp: string
}): Promise<{ valid: boolean; error?: 'EXPIRED' | 'INVALID' | 'TOO_MANY_ATTEMPTS' | 'NOT_FOUND' }> {
  const { data: row, error: fetchErr } = await supabaseAdmin
    .from('auth_otps')
    .select('id, otp_hash, attempts, expires_at')
    .eq('target', params.target)
    .eq('used', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (fetchErr || !row) return { valid: false, error: 'NOT_FOUND' }
  if (new Date(row.expires_at as string) < new Date()) {
    return { valid: false, error: 'EXPIRED' }
  }
  if ((row.attempts as number) >= 5) return { valid: false, error: 'TOO_MANY_ATTEMPTS' }

  const { error: updateErr } = await supabaseAdmin
    .from('auth_otps')
    .update({ attempts: (row.attempts as number) + 1 })
    .eq('id', row.id as string)

  if (updateErr) console.error('[OTP] Failed to increment attempts:', updateErr.message)

  if (!verifyOTPHash(params.otp, row.otp_hash as string)) {
    return { valid: false, error: 'INVALID' }
  }

  const { error: markErr } = await supabaseAdmin
    .from('auth_otps')
    .update({ used: true })
    .eq('id', row.id as string)
  if (markErr) throw new Error(`Failed to mark OTP used: ${markErr.message}`)
  return { valid: true }
}
