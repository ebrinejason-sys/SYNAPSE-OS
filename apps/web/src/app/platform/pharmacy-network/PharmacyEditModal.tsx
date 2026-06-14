'use client'

import { useState, useTransition } from 'react'
import { CheckCircle, Globe2, Loader2, Mail, RefreshCcw, Save, X } from 'lucide-react'
import {
  forceInventorySync,
  markMigrationReady,
  resendPharmacySetupInvite,
  updatePharmacyDetails,
  updatePharmacyDomain,
  verifyPharmacyDomain,
} from './actions'

type Tab = 'details' | 'migration' | 'domain' | 'invite'

interface Props {
  pharmacy: {
    id?: string
    name?: string | null
    district?: string | null
    email?: string | null
    phone?: string | null
    plan?: string | null
    is_network_member?: boolean | null
    accepts_refill_requests?: boolean | null
    network_listing_name?: string | null
  }
  profile?: {
    contact_phone?: string | null
    contact_email?: string | null
    custom_domain?: string | null
    custom_domain_verified?: boolean | null
    migrated_from?: string | null
    migration_status?: string | null
    is_network_visible?: boolean | null
    delivery_available?: boolean | null
  }
  onboarding?: {
    current_step?: number | null
    invite_sent_at?: string | null
    invite_expires_at?: string | null
  }
}

