import { NextRequest, NextResponse } from "next/server"
import { requirePharmacyTenant } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase/admin"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePharmacyTenant()
    if (!auth.ok) return auth.response
    const { session, tenantId } = auth

    const { id } = await params

    const { data: client, error } = await (supabaseAdmin as any)
      .from("pharmacy_clients")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .single()

    if (error || !client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    return NextResponse.json(client)
  } catch (error) {
    console.error("Fetch client error:", error)
    return NextResponse.json(
      { error: "Failed to fetch client" },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePharmacyTenant()
    if (!auth.ok) return auth.response
    const { session, tenantId } = auth

    const { name, phone, address, notes } = await request.json()
    const { id } = await params

    const updateData: Record<string, string | null> = {
      last_visit: new Date().toISOString(),
    }
    if (name) updateData.name = name.trim()
    if (phone !== undefined) updateData.phone = phone?.trim() || null
    if (address !== undefined) updateData.address = address?.trim() || null
    if (notes !== undefined) updateData.notes = notes?.trim() || null

    const { data: client, error } = await supabaseAdmin
      .from("pharmacy_clients")
      .update(updateData)
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(client)
  } catch (error) {
    console.error("Update client error:", error)
    return NextResponse.json(
      { error: "Failed to update client" },
      { status: 500 }
    )
  }
}
