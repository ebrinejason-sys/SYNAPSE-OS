import { NextRequest, NextResponse } from "next/server"
import { requirePharmacyTenant } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase/admin"

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePharmacyTenant()
    if (!auth.ok) return auth.response
    const { session, tenantId } = auth

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")
    const limit = parseInt(searchParams.get("limit") || "10")

    let query = (supabaseAdmin as any)
      .from("pharmacy_clients")
      .select("id, name, phone, address, notes, last_visit")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("last_visit", { ascending: false })
      .limit(limit)

    if (search && search.trim()) {
      query = query.or(
        `name.ilike.%${search.trim()}%,phone.ilike.%${search.trim()}%`
      )
    }

    const { data: clients, error } = await query

    if (error) throw error

    return NextResponse.json(clients)
  } catch (error) {
    console.error("Fetch clients error:", error)
    return NextResponse.json(
      { error: "Failed to fetch clients" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePharmacyTenant()
    if (!auth.ok) return auth.response
    const { session, tenantId } = auth

    const { name, phone, address, notes } = await request.json()

    if (!name || name.trim() === "") {
      return NextResponse.json(
        { error: "Client name is required" },
        { status: 400 }
      )
    }

    const { data: client, error } = await supabaseAdmin
      .from("pharmacy_clients")
      .insert({
        tenant_id: tenantId,
        name: name.trim(),
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        notes: notes?.trim() || null,
        last_visit: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(client, { status: 201 })
  } catch (error) {
    console.error("Create client error:", error)
    return NextResponse.json(
      { error: "Failed to create client" },
      { status: 500 }
    )
  }
}
