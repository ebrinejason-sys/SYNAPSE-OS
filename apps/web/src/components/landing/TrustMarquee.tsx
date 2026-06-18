'use client'

const ITEMS = [
  'FHIR R4 interoperability',
  'ICD-11 on clinical output',
  'DHIS2 scheduled exports',
  'Uganda Clinical Guidelines RAG',
  'Insurance claim copilot',
  'Pharmacy FEFO + POS',
  'Telemedicine + patient app',
  'Row-level tenant isolation',
  'Session audit & revocation',
  'Offline-tolerant ward mode',
  'Multi-department HMIS',
  'DPPA 2019 aligned design',
]

export function TrustMarquee() {
  const doubled = [...ITEMS, ...ITEMS]

  return (
    <div
      className="border-y py-3"
      style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-edge)' }}
    >
      <div className="marquee-outer">
        <div className="marquee-track gap-8 px-4">
          {doubled.map((item, i) => (
            <span
              key={`${item}-${i}`}
              className="flex shrink-0 items-center gap-2 text-xs font-medium whitespace-nowrap"
              style={{ color: 'var(--text-muted)' }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--brand-orange)' }} />
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
