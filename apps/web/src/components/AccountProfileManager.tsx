"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { KeyRound, Loader2, Save, ShieldCheck, UserRound } from "lucide-react";

type DashboardKind = "platform" | "admin" | "pharmacy";

type ProfilePayload = {
  user: {
    id: string;
    email: string | null;
    lastSignInAt: string | null;
  };
  profile: {
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    role: string | null;
    tenant_id: string | null;
    hospital_id: string | null;
    verification_status: string | null;
    is_admin: boolean | null;
    updated_at: string | null;
  } | null;
  tenant: {
    name: string | null;
    slug: string | null;
    facility_type: string | null;
    plan: string | null;
    is_active: boolean | null;
    custom_domain: string | null;
    district: string | null;
  } | null;
};

const DASHBOARD_COPY: Record<DashboardKind, { title: string; subtitle: string; mfaHref: string }> = {
  platform: {
    title: "Platform Account",
    subtitle: "Manage the operator profile used across SynapseOS command center workflows.",
    mfaHref: "/platform/mfa",
  },
  admin: {
    title: "Hospital Account",
    subtitle: "Keep your facility admin profile and security settings current.",
    mfaHref: "/admin/settings/mfa",
  },
  pharmacy: {
    title: "Pharmacy Account",
    subtitle: "Manage the profile used for pharmacy dispensing, inventory, and reporting access.",
    mfaHref: "/admin/settings/mfa",
  },
};

function formatRole(role: string | null | undefined) {
  return role ? role.replace(/_/g, " ") : "Unassigned";
}

export function AccountProfileManager({ dashboard }: { dashboard: DashboardKind }) {
  const copy = DASHBOARD_COPY[dashboard];
  const [payload, setPayload] = useState<ProfilePayload | null>(null);
  const [fullName, setFullName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const email = payload?.profile?.email || payload?.user.email || "";
  const role = payload?.profile?.role ?? null;
  const tenantName = payload?.tenant?.name ?? "No facility linked";

  const initials = useMemo(() => {
    const name = fullName || `${firstName} ${lastName}`.trim() || email;
    return name
      .split(/[ @.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }, [email, firstName, fullName, lastName]);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/account/profile", { cache: "no-store" });
        const data = (await response.json()) as ProfilePayload & { error?: string };
        if (!response.ok) throw new Error(data.error || "Could not load profile.");
        if (cancelled) return;
        setPayload(data);
        setFullName(data.profile?.full_name ?? "");
        setFirstName(data.profile?.first_name ?? "");
        setLastName(data.profile?.last_name ?? "");
        setPhone(data.profile?.phone ?? "");
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveProfile() {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, firstName, lastName, phone }),
      });
      const data = (await response.json()) as { profile?: ProfilePayload["profile"]; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not save profile.");
      setPayload((current) => (current ? { ...current, profile: data.profile ?? current.profile } : current));
      setMessage("Profile updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  }

  async function sendPasswordReset() {
    if (!email) return;
    setResetting(true);
    setError(null);
    setMessage(null);

    const response = await fetch("/api/auth/password-reset/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      setError("Could not send password reset email.");
    } else {
      setMessage("Password reset email sent.");
    }
    setResetting(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--brand-gold, #E8B84B)" }}>
          Account Management
        </p>
        <h1 className="mt-2 text-2xl font-bold" style={{ color: "var(--text-primary, #fff)" }}>
          {copy.title}
        </h1>
        <p className="mt-1 max-w-2xl text-sm" style={{ color: "var(--text-muted, #94A3B8)" }}>
          {copy.subtitle}
        </p>
      </div>

      {loading ? (
        <div className="flex min-h-64 items-center justify-center rounded-xl border border-slate-800 bg-[#111117] text-sm text-slate-400">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading profile
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <section className="rounded-xl border border-slate-800 bg-[#111117] p-5">
            <div className="flex flex-wrap items-center gap-4 border-b border-slate-800 pb-5">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-[#E8B84B]/30 bg-[#E8B84B]/10 text-lg font-bold text-[#E8B84B]">
                {initials || <UserRound className="h-6 w-6" />}
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-slate-100">{fullName || email || "Account profile"}</p>
                <p className="text-sm capitalize text-slate-400">{formatRole(role)}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Full name</span>
                <input value={fullName} onChange={(event) => setFullName(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-[#07070A] px-3 py-2 text-sm text-white outline-none focus:border-[#F97316]" />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</span>
                <input value={phone} onChange={(event) => setPhone(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-[#07070A] px-3 py-2 text-sm text-white outline-none focus:border-[#F97316]" />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">First name</span>
                <input value={firstName} onChange={(event) => setFirstName(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-[#07070A] px-3 py-2 text-sm text-white outline-none focus:border-[#F97316]" />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last name</span>
                <input value={lastName} onChange={(event) => setLastName(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-[#07070A] px-3 py-2 text-sm text-white outline-none focus:border-[#F97316]" />
              </label>
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email address</span>
                <input value={email} disabled className="w-full rounded-lg border border-slate-800 bg-[#07070A] px-3 py-2 text-sm text-slate-500" />
              </label>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button type="button" onClick={saveProfile} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#F97316] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#EA6C0A] disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save changes
              </button>
              {message ? <span className="text-sm text-emerald-400">{message}</span> : null}
              {error ? <span className="text-sm text-red-400">{error}</span> : null}
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-xl border border-slate-800 bg-[#111117] p-5">
              <p className="text-sm font-semibold text-slate-100">Access Context</p>
              <div className="mt-4 space-y-3 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Facility</p>
                  <p className="mt-1 text-slate-200">{tenantName}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Role</p>
                  <p className="mt-1 capitalize text-slate-200">{formatRole(role)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Verification</p>
                  <p className="mt-1 capitalize text-slate-200">{payload?.profile?.verification_status ?? "not set"}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#111117] p-5">
              <p className="text-sm font-semibold text-slate-100">Security</p>
              <div className="mt-4 space-y-3">
                <Link href={copy.mfaHref} className="flex items-center gap-3 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:border-[#E8B84B]/50">
                  <ShieldCheck className="h-4 w-4 text-[#E8B84B]" />
                  Manage MFA
                </Link>
                <button type="button" onClick={sendPasswordReset} disabled={resetting || !email} className="flex w-full items-center gap-3 rounded-lg border border-slate-700 px-3 py-2 text-left text-sm text-slate-200 transition hover:border-[#E8B84B]/50 disabled:opacity-60">
                  {resetting ? <Loader2 className="h-4 w-4 animate-spin text-[#E8B84B]" /> : <KeyRound className="h-4 w-4 text-[#E8B84B]" />}
                  Send password reset
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
