import { NextRequest, NextResponse } from "next/server"
import { requirePharmacyPermission } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { createPurchaseCatalogProduct, catalogProductFromRow } from "@synapse/db/pharmacy-purchases"
import { receivePharmacyStock, parsePharmacyRpcError } from "@synapse/db/inventory-rpc"
import { requireStoreScope } from "@/lib/pharmacy-context"

const db = () => supabaseAdmin as any

type MappingRow = {
  source: string
  target: string
  confidence: number
  status: string
}

type ImportResult = {
  success: number
  failed: number
  skipped: number
  rows: Array<{
    rowIndex: number
    status: "success" | "failed" | "skipped"
    reason?: string
    productId?: string
    productName?: string
  }>
}

function parseDate(value: string): string | null {
  if (!value?.trim()) return null
  const cleaned = String(value).trim()
  
  // Try ISO format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned
  }
  
  // Try DD/MM/YYYY or DD-MM-YYYY
  const dmy = cleaned.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (dmy) {
    const [, day, month, year] = dmy
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
  }
  
  // Try MM/DD/YYYY
  const mdy = cleaned.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (mdy) {
    const [, month, day, year] = mdy
    const fullYear = year.length === 2 ? `20${year}` : year
    return `${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
  }
  
  return null
}

function extractMappedValues(
  row: string[],
  mapping: MappingRow[],
  headers: string[],
): Record<string, string> {
  const values: Record<string, string> = {}
  
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i]
    const mappingRow = mapping.find((m) => m.source === header)
    if (mappingRow && mappingRow.target !== "unmapped") {
      values[mappingRow.target] = String(row[i] ?? "").trim()
    }
  }
  
  return values
}

async function loadExistingProducts(tenantId: string) {
  const { data, error } = await db()
    .from("pharmacy_products")
    .select(
      "id, name, sku, barcode, generic_name, strength, dosage_form, manufacturer, price, cost_price",
    )
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .limit(5000)
  
  if (error) throw error
  return (data ?? []).map(catalogProductFromRow)
}

function findExistingProduct(
  values: Record<string, string>,
  existingProducts: ReturnType<typeof catalogProductFromRow>[],
) {
  const barcode = values.barcode?.trim()
  const sku = values.sku?.trim()
  const name = values.name?.trim()
  
  if (barcode) {
    const match = existingProducts.find((p) => p.barcode?.toLowerCase() === barcode.toLowerCase())
    if (match) return match
  }
  
  if (sku) {
    const match = existingProducts.find((p) => p.sku?.toLowerCase() === sku.toLowerCase())
    if (match) return match
  }
  
  if (name) {
    const match = existingProducts.find((p) => p.name.toLowerCase() === name.toLowerCase())
    if (match) return match
  }
  
  return null
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await requirePharmacyPermission("inventory.adjust")
    if (!auth.ok) return auth.response
    const { session, tenantId } = auth

    const body = (await request.json()) as {
      allRows?: string[][]
      storeId?: string
    }

    const scoped = requireStoreScope(
      { ...auth, storeId: session.storeId ?? null },
      body.storeId ?? session.storeId ?? null,
    )
    if (!scoped.ok) return scoped.response

    const sessionId = params.id

    // Fetch the import session
    const { data: importSession, error: sessionError } = await db()
      .from("pharmacy_import_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("tenant_id", tenantId)
      .single()

    if (sessionError || !importSession) {
      return NextResponse.json(
        { error: "Import session not found" },
        { status: 404 },
      )
    }

    if (importSession.status === "complete") {
      return NextResponse.json(
        { error: "Import session has already been applied" },
        { status: 400 },
      )
    }

    const aiMapping = importSession.ai_mapping as { mapping?: MappingRow[]; sampleRows?: string[][] }
    const mapping = aiMapping?.mapping ?? []
    const headers = mapping.map((m) => m.source)

    if (!body.allRows || !Array.isArray(body.allRows) || body.allRows.length === 0) {
      return NextResponse.json(
        { error: "No rows provided for import" },
        { status: 400 },
      )
    }

    // Update session status to importing
    await db()
      .from("pharmacy_import_sessions")
      .update({ status: "importing" })
      .eq("id", sessionId)
      .eq("tenant_id", tenantId)

    const existingProducts = await loadExistingProducts(tenantId)
    const result: ImportResult = {
      success: 0,
      failed: 0,
      skipped: 0,
      rows: [],
    }

    for (let i = 0; i < body.allRows.length; i++) {
      const row = body.allRows[i]
      const values = extractMappedValues(row, mapping, headers)

      // Skip rows without a name
      if (!values.name?.trim()) {
        result.skipped++
        result.rows.push({
          rowIndex: i,
          status: "skipped",
          reason: "Missing product name",
        })
        continue
      }

      try {
        // Check if product exists
        let productId = findExistingProduct(values, existingProducts)?.id
        let productName = values.name

        // Create product if it doesn't exist
        if (!productId) {
          const createResult = await createPurchaseCatalogProduct(db(), {
            tenantId,
            actorId: session.user.id,
            name: values.name,
            genericName: values.generic_name || null,
            brand: values.name,
            strength: null,
            dosageForm: null,
            unit: values.unit_of_measure || "Tablet",
            barcode: values.barcode || null,
            sku: values.sku || null,
            manufacturer: values.manufacturer || null,
            category: values.category || "General",
            sellingPrice: values.price ? Number(values.price) : 0,
            costPrice: values.cost_price ? Number(values.cost_price) : 0,
            reorderLevel: 10,
            expiryRequired: true,
            createAnyway: true, // Override duplicate check for bulk imports
          })

          if (!createResult.ok) {
            result.failed++
            result.rows.push({
              rowIndex: i,
              status: "failed",
              reason: createResult.error,
              productName: values.name,
            })
            continue
          }

          productId = createResult.product.id
          productName = createResult.product.name
          
          // Add to existing products for subsequent lookups
          existingProducts.push(catalogProductFromRow({
            id: productId,
            name: productName,
            sku: createResult.product.sku,
            barcode: createResult.product.barcode,
            generic_name: createResult.product.genericName,
            manufacturer: createResult.product.manufacturer,
            price: createResult.product.price,
            cost_price: createResult.product.costPrice,
          }))
        }

        // Receive stock if quantity and batch info are provided
        const quantity = values.quantity ? Number(values.quantity) : 0
        const batchNumber = values.batch_number?.trim() || `BATCH-${Date.now()}-${i}`
        const expiryDate = parseDate(values.expiry_date)

        if (quantity > 0 && expiryDate) {
          const { error: receiveError } = await receivePharmacyStock(db(), {
            tenantId,
            productId,
            batchNumber,
            quantity: Math.round(quantity),
            expiryDate,
            costPrice: values.cost_price ? Number(values.cost_price) : null,
            sellingPrice: values.price ? Number(values.price) : null,
            receivedBy: session.user.id,
            supplierId: null,
            supplierRef: `Import: ${importSession.file_name || sessionId}`,
            purchaseOrderId: null,
            storeId: scoped.storeId,
            reason: `Bulk import from ${importSession.source_system || "unknown source"}`,
          })

          if (receiveError) {
            result.failed++
            result.rows.push({
              rowIndex: i,
              status: "failed",
              reason: receiveError.humanMessage,
              productId,
              productName,
            })
            continue
          }
        } else if (quantity > 0 && !expiryDate) {
          // Product created but stock not received due to missing expiry
          result.success++
          result.rows.push({
            rowIndex: i,
            status: "success",
            reason: "Product created but stock not added (missing expiry date)",
            productId,
            productName,
          })
          continue
        }

        result.success++
        result.rows.push({
          rowIndex: i,
          status: "success",
          productId,
          productName,
        })
      } catch (error) {
        result.failed++
        result.rows.push({
          rowIndex: i,
          status: "failed",
          reason: error instanceof Error ? error.message : "Unknown error",
          productName: values.name,
        })
      }
    }

    // Update session status
    const finalStatus = result.failed === 0 ? "complete" : result.success > 0 ? "complete" : "failed"
    const errorMessage =
      result.failed > 0
        ? `${result.failed} row${result.failed === 1 ? "" : "s"} failed to import`
        : null

    await db()
      .from("pharmacy_import_sessions")
      .update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        error_message: errorMessage,
        ai_summary: `Imported ${result.success} product${result.success === 1 ? "" : "s"}, ${result.failed} failed, ${result.skipped} skipped`,
      })
      .eq("id", sessionId)
      .eq("tenant_id", tenantId)

    // Log the import activity
    await db().from("pharmacy_audit_logs").insert({
      tenant_id: tenantId,
      profile_id: session.user.id,
      action: "import.applied",
      entity: "IMPORT_SESSION",
      entity_id: sessionId,
      details: JSON.stringify({
        source: importSession.source_system,
        file: importSession.file_name,
        success: result.success,
        failed: result.failed,
        skipped: result.skipped,
        total: body.allRows.length,
      }),
    })

    return NextResponse.json({
      ok: true,
      result,
      message: `Successfully imported ${result.success} of ${body.allRows.length} rows`,
    })
  } catch (error) {
    console.error("Import apply error:", error)
    const parsed = parsePharmacyRpcError((error as Error)?.message)
    return NextResponse.json(
      { error: parsed.humanMessage, code: parsed.code },
      { status: 500 },
    )
  }
}
