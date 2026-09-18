import Link from 'next/link'

export default function VerifyEmailPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
      <h1 className="font-display text-2xl text-primary-color">Verify your email</h1>
      <p className="mt-3 text-sm text-secondary-color">
        If this account requires email verification, check the inbox used at signup and follow the
        confirmation link. You can then continue to sign in.
      </p>
      <div className="mt-6 flex gap-3">
        <Link href="/login" className="rounded-lg bg-[#F97316] px-4 py-2 text-sm font-medium text-black">
          Back to sign in
        </Link>
        <Link href="/forgot-password" className="rounded-lg border border-border px-4 py-2 text-sm">
          Reset password
        </Link>
      </div>
    </main>
  )
}
