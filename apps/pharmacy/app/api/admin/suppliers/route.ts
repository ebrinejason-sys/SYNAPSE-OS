import { NextRequest, NextResponse } from "next/server"
import { requirePharmacyPermission } from "@/lib/api-auth"
import { mapSupplier } from "@/lib/api-serialize"
import { supabaseAdmin } from "@/lib/supabase/admin"

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePharmacyPermission("purchasing.manage")
    if (!auth.ok) return auth.response
    const { tenantId } = auth

    const [{ data: suppliers, error }, { data: poRows }] = await Promise.all([
      (supabaseAdmin as any)
        .from("pharmacy_suppliers")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false }),
      (supabaseAdmin as any)
        .from("pharmacy_purchase_orders")
        .select("supplier_id")
        .eq("tenant_id", tenantId),
    ])

    if (error) throw error

    const poCounts = new Map<string, number>()
    for (const row of poRows ?? []) {
      const sid = row.supplier_id as string
      if (!sid) continue
      poCounts.set(sid, (poCounts.get(sid) ?? 0) + 1)
    }

    return NextResponse.json(
      (suppliers ?? []).map((row: Record<string, unknown>) =>
        mapSupplier(row, poCounts.get(String(row.id)) ?? 0),
      ),
    )
  } catch (error) {
    console.error("Get suppliers error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePharmacyPermission("purchasing.manage")
    if (!auth.ok) return auth.response
    const { session, tenantId } = auth

    const { name, email, phone, address, contactPerson, notes, taxNumber } =
      await request.json()

    if (!name) {
      return NextResponse.json(
        { error: "Supplier name is required" },
        { status: 400 }
      )
    }

    if (email) {
    const { data: existing } = await (supabaseAdmin as any)
      .from("pharmacy_suppliers")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("email", email)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: "Supplier with this email already exists" },
        { status: 400 }
      )
    }
    }

    const { data: supplier, error } = await supabaseAdmin
      .from("pharmacy_suppliers")
      .insert({
        tenant_id: tenantId,
        name,
        email: email ?? null,
        phone: phone ?? null,
        address: address ?? null,
        contact_person: contactPerson ?? null,
        tax_number: taxNumber ?? null,
        notes: notes ?? null,
      })
      .select()
      .single()

    if (error) throw error

    await supabaseAdmin.from("pharmacy_audit_logs").insert({
      tenant_id: tenantId,
      profile_id: session.user.id,
      action: "CREATE_SUPPLIER",
      entity: "SUPPLIER",
      entity_id: supplier.id,
      details: `Created supplier: ${name}`,
    })

    return NextResponse.json({
      success: true,
      supplier: mapSupplier(supplier as Record<string, unknown>, 0),
    })
  } catch (error) {
    console.error("Create supplier error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requirePharmacyPermission("purchasing.manage")
    if (!auth.ok) return auth.response
    const { session, tenantId } = auth

    const { id, name, email, phone, address, contactPerson, notes, isActive, taxNumber } =
      await request.json()

    if (!id) {
      return NextResponse.json({ error: "Supplier ID required" }, { status: 400 })
    }

    // Check if email is taken by another supplier in this tenant
    if (email) {
      const { data: existing } = await (supabaseAdmin as any)
        .from("pharmacy_suppliers")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("email", email)
        .neq("id", id)
        .single()

      if (existing) {
        return NextResponse.json(
          { error: "Email is already used by another supplier" },
          { status: 400 }
        )
      }
    }

    const { data: supplier, error } = await supabaseAdmin
      .from("pharmacy_suppliers")
      .update({
        name,
        email,
        phone: phone ?? null,
        address: address ?? null,
        contact_person: contactPerson ?? null,
        tax_number: taxNumber ?? null,
        notes: notes ?? null,
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
      action: "UPDATE_SUPPLIER",
      entity: "SUPPLIER",
      entity_id: supplier.id,
      details: `Updated supplier: ${name}`,
    })

    return NextResponse.json({
      success: true,
      supplier: mapSupplier(supplier as Record<string, unknown>),
    })
  } catch (error) {
    console.error("Update supplier error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requirePharmacyPermission("purchasing.manage")
    if (!auth.ok) return auth.response
    const { session, tenantId } = auth

    const { searchParams } = new URL(request.url)
    const supplierId = searchParams.get("id")

    if (!supplierId) {
      return NextResponse.json({ error: "Supplier ID required" }, { status: 400 })
    }

    // Check supplier exists in tenant
    const { data: supplier } = await supabaseAdmin
      .from("pharmacy_suppliers")
      .select("name")
      .eq("id", supplierId)
      .eq("tenant_id", tenantId)
      .single()

    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 })
    }

    // Null out supplier_id on linked products instead of deleting them
    const { error: unlinkError } = await supabaseAdmin
      .from("pharmacy_products")
      .update({ supplier_id: null })
      .eq("supplier_id", supplierId)
      .eq("tenant_id", tenantId)

    if (unlinkError) throw unlinkError

    // Delete the supplier
    const { error: deleteError } = await supabaseAdmin
      .from("pharmacy_suppliers")
      .delete()
      .eq("id", supplierId)
      .eq("tenant_id", tenantId)

    if (deleteError) throw deleteError

    await supabaseAdmin.from("pharmacy_audit_logs").insert({
      tenant_id: tenantId,
      profile_id: session.user.id,
      action: "DELETE_SUPPLIER",
      entity: "SUPPLIER",
      entity_id: supplierId,
      details: `Deleted supplier: ${supplier.name}`,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete supplier error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
