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
  pharmacy_tenant_id: string | null
}

type PharmacyTask = {
  id: string
  sourceId: string | null
  title: string
  status: string
  priority: string
}

export function ClinicalDispensePanel() {
  const [prescriptions, setPrescriptions] = useState<PrescriptionRow[]>([])
  const [pharmacyTasks, setPharmacyTasks] = useState<PharmacyTask[]>([])
  const [taskId, setTaskId] = useState('')
  const [prescriptionId, setPrescriptionId] = useState('')
  const [productId, setProductId] = useState('')
  const [pharmacyTenantId, setPharmacyTenantId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/opd/prescriptions?status=active', { credentials: 'include' }),
      fetch('/api/hospital/tasks?department=pharmacy&status=REQUESTED', { credentials: 'include' }),
    ])
      .then(async ([prescriptionResponse, taskResponse]) => {
        if (!prescriptionResponse.ok || !taskResponse.ok) {
          setLoadError('Unable to load the pharmacy queue.')
          return
        }
        const prescriptionData = (await prescriptionResponse.json()) as { prescriptions: PrescriptionRow[] }
        const taskData = (await taskResponse.json()) as { tasks: PharmacyTask[] }
        setPrescriptions(prescriptionData.prescriptions ?? [])
        setPharmacyTasks((taskData.tasks ?? []).filter((task) => task.sourceId))
      })
      .catch(() => setLoadError('Unable to load the pharmacy queue.'))
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!prescriptionId || !productId || !pharmacyTenantId) {
      setError('Pharmacy task, product ID, and pharmacy tenant ID are required.')
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
    setPharmacyTasks((tasks) => tasks.filter((task) => task.id !== taskId))
    setTaskId('')
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
          <label className="mb-1.5 block text-sm font-semibold">Pharmacy queue task *</label>
          <select
            value={taskId}
            onChange={(e) => {
              const nextTaskId = e.target.value
              const task = pharmacyTasks.find((candidate) => candidate.id === nextTaskId)
              const prescription = prescriptions.find((rx) => rx.id === task?.sourceId)
              setTaskId(nextTaskId)
              setPrescriptionId(task?.sourceId ?? '')
              setPharmacyTenantId(prescription?.pharmacy_tenant_id ?? '')
            }}
            required
            className="w-full rounded-xl border border-subtle bg-surface px-4 py-2.5 text-sm text-primary-color outline-none"
          >
            <option value="">Select pharmacy task…</option>
            {pharmacyTasks.map((task) => {
              const prescription = prescriptions.find((rx) => rx.id === task.sourceId)
              return (
                <option key={task.id} value={task.id}>
                  {task.title} · {prescription?.medication_display ?? 'prescription'} · {task.priority}
                </option>
              )
            })}
          </select>
          {pharmacyTasks.length === 0 ? (
            <p className="mt-1.5 text-xs text-muted-color">No open pharmacy tasks.</p>
          ) : null}
        </div>
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
