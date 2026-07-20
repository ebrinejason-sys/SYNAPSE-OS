import { NextRequest, NextResponse } from "next/server"
import { requirePharmacyTenant } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase/admin"

// GET packages for a product
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePharmacyTenant()
    if (!auth.ok) return auth.response
    const { session, tenantId } = auth

    const { searchParams } = new URL(request.url)
    const productId = searchParams.get("productId")

    if (!productId) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 })
    }

    const { data: packages, error } = await (supabaseAdmin as any)
      .from("pharmacy_product_packages")
      .select("*")
      .eq("product_id", productId)
      .order("units_per_package", { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(packages ?? [])
  } catch (error) {
    console.error("Get packages error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST - Create a new package
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePharmacyTenant()
    if (!auth.ok) return auth.response
    const { session, tenantId } = auth

    const data: Record<string, unknown> = await request.json()

    if (!data.productId || !data.name || !data.unitsPerPackage || !data.price) {
      return NextResponse.json(
        { error: "Product ID, name, units per package, and price are required" },
        { status: 400 }
      )
    }

    // Check if package with same name already exists for this product
    const { data: existing } = await (supabaseAdmin as any)
      .from("pharmacy_product_packages")
      .select("id")
      .eq("product_id", data.productId as string)
      .eq("name", data.name as string)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: "A package with this name already exists for this product" },
        { status: 400 }
      )
    }

    const { data: productPackage, error: pkgError } = await supabaseAdmin
      .from("pharmacy_product_packages")
      .insert({
        tenant_id: tenantId,
        product_id: data.productId as string,
        name: data.name as string,
        units_per_package: data.unitsPerPackage as number,
        price: data.price as number,
        is_default: (data.isDefault as boolean) || false,
      })
      .select()
      .single()

    if (pkgError) return NextResponse.json({ error: pkgError.message }, { status: 500 })

    // Audit log
    await supabaseAdmin.from("pharmacy_audit_logs").insert({
      tenant_id: tenantId,
      profile_id: session.user.id,
      action: "CREATE_PACKAGE",
      entity: "PRODUCT_PACKAGE",
      entity_id: productPackage.id,
      details: `Created package "${data.name}" (${data.unitsPerPackage} units) for product`,
    })

    return NextResponse.json(productPackage)
  } catch (error) {
    console.error("Create package error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH - Update a package
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requirePharmacyTenant()
    if (!auth.ok) return auth.response
    const { session, tenantId } = auth

    const data: Record<string, unknown> = await request.json()

    if (!data.id) {
      return NextResponse.json({ error: "Package ID is required" }, { status: 400 })
    }

    const { data: productPackage, error: pkgError } = await supabaseAdmin
      .from("pharmacy_product_packages")
      .update({
        name: data.name as string,
        units_per_package: data.unitsPerPackage as number,
        price: data.price as number,
        is_default: data.isDefault as boolean,
      })
      .eq("id", data.id as string)
      .eq("tenant_id", tenantId)
      .select()
      .single()

    if (pkgError) return NextResponse.json({ error: pkgError.message }, { status: 500 })

    // Audit log
    await supabaseAdmin.from("pharmacy_audit_logs").insert({
      tenant_id: tenantId,
      profile_id: session.user.id,
      action: "UPDATE_PACKAGE",
      entity: "PRODUCT_PACKAGE",
      entity_id: productPackage.id,
      details: `Updated package "${data.name}"`,
    })

    return NextResponse.json(productPackage)
  } catch (error) {
    console.error("Update package error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE - Delete a package
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requirePharmacyTenant()
    if (!auth.ok) return auth.response
    const { session, tenantId } = auth

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Package ID is required" }, { status: 400 })
    }

    // Fetch package name for audit log (scoped to tenant)
    const { data: existingPackage } = await (supabaseAdmin as any)
      .from("pharmacy_product_packages")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .maybeSingle()

    if (!existingPackage) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 })
    }

    const { error: deleteError } = await supabaseAdmin
      .from("pharmacy_product_packages")
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenantId)

    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

    // Audit log
    await supabaseAdmin.from("pharmacy_audit_logs").insert({
      tenant_id: tenantId,
      profile_id: session.user.id,
      action: "DELETE_PACKAGE",
      entity: "PRODUCT_PACKAGE",
      entity_id: id,
      details: `Deleted package "${existingPackage.name}"`,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete package error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
