import Link from 'next/link'
import { SynapseLogo } from '../SynapseLogo'

const FOOTER_LINKS = {
  Product: [
    { href: '/docs', label: 'Documentation' },
    { href: '/status', label: 'Status' },
    { href: '/changelog', label: 'Changelog' },
    { href: '/download', label: 'Patient app' },
  ],
  Company: [
    { href: '/apply', label: 'Apply for pilot' },
    { href: '/contact', label: 'Contact' },
    { href: 'mailto:hello@synapseos.tech', label: 'hello@synapseos.tech' },
  ],
  Legal: [
    { href: '/legal/privacy', label: 'Privacy' },
    { href: '/legal', label: 'Terms' },
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
              Hospital information system, pharmacy POS, and patient access — built in Kampala for East
              African care delivery.
            </p>
            <p className="mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
              Synapse Health Technologies Ltd · Kampala, Uganda
            </p>
          </div>

          {(Object.entries(FOOTER_LINKS) as [keyof typeof FOOTER_LINKS, typeof FOOTER_LINKS[keyof typeof FOOTER_LINKS]][]).map(
            ([group, links]) => (
              <div key={group}>
                <p className="landing-footer-heading">{group}</p>
                <ul className="space-y-2.5">
                  {links.map((link) => (
                    <li key={link.href}>
                      {link.href.startsWith('mailto:') ? (
                        <a href={link.href} className="landing-footer-link">
                          {link.label}
                        </a>
                      ) : (
                        <Link href={link.href} className="landing-footer-link">
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ),
          )}
        </div>

        <div className="landing-footer-bar">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            © {new Date().getFullYear()} Synapse Health Technologies Ltd. All rights reserved.
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            FHIR R4 · ICD-11 · DPPA 2019 aligned
          </p>
        </div>
      </div>
    </footer>
  )
}
