import { supabaseAdmin } from '@/lib/supabase/admin'
import { findFacilityInvitationByToken } from '@synapse/db/facility-invite-token'
import { FacilityInviteForm } from './FacilityInviteForm'

export default async function PharmacyFacilityInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const found = await findFacilityInvitationByToken<{
    email: string; status: string; expires_at: string; tenants: { name?: string; facility_type?: string } | null
  }>(supabaseAdmin, token, 'email, status, expires_at, tenants(name, facility_type)')
  const invite = found?.invite ?? null
  const tenant = invite?.tenants as { name?: string; facility_type?: string } | null
  const valid = invite && tenant?.facility_type === 'pharmacy' && !['ACCEPTED', 'REVOKED', 'EXPIRED'].includes(invite.status) && new Date(invite.expires_at) >= new Date()

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      {valid ? (
        <FacilityInviteForm token={token} pharmacyName={tenant?.name ?? 'Your pharmacy'} email={invite.email} />
      ) : (
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center">
          <h1 className="text-xl font-bold">Invitation unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">This link is invalid, expired, revoked, or has already been used.</p>
        </div>
      )}
    </main>
  )
}
