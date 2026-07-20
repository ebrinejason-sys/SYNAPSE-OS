import { NextRequest, NextResponse } from "next/server"
import { getTrustedRequestTenantId } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase/admin"

const FALLBACK = {
  pharmacyName: "SYNAPSE Pharm",
  location: "Kampala, Uganda",
  contact: "0787599099",
  email: "info@synapseos.tech",
  logo: null,
  footerText: "Thank you for choosing us!",
}

/**
 * Public, non-sensitive pharmacy settings for storefront/landing.
 * Tenant must come from middleware-injected x-tenant-id (custom domain)
 * or an explicit ?tenant_id= query — never "first row wins".
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = getTrustedRequestTenantId(
      request,
      request.nextUrl.searchParams.get("tenant_id"),
    )
    if (!tenantId) {
      return NextResponse.json(FALLBACK)
    }

    const { data: settings, error } = await supabaseAdmin
      .from("pharmacy_settings")
      .select("pharmacy_name, location, contact, email, logo, footer_text")
      .eq("tenant_id", tenantId)
      .maybeSingle()

    if (error && error.code !== "PGRST116") throw error
    if (!settings) return NextResponse.json(FALLBACK)

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
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 })
  }
}
