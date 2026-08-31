import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveTenant } from "../../../lib/tenant";
import { SynapseLogo } from "../../../components/SynapseLogo";
import Link from "next/link";

const CLINICAL_LINKS = (slug: string) => [
  { href: `/os/${slug}/clinical/queue`, label: "OPD queue" },
  { href: `/os/${slug}/clinical/orders`, label: "Billing" },
  { href: `/os/${slug}/clinical/tasks`, label: "Tasks" },
  { href: `/lab/orders`, label: "Lab worklist" },
  { href: `/os/${slug}/clinical/dispense`, label: "Dispense" },
];

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const hdrs = await headers();
  const subdomain = hdrs.get("x-hospital-subdomain") ?? slug;
  const tenant = await resolveTenant(subdomain);

  if (!tenant) {
    redirect("https://synapseos.tech?e=unknown-hospital");
  }

  const clinical = CLINICAL_LINKS(slug);

  return (
    <div data-tenant={tenant.hospitalId} className="min-h-screen bg-base text-primary-color">
      <header className="flex items-center justify-between border-b border-subtle px-6 py-3">
        <div className="flex items-center gap-3">
          <SynapseLogo size="sm" />
          <span className="text-muted-color">|</span>
          <span className="text-sm font-medium text-secondary-color">{tenant.hospitalName}</span>
        </div>
        <nav className="flex flex-wrap items-center gap-4 text-sm">
          <Link href={`/os/${slug}/dashboard`} className="text-muted-color hover:text-primary-color">
            Dashboard
          </Link>
          <Link href={`/os/${slug}/patients`} className="text-muted-color hover:text-primary-color">
            Patients
          </Link>
          {clinical.map(({ href, label }) => (
            <Link key={href} href={href} className="text-muted-color hover:text-primary-color">
              {label}
            </Link>
          ))}
          <Link href={`/os/${slug}/migrate`} className="text-muted-color hover:text-primary-color">
            Import
          </Link>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
