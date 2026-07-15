/** Stylized POS mock — not a product screenshot. */
export function PosMock() {
  return (
    <svg viewBox="0 0 420 280" className="h-auto w-full" role="img" aria-label="Illustrated POS receipt and cart">
      <rect width="420" height="280" rx="16" fill="#111117" />
      <rect x="16" y="16" width="240" height="248" rx="10" fill="#07070A" stroke="#2A2A36" />
      <text x="32" y="48" fill="#E8B84B" fontFamily="ui-monospace,monospace" fontSize="11">
        RECEIPT · KLA
      </text>
      <text x="32" y="72" fill="#F5F5F7" fontFamily="ui-sans-serif,system-ui" fontSize="14" fontWeight="700">
        Amoxyl 500mg × 2
      </text>
      <text x="32" y="94" fill="#8C8C8C" fontFamily="ui-monospace,monospace" fontSize="11">
        Batch EXP 2027-03 · FEFO
      </text>
      <text x="32" y="128" fill="#F5F5F7" fontFamily="ui-sans-serif,system-ui" fontSize="14" fontWeight="700">
        Paracetamol 500mg × 1
      </text>
      <text x="32" y="150" fill="#8C8C8C" fontFamily="ui-monospace,monospace" fontSize="11">
        Batch EXP 2026-11 · FEFO
      </text>
      <line x1="32" y1="178" x2="236" y2="178" stroke="#2A2A36" />
      <text x="32" y="204" fill="#A0A0B0" fontFamily="ui-monospace,monospace" fontSize="11">
        TOTAL
      </text>
      <text x="150" y="204" fill="#F97316" fontFamily="ui-monospace,monospace" fontSize="16" fontWeight="700">
        UGX 12,500
      </text>
      <rect x="276" y="40" width="128" height="40" rx="8" fill="#1FA6A6" />
      <text x="300" y="65" fill="#07070A" fontFamily="ui-sans-serif,system-ui" fontSize="13" fontWeight="700">
        Complete sale
      </text>
      <rect x="276" y="100" width="128" height="88" rx="10" fill="#0F1A1A" stroke="#1FA6A6" strokeOpacity="0.4" />
      <text x="292" y="132" fill="#1FA6A6" fontFamily="ui-monospace,monospace" fontSize="10">
        STOCK ALERT
      </text>
      <text x="292" y="156" fill="#F5F5F7" fontFamily="ui-sans-serif,system-ui" fontSize="12">
        3 batches near
      </text>
      <text x="292" y="174" fill="#F5F5F7" fontFamily="ui-sans-serif,system-ui" fontSize="12">
        expiry this week
      </text>
    </svg>
  )
}
