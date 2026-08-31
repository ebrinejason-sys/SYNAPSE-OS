'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, FlaskConical } from 'lucide-react'

type PrescriptionRow = {
  id: string
  medication_display: string
  dose: string | null
  quantity: number
  unit: string
  status: string
  encounter_id: string | null
}

export function ClinicalDispensePanel() {
  const [prescriptions, setPrescriptions] = useState<PrescriptionRow[]>([])
  const [prescriptionId, setPrescriptionId] = useState('')
  const [productId, setProductId] = useState('')
  const [pharmacyTenantId, setPharmacyTenantId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    fetch('/api/opd/prescriptions?status=active', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) {
          setLoadError('Unable to load clinical prescriptions.')
          return
        }
        const data = (await res.json()) as { prescriptions: PrescriptionRow[] }
        setPrescriptions(data.prescriptions ?? [])
      })
      .catch(() => setLoadError('Unable to load clinical prescriptions.'))
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!prescriptionId || !productId || !pharmacyTenantId) {
      setError('Prescription, product ID, and pharmacy tenant ID are required.')
      return
    }
    setSaving(true)
    setError('')
    const res = await fetch('/api/hospital/pharmacy/dispense', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        prescription_id: prescriptionId,
        product_id: productId,
        pharmacy_tenant_id: pharmacyTenantId,
        payment_method: paymentMethod,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) {
      setError(typeof data.error === 'string' ? data.error : 'Dispense failed.')
      return
    }
    setDone(true)
    setPrescriptionId('')
    setProductId('')
    setTimeout(() => setDone(false), 3000)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl">Clinical dispense</h1>
        <p className="mt-2 text-sm text-muted-color">
          Verify and dispense via authoritative inventory (<code className="text-xs">complete_pharmacy_sale</code>).
        </p>
      </div>

      {done ? (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <CheckCircle className="h-5 w-5 text-emerald-400" />
          <p className="text-sm font-semibold text-emerald-300">Dispense recorded and inventory decremented.</p>
        </div>
      ) : null}

      {error || loadError ? <p className="text-sm text-red-400">{error || loadError}</p> : null}

      <form onSubmit={submit} className="max-w-lg space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Clinical prescription *</label>
          <select
            value={prescriptionId}
            onChange={(e) => setPrescriptionId(e.target.value)}
            required
            className="w-full rounded-xl border border-subtle bg-surface px-4 py-2.5 text-sm text-primary-color outline-none"
          >
            <option value="">Select prescription…</option>
            {prescriptions.map((rx) => (
              <option key={rx.id} value={rx.id}>
                {rx.medication_display} · qty {rx.quantity} · {rx.status}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Pharmacy product ID *</label>
          <input
            type="text"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            placeholder="UUID from pharmacy catalog"
            required
            className="w-full rounded-xl border border-subtle bg-surface px-4 py-2.5 text-sm text-primary-color outline-none"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Pharmacy tenant ID *</label>
          <input
            type="text"
            value={pharmacyTenantId}
            onChange={(e) => setPharmacyTenantId(e.target.value)}
            placeholder="Linked Pharm POS tenant UUID"
            required
            className="w-full rounded-xl border border-subtle bg-surface px-4 py-2.5 text-sm text-primary-color outline-none"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Payment method</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full rounded-xl border border-subtle bg-surface px-4 py-2.5 text-sm text-primary-color outline-none"
          >
            <option value="cash">Cash</option>
            <option value="mobile_money">Mobile money</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold disabled:opacity-60"
          style={{ background: 'var(--brand-orange)', color: '#07070A' }}
        >
          <FlaskConical className="h-4 w-4" />
          {saving ? 'Dispensing…' : 'Dispense via POS authority'}
        </button>
      </form>
    </div>
  )
}
