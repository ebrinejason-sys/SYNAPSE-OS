import Link from 'next/link'
import { supabaseAdmin } from '@synapse/db/admin'
import { SynapseLogo } from '../../../components/SynapseLogo'
import { RedeemInviteForm } from './RedeemInviteForm'

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any

  const { data: onboarding } = await db
    .from('pharmacy_onboarding')
    .select('tenant_id, invite_expires_at, account_created_at')
    .eq('invite_token', token)
    .maybeSingle()

  if (!onboarding) {
    return (
      <ErrorScreen
        title="Invalid invite"
        message="This invite link is not valid. It may have already been used or the link was copied incorrectly."
      />
    )
  }

  if (onboarding.account_created_at) {
    return (
      <ErrorScreen
        title="Account already set up"
        message="This pharmacy account has already been activated. Sign in to access your dashboard."
        action={{ label: 'Sign in', href: '/login' }}
      />
    )
  }

  if (new Date(onboarding.invite_expires_at as string) < new Date()) {
    return (
      <ErrorScreen
        title="Invite expired"
        message="This invite link has expired. Ask your Synapse administrator to send a new invite from the Pharmacy Network page."
      />
    )
  }

  const tenantId = onboarding.tenant_id as string

  const [{ data: tenant }, { data: profile }] = await Promise.all([
    db.from('tenants').select('name').eq('id', tenantId).maybeSingle(),
    db.from('profiles')
      .select('full_name, email')
      .eq('tenant_id', tenantId)
      .eq('role', 'pharmacy_admin')
      .maybeSingle(),
  ])

  return (
    <main
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}
    >
      {/* Nav */}
      <nav
        className="flex items-center gap-3 px-6 py-4"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <SynapseLogo size="md" />
        <span
          className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(249,115,22,0.1)', color: 'var(--brand-orange)' }}
        >
          Pharmacy
        </span>
      </nav>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div
              className="inline-flex h-14 w-14 items-center justify-center rounded-2xl mb-4"
              style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)' }}
            >
              <span style={{ color: 'var(--brand-orange)', fontSize: 28, fontWeight: 900 }}>S</span>
            </div>
            <h1
              className="font-bold text-2xl mb-2"
              style={{ letterSpacing: '-0.02em', color: 'var(--text-primary)' }}
            >
              Set up your account
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              You have been enrolled as the administrator of{' '}
              <strong style={{ color: 'var(--text-primary)' }}>
                {(tenant?.name as string) ?? 'your pharmacy'}
              </strong>
              . Choose a password to activate your account.
            </p>
          </div>

          <RedeemInviteForm
            token={token}
            pharmacyName={(tenant?.name as string) ?? ''}
            adminName={(profile?.full_name as string) ?? ''}
            adminEmail={(profile?.email as string) ?? ''}
          />

          <div
            className="mt-8 pt-6 flex items-center justify-center gap-4"
            style={{ borderTop: '1px solid var(--border-subtle)' }}
          >
            {['DPPA 2019', 'Encrypted', 'FHIR R4'].map(t => (
              <span key={t} className="text-xs" style={{ color: 'var(--text-muted)' }}>
                ✓ {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}

function ErrorScreen({
  title,
  message,
  action,
}: {
  title: string
  message: string
  action?: { label: string; href: string }
}) {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-4 text-center"
      style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}
    >
      <SynapseLogo size="md" />
      <div className="mt-8 max-w-sm">
        <div
          className="inline-flex h-12 w-12 items-center justify-center rounded-2xl mb-4"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          <span style={{ color: '#EF4444', fontSize: 22 }}>✕</span>
        </div>
        <h1 className="text-xl font-bold mb-2">{title}</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{message}</p>
        {action && (
          <Link
            href={action.href}
            className="inline-block mt-6 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: 'var(--brand-orange)', color: '#07070A' }}
          >
            {action.label}
          </Link>
        )}
      </div>
    </main>
  )
}
