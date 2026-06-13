import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/admin"

// Public endpoint — no authentication required.
// Returns non-sensitive pharmacy settings for the landing page.
// Note: for multi-tenant deployments the caller should pass a tenant identifier;
// for now we return the first settings row found as a single-tenant fallback.
export async function GET() {
  try {
    const { data: settings, error } = await supabaseAdmin
      .from("pharmacy_settings")
      .select(
        "pharmacy_name, location, contact, email, logo, footer_text"
      )
      .limit(1)
      .single()

    if (error && error.code !== "PGRST116") throw error

    if (!settings) {
      return NextResponse.json({
        pharmacyName: "SYNAPSE Pharm",
        location: "Kampala, Uganda",
        contact: "0787599099",
        email: "info@synapseos.tech",
        logo: null,
        footerText: "Thank you for choosing us!",
      })
    }

    return NextResponse.json({
      pharmacyName: settings.pharmacy_name,
      location: settings.location,
      contact: settings.contact,
      email: settings.email,
      logo: settings.logo,
      footerText: settings.footer_text,
    })
  } catch (error) {
    console.error("Failed to fetch public settings:", error)
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    )
  }
}
