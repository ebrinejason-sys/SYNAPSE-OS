'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { SynapseLogo } from '../SynapseLogo'
import { ThemeToggle } from '../ThemeToggle'

const NAV = [
  ['#get-started', 'Get started'],
  ['#products', 'Products'],
  ['#features', 'Features'],
  ['#pricing', 'Pricing'],
  ['#demo', 'Demo'],
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
      <div className="landing-container flex items-center justify-between gap-4 py-3.5 md:py-4">
        <SynapseLogo size="md" />

        <nav className="hidden items-center gap-8 lg:flex" aria-label="Main">
          {NAV.map(([href, label]) => (
            <a key={label} href={href} className="landing-nav-link">
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <Link href="/login" className="landing-nav-link hidden md:inline-flex">
            Sign in
          </Link>
          <Link href="/apply" className="landing-btn-secondary hidden sm:inline-flex">
            Onboard facility
          </Link>
          <Link href="/signup" className="landing-btn-primary">
            Create account
          </Link>
          <button
            type="button"
            className="landing-icon-btn lg:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open ? 'true' : 'false'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="landing-mobile-menu lg:hidden">
          <nav className="landing-container flex flex-col gap-1 py-4" aria-label="Mobile">
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
            <Link href="/login" className="landing-mobile-link" onClick={() => setOpen(false)}>
              Sign in
            </Link>
            <Link href="/apply" className="landing-mobile-link" onClick={() => setOpen(false)}>
              Onboard facility
            </Link>
          </nav>
        </div>
      )}
    </header>
  )
}
