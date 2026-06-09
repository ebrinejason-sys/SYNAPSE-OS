import { NextRequest, NextResponse } from "next/server"
import { getPharmacySession, isPharmacyAdmin } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"

export async function GET(request: NextRequest) {
  try {
    const session = await getPharmacySession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await createClient()

    const { data: settings, error } = await supabase
      .from("pharmacy_settings")
      .select("*")
      .eq("tenant_id", session.profile.tenant_id!)
      .single()

    if (error && error.code !== "PGRST116") throw error

    return NextResponse.json(settings ?? null)
  } catch (error) {
    console.error("Get settings error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getPharmacySession()

    if (!session || !isPharmacyAdmin(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const data = await request.json()

    const { data: settings, error } = await supabaseAdmin
      .from("pharmacy_settings")
      .upsert(
        {
          tenant_id: session.profile.tenant_id!,
          pharmacy_name: data.pharmacyName,
          location: data.location,
          contact: data.contact,
          email: data.email,
          logo: data.logo,
          footer_text: data.footerText ?? "",
          receipt_header: data.receiptHeader,
          receipt_footer: data.receiptFooter,
          currency: data.currency ?? "UGX",
          tax_rate: data.taxRate ?? 0,
          low_stock_threshold: data.lowStockThreshold,
        },
        { onConflict: "tenant_id" }
      )
      .select()
      .single()

    if (error) throw error

    // Audit log
    await supabaseAdmin.from("pharmacy_audit_logs").insert({
      tenant_id: session.profile.tenant_id!,
      profile_id: session.user.id,
      action: "UPDATE_SETTINGS",
      entity: "SETTINGS",
      entity_id: settings.id,
      details: "Updated pharmacy settings",
    })

    return NextResponse.json(settings)
  } catch (error) {
    console.error("Save settings error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
