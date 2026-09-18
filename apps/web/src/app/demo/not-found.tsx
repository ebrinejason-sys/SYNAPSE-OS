import Link from "next/link"
import { DEMO_ROUTES } from "../../lib/demo/paths"

export default function DemoNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="demo-frame max-w-lg p-8 text-center">
        <p className="demo-stamp mx-auto">Synthetic chart</p>
        <h1 className="font-display mt-6 text-2xl font-bold">That page is not on this chart</h1>
        <p className="mx-auto mt-3 max-w-md text-sm" style={{ color: "var(--text-secondary)" }}>
          Use the Test Drive stations. Production hospital URLs are not available on this host.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm">
          <Link href={DEMO_ROUTES.home} className="border px-4 py-2">Demo home</Link>
          <Link href={DEMO_ROUTES.login} className="border px-4 py-2 font-semibold" style={{ background: "var(--brand-orange)", color: "#07070A", borderColor: "var(--brand-orange)" }}>Start Test Drive</Link>
          <Link href={DEMO_ROUTES.guide} className="border px-4 py-2">How it works</Link>
        </div>
      </div>
    </main>
  )
}
