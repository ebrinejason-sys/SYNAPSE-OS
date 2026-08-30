"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ADMIN_ROLES,
  OBSERVER_ROLES,
  PLATFORM_ROLES,
  roleLabel,
  statusLabel,
  type PlatformRole,
} from "@/lib/platform/rbac";
import type { PlatformMemberRow } from "@/lib/platform/membership.server";
import {
  invitePlatformMember,
  resendPlatformInvitation,
  revokePlatformInvitation,
  resetPlatformMemberPassword,
  issuePlatformTemporaryPassword,
  revokePlatformMemberSessions,
  suspendPlatformMember,
  reactivatePlatformMember,
} from "./actions";

type InvitationRow = {
  id: string;
  email: string;
  full_name: string;
  platform_role: string;
  status: string;
  sent_at: string;
  expires_at: string;
  resent_count: number;
};

export function PlatformAccessClient({
  members,
  invitations,
  actorRole,
}: {
  members: PlatformMemberRow[];
  invitations: InvitationRow[];
  actorRole: PlatformRole;
}) {
  const [showInvite, setShowInvite] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const manageable = PLATFORM_ROLES.filter(
    (r) => r !== "SUPER_ADMIN" || actorRole === "SUPER_ADMIN"
  );

  const active = members.filter((m) => m.status === "ACTIVE");
  const suspended = members.filter((m) => m.status === "SUSPENDED");
  const invited = members.filter((m) => m.status === "INVITED");
  const observers = members.filter((m) => OBSERVER_ROLES.includes(m.platformRole));
  const administrators = members.filter((m) => ADMIN_ROLES.includes(m.platformRole));

  function onInvite(formData: FormData) {
    startTransition(async () => {
      const result = await invitePlatformMember(formData);
      setMessage(result.ok ? `Invitation sent to ${result.email}` : result.error);
      if (result.ok) setShowInvite(false);
    });
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#E8B84B]">Governance</p>
          <h1 className="mt-2 text-2xl font-bold">Platform Access</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Invite stakeholders, administrators, and observers. Manage roles, MFA, sessions, and password recovery
            without exposing credentials.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowInvite(true)}
          className="rounded-lg bg-[#F97316] px-4 py-2 text-sm font-semibold text-[#07070A]"
        >
          Invite Member
        </button>
      </section>

      {message ? (
        <p className="rounded-lg border border-slate-700 bg-[#111117] px-4 py-3 text-sm text-slate-200">{message}</p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Active", active.length],
          ["Pending", invited.length + invitations.length],
          ["Observers", observers.length],
          ["Administrators", administrators.length],
          ["Suspended", suspended.length],
        ].map(([label, value]) => (
          <article key={String(label)} className="rounded-xl border border-slate-800 bg-[#111117] p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-[#F97316]">{Number(value)}</p>
          </article>
        ))}
      </section>

      {showInvite ? (
        <form action={onInvite} className="rounded-xl border border-slate-800 bg-[#111117] p-5 space-y-4">
          <h2 className="text-sm font-semibold">Invite Member</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm">
              <span className="text-slate-400">Email</span>
              <input name="email" type="email" required className="mt-1 w-full rounded-lg border border-slate-700 bg-[#07070A] px-3 py-2" />
            </label>
            <label className="block text-sm">
              <span className="text-slate-400">Full name</span>
              <input name="full_name" required className="mt-1 w-full rounded-lg border border-slate-700 bg-[#07070A] px-3 py-2" />
            </label>
            <label className="block text-sm">
              <span className="text-slate-400">Platform role</span>
              <select name="platform_role" className="mt-1 w-full rounded-lg border border-slate-700 bg-[#07070A] px-3 py-2">
                {manageable.map((role) => (
                  <option key={role} value={role}>{roleLabel(role)}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-slate-400">Access expiry (optional)</span>
              <input name="expires_at" type="date" className="mt-1 w-full rounded-lg border border-slate-700 bg-[#07070A] px-3 py-2" />
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-slate-400">Notes</span>
            <textarea name="notes" rows={2} className="mt-1 w-full rounded-lg border border-slate-700 bg-[#07070A] px-3 py-2" />
          </label>
          <div className="flex gap-2">
            <button disabled={pending} type="submit" className="rounded-lg bg-[#F97316] px-4 py-2 text-sm font-semibold text-[#07070A]">
              {pending ? "Sending…" : "Send Invitation"}
            </button>
            <button type="button" onClick={() => setShowInvite(false)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm">
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <MemberTable title="Active Members" rows={active} />
      <InvitationTable
        invitations={invitations}
        onResend={(id) =>
          startTransition(async () => {
            const fd = new FormData();
            fd.set("invitation_id", id);
            const result = await resendPlatformInvitation(fd);
            setMessage(result.ok ? "Invitation resent." : result.error);
          })
        }
        onRevoke={(id) => {
          const reason = window.prompt("Reason for revoking invitation:");
          if (!reason) return;
          startTransition(async () => {
            const fd = new FormData();
            fd.set("invitation_id", id);
            fd.set("reason", reason);
            const result = await revokePlatformInvitation(fd);
            setMessage(result.ok ? "Invitation revoked." : result.error);
          });
        }}
      />
      <MemberTable title="Suspended" rows={suspended} />
    </div>
  );
}

function MemberTable({ title, rows }: { title: string; rows: PlatformMemberRow[] }) {
  return (
    <article className="overflow-hidden rounded-xl border border-slate-800 bg-[#111117]">
      <div className="border-b border-slate-800 p-4">
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-[#07070A] text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">MFA</th>
              <th className="px-4 py-3">Sessions</th>
              <th className="px-4 py-3">Last sign-in</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3 font-medium">{row.profile.fullName ?? "—"}</td>
                <td className="px-4 py-3 text-slate-400">{row.profile.email}</td>
                <td className="px-4 py-3">{roleLabel(row.platformRole)}</td>
                <td className="px-4 py-3">{statusLabel(row.status)}</td>
                <td className="px-4 py-3">{row.mfaEnrolled ? "Enrolled" : row.mfaRequired ? "Required" : "Optional"}</td>
                <td className="px-4 py-3">{row.sessionCount}</td>
                <td className="px-4 py-3 text-slate-500">{row.profile.lastSignInAt ? new Date(row.profile.lastSignInAt).toLocaleDateString() : "—"}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/platform/access/${row.userId}`} className="text-[#F97316] hover:underline">
                    Manage
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-500">No members.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function InvitationTable({
  invitations,
  onResend,
  onRevoke,
}: {
  invitations: InvitationRow[];
  onResend: (id: string) => void;
  onRevoke: (id: string) => void;
}) {
  if (invitations.length === 0) return null;
  return (
    <article className="overflow-hidden rounded-xl border border-slate-800 bg-[#111117]">
      <div className="border-b border-slate-800 p-4">
        <h2 className="text-sm font-semibold">Pending Invitations</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-[#07070A] text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Sent</th>
              <th className="px-4 py-3">Expires</th>
              <th className="px-4 py-3">Resent</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {invitations.map((inv) => (
              <tr key={inv.id}>
                <td className="px-4 py-3">{inv.full_name} · {inv.email}</td>
                <td className="px-4 py-3">{roleLabel(inv.platform_role as PlatformRole)}</td>
                <td className="px-4 py-3 text-slate-500">{new Date(inv.sent_at).toLocaleString()}</td>
                <td className="px-4 py-3 text-slate-500">{new Date(inv.expires_at).toLocaleString()}</td>
                <td className="px-4 py-3">{inv.resent_count}</td>
                <td className="px-4 py-3 text-right space-x-3">
                  <button type="button" onClick={() => onResend(inv.id)} className="text-[#F97316]">Resend</button>
                  <button type="button" onClick={() => onRevoke(inv.id)} className="text-red-400">Revoke</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

export function MemberDetailActions({
  member,
  actorRole,
}: {
  member: PlatformMemberRow;
  actorRole: PlatformRole;
}) {
  const [pending, startTransition] = useTransition();
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function runAction(
    action: (fd: FormData) => Promise<{ ok: boolean; error?: string; temporaryPassword?: string }>,
    extra?: Record<string, string>
  ) {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("user_id", member.userId);
      if (extra) {
        for (const [k, v] of Object.entries(extra)) fd.set(k, v);
      }
      const result = await action(fd);
      if (result.temporaryPassword) setTempPassword(result.temporaryPassword);
      setMessage(result.ok ? "Action completed." : result.error ?? "Action failed.");
    });
  }

  return (
    <div className="space-y-4">
      {message ? <p className="text-sm text-slate-300">{message}</p> : null}
      {tempPassword ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          <p className="font-semibold text-amber-200">Temporary password (shown once)</p>
          <p className="mt-2 font-mono text-lg">{tempPassword}</p>
          <p className="mt-2 text-xs text-slate-400">User must change password at next login. MFA still required where applicable.</p>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <ActionButton
          disabled={pending}
          label="Reset Password"
          onClick={() => {
            const reason = window.prompt("Reason for password reset:");
            if (!reason) return;
            runAction(resetPlatformMemberPassword, { reason, revoke_sessions: "true" });
          }}
        />
        <ActionButton
          disabled={pending}
          label="Issue Temp Password"
          onClick={() => {
            const reason = window.prompt("Reason for temporary password:");
            if (!reason) return;
            runAction(issuePlatformTemporaryPassword, { reason });
          }}
        />
        <ActionButton
          disabled={pending}
          label="Revoke All Sessions"
          onClick={() => {
            const reason = window.prompt("Reason for session revocation:");
            if (!reason) return;
            runAction(revokePlatformMemberSessions, { reason });
          }}
        />
        {member.status === "ACTIVE" ? (
          <ActionButton
            disabled={pending}
            label="Suspend"
            danger
            onClick={() => {
              const reason = window.prompt("Reason for suspension:");
              if (!reason) return;
              runAction(suspendPlatformMember, { reason });
            }}
          />
        ) : (
          <ActionButton
            disabled={pending}
            label="Reactivate"
            onClick={() => runAction(reactivatePlatformMember)}
          />
        )}
      </div>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  disabled,
  danger,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-sm ${
        danger ? "border-red-500/40 text-red-300" : "border-slate-700 text-slate-200"
      }`}
    >
      {label}
    </button>
  );
}
