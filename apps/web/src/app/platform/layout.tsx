"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Bell,
  Building2,
  ClipboardList,
  CreditCard,
  DatabaseZap,
  Eye,
  Flag,
  HeartPulse,
  LifeBuoy,
  Menu,
  Pill,
  Radio,
  Search,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { createClient } from "../../lib/supabase/client";
import { SynapseLogo } from "../../components/SynapseLogo";
import { ThemeToggle } from "../../components/ThemeToggle";
import { PlatformBreadcrumb } from "./_components/breadcrumb";

type CommandResult = {
  title: string;
  subtitle: string;
  href: string;
  type: string;
};

const SIDEBAR_ITEMS = [
  { href: "/platform", label: "Overview", icon: Activity, exact: true },
  { href: "/platform/hospitals", label: "Facilities", icon: Building2 },
  { href: "/platform/users", label: "Users + KYC", icon: Users },
  { href: "/platform/billing", label: "Revenue + Billing", icon: CreditCard },
  { href: "/platform/public-health", label: "SynapseEPI", icon: Radio },
  { href: "/platform/broadcasts", label: "Health Bulletins", icon: HeartPulse },
  { href: "/platform/pharmacy-network", label: "Pharmacy Network", icon: Pill },
  { href: "/platform/flags", label: "Feature Flags", icon: Flag },
  { href: "/platform/support", label: "Support Tickets", icon: LifeBuoy },
  { href: "/platform/dhis2", label: "DHIS2 Exports", icon: DatabaseZap },
  { href: "/platform/impersonation", label: "Impersonation", icon: Eye },
  { href: "/platform/audit-log", label: "Audit Log", icon: ClipboardList },
  { href: "/platform/settings", label: "Settings", icon: Settings },
];

const STATIC_COMMANDS: CommandResult[] = SIDEBAR_ITEMS.map((item) => ({
  title: item.label,
  subtitle: "Platform section",
  href: item.href,
  type: "Navigation",
}));

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [remoteResults, setRemoteResults] = useState<CommandResult[]>([]);

  useEffect(() => {
    function onKeydown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
      if (event.key === "Escape") {
        setPaletteOpen(false);
      }
    }
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, []);

  useEffect(() => {
    if (!paletteOpen || query.trim().length < 2) {
      setRemoteResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/platform/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { results?: CommandResult[] };
        setRemoteResults(data.results ?? []);
      } catch {
        setRemoteResults([]);
      }
    }, 180);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [paletteOpen, query]);

  const commandResults = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const local = normalized
      ? STATIC_COMMANDS.filter((item) => `${item.title} ${item.subtitle}`.toLowerCase().includes(normalized))
      : STATIC_COMMANDS;
    const seen = new Set<string>();
    return [...remoteResults, ...local].filter((item) => {
      if (seen.has(item.href)) return false;
      seen.add(item.href);
      return true;
    });
  }, [query, remoteResults]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/platform/login");
    router.refresh();
  }

  if (pathname === "/platform/login" || pathname === "/platform/mfa") {
    return <>{children}</>;
  }

  const activeItem = SIDEBAR_ITEMS.find((item) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)
  );

  return (
    <div className="min-h-screen bg-[#07070A] text-white">
      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/70 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[280px_1fr]">
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-800 bg-[#07070A] px-4 py-5 transition-transform lg:static lg:w-auto lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="mb-6 flex items-center justify-between px-2">
            <Link href="/platform" className="flex items-center gap-3">
              <SynapseLogo size="sm" />
              <span className="rounded-full border border-[#E8B84B]/30 bg-[#E8B84B]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#E8B84B]">
                Admin
              </span>
            </Link>
            <button type="button" className="rounded-lg p-2 text-slate-400 lg:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
            {SIDEBAR_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition ${
                    active
                      ? "border-[#F97316]/30 bg-[#F97316]/10 text-[#F97316]"
                      : "border-transparent text-slate-400 hover:border-slate-800 hover:bg-[#111117] hover:text-slate-100"
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${active ? "text-[#F97316]" : "text-[#E8B84B]"}`} />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-5 border-t border-slate-800 pt-4">
            <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-[#111117] p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E8B84B]/25 bg-[#E8B84B]/10 text-[#E8B84B]">
                <UserRound className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-100">Platform Admin</p>
                <p className="text-xs text-slate-500">platform_admin</p>
              </div>
            </div>
          </div>
        </aside>

        <section className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-800 bg-[#0B0B12]/95 px-4 backdrop-blur lg:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button type="button" className="rounded-lg p-2 text-slate-300 lg:hidden" onClick={() => setSidebarOpen(true)}>
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <h1 className="truncate text-sm font-semibold text-white sm:text-base">{activeItem?.label ?? "Platform"}</h1>
                <PlatformBreadcrumb />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="hidden min-w-[240px] items-center justify-between rounded-xl border border-slate-800 bg-[#111117] px-3 py-2 text-left text-sm text-slate-500 transition hover:border-[#F97316]/40 md:flex"
              >
                <span className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Search facilities, users, tickets
                </span>
                <kbd className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-500">⌘K</kbd>
              </button>
              <button type="button" className="relative rounded-xl border border-slate-800 bg-[#111117] p-2 text-slate-300">
                <Bell className="h-4 w-4" />
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#F97316]" />
              </button>
              <ThemeToggle />
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-xl border border-slate-800 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-slate-600 hover:text-white"
              >
                Sign out
              </button>
            </div>
          </header>

          <main className="flex-1 bg-[#07070A] p-4 lg:p-6">{children}</main>
        </section>
      </div>

      {paletteOpen ? (
        <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/70 px-4 pt-24">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-800 bg-[#0B0B12] shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-3">
              <Search className="h-5 w-5 text-[#E8B84B]" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search facilities, users, support tickets, audit events..."
                className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
              />
              <button type="button" className="rounded-lg p-1 text-slate-500 hover:text-white" onClick={() => setPaletteOpen(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[420px] overflow-y-auto p-2">
              {commandResults.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-slate-500">No results found.</p>
              ) : null}
              {commandResults.map((result) => (
                <Link
                  key={`${result.type}:${result.href}:${result.title}`}
                  href={result.href}
                  onClick={() => {
                    setPaletteOpen(false);
                    setQuery("");
                  }}
                  className="block rounded-xl px-3 py-3 transition hover:bg-[#111117]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-100">{result.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{result.subtitle}</p>
                    </div>
                    <span className="rounded-full border border-[#E8B84B]/20 bg-[#E8B84B]/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-[#E8B84B]">
                      {result.type}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
