'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, ExternalLink, Loader2 } from 'lucide-react'
import { provisionPharmacy } from './actions'

export default function ProvisionPharmacyPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const [form, setForm] = useState({
    name:          '',
    slug:          '',
    district:      '',
    adminEmail:    '',
    adminFullName: '',
  })

  useEffect(() => {
    if (form.name) {
      setForm(f => ({
        ...f,
        slug: f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40),
      }))
    }
  }, [form.name])

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.adminEmail || !form.adminFullName) {
      setError('Please fill in all required fields.')
      return
    }
    setLoading(true)
    setError(null)
    const result = await provisionPharmacy(form)
    setLoading(false)
    if (!result.ok) {
      setError(result.error ?? 'Provisioning failed.')
      return
    }
    setInviteUrl(result.inviteUrl ?? null)
    setTenantId(result.tenantId ?? null)
  }

  async function copyLink() {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (inviteUrl) {
    return (
      <div className="max-w-lg mx-auto mt-10">
        <div className="rounded-2xl border border-green-500/30 bg-green-500/5 p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-green-500/10 border-2 border-green-500/30 flex items-center justify-center mx-auto mb-5">
            <Check className="w-7 h-7 text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Pharmacy provisioned!</h2>
          <p className="text-slate-400 text-sm mb-6">
            Invite email sent to <strong className="text-white">{form.adminEmail}</strong>.
            If email delivery fails, share the link below directly.
          </p>
          <div className="bg-[#111117] border border-slate-800 rounded-xl p-3 text-left flex items-center gap-3 mb-4">
            <span className="text-xs text-slate-400 break-all flex-1">{inviteUrl}</span>
            <button onClick={copyLink} className="shrink-0 text-slate-400 hover:text-white transition-colors">
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex gap-3 justify-center mt-4">
            <button
              onClick={() => router.push(`/platform/tenants/${tenantId}`)}
              className="flex items-center gap-2 bg-[#F97316] text-black font-bold rounded-xl px-5 py-2.5 text-sm hover:bg-orange-500 transition-colors"
            >
              View Tenant <ExternalLink className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setInviteUrl(null); setForm({ name: '', slug: '', district: '', adminEmail: '', adminFullName: '' }) }}
              className="border border-slate-700 text-slate-300 rounded-xl px-5 py-2.5 text-sm hover:border-slate-500 transition-colors"
            >
              Provision Another
            </button>
          </div>
        </div>
      </div>
    )
  }

  const inputCls = "w-full rounded-lg border border-slate-700 bg-[#111117] px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:border-[#F97316] focus:outline-none transition-colors"
  const labelCls = "block mb-1 text-xs text-slate-400 font-medium"

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Provision New Pharmacy</h1>
        <p className="text-sm text-slate-400 mt-1">An invite email will be sent to the pharmacy admin to set up their account.</p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-800 bg-[#0B0B12] p-6 space-y-4">
        <div>
          <label className={labelCls}>Pharmacy Name *</label>
          <input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nakato Pharmacy" required />
        </div>

        <div>
          <label className={labelCls}>Subdomain (auto-generated)</label>
          <div className="flex items-center gap-2">
            <input className={inputCls} value={form.slug} onChange={e => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="nakato-pharmacy" />
            <span className="text-xs text-slate-500 shrink-0">.synapseos.tech</span>
          </div>
        </div>

        <div>
          <label className={labelCls}>District</label>
          <input className={inputCls} value={form.district} onChange={e => set('district', e.target.value)} placeholder="Kampala" />
        </div>

        <hr className="border-slate-800" />

        <div>
          <label className={labelCls}>Admin Full Name *</label>
          <input className={inputCls} value={form.adminFullName} onChange={e => set('adminFullName', e.target.value)} placeholder="Jane Nakato" required />
        </div>

        <div>
          <label className={labelCls}>Admin Email *</label>
          <input className={inputCls} type="email" value={form.adminEmail} onChange={e => set('adminEmail', e.target.value)} placeholder="admin@nakatopharmacy.ug" required />
        </div>

        {error && (
          <p className="text-red-400 bg-red-500/10 rounded-lg px-3 py-2.5 text-sm">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#F97316] hover:bg-orange-500 text-black font-bold rounded-xl py-2.5 text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
        >
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Provisioning…</> : 'Provision & Send Invite'}
        </button>
      </form>
    </div>
  )
}
