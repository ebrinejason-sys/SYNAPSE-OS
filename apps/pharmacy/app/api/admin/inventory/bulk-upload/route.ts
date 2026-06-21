import { NextRequest, NextResponse } from "next/server"
import { getPharmacySession } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase/admin"
import Papa from "papaparse"
import * as XLSX from "xlsx"

// Helper function to find value from multiple possible column names
function getFieldValue(
  data: Record<string, unknown>,
  ...possibleNames: string[]
): string | null {
  for (const name of possibleNames) {
    const lowerName = name.toLowerCase()
    for (const key of Object.keys(data)) {
      if (key.toLowerCase() === lowerName || key.toLowerCase().includes(lowerName)) {
        const value = data[key]
        if (value !== undefined && value !== null && value !== "") {
          return String(value).trim()
        }
      }
    }
  }
  return null
}

// Helper to parse number, handling commas and currency symbols
function parseNumber(value: string | null): number {
  if (!value) return 0
  const cleaned = value.replace(/[₹$,\s]/g, "").trim()
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

// Helper to generate SKU from product name if not provided
function generateSKU(name: string, index: number): string {
  const prefix = name
    .split(" ")
    .slice(0, 2)
    .map((word) => word.substring(0, 3).toUpperCase())
    .join("")
  return `${prefix}-${Date.now()}-${index}`
}

interface ProductRow {
  tenant_id: string
  name: string
  sku: string
  barcode: string | null
  category: string
  price: number
  cost_price: number
  quantity: number
  reorder_level: number
  unit_of_measure: string
  description: string | null
  batch_number: string | null
  manufacturer: string | null
  expiry_date: string | null
  generic_name: string | null
  dosage_form: string | null
  strength: string | null
  requires_prescription: boolean
  supplier_id: string | null
}

export async function POST(request: NextRequest) {
  try {
    const session = await getPharmacySession()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!session.profile.tenant_id) return NextResponse.json({ error: "No tenant" }, { status: 403 })
    const tenantId = session.profile.tenant_id

    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const fileName = file.name.toLowerCase()
    let parsedData: Record<string, unknown>[] = []

    // Handle both CSV and Excel files
    if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: "array" })
      const sheetName = workbook.SheetNames[0]
      if (!sheetName) {
        return NextResponse.json({ error: "No sheets found in Excel file" }, { status: 400 })
      }
      const worksheet = workbook.Sheets[sheetName]
      parsedData = XLSX.utils.sheet_to_json(worksheet, { defval: "" }) as Record<string, unknown>[]
      console.log("Excel headers:", Object.keys(parsedData[0] ?? {}))
    } else {
      const text = await file.text()
      console.log("File content preview:", text.substring(0, 500))
      const results = Papa.parse<Record<string, unknown>>(text, {
        header: true,
        skipEmptyLines: true,
      })
      parsedData = results.data
      console.log("CSV headers:", results.meta.fields)
    }

    console.log("Parsed data count:", parsedData.length)
    if (parsedData.length > 0) {
      console.log("Sample row:", JSON.stringify(parsedData[0]))
    }

    if (!parsedData || parsedData.length === 0) {
      return NextResponse.json({ error: "No data found in file" }, { status: 400 })
    }

    // Pre-load suppliers for this tenant to avoid N+1 lookups
    const { data: supplierRows } = await supabaseAdmin
      .from("pharmacy_suppliers")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
    const supplierMap = new Map<string, string>(
      (supplierRows ?? []).map((s) => [(s.name as string).toLowerCase(), s.id as string])
    )

    const productsToCreate: ProductRow[] = []
    const errors: string[] = []
    const skippedDuplicates: string[] = []

    for (const [index, data] of parsedData.entries()) {
      const name = getFieldValue(
        data,
        "name", "item name", "stock item", "product name", "particulars",
        "item", "product", "medicine name", "drug name"
      )

      let sku = getFieldValue(
        data,
        "sku", "part no", "part number", "item code", "product code",
        "hsn code", "hsn", "code", "item no"
      )

      const category =
        getFieldValue(
          data,
          "category", "group", "under", "item group", "product group",
          "stock group", "type", "classification"
        ) || "General"

      const priceStr = getFieldValue(
        data,
        "price", "rate", "selling price", "mrp", "sale rate", "sales price",
        "retail price", "sp", "selling rate", "unit price"
      )

      const costPriceStr = getFieldValue(
        data,
        "cost_price", "costprice", "cost price", "purchase price", "cost", "purchase rate",
        "cp", "buying price", "purchase cost", "landed cost"
      )

      const quantityStr = getFieldValue(
        data,
        "quantity", "qty", "stock", "closing stock", "balance",
        "opening stock", "stock qty", "available", "in stock", "closing balance"
      )

      const barcode =
        getFieldValue(data, "barcode", "bar code", "upc", "ean") || null

      const unitOfMeasure =
        getFieldValue(data, "unit_of_measure", "unit", "unitofmeasure", "uom", "unit of measure", "base unit") ||
        "Unit"

      const batchNumber =
        getFieldValue(
          data,
          "batch_number", "batchnumber", "batch number", "batch no", "batch", "lot number", "lot no"
        ) || null

      const manufacturer =
        getFieldValue(
          data,
          "manufacturer", "mfg", "brand", "company", "make"
        ) || null

      const expiryDateStr = getFieldValue(
        data,
        "expiry_date", "expirydate", "expiry date", "expiry", "exp date", "exp", "best before"
      )

      const description =
        getFieldValue(data, "description", "remarks", "notes", "details", "narration") || null

      const reorderLevelStr = getFieldValue(
        data,
        "reorder_level", "reorderlevel", "reorder level", "reorder", "min stock", "minimum stock"
      )

      const genericName =
        getFieldValue(data, "generic_name", "generic name", "generic", "inn") || null

      const dosageForm =
        getFieldValue(data, "dosage_form", "dosage form", "form", "formulation") || null

      const strength =
        getFieldValue(data, "strength", "potency", "concentration") || null

      const requiresPrescriptionRaw =
        getFieldValue(data, "requires_prescription", "prescription", "rx") ?? "no"
      const requiresPrescription =
        requiresPrescriptionRaw.toLowerCase() === "yes" ||
        requiresPrescriptionRaw.toLowerCase() === "true" ||
        requiresPrescriptionRaw === "1"

      const supplierName = getFieldValue(data, "supplier", "supplier name") ?? ""
      const supplierId = supplierName
        ? supplierMap.get(supplierName.toLowerCase()) ?? null
        : null

      // Skip empty rows
      if (!name) continue

      // Generate SKU if not provided
      if (!sku) {
        sku = generateSKU(name, index)
      }

      const price = parseNumber(priceStr)
      const costPrice = parseNumber(costPriceStr) || price * 0.7
      const quantity = Math.round(parseNumber(quantityStr)) || 0
      const reorderLevel = Math.round(parseNumber(reorderLevelStr)) || 10

      if (price <= 0 && costPrice <= 0) {
        errors.push(`Row ${index + 2}: "${name}" - No valid price found`)
        continue
      }

      // Check for duplicate SKU in database (scoped to tenant)
      const { data: existingProduct } = await (supabaseAdmin as any)
        .from("pharmacy_products")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("sku", sku)
        .maybeSingle()

      if (existingProduct) {
        skippedDuplicates.push(`Row ${index + 2}: SKU "${sku}" already exists (${name})`)
        continue
      }

      // Check for duplicate SKU in current batch
      if (productsToCreate.find((p) => p.sku === sku)) {
        sku = `${sku}-${index}`
      }

      // Parse expiry date
      let expiryDate: string | null = null
      if (expiryDateStr) {
        try {
          const parsed = new Date(expiryDateStr)
          if (!isNaN(parsed.getTime())) {
            expiryDate = parsed.toISOString()
          }
        } catch {
          expiryDate = null
        }
      }

      productsToCreate.push({
        tenant_id: tenantId,
        name,
        sku,
        barcode,
        category,
        price: price > 0 ? price : costPrice * 1.3,
        cost_price: costPrice > 0 ? costPrice : price * 0.7,
        quantity,
        reorder_level: reorderLevel,
        unit_of_measure: unitOfMeasure,
        description,
        batch_number: batchNumber,
        manufacturer,
        expiry_date: expiryDate,
        generic_name: genericName,
        dosage_form: dosageForm,
        strength,
        requires_prescription: requiresPrescription,
        supplier_id: supplierId,
      })
    }

    if (productsToCreate.length === 0) {
      return NextResponse.json(
        {
          error: "No valid products to create",
          details: errors,
          skipped: skippedDuplicates,
          hint: "Make sure your file has columns for: name, price (or cost_price), and optionally generic_name, category, dosage_form, strength, quantity, reorder_level, unit_of_measure, expiry_date, requires_prescription, manufacturer, supplier.",
        },
        { status: 400 }
      )
    }

    // Bulk upsert products (conflict on sku + tenant_id unique constraint)
    const { data: upsertResult, error: upsertError } = await supabaseAdmin
      .from("pharmacy_products")
      .upsert(productsToCreate, { onConflict: "sku,tenant_id" })
      .select()

    if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 })

    const count = upsertResult?.length ?? productsToCreate.length

    // Audit log
    await supabaseAdmin.from("pharmacy_audit_logs").insert({
      tenant_id: tenantId,
      profile_id: session.user.id,
      action: "BULK_UPLOAD_PRODUCTS",
      entity: "PRODUCT",
      entity_id: null,
      details: `Bulk uploaded ${count} products`,
    })

    return NextResponse.json({
      success: true,
      count,
      errors: errors.length > 0 ? errors : undefined,
      skipped: skippedDuplicates.length > 0 ? skippedDuplicates : undefined,
    })
  } catch (error) {
    console.error("Bulk upload error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
