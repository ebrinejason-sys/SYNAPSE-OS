'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Check, ChevronRight, Loader2, Plus, Trash2 } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OnboardingData {
  tenantId: string
  tenantName: string
  address: string
  district: string
  phone: string
  licenseNumber: string
  licenseExpiry: string
  currentStep: number
  storeName: string
  storeType: string
}

interface ProfileForm {
  pharmacyName: string
  address: string
  district: string
  phone: string
  licenseNumber: string
  licenseExpiry: string
}

interface StoreForm {
  storeName: string
  storeType: string
}

interface ProductRow {
  name: string
  category: string
  quantity: string
  price: string
  reorderLevel: string
}

interface NetworkForm {
  isNetworkMember: boolean
  acceptsRefillRequests: boolean
  networkListingName: string
}

// ─── Step config ──────────────────────────────────────────────────────────────

const STEPS = [
  { number: 1, label: 'Pharmacy Profile' },
  { number: 2, label: 'Store Setup' },
  { number: 3, label: 'Products' },
  { number: 4, label: 'Network' },
  { number: 5, label: 'Complete' },
]

function emptyProduct(): ProductRow {
  return { name: '', category: '', quantity: '', price: '', reorderLevel: '' }
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ currentStep }: { currentStep: number }) {
  return (
    <div className="w-full mb-8">
      <div className="flex items-center justify-between relative">
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-[#2A2A36] z-0" />
        <div
          className="absolute top-4 left-0 h-0.5 bg-[#F97316] z-0 transition-all duration-500"
          style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}
        />
        {STEPS.map((step) => {
          const done = step.number < currentStep
          const active = step.number === currentStep
          return (
            <div key={step.number} className="flex flex-col items-center z-10 gap-1.5">
              <div
                className={[
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                  done ? 'bg-[#F97316] text-white'
                    : active ? 'bg-[#F97316]/20 border-2 border-[#F97316] text-[#F97316]'
                    : 'bg-[#1A1A24] border-2 border-[#2A2A36] text-zinc-500',
                ].join(' ')}
              >
                {done ? <Check className="w-4 h-4" /> : step.number}
              </div>
              <span className={[
                'text-[10px] font-medium hidden sm:block whitespace-nowrap',
                active ? 'text-[#F97316]' : done ? 'text-zinc-400' : 'text-zinc-600',
              ].join(' ')}>
                {step.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [onboardingData, setOnboardingData] = useState<OnboardingData | null>(null)
  const [currentStep, setCurrentStep] = useState(1)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const [profile, setProfile] = useState<ProfileForm>({
    pharmacyName: '',
    address: '',
    district: '',
    phone: '',
    licenseNumber: '',
    licenseExpiry: '',
  })

  const [store, setStore] = useState<StoreForm>({ storeName: '', storeType: 'main' })
  const [products, setProducts] = useState<ProductRow[]>([emptyProduct()])
  const [network, setNetwork] = useState<NetworkForm>({
    isNetworkMember: false,
    acceptsRefillRequests: false,
    networkListingName: '',
  })

  // ── Load wizard data via API (service role, bypasses RLS) ─────────────────

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/onboarding', { cache: 'no-store' })
      if (res.status === 401) { router.replace('/login'); return }
      if (!res.ok) throw new Error('Failed to load onboarding data')

      const data: OnboardingData = await res.json()
      setOnboardingData(data)
      setCurrentStep(Math.min(Math.max(data.currentStep, 1), 5))

      // Pre-fill from what the platform admin already entered
      setProfile({
        pharmacyName: data.tenantName,
        address: data.address,
        district: data.district,
        phone: data.phone,
        licenseNumber: data.licenseNumber,
        licenseExpiry: data.licenseExpiry,
      })

      setStore({
        storeName: data.storeName || `${data.tenantName} - Main Branch`,
        storeType: data.storeType || 'main',
      })
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }, [router])

  useEffect(() => { loadData() }, [loadData])

  // ── Save a step via API ────────────────────────────────────────────────────

  async function saveStep(step: number, data: Record<string, unknown>) {
    setSaveError(null)
    setIsSaving(true)
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step, data }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Save failed')
      return json.nextStep as number | 'dashboard'
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
      return null
    } finally {
      setIsSaving(false)
    }
  }

  const handleStep1 = async () => {
    const next = await saveStep(1, {
      address: profile.address,
      district: profile.district,
      phone: profile.phone,
      licenseNumber: profile.licenseNumber,
      licenseExpiry: profile.licenseExpiry,
    })
    if (next) setCurrentStep(next as number)
  }

  const handleStep2 = async () => {
    const next = await saveStep(2, { storeName: store.storeName, storeType: store.storeType })
    if (next) setCurrentStep(next as number)
  }

  const handleStep3 = async (skip = false) => {
    const next = await saveStep(3, { products: skip ? [] : products })
    if (next) setCurrentStep(next as number)
  }

  const handleStep4 = async () => {
    const next = await saveStep(4, {
      isNetworkMember: network.isNetworkMember,
      acceptsRefillRequests: network.acceptsRefillRequests,
      networkListingName: network.networkListingName,
    })
    if (next) setCurrentStep(next as number)
  }

  const handleComplete = async () => {
    const next = await saveStep(5, {})
    if (next === 'dashboard') window.location.assign('/portal/dashboard')
  }

  // ── Product helpers ────────────────────────────────────────────────────────

  const updateProduct = (idx: number, field: keyof ProductRow, value: string) =>
    setProducts(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p))

  const removeProduct = (idx: number) =>
    setProducts(prev => prev.filter((_, i) => i !== idx))

  // ── Styles ─────────────────────────────────────────────────────────────────

  const inputCls = 'w-full bg-[#1A1A24] border border-[#2A2A36] rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-[#F97316] focus:outline-none transition-colors'
  const labelCls = 'block text-xs font-medium uppercase tracking-wider text-zinc-400 mb-1'
  const btnPrimary = 'flex items-center gap-2 bg-[#F97316] hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-lg px-6 py-2.5 transition-colors'

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#07070A] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-[#F97316] border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-400 text-sm">Loading your pharmacy…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#07070A] flex items-center justify-center p-4 py-10">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <Image
            src="/logo.png"
            alt="Synapse Pharmacy"
            width={160}
            height={48}
            className="mb-3 object-contain"
            priority
          />
          {onboardingData?.tenantName && (
            <p className="text-zinc-400 text-sm mt-1">{onboardingData.tenantName}</p>
          )}
        </div>

        <ProgressBar currentStep={currentStep} />

        <div className="bg-[#111117] border border-[#2A2A36] rounded-xl p-6 shadow-xl">
          {saveError && (
            <div className="mb-5 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
              {saveError}
            </div>
          )}

          {/* ── STEP 1: Pharmacy Profile ── */}
          {currentStep === 1 && (
            <div>
              <h2 className="text-lg font-bold text-white mb-1">Pharmacy Profile</h2>
              <p className="text-zinc-500 text-sm mb-6">
                Confirm your pharmacy details and add your license information.
              </p>

              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Pharmacy Name</label>
                  <input
                    className={`${inputCls} opacity-60 cursor-not-allowed`}
                    value={profile.pharmacyName}
                    readOnly
                    title="Set by platform admin"
                  />
                  <p className="text-xs text-zinc-600 mt-1">Name set by your platform administrator</p>
                </div>

                <div>
                  <label className={labelCls}>Physical Address</label>
                  <input
                    className={inputCls}
                    value={profile.address}
                    onChange={e => setProfile({ ...profile, address: e.target.value })}
                    placeholder="Plot 12, Kampala Road"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>District</label>
                    <input
                      className={inputCls}
                      value={profile.district}
                      onChange={e => setProfile({ ...profile, district: e.target.value })}
                      placeholder="e.g. Kampala"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Phone Number</label>
                    <input
                      className={inputCls}
                      value={profile.phone}
                      onChange={e => setProfile({ ...profile, phone: e.target.value })}
                      placeholder="+256 700 000 000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>License Number</label>
                    <input
                      className={inputCls}
                      value={profile.licenseNumber}
                      onChange={e => setProfile({ ...profile, licenseNumber: e.target.value })}
                      placeholder="NDA-PHARM-XXXXX"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>License Expiry Date</label>
                    <input
                      type="date"
                      className={inputCls}
                      value={profile.licenseExpiry}
                      onChange={e => setProfile({ ...profile, licenseExpiry: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button onClick={handleStep1} disabled={isSaving} className={btnPrimary}>
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Save & Continue
                  {!isSaving && <ChevronRight className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Store Setup ── */}
          {currentStep === 2 && (
            <div>
              <h2 className="text-lg font-bold text-white mb-1">Store Setup</h2>
              <p className="text-zinc-500 text-sm mb-6">
                Create your main pharmacy store. You can add more branches later.
              </p>

              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Store Name</label>
                  <input
                    className={inputCls}
                    value={store.storeName}
                    onChange={e => setStore({ ...store, storeName: e.target.value })}
                    placeholder="Main Branch"
                  />
                </div>

                <div>
                  <label className={labelCls}>Store Type</label>
                  <select
                    className={`${inputCls} appearance-none`}
                    value={store.storeType}
                    onChange={e => setStore({ ...store, storeType: e.target.value })}
                  >
                    <option value="main">Main Branch</option>
                    <option value="dispensary">Dispensary</option>
                    <option value="satellite">Satellite</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button onClick={handleStep2} disabled={isSaving} className={btnPrimary}>
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Save & Continue
                  {!isSaving && <ChevronRight className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Products ── */}
          {currentStep === 3 && (
            <div>
              <h2 className="text-lg font-bold text-white mb-1">Add First Products</h2>
              <p className="text-zinc-500 text-sm mb-6">
                Add a few medicines to get started. You can add more from the Inventory page later.
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#2A2A36]">
                      <th className="text-left py-2 pr-2 text-xs text-zinc-500 font-medium">Drug Name</th>
                      <th className="text-left py-2 pr-2 text-xs text-zinc-500 font-medium">Category</th>
                      <th className="text-left py-2 pr-2 text-xs text-zinc-500 font-medium w-20">Qty</th>
                      <th className="text-left py-2 pr-2 text-xs text-zinc-500 font-medium w-28">Price (UGX)</th>
                      <th className="text-left py-2 pr-2 text-xs text-zinc-500 font-medium w-24">Reorder</th>
                      <th className="py-2 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((row, idx) => (
                      <tr key={idx} className="border-b border-[#2A2A36]/50">
                        <td className="py-2 pr-2">
                          <input className={inputCls} placeholder="Amoxicillin 500mg" value={row.name}
                            onChange={e => updateProduct(idx, 'name', e.target.value)} />
                        </td>
                        <td className="py-2 pr-2">
                          <input className={inputCls} placeholder="Antibiotics" value={row.category}
                            onChange={e => updateProduct(idx, 'category', e.target.value)} />
                        </td>
                        <td className="py-2 pr-2">
                          <input type="number" min="0" className={inputCls} placeholder="100" value={row.quantity}
                            onChange={e => updateProduct(idx, 'quantity', e.target.value)} />
                        </td>
                        <td className="py-2 pr-2">
                          <input type="number" min="0" step="100" className={inputCls} placeholder="2500" value={row.price}
                            onChange={e => updateProduct(idx, 'price', e.target.value)} />
                        </td>
                        <td className="py-2 pr-2">
                          <input type="number" min="0" className={inputCls} placeholder="10" value={row.reorderLevel}
                            onChange={e => updateProduct(idx, 'reorderLevel', e.target.value)} />
                        </td>
                        <td className="py-2">
                          {products.length > 1 && (
                            <button type="button" onClick={() => removeProduct(idx)}
                              className="text-zinc-600 hover:text-red-400 transition-colors p-1">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button type="button" onClick={() => setProducts(prev => [...prev, emptyProduct()])}
                className="mt-3 flex items-center gap-1.5 text-sm text-[#F97316] hover:text-orange-400 transition-colors">
                <Plus className="w-4 h-4" />
                Add another medicine
              </button>

              <div className="mt-6 flex items-center justify-between">
                <button onClick={() => handleStep3(true)} disabled={isSaving}
                  className="text-sm text-zinc-500 hover:text-zinc-300 disabled:opacity-50 transition-colors">
                  Skip for now
                </button>
                <button onClick={() => handleStep3(false)} disabled={isSaving} className={btnPrimary}>
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Save & Continue
                  {!isSaving && <ChevronRight className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 4: Network ── */}
          {currentStep === 4 && (
            <div>
              <h2 className="text-lg font-bold text-white mb-1">Network Visibility</h2>
              <p className="text-zinc-500 text-sm mb-6">
                Choose whether patients can discover your pharmacy through the Synapse App.
              </p>

              <div className="space-y-5">
                <div className="flex items-start justify-between gap-4 bg-[#1A1A24] border border-[#2A2A36] rounded-lg p-4">
                  <div>
                    <p className="text-sm font-medium text-white">List my pharmacy in Synapse App</p>
                    <p className="text-xs text-zinc-500 mt-0.5">Patients nearby can find your pharmacy and view stock availability.</p>
                  </div>
                  <button type="button"
                    onClick={() => setNetwork(n => ({ ...n, isNetworkMember: !n.isNetworkMember }))}
                    className={['relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0',
                      network.isNetworkMember ? 'bg-[#F97316]' : 'bg-[#2A2A36]'].join(' ')}>
                    <span className={['inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                      network.isNetworkMember ? 'translate-x-6' : 'translate-x-1'].join(' ')} />
                  </button>
                </div>

                {network.isNetworkMember && (
                  <div>
                    <label className={labelCls}>Network Listing Name</label>
                    <input className={inputCls} value={network.networkListingName}
                      onChange={e => setNetwork({ ...network, networkListingName: e.target.value })}
                      placeholder={profile.pharmacyName || 'Your pharmacy display name'} />
                  </div>
                )}

                <div className="flex items-start justify-between gap-4 bg-[#1A1A24] border border-[#2A2A36] rounded-lg p-4">
                  <div>
                    <p className="text-sm font-medium text-white">Accept prescription refill requests</p>
                    <p className="text-xs text-zinc-500 mt-0.5">Allow patients to send digital refill requests from the app.</p>
                  </div>
                  <button type="button"
                    onClick={() => setNetwork(n => ({ ...n, acceptsRefillRequests: !n.acceptsRefillRequests }))}
                    className={['relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0',
                      network.acceptsRefillRequests ? 'bg-[#F97316]' : 'bg-[#2A2A36]'].join(' ')}>
                    <span className={['inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                      network.acceptsRefillRequests ? 'translate-x-6' : 'translate-x-1'].join(' ')} />
                  </button>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button onClick={handleStep4} disabled={isSaving} className={btnPrimary}>
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Save & Continue
                  {!isSaving && <ChevronRight className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 5: Complete ── */}
          {currentStep === 5 && (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-green-500/10 border-2 border-green-500/30 flex items-center justify-center mx-auto mb-5">
                <Check className="w-8 h-8 text-green-400" />
              </div>

              <h2 className="text-2xl font-bold text-white mb-2">Your pharmacy is ready!</h2>
              <p className="text-zinc-400 text-sm mb-6 max-w-md mx-auto">
                You have successfully configured your Synapse Pharmacy account.
              </p>

              <div className="bg-[#1A1A24] border border-[#2A2A36] rounded-lg p-4 text-left space-y-2.5 mb-7">
                {[
                  'Pharmacy profile & license information saved',
                  `Main store "${store.storeName}" created`,
                  products.filter(p => p.name.trim()).length > 0
                    ? `${products.filter(p => p.name.trim()).length} medicine(s) added to inventory`
                    : 'Inventory ready — add medicines from the Inventory page',
                  network.isNetworkMember ? 'Listed in the Synapse patient network' : 'Network listing configured',
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span className="text-sm text-zinc-300">{item}</span>
                  </div>
                ))}
              </div>

              <button onClick={handleComplete} disabled={isSaving}
                className="inline-flex items-center gap-2 bg-[#F97316] hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-lg px-8 py-3 transition-colors text-base">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Go to Dashboard
                {!isSaving && <ChevronRight className="w-4 h-4" />}
              </button>

              {saveError && <p className="mt-4 text-red-400 text-sm">{saveError}</p>}
            </div>
          )}
        </div>

        <p className="text-center text-xs mt-6 text-zinc-700">
          Synapse Health Technologies &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
