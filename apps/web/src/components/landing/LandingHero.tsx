'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  Building2,
  FlaskConical,
  Pill,
  Shield,
  Sparkles,
  Stethoscope,
} from 'lucide-react'

const TRUST_PILLS = [
  'FHIR R4',
  'ICD-11 coding',
  'DHIS2 exports',
  'DPPA 2019 aligned',
  'Postgres RLS',
  'Clinician-in-the-loop AI',
]

const LIVE_SURFACES = [
  { label: 'Hospital demo', href: 'https://demo.synapseos.tech', status: 'Live' },
  { label: 'Pharmacy POS', href: 'https://pharm.synapseos.tech', status: 'Live' },
  { label: 'Platform admin', href: '/platform/login', status: 'Staff' },
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
    title: 'Lab & radiology',
    metric: 'Order → result → alert',
    detail: 'Instrument ingest, critical value flags',
    accent: 'var(--brand-gold)',
  },
  {
    icon: Pill,
    title: 'Pharmacy & revenue',
    metric: 'FEFO · POS · claims',
    detail: 'Batch stock, receipts, insurer copilot',
    accent: '#22C55E',
  },
]

export function LandingHero() {
  return (
    <section className="relative overflow-hidden px-6 pt-16 pb-20 md:pt-24 md:pb-28">
      {/* Ambient mesh */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 15% 20%, var(--hero-glow) 0%, transparent 55%),
            radial-gradient(ellipse 60% 50% at 85% 10%, var(--hero-glow-gold) 0%, transparent 50%),
            radial-gradient(ellipse 50% 40% at 70% 80%, rgba(34,197,94,0.06) 0%, transparent 55%),
            var(--bg-base)
          `,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.35]"
        aria-hidden
        style={{
          backgroundImage: `linear-gradient(var(--border-subtle) 1px, transparent 1px),
            linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, black 20%, transparent 75%)',
        }}
      />

      <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-5 inline-flex flex-wrap items-center gap-2"
          >
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                background: 'rgba(249,115,22,0.12)',
                border: '1px solid var(--border-orange)',
                color: 'var(--brand-orange)',
              }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Built in Kampala for East African care
            </span>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)', color: 'var(--text-muted)' }}
            >
              <Activity className="h-3.5 w-3.5 text-green-500" />
              Production on demo + pharmacy
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08 }}
            className="font-display mb-5 font-bold leading-[1.08] tracking-tight"
            style={{ fontSize: 'clamp(2.25rem, 5.5vw, 3.75rem)' }}
          >
            One platform for{' '}
            <span className="shimmer-text">hospital records</span>, pharmacy revenue, and patient access.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.16 }}
            className="mb-8 max-w-xl text-lg leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            SynapseOS connects OPD, wards, laboratory, pharmacy POS, insurance claims, and telemedicine on a
            single tenant — with Uganda Clinical Guidelines in the workflow and audit logs from day one.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.24 }}
            className="mb-8 flex flex-wrap gap-3"
          >
            <a
              href="https://demo.synapseos.tech"
              target="_blank"
              rel="noopener noreferrer"
              className="pulse-glow inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold transition-transform hover:scale-[1.02]"
              style={{ background: 'var(--brand-orange)', color: '#07070A' }}
            >
              Open live demo
              <ArrowRight className="h-4 w-4" />
            </a>
            <Link
              href="/apply"
              className="inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold transition-colors"
              style={{ border: '1px solid var(--border-edge)', color: 'var(--text-primary)', background: 'var(--bg-surface)' }}
            >
              <Building2 className="h-4 w-4" style={{ color: 'var(--brand-gold)' }} />
              Apply for hospital pilot
            </Link>
            <Link href="/docs" className="inline-flex items-center px-2 py-3.5 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
              Documentation →
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="mb-8 flex flex-wrap gap-2"
          >
            {TRUST_PILLS.map((pill) => (
              <span
                key={pill}
                className="rounded-md px-2.5 py-1 text-[11px] font-medium"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
              >
                {pill}
              </span>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.42 }}
            className="grid grid-cols-2 gap-4 sm:grid-cols-4"
          >
            {[
              { v: '20+', l: 'Department modules' },
              { v: '150+', l: 'Clinical scores' },
              { v: '120+', l: 'RLS-protected tables' },
              { v: '3', l: 'Live products' },
            ].map((stat) => (
              <div key={stat.l}>
                <p className="font-display text-2xl font-bold" style={{ color: 'var(--brand-orange)' }}>
                  {stat.v}
                </p>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {stat.l}
                </p>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Product preview stack */}
        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.65, delay: 0.2 }}
          className="relative mx-auto w-full max-w-md lg:max-w-none"
        >
          <div
            className="relative rounded-2xl p-5 noise-overlay"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-edge)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.35), 0 0 0 1px var(--border-subtle)',
            }}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                Clinical operating layer
              </p>
              <span className="flex items-center gap-1.5 text-xs font-medium text-green-500">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                </span>
                Synced
              </span>
            </div>

            <div className="space-y-3">
              {PREVIEW_CARDS.map((card, i) => (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 + i * 0.1 }}
                  className="flex gap-3 rounded-xl p-4 transition-colors"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: `${card.accent}18`, color: card.accent }}
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
                </motion.div>
              ))}
            </div>

            <div
              className="mt-4 flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs"
              style={{ background: 'rgba(232,184,75,0.08)', border: '1px solid var(--border-gold)' }}
            >
              <Shield className="h-4 w-4 shrink-0" style={{ color: 'var(--brand-gold)' }} />
              <span style={{ color: 'var(--text-secondary)' }}>
                AI suggestions require clinician review — never auto-submitted to the chart.
              </span>
            </div>
          </div>

          {/* Floating accent card */}
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -bottom-4 -left-4 hidden rounded-xl px-4 py-3 sm:block"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-orange)',
              boxShadow: '0 12px 40px rgba(249,115,22,0.15)',
            }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Pharmacy POS
            </p>
            <p className="font-display text-lg font-bold" style={{ color: 'var(--brand-orange)' }}>
              RX-20260618-0001
            </p>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              Receipt · FEFO batch deduct
            </p>
          </motion.div>
        </motion.div>
      </div>

      {/* Live surfaces strip */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55 }}
        className="mx-auto mt-14 flex max-w-6xl flex-wrap items-center justify-center gap-3 border-t pt-8"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Try now
        </span>
        {LIVE_SURFACES.map((s) => (
          <a
            key={s.label}
            href={s.href}
            target={s.href.startsWith('http') ? '_blank' : undefined}
            rel={s.href.startsWith('http') ? 'noopener noreferrer' : undefined}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:opacity-90"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }}
          >
            {s.label}
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
              style={{ background: 'rgba(34,197,94,0.12)', color: '#22C55E' }}
            >
              {s.status}
            </span>
          </a>
        ))}
      </motion.div>
    </section>
  )
}
