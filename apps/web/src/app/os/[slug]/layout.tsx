import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveTenant } from "../../../lib/tenant";
import { SynapseLogo } from "../../../components/SynapseLogo";

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

  return (
    <div data-tenant={tenant.hospitalId} className="min-h-screen" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <header className="px-6 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-edge)' }}>
        <div className="flex items-center gap-3">
          <SynapseLogo size="sm" />
          <span style={{ color: 'var(--border-strong)' }}>|</span>
          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{tenant.hospitalName}</span>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <a href={`/os/${slug}/dashboard`} className="text-slate-400 hover:text-white">Dashboard</a>
          <a href={`/os/${slug}/patients`} className="text-slate-400 hover:text-white">Patients</a>
          <a href={`/os/${slug}/migrate`} className="text-slate-400 hover:text-white">Import</a>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
