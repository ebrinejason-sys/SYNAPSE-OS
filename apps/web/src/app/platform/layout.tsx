"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bell,
  Beaker,
  Brain,
  Building2,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  DatabaseZap,
  Flag,
  Gauge,
  GitBranch,
  HeartPulse,
  Kanban,
  Layers,
  LifeBuoy,
  Menu,
  MonitorSmartphone,
  Network,
  Pill,
  Radio,
  Receipt,
  Search,
  Settings,
  ShieldCheck,
  Siren,
  Spline,
  Stethoscope,
  TestTube2,
  TrendingUp,
  UserRound,
  Users,
  Workflow,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SynapseLogo } from "../../components/SynapseLogo";
import { ThemeToggle } from "../../components/ThemeToggle";
import { PlatformBreadcrumb } from "./_components/breadcrumb";

type CommandResult = {
  title: string;
  subtitle: string;
  href: string;
  type: string;
};

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
};

type NavSection = {
  caption: string;
  items: NavItem[];
};

const SIDEBAR_SECTIONS: NavSection[] = [
  {
    caption: "Overview",
    items: [
      { href: "/platform", label: "Command Center", icon: Activity, exact: true },
      { href: "/platform/test-center", label: "Test Center", icon: TestTube2 },
      { href: "/platform/registry", label: "Product Registry", icon: Layers },
      { href: "/platform/monitoring", label: "Service Health", icon: Gauge },
    ],
  },
  {
    caption: "Control Center",
    items: [
      { href: "/platform/simulation", label: "Simulation Lab", icon: Beaker },
      { href: "/platform/events", label: "Event Explorer", icon: Spline },
      { href: "/platform/lab", label: "Lab Monitor", icon: TestTube2 },
      { href: "/platform/intelligence", label: "Intelligence", icon: Brain },
      { href: "/platform/icd11", label: "ICD-11", icon: Stethoscope },
      { href: "/platform/modules", label: "Module Matrix", icon: Workflow },
      { href: "/platform/integrations", label: "Integrations", icon: Network },
      { href: "/platform/incidents", label: "Incidents", icon: Siren },
    ],
  },
  {
    caption: "Growth",
    items: [
      { href: "/platform/applications", label: "Applications", icon: Kanban },
      { href: "/platform/approvals", label: "Approvals", icon: ClipboardCheck },
      { href: "/platform/sales", label: "Sales Pipeline", icon: TrendingUp },
      { href: "/platform/facilities", label: "Facilities", icon: Building2 },
      { href: "/platform/hospitals", label: "Hospitals", icon: Stethoscope },
      { href: "/platform/users", label: "Users & Professionals", icon: Users },
    ],
  },
  {
    caption: "Operations",
    items: [
      { href: "/platform/pharmacy-network", label: "Pharmacies", icon: Pill },
      { href: "/platform/support", label: "Support", icon: LifeBuoy },
      { href: "/platform/broadcasts", label: "Broadcasts", icon: HeartPulse },
    ],
  },
  {
    caption: "Money",
    items: [
      { href: "/platform/billing", label: "Revenue & Billing", icon: CreditCard },
      { href: "/platform/receipts", label: "Receipts & Invoices", icon: Receipt },
    ],
  },
  {
    caption: "Intelligence",
    items: [
      { href: "/platform/analytics", label: "Ecosystem Analytics", icon: BarChart3 },
      { href: "/platform/public-health", label: "SynapseEPI", icon: Radio },
    ],
  },
  {
    caption: "Governance",
    items: [
      { href: "/platform/performance", label: "Stakeholder Performance", icon: TrendingUp },
      { href: "/platform/access", label: "Platform Access", icon: ShieldCheck },
      { href: "/platform/audit-log", label: "Audit Log", icon: ClipboardList },
    ],
  },
  {
    caption: "System",
    items: [
      { href: "/platform/security", label: "Sessions & Security", icon: ShieldCheck },
      { href: "/platform/flags", label: "Feature Flags", icon: Flag },
      { href: "/platform/dhis2", label: "DHIS2 Exports", icon: DatabaseZap },
      { href: "/platform/database", label: "Database", icon: DatabaseZap },
      { href: "/platform/deployments", label: "Deployments", icon: GitBranch },
      { href: "/platform/mobile", label: "Mobile Builds", icon: MonitorSmartphone },
      { href: "/platform/health", label: "Platform Health", icon: Gauge },
      { href: "/platform/settings", label: "Settings", icon: Settings },
    ],
  },
];

const ALL_NAV_ITEMS = SIDEBAR_SECTIONS.flatMap((section) => section.items);

