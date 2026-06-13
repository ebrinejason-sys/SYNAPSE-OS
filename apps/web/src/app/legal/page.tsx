import Link from 'next/link'
import { FileText, LockKeyhole, ShieldCheck } from 'lucide-react'
import { SynapseLogo } from '../../components/SynapseLogo'

const links = [
  { href: '/legal/privacy', label: 'Privacy Policy', icon: LockKeyhole },
  { href: '/legal/terms', label: 'Terms of Service', icon: FileText },
  { href: '/legal/dpa', label: 'Data Processing Agreement', icon: ShieldCheck },
]

export default function LegalPage() {
  return (
    <main className="min-h-screen px-6 py-10" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="inline-flex">
          <SynapseLogo size="md" />
        </Link>

        <div className="mt-14">
          <p className="section-label">Legal</p>
          <h1 className="font-display text-3xl font-bold md:text-5xl">Synapse OS legal center.</h1>
          <p className="mt-4 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
            Policies and agreements for patients, facilities, pharmacies, and platform operators.
          </p>
        </div>

        <div className="mt-10 grid gap-4">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center justify-between rounded-2xl p-5"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}
            >
              <span className="flex items-center gap-3 font-semibold">
                <Icon className="h-5 w-5" style={{ color: 'var(--brand-orange)' }} />
                {label}
              </span>
              <span style={{ color: 'var(--brand-orange)' }}>Open</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
