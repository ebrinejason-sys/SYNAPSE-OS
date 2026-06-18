#!/usr/bin/env npx tsx
/**
 * Admin-only: set password + verify email for a platform user.
 *
 * Usage (service role required):
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   npx tsx scripts/seed-admin-password.ts nathandavid762@gmail.com
 *
 * Prints a one-time temporary password to stdout — deliver out-of-band.
 */

import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { hashPassword } from '../packages/auth/src/password'

const emailArg = process.argv[2]?.trim().toLowerCase()
if (!emailArg) {
  console.error('Usage: npx tsx scripts/seed-admin-password.ts <email>')
  process.exit(1)
}

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

function tempPassword(): string {
  const raw = randomBytes(12).toString('base64url')
  return `Syn-${raw.slice(0, 10)}!1`
}

async function main() {
  const db = createClient(url!, key!, { auth: { persistSession: false } })

  const { data: profile, error } = await db
    .from('profiles')
    .select('id, email, role')
    .eq('email', emailArg)
    .maybeSingle()

  if (error || !profile) {
    console.error('Profile not found:', emailArg)
    process.exit(1)
  }

  const password = tempPassword()
  const passwordHash = await hashPassword(password)
  const now = new Date().toISOString()

  const { error: updateErr } = await db
    .from('profiles')
    .update({
      password_hash: passwordHash,
      email_verified_at: now,
      must_change_password: true,
      login_attempts: 0,
      locked_until: null,
      updated_at: now,
    })
    .eq('id', profile.id)

  if (updateErr) {
    console.error('Update failed:', updateErr.message)
    process.exit(1)
  }

  console.log(JSON.stringify({
    ok: true,
    email: profile.email,
    role: profile.role,
    temporaryPassword: password,
    mustChangePassword: true,
    note: 'Deliver password out-of-band. User must change on first login.',
  }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
