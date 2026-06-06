import Link from 'next/link'
import { FileText, CreditCard, TrendingUp } from 'lucide-react'

export default function AdminFinancePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Finance</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Invoices, payments, and financial reporting</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { href: '/admin/finance/invoices', icon: FileText, title: 'Invoices', desc: 'Create and manage patient invoices', color: '#3B82F6' },
          { href: '/admin/finance/payments', icon: CreditCard, title: 'Payments', desc: 'Track payments and outstanding balances', color: '#22C55E' },
          { href: '/admin/insurance/claims', icon: TrendingUp, title: 'Insurance Claims', desc: 'Submit and track insurance reimbursements', color: '#F97316' },
        ].map(card => (
          <Link key={card.href} href={card.href}
            className="flex items-start gap-4 rounded-2xl p-5 transition-all hover:border-orange-500/30"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
              style={{ background: `${card.color}20`, color: card.color }}>
              <card.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{card.title}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{card.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
