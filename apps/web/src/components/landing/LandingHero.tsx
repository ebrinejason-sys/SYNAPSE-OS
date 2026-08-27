'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  FlaskConical,
  Pill,
  Shield,
  Stethoscope,
} from 'lucide-react'
import { PUBLIC_STORY, HEADLINE_METRICS } from '@synapse/config/manifest'
import { AvatarCluster } from './AvatarCluster'
import { LandingParticleField } from './LandingParticleField'
import { BodyText, DisplayHeading, Eyebrow, LeadText } from '../typography'

const COMPLIANCE = [
  'ICD-11 coding',
  'DPPA 2019 aligned',
  'Postgres RLS',
  'Clinician-in-the-loop AI',
  'Audit logging',
  'FHIR roadmap',
]

const PREVIEW_CARDS = [
  {
    icon: Stethoscope,
    title: 'OPD & encounters',
    metric: 'Queue → consult → bill',
    detail: 'Signed notes, ICD-11, fee schedules',
    accent: 'var(--brand-orange)',
  },
  {
    icon: FlaskConical,
    title: 'Lab',
    metric: 'Order → result → verify',
    detail: 'First vertical slice in development',
    accent: 'var(--brand-gold)',
  },
  {
    icon: Pill,
    title: 'Pharmacy & revenue',
    metric: 'FEFO · POS · claims',
    detail: 'Batch stock and receipts. Offline checkout disabled.',
    accent: '#22C55E',
  },
]

const LIVE_SURFACES = [
  { label: 'AI diagnostic demo', href: 'https://demo.synapseos.tech', status: 'Live' },
  { label: 'Pharmacy POS', href: 'https://pharm.synapseos.tech', status: 'Live' },
  { label: 'Android APK', href: '/download/android', status: 'Download' },
  { label: 'Personal health app', href: 'https://app.synapseos.tech', status: 'Sign up' },
]

export function LandingHero() {
  const reduceMotion = useReducedMotion()

  return (
    <section className="landing-hero">
      <div className="landing-hero-bg" aria-hidden />
      <div className="landing-hero-grid" aria-hidden />
      <div className="landing-hero-aurora" aria-hidden />
      <LandingParticleField />

      <div className="landing-container relative z-[1] grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div>
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="mb-6"
          >
            <Eyebrow className="shimmer-sweep">
              Health management platform · Kampala, Uganda
            </Eyebrow>
          </motion.div>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="mb-6"
          >
            <DisplayHeading size="xl" className="landing-hero-title !max-w-none">
              {PUBLIC_STORY.heroTitle}
            </DisplayHeading>
          </motion.div>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-8"
          >
            <LeadText>{PUBLIC_STORY.heroSupport}</LeadText>
          </motion.div>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mb-4 flex flex-wrap items-center gap-3"
          >
            <a
              href="https://demo.synapseos.tech"
              target="_blank"
              rel="noopener noreferrer"
              className="landing-btn-primary glow-ring inline-flex items-center gap-2 px-6 py-3.5"
            >
              Open live demo
              <ArrowRight className="h-4 w-4" />
            </a>
            <Link href="/apply" className="landing-btn-secondary inline-flex items-center gap-2 px-6 py-3.5">
              <Building2 className="h-4 w-4" style={{ color: 'var(--brand-gold)' }} />
              Apply for pilot
            </Link>
            <a href="#pharm" className="landing-btn-secondary inline-flex items-center gap-2 px-6 py-3.5">
              <Pill className="h-4 w-4" style={{ color: 'var(--brand-teal)' }} />
              Get Synapse Pharm
            </a>
            <Link href="#platform" className="landing-btn-secondary inline-flex items-center gap-2 px-6 py-3.5">
              Explore the platform
            </Link>
          </motion.div>
          <p className="mb-10 text-caption" style={{ color: 'var(--text-muted)' }}>
            Preview APK for staff &amp; pharmacy roles · sideload on Android · updates via Expo builds
          </p>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-10"
          >
            <AvatarCluster />
          </motion.div>

          <motion.ul
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.22 }}
            className="mb-10 grid gap-2 sm:grid-cols-2"
          >
            {COMPLIANCE.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: 'var(--brand-teal)' }} />
                <BodyText as="span" size="sm" className="!max-w-none">
                  {item}
                </BodyText>
              </li>
            ))}
          </motion.ul>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28 }}
            className="landing-stat-row grid grid-cols-2 gap-px sm:grid-cols-4"
          >
            {HEADLINE_METRICS.map((stat) => (
              <div key={stat.id} className="landing-stat-cell px-4 py-4">
                <p className="font-display text-heading-2 tracking-tight">{stat.value}</p>
                <p className="mt-1 text-caption leading-snug" style={{ color: 'var(--text-muted)' }}>
                  {stat.label}
                </p>
              </div>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, delay: 0.12 }}
          className="landing-preview-wrap mx-auto w-full max-w-lg lg:max-w-none"
        >
          <div className="landing-preview landing-preview-float">
            <div className="landing-preview-header">
              <div>
                <p className="type-overline" style={{ color: 'var(--text-muted)' }}>
                  Clinical operating layer
                </p>
                <p className="mt-1 text-sm font-medium">Mulago General · Tenant dashboard</p>
              </div>
              <span className="landing-status-pill">
                <span className="landing-status-dot" />
                Synced
              </span>
            </div>

            <div className="space-y-3">
              {PREVIEW_CARDS.map((card) => (
                <div key={card.title} className="landing-preview-card">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: `${card.accent}14`, color: card.accent }}
                  >
                    <card.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{card.title}</p>
                    <p className="text-xs font-medium" style={{ color: card.accent }}>
                      {card.metric}
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {card.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="landing-preview-note">
              <Shield className="h-4 w-4 shrink-0" style={{ color: 'var(--brand-gold)' }} />
              <span>AI suggestions require clinician review. They are never auto-submitted to the chart.</span>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="landing-container relative z-[1] mt-14 border-t pt-8" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Try now
          </span>
          {LIVE_SURFACES.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target={s.href.startsWith('http') ? '_blank' : undefined}
              rel={s.href.startsWith('http') ? 'noopener noreferrer' : undefined}
              className="landing-chip-link"
            >
              {s.label}
              <span className="landing-chip-badge">{s.status}</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
