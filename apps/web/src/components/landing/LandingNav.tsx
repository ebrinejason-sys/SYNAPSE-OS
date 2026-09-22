'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight, Menu, X } from 'lucide-react'
import { SynapseLogo } from '../SynapseLogo'
import { ThemeToggle } from '../ThemeToggle'

const NAV = [
  ['/products/os', 'Products'],
  ['/pricing', 'Pricing'],
  ['/products/pharmacy', 'Pharmacy'],
  ['/products/lab', 'Lab'],
  ['/book-meeting', 'Enterprise'],
  ['/contact', 'Contact'],
  ['/docs', 'Docs'],
] as const

export function LandingNav() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <header
      className="landing-nav sticky top-0 z-50"
      data-scrolled={scrolled || open ? 'true' : 'false'}
    >
      <div className="landing-container flex items-center justify-between gap-3 py-3.5 md:py-4">
        <Link href="/" aria-label="SynapseOS home" className="shrink-0">
          <SynapseLogo size="sm" className="sm:hidden" />
          <SynapseLogo size="md" className="hidden sm:flex" />
        </Link>

        <nav className="hidden items-center gap-8 lg:flex" aria-label="Main">
          {NAV.map(([href, label]) => (
            <a key={label} href={href} className="landing-nav-link">
              {label}
            </a>
          ))}
        </nav>

        {/* Desktop actions */}
        <div className="hidden items-center gap-3 lg:flex">
          <ThemeToggle />
          <Link href="/login" className="landing-nav-link">
            Sign in
          </Link>
          <Link href="/book-meeting" className="landing-btn-secondary">
            Book a Meeting
          </Link>
          <Link href="/pricing" className="landing-btn-primary">
            View pricing
          </Link>
        </div>

        {/* Mobile actions: one compact CTA + hamburger only */}
        <div className="flex items-center gap-2 lg:hidden">
          <Link href="/book-meeting" className="landing-btn-primary landing-btn-compact">
            Book meeting
          </Link>
          <button
            type="button"
            className="landing-icon-btn"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open ? 'true' : 'false'}
            aria-controls="landing-mobile-menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div id="landing-mobile-menu" className="landing-mobile-menu lg:hidden">
          <nav className="landing-container flex flex-col py-4" aria-label="Mobile">
            {NAV.map(([href, label]) => (
              <a
                key={label}
                href={href}
                className="landing-mobile-link"
                onClick={() => setOpen(false)}
              >
                {label}
              </a>
            ))}

            <div className="mt-4 flex flex-col gap-2.5">
              <Link
                href="/book-meeting"
                className="landing-btn-primary w-full justify-center py-3"
                onClick={() => setOpen(false)}
              >
                Book a Meeting
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
              <Link
                href="/pricing"
                className="landing-btn-secondary w-full justify-center py-3"
                onClick={() => setOpen(false)}
              >
                View pricing
              </Link>
              <Link
                href="/login"
                className="landing-btn-secondary w-full justify-center py-3"
                onClick={() => setOpen(false)}
              >
                Sign in
              </Link>
            </div>

            <div className="mt-4 flex items-center justify-between border-t pt-4" style={{ borderColor: 'var(--border-subtle)' }}>
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Appearance
              </span>
              <ThemeToggle />
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
