'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ClipboardList,
  Download,
  Pill,
  Radio,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'

type CapItem = {
  label: string
  status?: 'live' | 'advisory' | 'roadmap' | 'pilot'
}

type CapGroup = {
  title: string
  blurb: string
  icon: LucideIcon
  accent: string
  items: CapItem[]
}

const GROUPS: CapGroup[] = [
  {
    title: 'Clinical',
    blurb: 'Records that follow the encounter',
    icon: ClipboardList,
    accent: 'var(--brand-orange)',
    items: [
      { label: 'ICD-11 coding on clinical output' },
      { label: 'Uganda Clinical Guidelines in workflow' },
      { label: 'Hospital registration & OPD foundation' },
      { label: 'Insurance claim copilot', status: 'advisory' },
    ],
  },
  {
    title: 'Pharmacy & mobile',
    blurb: 'Counter ops and companion app',
    icon: Pill,
    accent: 'var(--brand-teal)',
    items: [
      { label: 'Pharmacy FEFO + POS' },
      { label: 'Inventory & receipts' },
      { label: 'Patient & staff mobile companion' },
    ],
  },
  {
    title: 'Trust & security',
    blurb: 'Tenant isolation by default',
    icon: ShieldCheck,
    accent: 'var(--brand-gold)',
    items: [
      { label: 'Row-level tenant isolation' },
      { label: 'Session audit & revocation' },
      { label: 'DPPA 2019 aligned design' },
    ],
  },
  {
    title: 'Interoperability',
    blurb: 'Honest roadmap, not vapourware',
    icon: Radio,
    accent: '#22C55E',
    items: [
      { label: 'FHIR R4', status: 'roadmap' },
      { label: 'DHIS2 export', status: 'pilot' },
    ],
  },
]

const STATUS_LABEL: Record<NonNullable<CapItem['status']>, string> = {
  live: 'Live',
  advisory: 'Advisory',
  roadmap: 'Roadmap',
  pilot: 'Pilot',
}

export function TrustMarquee() {
  const reduceMotion = useReducedMotion()

  return (
    <div className="landing-trust-bar">
      <div className="landing-container">
        <div className="landing-trust-head">
          <div>
            <p className="landing-trust-label">Platform capabilities</p>
            <p className="landing-trust-lead">
              What ships today vs what is labelled roadmap — no inflated claims.
            </p>
          </div>
          <Link href="/download/android" className="landing-trust-app-cta">
            <Download className="h-3.5 w-3.5" />
            Get the Android app
          </Link>
        </div>

        <div className="landing-trust-pillars">
          {GROUPS.map((group, i) => (
            <motion.article
              key={group.title}
              className="landing-trust-pillar"
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.35, delay: reduceMotion ? 0 : i * 0.05 }}
            >
              <div className="landing-trust-pillar-top">
                <span
                  className="landing-trust-icon"
                  style={{ background: `color-mix(in srgb, ${group.accent} 16%, transparent)`, color: group.accent }}
                >
                  <group.icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h3 className="landing-trust-pillar-title">{group.title}</h3>
                  <p className="landing-trust-pillar-blurb">{group.blurb}</p>
                </div>
              </div>
              <ul className="landing-trust-list">
                {group.items.map((item) => (
                  <li key={item.label} className="landing-trust-list-item">
                    <span
                      className="landing-trust-dot"
                      style={{ background: group.accent }}
                      aria-hidden
                    />
                    <span className="landing-trust-list-label">{item.label}</span>
                    {item.status ? (
                      <span
                        className="landing-trust-status"
                        data-status={item.status}
                      >
                        {STATUS_LABEL[item.status]}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </motion.article>
          ))}
        </div>
      </div>
    </div>
  )
}
