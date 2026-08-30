import Link from 'next/link'
import { supabaseAdmin } from '@synapse/db/admin'
import { SynapseLogo } from '../../../../components/SynapseLogo'
import { hashInviteToken } from '@/lib/platform/membership.server'
import { roleLabel, type PlatformRole } from '@/lib/platform/rbac'
import { AcceptPlatformInviteForm } from './AcceptPlatformInviteForm'

export default async function PlatformInvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const tokenHash = hashInviteToken(token)

  const { data: invitation } = await db
    .from('platform_invitations')
    .select('email, full_name, platform_role, status, expires_at, accepted_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (!invitation) {
    return <InviteError title="Invalid invitation" message="This link is not valid or has already been used." />
  }

  if (invitation.status === 'ACCEPTED' || invitation.accepted_at) {
    return (
      <InviteError
        title="Invitation already accepted"
        message="Sign in to access the SYNAPSE governance portal."
        action={{ label: 'Sign in', href: '/platform/login' }}
      />
    )
  }

  if (invitation.status !== 'PENDING' || new Date(invitation.expires_at as string) < new Date()) {
    return <InviteError title="Invitation expired" message="Ask your platform administrator to resend the invitation." />
  }

  return (
    <main className="min-h-screen flex flex-col" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <nav className="flex items-center gap-3 px-6 py-4 border-b border-white/10">
        <SynapseLogo size="md" />
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400">
          Platform Access
        </span>
      </nav>
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="font-bold text-2xl mb-2">Accept platform access</h1>
            <p className="text-sm text-slate-400">
              {invitation.full_name as string}, you have been invited as{' '}
              <strong className="text-orange-400">{roleLabel(invitation.platform_role as PlatformRole)}</strong>.
            </p>
            <p className="mt-2 text-xs text-slate-500">{invitation.email as string}</p>
          </div>
          <AcceptPlatformInviteForm token={token} />
        </div>
      </div>
    </main>
  )
}

function InviteError({
  title,
  message,
  action,
}: {
  title: string
  message: string
  action?: { label: string; href: string }
}) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <SynapseLogo size="md" />
      <div className="mt-8 max-w-sm">
        <h1 className="text-xl font-bold mb-2">{title}</h1>
        <p className="text-sm text-slate-400">{message}</p>
        {action ? (
          <Link href={action.href} className="inline-block mt-6 px-6 py-2.5 rounded-xl text-sm font-semibold bg-orange-500 text-black">
            {action.label}
          </Link>
        ) : null}
      </div>
    </main>
  )
}
