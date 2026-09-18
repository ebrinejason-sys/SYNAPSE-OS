import Link from 'next/link'

export default function UnauthorizedPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
      <h1 className="font-display text-2xl text-primary-color">Access denied</h1>
      <p className="mt-3 text-sm text-secondary-color">
        Your signed-in role or facility membership cannot open this workspace. Sign in with the
        correct facility account, or ask an administrator to grant membership.
      </p>
      <div className="mt-6 flex gap-3">
        <Link href="/login" className="rounded-lg bg-[#F97316] px-4 py-2 text-sm font-medium text-black">
          Sign in
        </Link>
        <Link href="/os" className="rounded-lg border border-border px-4 py-2 text-sm">
          Facility directory
        </Link>
      </div>
    </main>
  )
}
