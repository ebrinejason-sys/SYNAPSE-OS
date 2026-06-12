'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Hospital, FlaskConical, Heart, Globe, Package } from 'lucide-react'
import { provisionTenant } from './actions'

const FACILITY_TYPES = [
  { value: 'hospital',  label: 'Hospital',         icon: Hospital,    plans: ['hospital_network'] },
  { value: 'clinic',    label: 'Clinic',            icon: Building2,   plans: ['clinic_basic', 'clinic_pro'] },
  { value: 'pharmacy',  label: 'Pharmacy',          icon: Package,     plans: ['starter_pharmacy', 'growth_pharmacy'] },
  { value: 'lab',       label: 'Laboratory',        icon: FlaskConical, plans: ['lab_basic'] },
  { value: 'homecare',  label: 'Home Care',         icon: Heart,       plans: ['homecare_basic'] },
  { value: 'ngo',       label: 'NGO / Program',     icon: Globe,       plans: ['ngo_program'] },
]

const PLAN_LABELS: Record<string, string> = {
  starter_pharmacy: 'Starter Pharmacy — $29/mo',
  growth_pharmacy:  'Growth Pharmacy — $79/mo',
  clinic_basic:     'Clinic Basic — $49/mo',
  clinic_pro:       'Clinic Pro — $149/mo',
  hospital_network: 'Hospital Network — $299/mo',
  homecare_basic:   'Homecare Basic — $39/mo',
  ngo_program:      'NGO Program — $19/mo',
  lab_basic:        'Lab Basic — $29/mo',
}

export default function ProvisionTenantPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    facilityType:  '',
    name:          '',
    slug:          '',
    country:       'Uganda',
    district:      '',
    address:       '',
    phone:         '',
    email:         '',
    planSlug:      '',
    adminEmail:    '',
    adminPassword: '',
    adminFullName: '',
  })

  // Auto-generate slug from name
  useEffect(() => {
    if (form.name && !form.slug) {
      setForm(f => ({ ...f, slug: f.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 40) }))
    }
  }, [form.name, form.slug])

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
    setError(null)
  }

  const facilityConfig = FACILITY_TYPES.find(f => f.value === form.facilityType)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (step < 4) { setStep(s => s + 1); return }

    setLoading(true)
    setError(null)

    const result = await provisionTenant(form)

    if (!result.ok) {
      setError(result.error ?? 'Provisioning failed.')
      setLoading(false)
      return
    }

    router.push(`/platform/tenants/${result.tenantId}`)
  }

  const steps = ['Facility Type', 'Details', 'Plan', 'Admin User']

  return (
    <div className="min-h-screen bg-[#07070A] text-white p-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Provision New Tenant</h1>
          <p className="mt-1 text-sm text-slate-400">Create a facility account and assign a subscription plan.</p>
        </div>

        {/* Stepper */}
        <div className="mb-8 flex gap-2">
          {steps.map((label, i) => (
            <div key={i} className="flex flex-1 items-center gap-2">
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                i + 1 < step ? 'bg-green-500 text-black'
                : i + 1 === step ? 'bg-[#F97316] text-black'
                : 'bg-slate-800 text-slate-500'}`}>
                {i + 1 < step ? '✓' : i + 1}
              </div>
              <span className={`hidden text-xs sm:block ${i + 1 === step ? 'text-white' : 'text-slate-500'}`}>{label}</span>
              {i < steps.length - 1 && <div className="h-px flex-1 bg-slate-800" />}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6 space-y-5">

            {/* Step 1: Facility Type */}
            {step === 1 && (
              <div className="space-y-4">
                <h2 className="font-semibold">Select facility type</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {FACILITY_TYPES.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value} type="button"
                      onClick={() => { set('facilityType', value); set('planSlug', '') }}
                      className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition ${
                        form.facilityType === value
                          ? 'border-[#F97316] bg-[#F97316]/10 text-[#F97316]'
                          : 'border-slate-800 bg-[#111117] text-slate-400 hover:border-slate-600'}`}
                    >
                      <Icon className="h-6 w-6" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Facility Details */}
            {step === 2 && (
              <div className="space-y-3">
                <h2 className="font-semibold">Facility details</h2>
                {[
                  { key: 'name', label: 'Facility Name', placeholder: 'Kampala General Hospital' },
                  { key: 'slug', label: 'Subdomain slug', placeholder: 'kampala-general' },
                  { key: 'country', label: 'Country', placeholder: 'Uganda' },
                  { key: 'district', label: 'District', placeholder: 'Kampala' },
                  { key: 'address', label: 'Physical Address', placeholder: 'Plot 12, Nakasero Road' },
                  { key: 'phone', label: 'Phone', placeholder: '+256 700 000000' },
                  { key: 'email', label: 'Facility Email', placeholder: 'info@hospital.ug' },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="mb-1 block text-xs text-slate-400">{label}</label>
                    <input
                      required
                      value={form[key as keyof typeof form]}
                      onChange={e => set(key, e.target.value)}
                      placeholder={placeholder}
                      className="w-full rounded-lg border border-slate-700 bg-[#111117] px-3 py-2.5 text-sm focus:border-[#F97316] focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Step 3: Subscription Plan */}
            {step === 3 && (
              <div className="space-y-4">
                <h2 className="font-semibold">Subscription plan for {facilityConfig?.label}</h2>
                <div className="space-y-2">
                  {(facilityConfig?.plans ?? []).map(slug => (
                    <label key={slug} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition ${
                      form.planSlug === slug ? 'border-[#F97316] bg-[#F97316]/10' : 'border-slate-800 bg-[#111117]'}`}>
                      <input
                        type="radio" name="plan" value={slug}
                        checked={form.planSlug === slug}
                        onChange={() => set('planSlug', slug)}
                        className="accent-[#F97316]"
                      />
                      <span className="text-sm font-medium">{PLAN_LABELS[slug] ?? slug}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4: Admin User */}
            {step === 4 && (
              <div className="space-y-3">
                <h2 className="font-semibold">Facility admin account</h2>
                {[
                  { key: 'adminFullName',  label: 'Full Name',    placeholder: 'Dr. Jane Nakato', type: 'text' },
                  { key: 'adminEmail',     label: 'Email',        placeholder: 'admin@hospital.ug', type: 'email' },
                  { key: 'adminPassword',  label: 'Temp Password', placeholder: '••••••••', type: 'password' },
                ].map(({ key, label, placeholder, type }) => (
                  <div key={key}>
                    <label className="mb-1 block text-xs text-slate-400">{label}</label>
                    <input
                      required type={type}
                      value={form[key as keyof typeof form]}
                      onChange={e => set(key, e.target.value)}
                      placeholder={placeholder}
                      minLength={key === 'adminPassword' ? 8 : undefined}
                      className="w-full rounded-lg border border-slate-700 bg-[#111117] px-3 py-2.5 text-sm focus:border-[#F97316] focus:outline-none"
                    />
                  </div>
                ))}
                <p className="text-xs text-slate-500">Admin will need to change this password on first login.</p>
              </div>
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="flex justify-between pt-2">
              {step > 1 && (
                <button type="button" onClick={() => setStep(s => s - 1)}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500">
                  Back
                </button>
              )}
              <button
                type="submit"
                disabled={
                  loading ||
                  (step === 1 && !form.facilityType) ||
                  (step === 3 && !form.planSlug)
                }
                className="ml-auto rounded-xl bg-[#F97316] px-6 py-2.5 text-sm font-bold text-black disabled:opacity-50"
              >
                {step === 4 ? (loading ? 'Provisioning…' : 'Provision Tenant') : 'Next →'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