function fmt(dt?: string | null) {
  if (!dt) return '—'
  return new Date(dt).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function SaveButton({ pending, saved, label = 'Save' }: { pending: boolean; saved: boolean; label?: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-xl bg-[#F97316] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#EA6C0A] disabled:opacity-60"
    >
      {pending ? (
        <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving…</>
      ) : saved ? (
        <><CheckCircle className="h-3.5 w-3.5" />Saved!</>
      ) : (
        <><Save className="h-3.5 w-3.5" />{label}</>
      )}
    </button>
  )
}

export function PharmacyEditModal({ pharmacy, profile, onboarding }: Props) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('details')
  const [pending, startTransition] = useTransition()
  const [savedTab, setSavedTab] = useState<Tab | null>(null)

  const tenantId = pharmacy.id ?? ''
  const customDomain = profile?.custom_domain ?? ''

  function runAction(action: (fd: FormData) => Promise<void>, currentTab: Tab) {
    return (formData: FormData) => {
      startTransition(async () => {
        await action(formData)
        setSavedTab(currentTab)
        // Show success for 1.5s then clear
        setTimeout(() => setSavedTab(null), 1500)
      })
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'details', label: 'Details' },
    { id: 'migration', label: 'Migration' },
    { id: 'domain', label: 'Domain' },
    { id: 'invite', label: 'Invite' },
  ]

  return (
    <>
      <button
        type="button"
        onClick={() => { setTab('details'); setSavedTab(null); setOpen(true) }}
        className="inline-flex items-center gap-1 rounded-lg border border-[#F97316]/40 bg-[#F97316]/10 px-2.5 py-1 text-xs font-semibold text-[#F97316] transition hover:bg-[#F97316]/20"
      >
        Edit
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close modal"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Modal */}
          <div className="relative z-10 flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-subtle bg-surface shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between border-b border-subtle px-5 py-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#E8B84B]">Pharmacy</p>
                <h2 className="text-base font-bold text-primary-color">{pharmacy.name ?? 'Unnamed pharmacy'}</h2>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-muted-color transition hover:bg-elevated hover:text-primary-color"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-subtle px-5">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`-mb-px border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
                    tab === t.id
                      ? 'border-[#F97316] text-[#F97316]'
                      : 'border-transparent text-secondary-color hover:text-primary-color'
                  }`}
                >
                  {t.label}
                  {savedTab === t.id && (
                    <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-green-500/20 text-green-400">
                      <CheckCircle className="h-2.5 w-2.5" />
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="max-h-[65vh] overflow-y-auto p-5">

              {/* ── Details ──────────────────────────────────────── */}
              {tab === 'details' && (
                <form action={runAction(updatePharmacyDetails, 'details')} className="grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="tenant_id" value={tenantId} />
                  {[
                    { name: 'name', label: 'Name', value: pharmacy.name ?? '' },
                    { name: 'district', label: 'District', value: pharmacy.district ?? '' },
                    { name: 'phone', label: 'Phone', value: profile?.contact_phone ?? pharmacy.phone ?? '' },
                    { name: 'email', label: 'Email', value: profile?.contact_email ?? pharmacy.email ?? '' },
                    { name: 'network_listing_name', label: 'Network listing name', value: pharmacy.network_listing_name ?? pharmacy.name ?? '' },
                  ].map((field) => (
                    <label key={field.name} className="space-y-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-color">{field.label}</span>
                      <input
                        name={field.name}
                        defaultValue={field.value}
                        className="w-full rounded-lg border border-subtle bg-elevated px-3 py-2 text-xs text-primary-color focus:border-[#F97316]/50 focus:outline-none"
                      />
                    </label>
                  ))}
                  <label className="space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-color">Plan</span>
                    <select
                      name="plan"
                      defaultValue={pharmacy.plan ?? 'starter'}
                      className="w-full rounded-lg border border-subtle bg-elevated px-3 py-2 text-xs text-primary-color focus:border-[#F97316]/50 focus:outline-none"
                    >
                      <option value="trial">Trial</option>
                      <option value="starter">Starter</option>
                      <option value="professional">Professional</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </label>
                  <div className="flex flex-col gap-2 sm:col-span-2">
                    {[
                      { name: 'is_network_member', label: 'Visible on patient network', checked: Boolean(pharmacy.is_network_member || profile?.is_network_visible) },
                      { name: 'accepts_refill_requests', label: 'Accept refill requests', checked: Boolean(pharmacy.accepts_refill_requests) },
                      { name: 'delivery_available', label: 'Delivery available', checked: Boolean(profile?.delivery_available) },
                    ].map((cb) => (
                      <label key={cb.name} className="flex items-center gap-2 text-xs text-secondary-color">
                        <input name={cb.name} type="checkbox" defaultChecked={cb.checked} className="accent-[#F97316]" />
                        {cb.label}
                      </label>
                    ))}
                  </div>
                  <div className="sm:col-span-2">
                    <SaveButton pending={pending} saved={savedTab === 'details'} label="Save details" />
                  </div>
                </form>
              )}

              {/* ── Migration ─────────────────────────────────────── */}
              {tab === 'migration' && (
                <div className="space-y-4">
                  <form action={runAction(markMigrationReady, 'migration')} className="flex flex-wrap items-end gap-3">
                    <input type="hidden" name="tenant_id" value={tenantId} />
                    <label className="space-y-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-color">Source system</span>
                      <select
                        name="migration_source"
                        defaultValue={profile?.migrated_from ?? 'csv_excel'}
                        className="rounded-lg border border-subtle bg-elevated px-3 py-2 text-xs text-primary-color"
                      >
                        <option value="csv_excel">CSV / Excel</option>
                        <option value="quickbooks">QuickBooks</option>
                        <option value="legacy_system">Legacy system</option>
                        <option value="manual">Manual entry</option>
                      </select>
                    </label>
                    <button
                      type="submit"
                      disabled={pending}
                      className="inline-flex items-center gap-2 rounded-xl border border-[#E8B84B]/30 bg-[#E8B84B]/10 px-4 py-2 text-xs font-semibold text-[#E8B84B] transition hover:bg-[#E8B84B]/20 disabled:opacity-60"
                    >
                      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : savedTab === 'migration' ? <CheckCircle className="h-3.5 w-3.5" /> : null}
                      {pending ? 'Saving…' : savedTab === 'migration' ? 'Marked!' : 'Mark migration ready'}
                    </button>
                  </form>
                  <div className="rounded-xl border border-subtle bg-elevated p-4 text-xs space-y-1.5">
                    <p className="text-muted-color">Current status: <span className="font-medium text-primary-color">{profile?.migration_status ?? 'not started'}</span></p>
                    <p className="text-muted-color">Source: <span className="font-medium text-primary-color">{profile?.migrated_from ?? '—'}</span></p>
                  </div>
                  <form action={runAction(forceInventorySync, 'migration')}>
                    <input type="hidden" name="tenant_id" value={tenantId} />
                    <button
                      type="submit"
                      disabled={pending}
                      className="inline-flex items-center gap-2 rounded-xl border border-subtle px-4 py-2 text-xs text-secondary-color transition hover:text-primary-color disabled:opacity-60"
                    >
                      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
                      Force inventory sync
                    </button>
                  </form>
                </div>
              )}

              {/* ── Domain ────────────────────────────────────────── */}
              {tab === 'domain' && (
                <div className="space-y-4">
                  <form action={runAction(updatePharmacyDomain, 'domain')} className="flex flex-wrap items-end gap-3">
                    <input type="hidden" name="tenant_id" value={tenantId} />
                    <label className="flex-1 space-y-1 min-w-48">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-color">Custom domain</span>
                      <input
                        name="custom_domain"
                        placeholder="rx.example.ug"
                        defaultValue={customDomain}
                        className="w-full rounded-lg border border-subtle bg-elevated px-3 py-2 text-xs text-primary-color focus:border-[#F97316]/50 focus:outline-none"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={pending}
                      className="inline-flex items-center gap-2 rounded-xl border border-subtle px-4 py-2 text-xs text-secondary-color transition hover:text-primary-color disabled:opacity-60"
                    >
                      <Globe2 className="h-3.5 w-3.5" />
                      Set domain
                    </button>
                  </form>
                  {customDomain && (
                    <form action={runAction(verifyPharmacyDomain, 'domain')}>
                      <input type="hidden" name="tenant_id" value={tenantId} />
                      <input type="hidden" name="custom_domain" value={customDomain} />
                      <button
                        type="submit"
                        disabled={pending}
                        className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs transition disabled:opacity-60 ${profile?.custom_domain_verified ? 'border-green-500/30 text-green-300' : 'border-[#E8B84B]/30 text-[#E8B84B] hover:bg-[#E8B84B]/10'}`}
                      >
                        <Globe2 className="h-3.5 w-3.5" />
                        {profile?.custom_domain_verified ? 'Domain verified ✓' : 'Verify domain'}
                      </button>
                    </form>
                  )}
                  {customDomain && (
                    <div className="rounded-xl border border-subtle bg-elevated p-4 text-xs text-muted-color space-y-1">
                      <p className="font-semibold text-secondary-color">DNS TXT record required</p>
                      <p>Name: <span className="font-mono text-[#E8B84B] break-all">_synapse.{customDomain}</span></p>
                      <p>Value: <span className="font-mono text-primary-color">synapse-domain-verification={tenantId.slice(0, 8)}</span></p>
                    </div>
                  )}
                  {savedTab === 'domain' && (
                    <p className="flex items-center gap-1.5 text-xs text-green-400">
                      <CheckCircle className="h-3.5 w-3.5" />Domain updated successfully
                    </p>
                  )}
                </div>
              )}

              {/* ── Invite ────────────────────────────────────────── */}
              {tab === 'invite' && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-subtle bg-elevated p-4 text-xs space-y-1.5">
                    <p className="text-muted-color">Onboarding step: <span className="font-medium text-primary-color">{onboarding?.current_step ?? 'not started'}</span></p>
                    <p className="text-muted-color">Invite sent: <span className="text-primary-color">{fmt(onboarding?.invite_sent_at)}</span></p>
                    <p className="text-muted-color">Invite expires: <span className="text-primary-color">{fmt(onboarding?.invite_expires_at)}</span></p>
                  </div>
                  <form action={runAction(resendPharmacySetupInvite, 'invite')}>
                    <input type="hidden" name="tenant_id" value={tenantId} />
                    <button
                      type="submit"
                      disabled={pending}
                      className="inline-flex items-center gap-2 rounded-xl border border-[#E8B84B]/30 bg-[#E8B84B]/10 px-4 py-2 text-xs font-semibold text-[#E8B84B] transition hover:bg-[#E8B84B]/20 disabled:opacity-60"
                    >
                      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : savedTab === 'invite' ? <CheckCircle className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
                      {pending ? 'Sending…' : savedTab === 'invite' ? 'Sent!' : 'Resend setup invite'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
