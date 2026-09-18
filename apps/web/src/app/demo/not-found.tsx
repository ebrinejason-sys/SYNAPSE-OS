import Link from "next/link"
import { DEMO_ROUTES } from "../../lib/demo/paths"

export default function DemoNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-sm font-semibold text-orange-500">SYNTHETIC PLAYGROUND</p>
      <h1 className="text-2xl font-bold">That demo page is not part of the playground</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Use the Test Drive roles and workspaces. Production hospital URLs are not available on this host.
      </p>
      <div className="flex flex-wrap justify-center gap-3 text-sm">
        <Link href={DEMO_ROUTES.home} className="rounded-lg border px-4 py-2">Demo home</Link>
        <Link href={DEMO_ROUTES.login} className="rounded-lg bg-orange-500 px-4 py-2 font-semibold text-black">Start Test Drive</Link>
        <Link href={DEMO_ROUTES.guide} className="rounded-lg border px-4 py-2">How it works</Link>
      </div>
    </main>
  )
}
