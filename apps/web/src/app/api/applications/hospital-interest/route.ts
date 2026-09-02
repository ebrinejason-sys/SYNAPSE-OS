import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const hospitalName = String(body.hospital_name ?? "").trim()
  const contactEmail = String(body.contact_email ?? "").trim()

  if (!hospitalName || !contactEmail) {
    return NextResponse.json({ error: "hospital_name and contact_email are required" }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { error } = await (supabase as any).from("hospital_leads").upsert(
    {
      hospital_name: hospitalName,
      contact_name: body.contact_name?.trim() || null,
      contact_email: contactEmail,
      contact_phone: body.contact_phone?.trim() || null,
      location: body.location?.trim() || null,
      bed_count: body.beds_count ? Number(body.beds_count) : null,
      current_system: body.current_system?.trim() || null,
      notes: body.notes?.trim() || null,
      facility_type: "hospital",
      status: "new",
      stage: "interest",
      source: "signup_form",
    },
    { onConflict: "contact_email" },
  )

  if (error) {
    console.error("[hospital-interest] insert failed:", error.message)
    return NextResponse.json({ error: "Failed to save interest form" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
