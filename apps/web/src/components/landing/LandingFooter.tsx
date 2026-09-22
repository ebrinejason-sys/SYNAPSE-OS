import Link from 'next/link'
import { SynapseLogo } from '../SynapseLogo'
import { COMPANY, PUBLIC_CONTACT_EMAIL } from '@synapse/config/company'

const FOOTER_LINKS = {
  Product: [
    { href: '/products/os', label: 'SYNAPSE OS' },
    { href: '/products/pharmacy', label: 'SYNAPSE Pharmacy' },
    { href: '/products/lab', label: 'SYNAPSE Lab' },
    { href: '/pricing', label: 'Pricing' },
    { href: COMPANY.domains.pharmacy, label: 'Pharmacy app' },
    { href: COMPANY.domains.lab, label: 'Lab product' },
    { href: '/status', label: 'Status' },
  ],
  Company: [
    { href: '/book-meeting', label: 'Book a Meeting' },
    { href: '/contact', label: 'Contact' },
    { href: '/careers', label: 'Careers' },
    { href: '/about', label: 'About' },
  ],
  Legal: [
    { href: '/legal/privacy', label: 'Privacy' },
    { href: '/legal/terms', label: 'Terms' },
    { href: '/legal/dpa', label: 'Data processing' },
  ],
} as const

export function LandingFooter() {
  return (
    <footer className="landing-footer">
      <div className="landing-container">
        <div className="grid gap-10 pb-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <SynapseLogo size="sm" className="mb-4" />
            <p className="max-w-xs text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {COMPANY.tagline}
            </p>
            <p className="mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
              {COMPANY.legalName} · {COMPANY.location}
            </p>
            <a
              href={`mailto:${PUBLIC_CONTACT_EMAIL}`}
              className="mt-3 inline-block text-sm"
              style={{ color: 'var(--brand-orange)' }}
            >
              {PUBLIC_CONTACT_EMAIL}
            </a>
          </div>

          {(
            Object.entries(FOOTER_LINKS) as [
              keyof typeof FOOTER_LINKS,
              (typeof FOOTER_LINKS)[keyof typeof FOOTER_LINKS],
            ][]
          ).map(([group, links]) => (
            <div key={group}>
              <p className="landing-footer-heading">{group}</p>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="landing-footer-link">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="landing-footer-bar">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            © {new Date().getFullYear()} {COMPANY.legalName}. All rights reserved.
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Built for African healthcare environments · ICD-11 · FHIR-oriented APIs
          </p>
        </div>
      </div>
    </footer>
  )
}
