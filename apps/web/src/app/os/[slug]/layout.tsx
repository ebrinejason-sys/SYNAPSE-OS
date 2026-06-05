import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveTenant } from "../../../lib/tenant";

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
    <div data-tenant={tenant.hospitalId} className="min-h-screen bg-[#060D1A] text-white">
      <header className="border-b border-[#00D4AA]/20 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[#00D4AA] font-bold">Synapse OS</span>
          <span className="text-slate-500 text-sm">|</span>
          <span className="text-slate-200 text-sm font-medium">{tenant.hospitalName}</span>
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
