'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Check, ChevronRight, Loader2, Plus, Trash2 } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SessionData {
  userId: string
  tenantId: string
  tenantName: string
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30)
}

function emptyProduct(): ProductRow {
  return { name: '', category: '', quantity: '', price: '', reorderLevel: '' }
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ currentStep }: { currentStep: number }) {
  return (
    <div className="w-full mb-8">
      <div className="flex items-center justify-between relative">
        {/* connector line */}
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
                  done
                    ? 'bg-[#F97316] text-white'
                    : active
                    ? 'bg-[#F97316]/20 border-2 border-[#F97316] text-[#F97316]'
                    : 'bg-[#1A1A24] border-2 border-[#2A2A36] text-zinc-500',
                ].join(' ')}
              >
                {done ? <Check className="w-4 h-4" /> : step.number}
              </div>
              <span
                className={[
                  'text-[10px] font-medium hidden sm:block whitespace-nowrap',
                  active ? 'text-[#F97316]' : done ? 'text-zinc-400' : 'text-zinc-600',
                ].join(' ')}
              >
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
  const [session, setSession] = useState<SessionData | null>(null)
  const [currentStep, setCurrentStep] = useState(1)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Step forms
  const [profile, setProfile] = useState<ProfileForm>({
    pharmacyName: '',
    address: '',
    district: '',
    phone: '',
    licenseNumber: '',
    licenseExpiry: '',
  })

  const [store, setStore] = useState<StoreForm>({
    storeName: '',
    storeType: 'Main Branch',
  })

  const [products, setProducts] = useState<ProductRow[]>([emptyProduct()])

  const [network, setNetwork] = useState<NetworkForm>({
    isNetworkMember: false,
    acceptsRefillRequests: false,
    networkListingName: '',
  })

  // ── Fetch session on mount ─────────────────────────────────────────────────

  const loadSession = useCallback(async () => {
    // Use synapse_session for auth check
    const sessionRes = await fetch('/api/auth/session', { cache: 'no-store' })
    const sessionData = await sessionRes.json()

    if (!sessionData?.userId) {
      router.replace('/login')
      return
    }

    if (!sessionData?.tenantId) {
      router.replace('/login?error=no_pharmacy_access')
      return
    }

    const tenantId = sessionData.tenantId as string
    const supabase = createClient()

    // Fetch tenant data
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name, address, district, phone')
      .eq('id', tenantId)
      .single()

    // Fetch pharmacy_profiles if exists
    const { data: pharmProfile } = await supabase
      .from('pharmacy_profiles')
      .select('license_number, license_expiry, contact_phone, physical_address, district')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    // Fetch current onboarding step
    const { data: onboarding } = await supabase
      .from('pharmacy_onboarding')
      .select('current_step')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    setSession({ userId: sessionData.userId, tenantId, tenantName: tenant?.name ?? '' })

    setProfile({
      pharmacyName: tenant?.name ?? '',
      address: pharmProfile?.physical_address ?? tenant?.address ?? '',
      district: pharmProfile?.district ?? tenant?.district ?? '',
      phone: pharmProfile?.contact_phone ?? tenant?.phone ?? '',
      licenseNumber: pharmProfile?.license_number ?? '',
      licenseExpiry: pharmProfile?.license_expiry ?? '',
    })

    setStore((prev) => ({
      ...prev,
      storeName: `${tenant?.name ?? ''} - Main Branch`,
    }))

    // Resume at the correct step (min 1, max 5)
    const savedStep = onboarding?.current_step ?? 1
    setCurrentStep(Math.min(Math.max(savedStep, 1), 5))

    setIsLoading(false)
  }, [router])

  useEffect(() => {
    loadSession()
  }, [loadSession])

  // ── Step 1: Save pharmacy profile ──────────────────────────────────────────

  const saveStep1 = async () => {
    if (!session) return
    setSaveError(null)
    setIsSaving(true)
    try {
      const supabase = createClient()

      const { error: tenantErr } = await supabase
        .from('tenants')
        .update({
          address: profile.address,
          district: profile.district,
          phone: profile.phone,
        })
        .eq('id', session.tenantId)

      if (tenantErr) throw new Error(tenantErr.message)

      const { error: profileErr } = await supabase
        .from('pharmacy_profiles')
        .upsert(
          {
            tenant_id: session.tenantId,
            license_number: profile.licenseNumber || null,
            license_expiry: profile.licenseExpiry || null,
            contact_phone: profile.phone || null,
            physical_address: profile.address || null,
            district: profile.district || null,
          },
          { onConflict: 'tenant_id' }
        )

      if (profileErr) throw new Error(profileErr.message)

      // Advance onboarding step
      await supabase
        .from('pharmacy_onboarding')
        .update({ current_step: 2 })
        .eq('tenant_id', session.tenantId)

      setCurrentStep(2)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  // ── Step 2: Save store setup ───────────────────────────────────────────────

  const saveStep2 = async () => {
    if (!session) return
    setSaveError(null)
    setIsSaving(true)
    try {
      const supabase = createClient()

      // Check if store already exists for this tenant
      const { data: existingStore } = await supabase
        .from('pharmacy_stores')
        .select('id')
        .eq('tenant_id', session.tenantId)
        .maybeSingle()

      if (!existingStore) {
        const { error: storeErr } = await supabase.from('pharmacy_stores').insert({
          tenant_id: session.tenantId,
          name: store.storeName,
          store_type: store.storeType,
        })
        // Swallow error gracefully — table might not exist yet
        if (storeErr) {
          console.warn('pharmacy_stores insert failed (table may not exist):', storeErr.message)
        }
      }

      // Advance onboarding step
      const { error: stepErr } = await supabase
        .from('pharmacy_onboarding')
        .update({ current_step: 3 })
        .eq('tenant_id', session.tenantId)

      if (stepErr) throw new Error(stepErr.message)

      // Try to set timestamp separately — column may not exist
      void Promise.resolve(
        supabase
          .from('pharmacy_onboarding')
          .update({ store_setup_at: new Date().toISOString() } as Record<string, unknown>)
          .eq('tenant_id', session.tenantId)
      ).catch(() => {})

      setCurrentStep(3)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  // ── Step 3: Save products ──────────────────────────────────────────────────

  const saveStep3 = async (skip = false) => {
    if (!session) return
    setSaveError(null)
    setIsSaving(true)
    try {
      const supabase = createClient()

      if (!skip) {
        const validRows = products.filter((p) => p.name.trim())
        if (validRows.length > 0) {
          const inserts = validRows.map((row, idx) => ({
            tenant_id: session.tenantId,
            name: row.name.trim(),
            category: row.category.trim() || 'General',
            quantity: parseInt(row.quantity) || 0,
            price: parseFloat(row.price) || 0,
            reorder_level: parseInt(row.reorderLevel) || 5,
            is_active: true,
            // Required non-nullable fields with safe defaults
            sku: `SKU-${slugify(row.name)}-${Date.now()}-${idx}`,
            cost_price: parseFloat(row.price) || 0,
            unit_of_measure: 'units',
          }))

          const { error: prodErr } = await supabase.from('pharmacy_products').insert(inserts)
          if (prodErr) throw new Error(prodErr.message)
        }
      }

      // Advance step
      const { error: stepErr } = await supabase
        .from('pharmacy_onboarding')
        .update({ current_step: 4 })
        .eq('tenant_id', session.tenantId)

      if (stepErr) throw new Error(stepErr.message)

      // Try timestamp separately
      void Promise.resolve(
        supabase
          .from('pharmacy_onboarding')
          .update({ first_product_at: new Date().toISOString() } as Record<string, unknown>)
          .eq('tenant_id', session.tenantId)
      ).catch(() => {})

      setCurrentStep(4)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  // ── Step 4: Save network visibility ───────────────────────────────────────

  const saveStep4 = async () => {
    if (!session) return
    setSaveError(null)
    setIsSaving(true)
    try {
      const supabase = createClient()

      // Build update — network_listing_name may not exist on all tenants rows
      const tenantUpdate: Record<string, unknown> = {
        is_network_member: network.isNetworkMember,
        accepts_refill_requests: network.acceptsRefillRequests,
      }
      if (network.isNetworkMember && network.networkListingName.trim()) {
        tenantUpdate.network_listing_name = network.networkListingName.trim()
      }

      const { error: tenantErr } = await supabase
        .from('tenants')
        .update(tenantUpdate)
        .eq('id', session.tenantId)

      if (tenantErr) throw new Error(tenantErr.message)

      const { error: stepErr } = await supabase
        .from('pharmacy_onboarding')
        .update({ current_step: 5 })
        .eq('tenant_id', session.tenantId)

      if (stepErr) throw new Error(stepErr.message)

      setCurrentStep(5)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  // ── Step 5: Complete ───────────────────────────────────────────────────────

  const completeOnboarding = async () => {
    if (!session) return
    setSaveError(null)
    setIsSaving(true)
    try {
      const supabase = createClient()

      // Mark tenant onboarding complete
      await supabase
        .from('tenants')
        .update({ onboarding_completed: true })
        .eq('id', session.tenantId)

      // Ensure current_step = 5 is persisted (guards middleware redirect)
      const { error: stepFinalErr } = await supabase
        .from('pharmacy_onboarding')
        .update({ current_step: 5 })
        .eq('tenant_id', session.tenantId)

      if (stepFinalErr) throw new Error(stepFinalErr.message)

      // Fire-and-forget timestamp — column may not exist yet
      void Promise.resolve(
        supabase
          .from('pharmacy_onboarding')
          .update({ onboarding_completed_at: new Date().toISOString() } as Record<string, unknown>)
          .eq('tenant_id', session.tenantId)
      ).catch(() => {})

      router.push('/portal/dashboard')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to complete. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  // ── Product rows helpers ───────────────────────────────────────────────────

  const updateProduct = (idx: number, field: keyof ProductRow, value: string) => {
    setProducts((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p))
    )
  }

  const removeProduct = (idx: number) => {
    setProducts((prev) => prev.filter((_, i) => i !== idx))
  }

  // ── Shared input class ─────────────────────────────────────────────────────

  const inputCls =
    'w-full bg-[#1A1A24] border border-[#2A2A36] rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-[#F97316] focus:outline-none transition-colors'

  const labelCls = 'block text-xs font-medium uppercase tracking-wider text-zinc-400 mb-1'

  // ── Loading spinner ────────────────────────────────────────────────────────

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

  // ── Layout wrapper ─────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#07070A] flex items-center justify-center p-4 py-10">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 shadow-lg bg-gradient-to-br from-[#F97316] to-[#E8B84B]">
            <span className="text-white font-black text-xl">S</span>
          </div>
          <h1 className="text-xl font-bold text-white">
            Synapse <span className="text-[#E8B84B]">Pharmacy</span>
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Set up your pharmacy in just a few steps</p>
        </div>

        {/* Progress bar */}
        <ProgressBar currentStep={currentStep} />

        {/* Card */}
        <div className="bg-[#111117] border border-[#2A2A36] rounded-xl p-6 shadow-xl">
          {/* Error banner */}
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
                Tell us about your pharmacy. This information helps patients find you.
              </p>

              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Pharmacy Name</label>
                  <input
                    className={inputCls}
                    value={profile.pharmacyName}
                    onChange={(e) => setProfile({ ...profile, pharmacyName: e.target.value })}
                    placeholder="e.g. Nakato Pharmacy"
                  />
                </div>

                <div>
                  <label className={labelCls}>Physical Address</label>
                  <input
                    className={inputCls}
                    value={profile.address}
                    onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                    placeholder="Plot 12, Kampala Road"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>District</label>
                    <input
                      className={inputCls}
                      value={profile.district}
                      onChange={(e) => setProfile({ ...profile, district: e.target.value })}
                      placeholder="e.g. Kampala"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Phone Number</label>
                    <input
                      className={inputCls}
                      value={profile.phone}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
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
                      onChange={(e) => setProfile({ ...profile, licenseNumber: e.target.value })}
                      placeholder="NDA-PHARM-XXXXX"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>License Expiry Date</label>
                    <input
                      type="date"
                      className={inputCls}
                      value={profile.licenseExpiry}
                      onChange={(e) => setProfile({ ...profile, licenseExpiry: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={saveStep1}
                  disabled={isSaving}
                  className="flex items-center gap-2 bg-[#F97316] hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-lg px-6 py-2.5 transition-colors"
                >
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
                    onChange={(e) => setStore({ ...store, storeName: e.target.value })}
                    placeholder="Main Branch"
                  />
                </div>

                <div>
                  <label className={labelCls}>Store Type</label>
                  <select
                    className={`${inputCls} appearance-none`}
                    value={store.storeType}
                    onChange={(e) => setStore({ ...store, storeType: e.target.value })}
                  >
                    <option value="Main Branch">Main Branch</option>
                    <option value="Dispensary">Dispensary</option>
                    <option value="Satellite">Satellite</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={saveStep2}
                  disabled={isSaving}
                  className="flex items-center gap-2 bg-[#F97316] hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-lg px-6 py-2.5 transition-colors"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Save & Continue
                  {!isSaving && <ChevronRight className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: First Products ── */}
          {currentStep === 3 && (
            <div>
              <h2 className="text-lg font-bold text-white mb-1">Add First Products</h2>
              <p className="text-zinc-500 text-sm mb-6">
                Add a few medicines to get started. You can add more from the Inventory page later.
              </p>

              {/* Table */}
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
                  <tbody className="space-y-2">
                    {products.map((row, idx) => (
                      <tr key={idx} className="border-b border-[#2A2A36]/50">
                        <td className="py-2 pr-2">
                          <input
                            className={inputCls}
                            placeholder="Amoxicillin 500mg"
                            value={row.name}
                            onChange={(e) => updateProduct(idx, 'name', e.target.value)}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            className={inputCls}
                            placeholder="Antibiotics"
                            value={row.category}
                            onChange={(e) => updateProduct(idx, 'category', e.target.value)}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="number"
                            min="0"
                            className={inputCls}
                            placeholder="100"
                            value={row.quantity}
                            onChange={(e) => updateProduct(idx, 'quantity', e.target.value)}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="number"
                            min="0"
                            step="100"
                            className={inputCls}
                            placeholder="2500"
                            value={row.price}
                            onChange={(e) => updateProduct(idx, 'price', e.target.value)}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="number"
                            min="0"
                            className={inputCls}
                            placeholder="10"
                            value={row.reorderLevel}
                            onChange={(e) => updateProduct(idx, 'reorderLevel', e.target.value)}
                          />
                        </td>
                        <td className="py-2">
                          {products.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeProduct(idx)}
                              className="text-zinc-600 hover:text-red-400 transition-colors p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                onClick={() => setProducts((prev) => [...prev, emptyProduct()])}
                className="mt-3 flex items-center gap-1.5 text-sm text-[#F97316] hover:text-orange-400 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add another medicine
              </button>

              <div className="mt-6 flex items-center justify-between">
                <button
                  onClick={() => saveStep3(true)}
                  disabled={isSaving}
                  className="text-sm text-zinc-500 hover:text-zinc-300 disabled:opacity-50 transition-colors"
                >
                  Skip for now
                </button>
                <button
                  onClick={() => saveStep3(false)}
                  disabled={isSaving}
                  className="flex items-center gap-2 bg-[#F97316] hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-lg px-6 py-2.5 transition-colors"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Save & Continue
                  {!isSaving && <ChevronRight className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 4: Network Visibility ── */}
          {currentStep === 4 && (
            <div>
              <h2 className="text-lg font-bold text-white mb-1">Network Visibility</h2>
              <p className="text-zinc-500 text-sm mb-6">
                Choose whether patients can discover your pharmacy through the Synapse App.
              </p>

              <div className="space-y-5">
                {/* Toggle 1 */}
                <div className="flex items-start justify-between gap-4 bg-[#1A1A24] border border-[#2A2A36] rounded-lg p-4">
                  <div>
                    <p className="text-sm font-medium text-white">
                      List my pharmacy in Synapse App
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Patients nearby can find your pharmacy and view your stock availability.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setNetwork((n) => ({ ...n, isNetworkMember: !n.isNetworkMember }))
                    }
                    className={[
                      'relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0',
                      network.isNetworkMember ? 'bg-[#F97316]' : 'bg-[#2A2A36]',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                        network.isNetworkMember ? 'translate-x-6' : 'translate-x-1',
                      ].join(' ')}
                    />
                  </button>
                </div>

                {/* Network listing name — shown when member */}
                {network.isNetworkMember && (
                  <div>
                    <label className={labelCls}>Network Listing Name</label>
                    <input
                      className={inputCls}
                      value={network.networkListingName}
                      onChange={(e) =>
                        setNetwork({ ...network, networkListingName: e.target.value })
                      }
                      placeholder={profile.pharmacyName || 'Your pharmacy display name'}
                    />
                    <p className="text-xs text-zinc-600 mt-1">
                      This is how patients see your pharmacy in search results.
                    </p>
                  </div>
                )}

                {/* Toggle 2 */}
                <div className="flex items-start justify-between gap-4 bg-[#1A1A24] border border-[#2A2A36] rounded-lg p-4">
                  <div>
                    <p className="text-sm font-medium text-white">
                      Accept prescription refill requests
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Allow patients to send digital refill requests from the app.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setNetwork((n) => ({
                        ...n,
                        acceptsRefillRequests: !n.acceptsRefillRequests,
                      }))
                    }
                    className={[
                      'relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0',
                      network.acceptsRefillRequests ? 'bg-[#F97316]' : 'bg-[#2A2A36]',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                        network.acceptsRefillRequests ? 'translate-x-6' : 'translate-x-1',
                      ].join(' ')}
                    />
                  </button>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={saveStep4}
                  disabled={isSaving}
                  className="flex items-center gap-2 bg-[#F97316] hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-lg px-6 py-2.5 transition-colors"
                >
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
              {/* Green checkmark */}
              <div className="w-16 h-16 rounded-full bg-green-500/10 border-2 border-green-500/30 flex items-center justify-center mx-auto mb-5">
                <Check className="w-8 h-8 text-green-400" />
              </div>

              <h2 className="text-2xl font-bold text-white mb-2">Your pharmacy is ready!</h2>
              <p className="text-zinc-400 text-sm mb-6 max-w-md mx-auto">
                You have successfully configured your Synapse Pharmacy account. Here is a summary
                of what was set up:
              </p>

              {/* Summary */}
              <div className="bg-[#1A1A24] border border-[#2A2A36] rounded-lg p-4 text-left space-y-2.5 mb-7">
                <div className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span className="text-sm text-zinc-300">
                    Pharmacy profile &amp; license information saved
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span className="text-sm text-zinc-300">
                    Main store &ldquo;{store.storeName}&rdquo; created
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span className="text-sm text-zinc-300">
                    {products.filter((p) => p.name.trim()).length > 0
                      ? `${products.filter((p) => p.name.trim()).length} medicine(s) added to inventory`
                      : 'Inventory ready — add medicines from the Inventory page'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span className="text-sm text-zinc-300">
                    {network.isNetworkMember
                      ? 'Listed in the Synapse patient network'
                      : 'Network listing configured'}
                  </span>
                </div>
              </div>

              <button
                onClick={completeOnboarding}
                disabled={isSaving}
                className="inline-flex items-center gap-2 bg-[#F97316] hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-lg px-8 py-3 transition-colors text-base"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Go to Dashboard
                {!isSaving && <ChevronRight className="w-4 h-4" />}
              </button>

              {saveError && (
                <p className="mt-4 text-red-400 text-sm">{saveError}</p>
              )}
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
