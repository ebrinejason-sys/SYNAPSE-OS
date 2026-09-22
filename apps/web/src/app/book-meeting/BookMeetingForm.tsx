'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { LandingNav } from '../../components/landing/LandingNav'
import { LandingFooter } from '../../components/landing/LandingFooter'
import { PUBLIC_CONTACT_EMAIL } from '@synapse/config/company'

const PRODUCTS = [
  { id: 'pharmacy', label: 'SYNAPSE Pharmacy' },
  { id: 'lab', label: 'SYNAPSE Lab' },
  { id: 'os', label: 'SYNAPSE OS' },
  { id: 'os-lab-addon', label: 'OS + Lab add-on' },
  { id: 'enterprise', label: 'Enterprise' },
  { id: 'intelligence', label: 'Intelligence' },
  { id: 'exchange', label: 'Exchange' },
] as const

const FACILITY_TYPES = ['hospital', 'clinic', 'pharmacy', 'laboratory', 'other'] as const

export default function BookMeetingForm() {
  const search = useSearchParams()
  const preset = search.get('product') ?? ''
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [emailNote, setEmailNote] = useState<string | null>(null)
  const initialProducts = useMemo(() => (preset ? [preset] : []), [preset])

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('loading')
    setError(null)
    const form = new FormData(e.currentTarget)
    const products = form.getAll('products').map(String)
    const payload = {
      name: String(form.get('name') ?? ''),
      workEmail: String(form.get('workEmail') ?? ''),
      phone: String(form.get('phone') ?? ''),
      organization: String(form.get('organization') ?? ''),
      facilityName: String(form.get('facilityName') ?? ''),
      facilityType: String(form.get('facilityType') ?? ''),
      country: String(form.get('country') ?? 'UG'),
      approximateSize: String(form.get('approximateSize') ?? ''),
      locationsCount: form.get('locationsCount') ? Number(form.get('locationsCount')) : null,
      productsInterested: products,
      currentSoftware: String(form.get('currentSoftware') ?? ''),
      preferredMeetingAt: String(form.get('preferredMeetingAt') ?? ''),
      message: String(form.get('message') ?? ''),
      source: 'book_meeting_page',
    }
    try {
      const res = await fetch('/api/commercial/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        emailStatus?: string
        emailDetail?: string
        contact?: string
      }
      if (!res.ok) throw new Error(data.error || 'Submission failed')
      if (data.emailStatus === 'skipped' || data.emailStatus === 'failed') {
        setEmailNote(
          `Request saved. Email notification ${data.emailStatus}${data.emailDetail ? `: ${data.emailDetail}` : ''}. Contact ${data.contact || PUBLIC_CONTACT_EMAIL}.`,
        )
      } else {
        setEmailNote(null)
      }
      setStatus('success')
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Submission failed')
    }
  }

  const input =
    'mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-[#F97316]/50'

  return (
    <main className="min-h-screen bg-[#07070A] text-white">
      <LandingNav />
      <div className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#E8B84B]">Book a Meeting</p>
        <h1 className="mt-3 text-3xl font-bold">Talk with the SYNAPSE team</h1>
        <p className="mt-3 text-sm text-slate-400">
          For enterprise, large hospitals, multisite groups, and custom deployments. We will follow up
          to schedule a conversation — calendar providers can be connected later without changing this
          flow.
        </p>

        {status === 'success' ? (
          <div className="mt-10 rounded-2xl border border-green-500/30 bg-green-500/10 p-6">
            <p className="font-semibold text-green-200">Request received</p>
            <p className="mt-2 text-sm text-green-100/80">
              Thanks — your meeting request is in our commercial pipeline. Email{' '}
              <a className="underline" href={`mailto:${PUBLIC_CONTACT_EMAIL}`}>
                {PUBLIC_CONTACT_EMAIL}
              </a>{' '}
              if you need to add details.
            </p>
            {emailNote ? <p className="mt-3 text-xs text-amber-200/90">{emailNote}</p> : null}
            <Link href="/pricing" className="mt-4 inline-block text-sm text-[#F97316]">
              Back to pricing →
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-10 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-xs text-slate-400">
                Name *
                <input name="name" required className={input} />
              </label>
              <label className="text-xs text-slate-400">
                Work email *
                <input name="workEmail" type="email" required className={input} />
              </label>
              <label className="text-xs text-slate-400">
                Phone
                <input name="phone" className={input} />
              </label>
              <label className="text-xs text-slate-400">
                Organization
                <input name="organization" className={input} />
              </label>
              <label className="text-xs text-slate-400">
                Facility name
                <input name="facilityName" className={input} />
              </label>
              <label className="text-xs text-slate-400">
                Facility type
                <select name="facilityType" className={input} defaultValue="hospital">
                  {FACILITY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-400">
                Country
                <input name="country" defaultValue="UG" className={input} />
              </label>
              <label className="text-xs text-slate-400">
                Approximate size
                <input name="approximateSize" placeholder="e.g. 120 beds / 3 branches" className={input} />
              </label>
              <label className="text-xs text-slate-400">
                Number of locations
                <input name="locationsCount" type="number" min={1} className={input} />
              </label>
              <label className="text-xs text-slate-400">
                Preferred meeting date/time
                <input name="preferredMeetingAt" type="datetime-local" className={input} />
              </label>
            </div>

            <fieldset>
              <legend className="text-xs text-slate-400">Products interested in</legend>
              <div className="mt-2 flex flex-wrap gap-3">
                {PRODUCTS.map((p) => (
                  <label key={p.id} className="inline-flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      name="products"
                      value={p.id}
                      defaultChecked={initialProducts.includes(p.id)}
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="block text-xs text-slate-400">
              Current software (if any)
              <input name="currentSoftware" className={input} />
            </label>
            <label className="block text-xs text-slate-400">
              Message / requirements
              <textarea name="message" rows={4} className={input} />
            </label>

            {status === 'error' && error ? (
              <p className="text-sm text-red-300">
                {error} — or email {PUBLIC_CONTACT_EMAIL}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="rounded-xl bg-[#F97316] px-5 py-3 text-sm font-semibold text-black disabled:opacity-60"
            >
              {status === 'loading' ? 'Submitting…' : 'Submit meeting request'}
            </button>
          </form>
        )}
      </div>
      <LandingFooter />
    </main>
  )
}
