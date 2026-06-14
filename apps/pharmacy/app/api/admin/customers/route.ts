import { NextRequest, NextResponse } from "next/server"
import { getPharmacySession } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase/admin"

export async function GET(request: NextRequest) {
  try {
    const session = await getPharmacySession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: customers, error } = await (supabaseAdmin as any)
      .from("pharmacy_customers")
      .select("*")
      .eq("tenant_id", session.profile.tenant_id!)
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
    const session = await getPharmacySession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { name, email, phone, address } = await request.json()

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      )
    }

    // Check if email already exists for this tenant
    const { data: existing } = await (supabaseAdmin as any)
      .from("pharmacy_customers")
      .select("id")
      .eq("tenant_id", session.profile.tenant_id!)
      .eq("email", email)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: "Customer with this email already exists" },
        { status: 400 }
      )
    }

    const { data: customer, error } = await supabaseAdmin
      .from("pharmacy_customers")
      .insert({
        tenant_id: session.profile.tenant_id!,
        name,
        email,
        phone: phone ?? null,
        address: address ?? null,
      })
      .select()
      .single()

    if (error) throw error

    await supabaseAdmin.from("pharmacy_audit_logs").insert({
      tenant_id: session.profile.tenant_id!,
      profile_id: session.user.id,
      action: "CREATE_CUSTOMER",
      entity: "CUSTOMER",
      entity_id: customer.id,
      details: `Created customer: ${name} (${email})`,
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
    const session = await getPharmacySession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

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
      .eq("tenant_id", session.profile.tenant_id!)
      .select()
      .single()

    if (error) throw error

    await supabaseAdmin.from("pharmacy_audit_logs").insert({
      tenant_id: session.profile.tenant_id!,
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
    const session = await getPharmacySession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get("id")

    if (!customerId) {
      return NextResponse.json({ error: "Customer ID required" }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from("pharmacy_customers")
      .delete()
      .eq("id", customerId)
      .eq("tenant_id", session.profile.tenant_id!)

    if (error) throw error

    await supabaseAdmin.from("pharmacy_audit_logs").insert({
      tenant_id: session.profile.tenant_id!,
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
