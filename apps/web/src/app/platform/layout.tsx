"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Building2,
  ClipboardCheck,
  CreditCard,
  Flag,
  HeartPulse,
  LifeBuoy,
  ShieldCheck,
  Stethoscope,
  TrendingUp,
  UserRound,
  Users,
  Wrench,
} from "lucide-react";
import { createClient } from "../../lib/supabase/client";
import { SynapseLogo } from "../../components/SynapseLogo";
import { PlatformBreadcrumb } from "./_components/breadcrumb";

const SIDEBAR_ITEMS = [
  { href: "/platform", label: "Overview", icon: Activity },
  { href: "/platform/hospitals", label: "Hospitals", icon: Building2 },
  { href: "/platform/approvals", label: "Onboarding Queue", icon: ClipboardCheck, badge: "new" },
  { href: "/platform/users", label: "Users", icon: Users },
  { href: "/platform/flags", label: "Feature Flags", icon: Flag },
  { href: "/platform/billing", label: "Billing", icon: CreditCard },
  { href: "/platform/sales", label: "Sales Pipeline", icon: TrendingUp },
  { href: "/platform/public-health", label: "Public Health", icon: HeartPulse },
  { href: "/platform/support", label: "Support", icon: LifeBuoy },
  { href: "/platform/audit-log", label: "Audit Log", icon: ShieldCheck },
  { href: "/platform/health", label: "System Health", icon: Wrench },
];

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/platform/login");
    router.refresh();
  }

  if (pathname === "/platform/login") {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#07070A] text-white">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[280px_1fr]">
        <aside className="border-r border-slate-800 bg-[#0A0A10] px-4 py-6">
          <div className="mb-8 px-2">
            <SynapseLogo size="sm" />
            <p className="mt-2 text-xs text-slate-500">Platform Control Center</p>
          </div>
          <nav className="space-y-1">
            {SIDEBAR_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between rounded-xl border border-transparent px-3 py-2 text-sm text-slate-300 transition hover:border-slate-700 hover:bg-slate-900 hover:text-white"
                >
                  <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-[#E8B84B]" />
                    {item.label}
                  </span>
                  {item.badge ? (
                    <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-orange-300">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </aside>

        <section className="flex min-h-screen flex-col">
          <header className="flex items-center justify-between border-b border-slate-800 bg-[#0B0B12] px-4 py-3 lg:px-6">
            <div className="flex items-center gap-3">
              <SynapseLogo size="xs" variant="icon" />
              <PlatformBreadcrumb />
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-slate-200">Platform Admin</p>
                <p className="text-xs text-slate-500">platform_admin</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E8B84B]/25 bg-[#E8B84B]/10 text-[#E8B84B]">
                <UserRound className="h-4 w-4" />
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:border-slate-500 hover:text-white"
              >
                Sign out
              </button>
            </div>
          </header>

          <main className="flex-1 bg-[#07070A] p-4 lg:p-6">{children}</main>
        </section>
      </div>
    </div>
  );
}
