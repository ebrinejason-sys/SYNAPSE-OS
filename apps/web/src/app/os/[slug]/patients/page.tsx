import { createClient } from "../../../../lib/supabase/server";
import { headers } from "next/headers";
import { resolveTenant } from "../../../../lib/tenant";
import Link from "next/link";

export default async function PatientsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { slug } = await params;
  const { q } = await searchParams;
  const hdrs = await headers();
  const subdomain = hdrs.get("x-hospital-subdomain") ?? slug;
  const tenant = await resolveTenant(subdomain);
  if (!tenant) return <div className="p-8 text-red-400">Tenant not found</div>;

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("patients")
    .select("id, full_name, date_of_birth, sex, mrn, created_at")
    .eq("tenant_id", tenant.tenantId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(50);

  if (q) {
    query = query.ilike("full_name", `%${q}%`);
  }

  const { data: patients } = await query;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Patients</h1>
      </div>

      <form method="GET" className="mb-6">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by name..."
          className="w-full max-w-md bg-[#0D1B2E] border border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#00D4AA]"
        />
      </form>

      <div className="bg-[#0D1B2E] border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-800">
            <tr>
              {["MRN", "Name", "DOB", "Sex", "Registered"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {((patients as any[]) ?? []).map((p: any) => (
              <tr key={p.id} className="hover:bg-slate-800/40">
                <td className="px-4 py-3 font-mono text-xs text-slate-300">{p.mrn ?? "—"}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/os/${slug}/patients/${p.id}`}
                    className="text-white hover:text-[#00D4AA] font-medium"
                  >
                    {p.full_name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-400">{p.date_of_birth ?? "—"}</td>
                <td className="px-4 py-3 text-slate-400 capitalize">{p.sex ?? "—"}</td>
                <td className="px-4 py-3 text-slate-400">
                  {new Date(p.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {((patients as any[]) ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No patients found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
