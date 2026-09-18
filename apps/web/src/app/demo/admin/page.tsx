import Link from "next/link"
import { DemoShell } from "../../../components/demo/DemoShell"
import { DEMO_ROUTES } from "../../../lib/demo/paths"

const LINKS = [
  { href: DEMO_ROUTES.reception, label: "Reception" },
  { href: DEMO_ROUTES.nurse, label: "Nursing" },
  { href: DEMO_ROUTES.doctor, label: "Doctor" },
  { href: DEMO_ROUTES.lab, label: "Lab" },
  { href: DEMO_ROUTES.pharmacist, label: "Pharmacy" },
  { href: DEMO_ROUTES.billing, label: "Billing" },
  { href: DEMO_ROUTES.timeline, label: "Timeline" },
  { href: DEMO_ROUTES.network, label: "Network" },
]

export default function AdminDemoPage() {
  return (
    <DemoShell title="Facility overview" requiresRole={["admin"]}>
      <div className="grid gap-4 sm:grid-cols-3">
        {["Demo Hospital", "Demo Lab", "Demo Pharmacy"].map((name) => (
          <div key={name} className="rounded-lg border bg-card p-4">
            <h2 className="font-semibold">{name}</h2>
            <p className="text-sm text-muted-foreground">Synthetic · playground only</p>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="rounded-lg border bg-card p-4 hover:bg-accent">
            {link.label}
          </Link>
        ))}
      </div>
    </DemoShell>
  )
}
