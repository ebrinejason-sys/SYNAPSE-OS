import { NextRequest, NextResponse } from "next/server"
import { getTrustedRequestTenantId } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase/admin"

export async function GET(request: NextRequest) {
  try {
    const tenantId = getTrustedRequestTenantId(
      request,
      request.nextUrl.searchParams.get("tenant_id"),
    )

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant ID is required" }, { status: 400 })
    }

    const { data: products, error } = await supabaseAdmin
      .from("pharmacy_products")
      .select("id, name, sku, price, quantity")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .gt("quantity", 0)
      .order("name", { ascending: true })

    if (error) {
      console.error("Get products error:", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    return NextResponse.json(products ?? [])
  } catch (error) {
    console.error("Get products error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
