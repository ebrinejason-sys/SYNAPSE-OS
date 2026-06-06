import Link from 'next/link'
import { FileText, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react'

export default function AdminInsurancePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Insurance Copilot</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Manage claims, appeals, and insurer relationships
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {
            href: '/admin/insurance/claims',
            icon: FileText,
            title: 'Claims',
            description: 'Submit and track insurance claims with AI-assisted ICD-11 coding',
            color: '#3B82F6',
          },
          {
            href: '/admin/insurance/appeals',
            icon: AlertTriangle,
            title: 'Appeals',
            description: 'AI-generated appeal letters for denied or underpaid claims',
            color: '#F97316',
          },
          {
            href: '/admin/insurance/claims?status=approved',
            icon: CheckCircle,
            title: 'Approved Claims',
            description: 'View approved and paid claims',
            color: '#22C55E',
          },
          {
            href: '/admin/insurance/claims',
            icon: TrendingUp,
            title: 'Recovery Rate',
            description: 'Track payment recovery and insurer performance',
            color: '#E8B84B',
          },
        ].map(card => (
          <Link
            key={card.href}
            href={card.href}
            className="flex items-start gap-4 rounded-2xl p-5 transition-all hover:border-orange-500/30"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
              style={{ background: `${card.color}20`, color: card.color }}
            >
              <card.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{card.title}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{card.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
