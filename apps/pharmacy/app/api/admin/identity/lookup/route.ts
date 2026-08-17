import { NextRequest, NextResponse } from "next/server"
import { requirePharmacyPermission } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { resolvePersonByIdentifier } from "@synapse/db/identity-persist"
import { logPHIAccess } from "@synapse/db"

export async function GET(request: NextRequest) {
  const auth = await requirePharmacyPermission(["pos.sell", "customers.credit"])
  if (!auth.ok) return auth.response
  const { session, tenantId } = auth

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? ""
  if (q.length < 2) {
    return NextResponse.json({ error: "Query must be at least 2 characters" }, { status: 400 })
  }
  const safe = q.replace(/[,()*%]/g, "").slice(0, 80)
  if (safe.length < 2) {
    return NextResponse.json({ error: "Query must be at least 2 characters" }, { status: 400 })
  }

  const byIdentifier =
    (await resolvePersonByIdentifier({ value: safe })) ??
    (await resolvePersonByIdentifier({ value: safe, facilityId: tenantId }))
  if (byIdentifier) {
    await logPHIAccess({
      accessor_id: session.userId,
      accessor_role: session.pharmacyRole,
      patient_id: byIdentifier.id,
      record_type: "person_identifier_lookup",
      tenant_id: tenantId,
    })
    return NextResponse.json({ person: byIdentifier, customers: [] })
  }

  const db = supabaseAdmin as any
  const { data: customers } = await db
    .from("pharmacy_customers")
    .select("id, name, phone, email, person_id")
    .eq("tenant_id", tenantId)
    .or(`name.ilike.%${safe}%,phone.ilike.%${safe}%,email.ilike.%${safe}%`)
    .limit(20)

  return NextResponse.json({ person: null, customers: customers ?? [] })
}
