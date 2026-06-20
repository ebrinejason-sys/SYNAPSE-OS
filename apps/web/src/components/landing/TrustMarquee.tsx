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
  return (
    <div className="landing-trust-bar">
      <div className="landing-container">
        <p className="landing-trust-label">Platform capabilities</p>
        <ul className="landing-trust-grid">
          {ITEMS.map((item) => (
            <li key={item} className="landing-trust-item">
              <span className="landing-trust-dot" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
