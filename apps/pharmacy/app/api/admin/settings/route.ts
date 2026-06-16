import { NextRequest, NextResponse } from "next/server"
import { getPharmacySession, isPharmacyAdmin } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase/admin"

export async function GET(request: NextRequest) {
  try {
    const session = await getPharmacySession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: settings, error } = await (supabaseAdmin as any)
      .from("pharmacy_settings")
      .select("*")
      .eq("tenant_id", session.profile.tenant_id!)
      .single()

    if (error && error.code !== "PGRST116") throw error
    if (!settings) return NextResponse.json(null)

    // Return camelCase so client-side Settings interface matches
    return NextResponse.json({
      id:                settings.id,
      tenantId:          settings.tenant_id,
      pharmacyName:      settings.pharmacy_name ?? "",
      location:          settings.location ?? "",
      contact:           settings.contact ?? "",
      email:             settings.email ?? "",
      logo:              settings.logo ?? null,
      footerText:        settings.footer_text ?? "",
      receiptHeader:     settings.receipt_header ?? "",
      receiptFooter:     settings.receipt_footer ?? "",
      currency:          settings.currency ?? "UGX",
      taxRate:           settings.tax_rate ?? 0,
      lowStockThreshold: settings.low_stock_threshold ?? 10,
      printerType:       settings.printer_type ?? "default",
    })
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
          printer_type: data.printerType ?? "default",
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
