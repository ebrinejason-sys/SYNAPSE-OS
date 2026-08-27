import { NextResponse } from "next/server"
import { requirePharmacyPermission } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { verifyPrescription, dispensePrescription } from "@synapse/db/prescription-bridge"

export const dynamic = "force-dynamic"

export async function GET() {
  const auth = await requirePharmacyPermission("MANAGE_POS")
  if (!auth.ok) return auth.response
  const { tenantId } = auth
  if (!tenantId) return NextResponse.json({ error: "Tenant not found" }, { status: 400 })

  const { data, error } = await (supabaseAdmin as any)
    .from("clinical_prescriptions")
    .select("id, medication_display, dose, quantity, unit, status, is_synthetic, created_at, encounter_id")
    .eq("pharmacy_tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) {
    return NextResponse.json({
      prescriptions: [],
      notice: "Clinical prescription table is not available in this environment yet.",
    })
  }
  return NextResponse.json({ prescriptions: data ?? [] })
}

export async function POST(request: Request) {
  const auth = await requirePharmacyPermission("MANAGE_POS")
  if (!auth.ok) return auth.response
  const { session, tenantId } = auth
  if (!tenantId) return NextResponse.json({ error: "Tenant not found" }, { status: 400 })
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const id = String(body.id ?? "")
  const action = String(body.action ?? "")

  const { data: row, error } = await (supabaseAdmin as any)
    .from("clinical_prescriptions")
    .select("*")
    .eq("id", id)
    .eq("pharmacy_tenant_id", tenantId)
    .maybeSingle()
  if (error || !row) return NextResponse.json({ error: "Prescription not found" }, { status: 404 })

  try {
    const current = {
      id: row.id,
      tenantId: row.tenant_id,
      pharmacyTenantId: row.pharmacy_tenant_id,
      patientId: row.patient_id,
      personId: row.person_id,
      encounterId: row.encounter_id,
      medicationDisplay: row.medication_display,
      dose: row.dose ?? "",
      quantity: Number(row.quantity ?? 1),
      unit: row.unit ?? "unit",
      prescriberId: row.prescriber_id ?? "unknown",
      verifierId: row.verifier_id,
      dispenserId: row.dispenser_id,
      status: row.status,
      isSynthetic: Boolean(row.is_synthetic),
      simulationRunId: row.simulation_run_id,
      correlationId: row.correlation_id ?? row.id,
    }
    if (action === "verify") {
      const next = verifyPrescription(current, session.userId, session.role ?? "pharmacist")
      await (supabaseAdmin as any)
        .from("clinical_prescriptions")
        .update({ status: next.status, verifier_id: next.verifierId, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("pharmacy_tenant_id", tenantId)
      return NextResponse.json({ prescription: next })
    }
    if (action === "dispense") {
      const verified = current.status === "verified" ? current : verifyPrescription(current, session.userId, session.role ?? "pharmacist")
      const next = dispensePrescription({
        rx: verified,
        dispenserId: session.userId,
        role: session.role ?? "pharmacist",
        availableStock: Number(body.availableStock ?? 10),
      })
      await (supabaseAdmin as any)
        .from("clinical_prescriptions")
        .update({
          status: next.rx.status,
          verifier_id: next.rx.verifierId,
          dispenser_id: next.rx.dispenserId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("pharmacy_tenant_id", tenantId)
      return NextResponse.json({ prescription: next.rx, remainingStock: next.remainingStock })
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "failed" }, { status: 400 })
  }
}
