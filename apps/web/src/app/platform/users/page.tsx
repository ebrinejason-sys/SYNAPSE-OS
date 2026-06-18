export const dynamic = "force-dynamic";

import { requirePlatformAdmin } from "@/lib/platform/auth";
import { formatDate, safeCount, safeRows } from "../_lib/platform-data";
import { UserActions } from "./UserActions";

type UserRow = {
  id?: string;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
  verification_status?: string | null;
  created_at?: string | null;
  last_sign_in_at?: string | null;
};

type VerificationRow = {
  id?: string;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
  status?: string | null;
  document_type?: string | null;
  registration_body?: string | null;
  registration_number?: string | null;
  created_at?: string | null;
};

function badgeClass(value: string | null | undefined) {
  if (value === "verified" || value === "approved") return "border-green-500/25 bg-green-500/10 text-green-300";
  if (value === "rejected" || value === "suspended") return "border-red-500/25 bg-red-500/10 text-red-300";
  return "border-[#F97316]/25 bg-[#F97316]/10 text-[#F97316]";
}

export default async function PlatformUsersPage() {
  await requirePlatformAdmin();

  const [totalUsers, pendingKyc, verifiedUsers, suspendedUsers, users, kycRows] = await Promise.all([
    safeCount("profiles"),
    safeCount("verification_documents", [["status", "pending_review"]]),
    safeCount("profiles", [["verification_status", "verified"]]),
    safeCount("profiles", [["verification_status", "suspended"]]),
    safeRows<UserRow>("profiles", "id, full_name, email, role, verification_status, created_at, last_sign_in_at", {
      orderBy: "created_at",
      limit: 80,
    }),
    safeRows<VerificationRow>(
      "verification_documents",
      "id, full_name, email, role, status, document_type, registration_body, registration_number, created_at",
      { filters: [["status", "pending_review"]], orderBy: "created_at", limit: 24 }
    ),
  ]);

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#E8B84B]">Identity Control</p>
          <h1 className="mt-2 text-2xl font-bold">Users + KYC</h1>
          <p className="mt-1 text-sm text-slate-400">Manage platform users, professional verification, suspensions, and access recovery.</p>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Total users", totalUsers],
          ["Pending KYC", pendingKyc],
          ["Verified professionals", verifiedUsers],
          ["Suspended accounts", suspendedUsers],
        ].map(([label, value]) => (
          <article key={String(label)} className="rounded-xl border border-slate-800 bg-[#111117] p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-[#F97316]">{Number(value).toLocaleString()}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <article className="overflow-hidden rounded-xl border border-slate-800 bg-[#111117]">
          <div className="border-b border-slate-800 p-4">
            <h2 className="text-sm font-semibold">All Users</h2>
            <p className="mt-1 text-xs text-slate-500">Recent users across all roles and facilities.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[#07070A] text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Verification</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {users.map((user) => (
                  <tr key={user.id ?? user.email ?? crypto.randomUUID()}>
                    <td className="px-4 py-3 font-medium text-slate-100">{user.full_name ?? "Unnamed user"}</td>
                    <td className="px-4 py-3 text-slate-400">{user.email ?? "No email"}</td>
                    <td className="px-4 py-3 text-slate-300">{user.role ?? "unknown"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-xs ${badgeClass(user.verification_status)}`}>
                        {user.verification_status ?? "pending"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(user.created_at)}</td>
                    <td className="px-4 py-3">
                      {user.id && user.email ? (
                        <UserActions userId={user.id} email={user.email} role={user.role ?? null} />
                      ) : null}
                    </td>
                  </tr>
                ))}
                {users.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No users found.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>

        <aside className="rounded-xl border border-slate-800 bg-[#111117] p-4">
          <h2 className="text-sm font-semibold">Pending KYC Queue</h2>
          <p className="mt-1 text-xs text-slate-500">Professional documents awaiting review and AI assessment.</p>
          <div className="mt-4 space-y-3">
            {kycRows.length === 0 ? <p className="rounded-lg border border-slate-800 bg-[#07070A] p-4 text-sm text-slate-500">No pending KYC records.</p> : null}
            {kycRows.map((row) => (
              <article key={row.id ?? row.email ?? crypto.randomUUID()} className="rounded-lg border border-slate-800 bg-[#07070A] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{row.full_name ?? row.email ?? "Applicant"}</p>
                    <p className="mt-1 text-xs text-slate-500">{row.role ?? "health professional"} · {row.registration_body ?? "body not set"}</p>
                    <p className="mt-1 text-xs text-slate-500">Reg no: {row.registration_number ?? "not supplied"}</p>
                  </div>
                  <span className="rounded-full border border-[#F97316]/25 bg-[#F97316]/10 px-2 py-0.5 text-xs text-[#F97316]">
                    Review
                  </span>
                </div>
              </article>
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
}
