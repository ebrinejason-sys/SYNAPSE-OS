import { NextRequest, NextResponse } from "next/server"
import { getPharmacySession } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase/admin"

export async function GET(request: NextRequest) {
  try {
    const session = await getPharmacySession()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!session.profile.tenant_id) return NextResponse.json({ error: "No tenant" }, { status: 403 })

    const { data: products, error } = await (supabaseAdmin as any)
      .from("pharmacy_products")
      .select(`
        *,
        pharmacy_product_packages(*),
        pharmacy_product_batches(*)
      `)
      .eq("tenant_id", session.profile.tenant_id!)
      .eq("is_active", true)
      .order("created_at", { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Normalize to camelCase so the POS client interface matches
    const result = (products ?? []).map((product: any) => ({
      id:                   product.id,
      name:                 product.name,
      sku:                  product.sku,
      barcode:              product.barcode ?? null,
      price:                Number(product.price ?? 0),
      costPrice:            product.cost_price != null ? Number(product.cost_price) : null,
      quantity:             product.quantity ?? 0,
      unitOfMeasure:        product.unit_of_measure ?? "unit",
      strength:             product.strength ?? null,
      dosageForm:           product.dosage_form ?? null,
      activeIngredient:     product.active_ingredient ?? null,
      genericName:          product.generic_name ?? null,
      requiresPrescription: product.requires_prescription ?? false,
      supplierId:           product.supplier_id ?? null,
      expiryDate:           product.expiry_date ?? null,
      batchNumber:          product.batch_number ?? null,
      isActive:             product.is_active,
      tenantId:             product.tenant_id,
      createdAt:            product.created_at,
      updatedAt:            product.updated_at,
      packages: (product.pharmacy_product_packages ?? [])
        .sort((a: any, b: any) => a.units_per_package - b.units_per_package)
        .map((pkg: any) => ({
          id:              pkg.id,
          name:            pkg.name,
          unitsPerPackage: pkg.units_per_package,
          price:           Number(pkg.price ?? 0),
          isDefault:       pkg.is_default ?? false,
        })),
      batches: (product.pharmacy_product_batches ?? [])
        .filter((b: any) => b.is_active && b.quantity > 0)
        .sort((a: any, b: any) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime())
        .map((batch: any) => ({
          id:          batch.id,
          batchNumber: batch.batch_number,
          quantity:    batch.quantity,
          expiryDate:  batch.expiry_date,
          costPrice:   batch.cost_price != null ? Number(batch.cost_price) : null,
          manufacturer: batch.manufacturer ?? null,
        })),
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error("Get products error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getPharmacySession()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!session.profile.tenant_id) return NextResponse.json({ error: "No tenant" }, { status: 403 })
    const tenantId = session.profile.tenant_id

    const data: Record<string, unknown> = await request.json()

    // Check if SKU already exists (scoped to tenant)
    const { data: existingProduct } = await (supabaseAdmin as any)
      .from("pharmacy_products")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("sku", data.sku as string)
      .maybeSingle()

    if (existingProduct) {
      return NextResponse.json({ error: "Product with this SKU already exists" }, { status: 400 })
    }

    // Create the product
    const { data: product, error: productError } = await supabaseAdmin
      .from("pharmacy_products")
      .insert({
        tenant_id: tenantId,
        name: data.name as string,
        sku: data.sku as string,
        barcode: (data.barcode as string) || null,
        category: (data.category as string) || "General",
        price: data.price as number,
        cost_price: data.costPrice as number,
        quantity: (data.quantity as number) || 0,
        reorder_level: (data.reorderLevel as number) || 10,
        unit_of_measure: (data.unitOfMeasure as string) || "Tablet",
        description: (data.description as string) || null,
        manufacturer: (data.manufacturer as string) || null,
        strength: (data.strength as string) || null,
        dosage_form: (data.dosageForm as string) || null,
        active_ingredient: (data.activeIngredient as string) || null,
        requires_prescription: (data.requiresPrescription as boolean) || false,
        generic_name: (data.genericName as string) || null,
        side_effects: (data.sideEffects as string) || null,
        storage_instructions: (data.storageInstructions as string) || null,
        regulatory_id: (data.regulatoryId as string) || null,
        supplier_id: (data.supplierId as string) || null,
      })
      .select()
      .single()

    if (productError) return NextResponse.json({ error: productError.message }, { status: 500 })

    // Create packages if provided
    const packages = data.packages as Array<Record<string, unknown>> | undefined
    if (Array.isArray(packages) && packages.length > 0) {
      const { error: packagesError } = await supabaseAdmin
        .from("pharmacy_product_packages")
        .insert(
          packages.map((pkg) => ({
            tenant_id: tenantId,
            product_id: product.id,
            name: pkg.name as string,
            units_per_package: pkg.unitsPerPackage as number,
            price: pkg.price as number,
            is_default: (pkg.isDefault as boolean) || false,
          }))
        )
      if (packagesError) return NextResponse.json({ error: packagesError.message }, { status: 500 })
    }

    // Create batches if provided
    const batches = data.batches as Array<Record<string, unknown>> | undefined
    if (Array.isArray(batches) && batches.length > 0) {
      const { error: batchesError } = await supabaseAdmin
        .from("pharmacy_product_batches")
        .insert(
          batches.map((batch) => ({
            tenant_id: tenantId,
            product_id: product.id,
            batch_number: batch.batchNumber as string,
            quantity: batch.quantity as number,
            initial_quantity: batch.quantity as number,
            expiry_date: batch.expiryDate as string,
            cost_price: (batch.costPrice as number) || (data.costPrice as number),
          }))
        )
      if (batchesError) return NextResponse.json({ error: batchesError.message }, { status: 500 })

      // Update product quantity to sum of batch quantities
      const totalBatchQty = batches.reduce(
        (sum, b) => sum + ((b.quantity as number) || 0),
        0
      )
      if (totalBatchQty > 0) {
        const { error: updateError } = await supabaseAdmin
          .from("pharmacy_products")
          .update({ quantity: totalBatchQty })
          .eq("id", product.id)
          .eq("tenant_id", tenantId)
        if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
      }
    }

    // Audit log
    await supabaseAdmin.from("pharmacy_audit_logs").insert({
      tenant_id: tenantId,
      profile_id: session.user.id,
      action: "CREATE_PRODUCT",
      entity: "PRODUCT",
      entity_id: product.id,
      details: `Created product: ${product.name} (${product.sku}) with ${packages?.length ?? 0} packages, ${batches?.length ?? 0} batches`,
    })

    return NextResponse.json(product)
  } catch (error) {
    console.error("Create product error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getPharmacySession()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!session.profile.tenant_id) return NextResponse.json({ error: "No tenant" }, { status: 403 })
    const tenantId = session.profile.tenant_id

    const data: Record<string, unknown> = await request.json()

    if (!data.id) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 })
    }

    // Verify product exists (scoped to tenant)
    const { data: existingProduct } = await (supabaseAdmin as any)
      .from("pharmacy_products")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("id", data.id as string)
      .maybeSingle()

    if (!existingProduct) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    // Update the product
    const { data: product, error: productError } = await supabaseAdmin
      .from("pharmacy_products")
      .update({
        name: data.name as string,
        barcode: (data.barcode as string) || null,
        category: (data.category as string) || "General",
        price: data.price as number,
        cost_price: data.costPrice as number,
        quantity: data.quantity as number,
        reorder_level: (data.reorderLevel as number) || 10,
        unit_of_measure: (data.unitOfMeasure as string) || "Tablet",
        description: (data.description as string) || null,
        manufacturer: (data.manufacturer as string) || null,
        strength: (data.strength as string) || null,
        dosage_form: (data.dosageForm as string) || null,
        active_ingredient: (data.activeIngredient as string) || null,
        requires_prescription: data.requiresPrescription as boolean,
        generic_name: (data.genericName as string) || null,
        side_effects: (data.sideEffects as string) || null,
        storage_instructions: (data.storageInstructions as string) || null,
        regulatory_id: (data.regulatoryId as string) || null,
        supplier_id: (data.supplierId as string) || null,
      })
      .eq("id", data.id as string)
      .eq("tenant_id", tenantId)
      .select()
      .single()

    if (productError) return NextResponse.json({ error: productError.message }, { status: 500 })

    // Soft-delete removed batches (bulk update)
    const deletedBatchIds = data.deletedBatchIds as string[] | undefined
    if (Array.isArray(deletedBatchIds) && deletedBatchIds.length > 0) {
      const { error: batchDeleteError } = await supabaseAdmin
        .from("pharmacy_product_batches")
        .update({ is_active: false })
        .in("id", deletedBatchIds)
        .eq("tenant_id", tenantId)
      if (batchDeleteError) return NextResponse.json({ error: batchDeleteError.message }, { status: 500 })
    }

    // Hard-delete removed packages
    const deletedPackageIds = data.deletedPackageIds as string[] | undefined
    if (Array.isArray(deletedPackageIds) && deletedPackageIds.length > 0) {
      const { error: pkgDeleteError } = await supabaseAdmin
        .from("pharmacy_product_packages")
        .delete()
        .in("id", deletedPackageIds)
        .eq("tenant_id", tenantId)
      if (pkgDeleteError) return NextResponse.json({ error: pkgDeleteError.message }, { status: 500 })
    }

    // Handle packages: update existing, create new
    const packages = data.packages as Array<Record<string, unknown>> | undefined
    if (Array.isArray(packages)) {
      for (const pkg of packages) {
        if (pkg.id) {
          const { error } = await supabaseAdmin
            .from("pharmacy_product_packages")
            .update({
              name: pkg.name as string,
              units_per_package: pkg.unitsPerPackage as number,
              price: pkg.price as number,
              is_default: pkg.isDefault as boolean,
            })
            .eq("id", pkg.id as string)
            .eq("tenant_id", tenantId)
          if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        } else {
          const { error } = await supabaseAdmin
            .from("pharmacy_product_packages")
            .insert({
              tenant_id: tenantId,
              product_id: product.id,
              name: pkg.name as string,
              units_per_package: pkg.unitsPerPackage as number,
              price: pkg.price as number,
              is_default: (pkg.isDefault as boolean) || false,
            })
          if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        }
      }
    }

    // Handle batches: update existing, create new
    const batches = data.batches as Array<Record<string, unknown>> | undefined
    if (Array.isArray(batches)) {
      for (const batch of batches) {
        if (batch.id) {
          const updateFields: Record<string, unknown> = {
            batch_number: batch.batchNumber,
            quantity: batch.quantity,
            cost_price: batch.costPrice,
          }
          if (batch.expiryDate !== undefined) {
            updateFields.expiry_date = batch.expiryDate || null
          }
          const { error } = await supabaseAdmin
            .from("pharmacy_product_batches")
            .update(updateFields)
            .eq("id", batch.id as string)
            .eq("tenant_id", tenantId)
          if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        } else {
          const { error } = await supabaseAdmin
            .from("pharmacy_product_batches")
            .insert({
              tenant_id: tenantId,
              product_id: product.id,
              batch_number: batch.batchNumber as string,
              quantity: batch.quantity as number,
              initial_quantity: batch.quantity as number,
              expiry_date: batch.expiryDate as string,
              cost_price: (batch.costPrice as number) || (data.costPrice as number),
            })
          if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        }
      }
    }

    // Audit log
    await supabaseAdmin.from("pharmacy_audit_logs").insert({
      tenant_id: tenantId,
      profile_id: session.user.id,
      action: "UPDATE_PRODUCT",
      entity: "PRODUCT",
      entity_id: product.id,
      details: `Updated product: ${product.name} (${product.sku})`,
    })

    return NextResponse.json(product)
  } catch (error) {
    console.error("Update product error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getPharmacySession()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!session.profile.tenant_id) return NextResponse.json({ error: "No tenant" }, { status: 403 })

    const productId = request.nextUrl.searchParams.get("id")
    if (!productId) {
      return NextResponse.json({ error: "Product id is required" }, { status: 400 })
    }

    const tenantId = session.profile.tenant_id

    const { data: product, error: fetchError } = await supabaseAdmin
      .from("pharmacy_products")
      .select("id, name, sku")
      .eq("id", productId)
      .eq("tenant_id", tenantId)
      .maybeSingle()

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 })

    const { error: deleteError } = await supabaseAdmin
      .from("pharmacy_products")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", productId)
      .eq("tenant_id", tenantId)

    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

    await supabaseAdmin.from("pharmacy_audit_logs").insert({
      tenant_id: tenantId,
      profile_id: session.user.id,
      action: "DELETE_PRODUCT",
      entity: "PRODUCT",
      entity_id: productId,
      details: `Deleted product: ${product.name} (${product.sku})`,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Delete product error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
