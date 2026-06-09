export const dynamic = "force-dynamic";

import { Eye, ShieldAlert } from "lucide-react";
import { requirePlatformAdmin } from "../../../lib/platform/auth";
import { formatDateTime, safeRows } from "../_lib/platform-data";

type UserRow = {
  id?: string;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
  tenant_id?: string | null;
  last_sign_in_at?: string | null;
};

export default async function ImpersonationPage() {
  await requirePlatformAdmin();
  const users = await safeRows<UserRow>("profiles", "id, full_name, email, role, tenant_id, last_sign_in_at", {
    orderBy: "last_sign_in_at",
    limit: 80,
  });

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#E8B84B]">Support Visibility</p>
        <h1 className="mt-2 text-2xl font-bold">Impersonation Tool</h1>
        <p className="mt-1 text-sm text-slate-400">Search users, view their role context, and start a scoped support session when the token service is enabled.</p>
      </section>

      <section className="rounded-xl border border-[#F97316]/25 bg-[#F97316]/10 p-4">
        <div className="flex gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[#F97316]" />
          <div>
            <h2 className="text-sm font-semibold text-[#F97316]">Audit-first impersonation</h2>
            <p className="mt-1 text-sm text-slate-300">
              This page is intentionally readied before session minting. The next step is a server route that creates a scoped token,
              records `impersonated_by`, and blocks platform-admin impersonation.
            </p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-800 bg-[#111117]">
        <div className="border-b border-slate-800 p-4">
          <h2 className="text-sm font-semibold">Eligible Users</h2>
          <p className="mt-1 text-xs text-slate-500">Platform admins are hidden from action by policy.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[#07070A] text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Tenant</th>
                <th className="px-4 py-3">Last login</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {users.map((user) => {
                const isPlatformAdmin = user.role === "platform_admin";
                return (
                  <tr key={user.id ?? user.email ?? crypto.randomUUID()}>
                    <td className="px-4 py-3 font-medium text-slate-100">{user.full_name ?? "Unnamed user"}</td>
                    <td className="px-4 py-3 text-slate-400">{user.email ?? "No email"}</td>
                    <td className="px-4 py-3 text-slate-300">{user.role ?? "unknown"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{user.tenant_id?.slice(0, 8) ?? "none"}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDateTime(user.last_sign_in_at)}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={isPlatformAdmin}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Eye className="h-3 w-3" />
                        {isPlatformAdmin ? "Blocked" : "Impersonate"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No users found.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
