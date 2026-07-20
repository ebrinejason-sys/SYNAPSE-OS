import { NextRequest, NextResponse } from "next/server"
import { requirePharmacyTenant } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase/admin"

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePharmacyTenant()
    if (!auth.ok) return auth.response
    const { session, tenantId } = auth

    const { data: customers, error } = await (supabaseAdmin as any)
      .from("pharmacy_customers")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })

    if (error) throw error

    return NextResponse.json(customers)
  } catch (error) {
    console.error("Get customers error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePharmacyTenant()
    if (!auth.ok) return auth.response
    const { session, tenantId } = auth

    const { name, email, phone, address } = await request.json()

    if (!name?.trim()) {
      return NextResponse.json({ error: "Customer name is required" }, { status: 400 })
    }

    if (!email?.trim() && !phone?.trim()) {
      return NextResponse.json(
        { error: "Provide at least an email or phone number" },
        { status: 400 }
      )
    }

    const normalizedEmail =
      email?.trim() ||
      (phone?.trim() ? `credit+${String(phone).replace(/\D/g, "")}@synapse.local` : null)

    // Check if email already exists for this tenant
    if (normalizedEmail) {
      const { data: existing } = await (supabaseAdmin as any)
        .from("pharmacy_customers")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("email", normalizedEmail)
        .maybeSingle()

      if (existing) {
        return NextResponse.json(
          { error: "Customer with this email already exists" },
          { status: 400 }
        )
      }
    }

    if (phone?.trim()) {
      const { data: existingPhone } = await (supabaseAdmin as any)
        .from("pharmacy_customers")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("phone", phone.trim())
        .maybeSingle()

      if (existingPhone) {
        return NextResponse.json(
          { error: "Customer with this phone already exists" },
          { status: 400 }
        )
      }
    }

    const { data: customer, error } = await supabaseAdmin
      .from("pharmacy_customers")
      .insert({
        tenant_id: tenantId,
        name: name.trim(),
        email: normalizedEmail,
        phone: phone?.trim() ?? null,
        address: address ?? null,
      })
      .select()
      .single()

    if (error) throw error

    await supabaseAdmin.from("pharmacy_audit_logs").insert({
      tenant_id: tenantId,
      profile_id: session.user.id,
      action: "CREATE_CUSTOMER",
      entity: "CUSTOMER",
      entity_id: customer.id,
      details: `Created customer: ${name}${normalizedEmail ? ` (${normalizedEmail})` : ""}`,
    })

    return NextResponse.json(customer)
  } catch (error) {
    console.error("Create customer error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requirePharmacyTenant()
    if (!auth.ok) return auth.response
    const { session, tenantId } = auth

    const { id, name, email, phone, address, isActive } = await request.json()

    if (!id) {
      return NextResponse.json({ error: "Customer ID required" }, { status: 400 })
    }

    const { data: customer, error } = await supabaseAdmin
      .from("pharmacy_customers")
      .update({
        name,
        email,
        phone: phone ?? null,
        address: address ?? null,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select()
      .single()

    if (error) throw error

    await supabaseAdmin.from("pharmacy_audit_logs").insert({
      tenant_id: tenantId,
      profile_id: session.user.id,
      action: "UPDATE_CUSTOMER",
      entity: "CUSTOMER",
      entity_id: customer.id,
      details: `Updated customer: ${name}`,
    })

    return NextResponse.json(customer)
  } catch (error) {
    console.error("Update customer error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requirePharmacyTenant()
    if (!auth.ok) return auth.response
    const { session, tenantId } = auth

    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get("id")

    if (!customerId) {
      return NextResponse.json({ error: "Customer ID required" }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from("pharmacy_customers")
      .delete()
      .eq("id", customerId)
      .eq("tenant_id", tenantId)

    if (error) throw error

    await supabaseAdmin.from("pharmacy_audit_logs").insert({
      tenant_id: tenantId,
      profile_id: session.user.id,
      action: "DELETE_CUSTOMER",
      entity: "CUSTOMER",
      entity_id: customerId,
      details: "Deleted customer account",
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete customer error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
