import Link from 'next/link'
import { ArrowLeft, ShieldAlert } from 'lucide-react'

export default function AdminMFAPage() {
  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/settings" className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft className="h-4 w-4" /> Settings
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Authenticator App</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          MFA setup has moved to the platform-admin sign-in flow.
        </p>
      </div>

      <div
        className="rounded-2xl p-5 space-y-4"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'rgba(249,115,22,0.12)', color: 'var(--brand-orange)' }}
          >
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Legacy MFA setup disabled</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              This page no longer enrolls Supabase Auth factors because Synapse now verifies platform MFA through its custom session flow.
            </p>
          </div>
        </div>

        <Link href="/platform/mfa" className="btn-primary inline-flex w-full items-center justify-center">
          Open Platform MFA
        </Link>
      </div>
    </div>
  )
}