const STATIC_COMMANDS: CommandResult[] = ALL_NAV_ITEMS.map((item) => ({
  title: item.label,
  subtitle: "Platform section",
  href: item.href,
  type: "Navigation",
}));

function isNavActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

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
      if (event.key === "Escape") setPaletteOpen(false);
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
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/platform/login");
    router.refresh();
  }

  if (pathname === "/platform/login" || pathname === "/platform/mfa" || pathname === "/platform/mfa-verify") {
    return <>{children}</>;
  }

  const activeItem = ALL_NAV_ITEMS.find((item) => isNavActive(pathname, item));

  return (
    <div className="flex h-screen overflow-hidden bg-base text-primary-color">
      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/70 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      {/* Sidebar — fixed height, scrolls independently */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 shrink-0 flex-col border-r border-subtle bg-[#0a0a0f] transition-transform print:hidden lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-subtle px-4 py-4">
          <Link href="/platform" className="flex min-w-0 items-center gap-2">
            <SynapseLogo size="sm" />
            <span className="rounded-full border border-[#E8B84B]/30 bg-[#E8B84B]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#E8B84B]">
              Admin
            </span>
          </Link>
          <button
            type="button"
            aria-label="Close navigation"
            className="rounded-lg p-2 text-secondary-color lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
          {SIDEBAR_SECTIONS.map((section) => (
            <div key={section.caption} className="mb-5 last:mb-0">
              <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-color">
                {section.caption}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isNavActive(pathname, item);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                        active
                          ? "bg-[#F97316]/10 font-medium text-[#F97316]"
                          : "text-secondary-color hover:bg-surface hover:text-primary-color"
                      }`}
                    >
                      {active ? (
                        <span
                          className="absolute bottom-1 left-0 top-1 w-0.5 rounded-full bg-[#F97316]"
                          aria-hidden
                        />
                      ) : null}
                      <Icon className={`h-4 w-4 shrink-0 ${active ? "text-[#F97316]" : "text-[#E8B84B]/80"}`} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-subtle p-3">
          <div className="flex items-center gap-3 rounded-xl border border-subtle bg-surface p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E8B84B]/25 bg-[#E8B84B]/10 text-[#E8B84B]">
              <UserRound className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-primary-color">Platform Admin</p>
              <p className="text-xs text-muted-color">platform_admin</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main column — header fixed, content scrolls independently */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-subtle bg-[var(--nav-glass)] px-4 backdrop-blur print:hidden lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation"
              className="rounded-lg p-2 text-secondary-color lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold text-primary-color sm:text-base">
                {activeItem?.label ?? "Platform"}
              </h1>
              <PlatformBreadcrumb />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden min-w-[240px] items-center justify-between rounded-xl border border-subtle bg-surface px-3 py-2 text-left text-sm text-muted-color transition hover:border-[#F97316]/40 md:flex"
            >
              <span className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                Search facilities, users, tickets
              </span>
              <kbd className="rounded border border-subtle px-1.5 py-0.5 text-[10px] text-muted-color">⌘K</kbd>
            </button>
            <Link
              href="/platform#attention"
              aria-label="Needs attention"
              className="relative rounded-xl border border-subtle bg-surface p-2 text-secondary-color transition hover:border-[#F97316]/40"
            >
              <Bell className="h-4 w-4" />
            </Link>
            <ThemeToggle />
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-xl border border-subtle px-3 py-2 text-xs font-medium text-secondary-color transition hover:border-edge hover:text-primary-color"
            >
              Sign out
            </button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-base p-4 lg:p-6">{children}</main>
      </div>

      {paletteOpen ? (
        <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/70 px-4 pt-24">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-subtle bg-surface shadow-2xl">
            <div className="flex items-center gap-3 border-b border-subtle px-4 py-3">
              <Search className="h-5 w-5 text-[#E8B84B]" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search facilities, users, support tickets, audit events..."
                className="flex-1 bg-transparent text-sm text-primary-color outline-none placeholder:text-muted-color"
              />
              <button
                type="button"
                aria-label="Close search"
                className="rounded-lg p-1 text-muted-color hover:text-primary-color"
                onClick={() => setPaletteOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[420px] overflow-y-auto p-2">
              {commandResults.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted-color">No results found.</p>
              ) : null}
              {commandResults.map((result) => (
                <Link
                  key={`${result.type}:${result.href}:${result.title}`}
                  href={result.href}
                  onClick={() => {
                    setPaletteOpen(false);
                    setQuery("");
                  }}
                  className="block rounded-xl px-3 py-3 transition hover:bg-elevated"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-primary-color">{result.title}</p>
                      <p className="mt-0.5 text-xs text-muted-color">{result.subtitle}</p>
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
