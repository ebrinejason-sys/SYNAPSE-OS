import { getInviteDetails } from './actions'
import { InviteForm } from './InviteForm'
import Link from 'next/link'

function Logo() {
  return (
    <div className="flex flex-col items-center mb-8">
      <img src="/logo-dark.png" alt="Synapse Pharmacy" className="w-16 h-16 rounded-2xl object-contain mb-4 shadow-lg" />
      <h1 className="text-xl font-bold text-white">
        Synapse <span className="text-[#E8B84B]">Pharmacy</span>
      </h1>
    </div>
  )
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  if (!token) {
    return (
      <Shell>
        <Logo />
        <InvalidCard />
      </Shell>
    )
  }

  const details = await getInviteDetails(token)

  if (details.status === 'already_used') {
    return (
      <Shell>
        <Logo />
        <div className="text-blue-300 bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-4 text-sm text-center">
          <p className="font-semibold text-base mb-1">Invite already used</p>
          <p className="text-blue-200/80">This invite has already been used. Contact your administrator if you need access.</p>
        </div>
        <p className="mt-6 text-sm text-zinc-500 text-center">
          Already have an account?{' '}
          <Link href="/login" className="text-[#F97316] hover:underline font-medium">Sign in</Link>
        </p>
      </Shell>
    )
  }

  if (details.status !== 'valid') {
    return (
      <Shell>
        <Logo />
        <InvalidCard />
      </Shell>
    )
  }

  return (
    <Shell>
      <Logo />
      <InviteForm
        token={token}
        pharmacyName={details.pharmacyName}
        adminEmail={details.adminEmail}
        adminName={details.adminName}
        profileExists={details.profileExists}
      />
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#07070A] flex items-center justify-center p-4">
      <div className="bg-[#111117] border border-[#2A2A36] rounded-2xl p-8 w-full max-w-md shadow-xl">
        {children}
      </div>
    </div>
  )
}

function InvalidCard() {
  return (
    <div className="text-red-400 bg-red-500/10 rounded-lg px-4 py-4 text-sm text-center">
      <p className="font-semibold text-base mb-1">Link invalid or expired</p>
      <p className="text-red-300/80">This invite link is invalid or has expired. Contact your administrator to request a new one.</p>
    </div>
  )
}
