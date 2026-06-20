import { NextRequest, NextResponse } from "next/server"
import { getPharmacySession, isPharmacyAdmin } from "@/lib/auth"
import { gateFeature } from "@synapse/auth/features"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { generateReceiptNumber } from "@/lib/receipt-number"
import { ensureDefaultPharmacyStore } from "@/lib/ensure-default-store"
import { findOrCreateCreditCustomer, postCreditLedgerEntry } from "@/lib/credit-ledger"

interface CartItem {
  productId: string
  quantity: number // Always in base units
  unitPrice: number
  packageName?: string // "Strip", "Box", etc. - null for base unit sales
  packageQuantity?: number // Number of packages sold (e.g., 2 strips)
  batchId?: string // Specific batch to sell from (optional - FIFO if not specified)
}

interface BatchRow {
  id: string
  batch_number: string
  expiry_date: string | null
  cost_price: number | null
  quantity: number
}

interface DeductionRecord {
  batchId: string
  batchNumber: string
  expiryDate: string | null
  costPrice: number | null
  quantity: number
}

// Simple UUID validation
function isValidUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

// FIFO batch deduction - deducts from earliest expiring batches first
async function deductFromBatches(
  tenantId: string,
  productId: string,
  quantityToDeduct: number,
  preferredBatchId?: string
): Promise<DeductionRecord[]> {
  const deductions: DeductionRecord[] = []
  let remaining = quantityToDeduct

  // If a specific batch is preferred, try that first
  if (preferredBatchId && isValidUUID(preferredBatchId)) {
    const { data: preferredBatch } = await supabaseAdmin
      .from("pharmacy_product_batches")
      .select("id, batch_number, expiry_date, cost_price, quantity")
      .eq("id", preferredBatchId)
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .gt("quantity", 0)
      .single()

    if (preferredBatch) {
      const deductAmount = Math.min(remaining, preferredBatch.quantity)

      await supabaseAdmin
        .from("pharmacy_product_batches")
        .update({ quantity: preferredBatch.quantity - deductAmount })
        .eq("id", preferredBatchId)
        .eq("tenant_id", tenantId)

      deductions.push({
        batchId: preferredBatch.id,
        batchNumber: preferredBatch.batch_number,
        expiryDate: preferredBatch.expiry_date,
        costPrice: preferredBatch.cost_price,
        quantity: deductAmount,
      })

      remaining -= deductAmount
    }
  }

  // FIFO: Get remaining batches ordered by expiry date (earliest first)
  if (remaining > 0) {
    let batchQuery = supabaseAdmin
      .from("pharmacy_product_batches")
      .select("id, batch_number, expiry_date, cost_price, quantity")
      .eq("tenant_id", tenantId)
      .eq("product_id", productId)
      .eq("is_active", true)
      .gt("quantity", 0)
      .order("expiry_date", { ascending: true })

    if (preferredBatchId && isValidUUID(preferredBatchId)) {
      batchQuery = batchQuery.neq("id", preferredBatchId)
    }

    const { data: batches } = await batchQuery

    for (const batch of (batches ?? []) as BatchRow[]) {
      if (remaining <= 0) break

      const deductAmount = Math.min(remaining, batch.quantity)

      await supabaseAdmin
        .from("pharmacy_product_batches")
        .update({ quantity: batch.quantity - deductAmount })
        .eq("id", batch.id)
        .eq("tenant_id", tenantId)

      deductions.push({
        batchId: batch.id,
        batchNumber: batch.batch_number,
        expiryDate: batch.expiry_date,
        costPrice: batch.cost_price,
        quantity: deductAmount,
      })

      remaining -= deductAmount
    }
  }

  return deductions
}

export async function POST(request: NextRequest) {
  try {
    const session = await getPharmacySession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tenantId = session.profile.tenant_id
    if (!tenantId) {
      return NextResponse.json({ error: "No tenant" }, { status: 403 })
    }

    const gate = await gateFeature(tenantId, 'pos.sell')
    if (gate) return gate

    const {
      items,
      paymentMethod,
      staffId,
      staffName,
      clientName,
      clientPhone,
      clientAddress,
      transactionNo,
      customerId,
      creditDueDate,
    } = await request.json()

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "No items in cart" }, { status: 400 })
    }

    if (!paymentMethod) {
      return NextResponse.json({ error: "Payment method is required" }, { status: 400 })
    }

    const isCreditSale = String(paymentMethod).toUpperCase() === "CREDIT"

    if (isCreditSale && !clientName?.trim() && !customerId) {
      return NextResponse.json(
        { error: "Credit sales require a customer name or selected customer" },
        { status: 400 }
      )
    }

    await ensureDefaultPharmacyStore(tenantId)

    const { data: storeRow } = await supabaseAdmin
      .from("pharmacy_stores")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle()

    if (!storeRow) {
      return NextResponse.json(
        {
          error: "No pharmacy store configured. Complete onboarding (step 2) or add a store in Settings before using POS.",
          code: "NO_STORE",
        },
        { status: 422 }
      )
    }

    // Use provided staffId if it's a valid UUID, otherwise use session user
    const cashierId =
      typeof staffId === "string" && isValidUUID(staffId) ? staffId : session.user.id

    let totalAmount = 0
    const transactionItems: Array<{
      tenant_id: string
      transaction_id: string // filled after transaction insert
      product_id: string
      batch_id: string | null
      quantity: number
      unit_price: number
      cost_price: number | null
      total_price: number
      package_name: string | null
      package_quantity: number | null
    }> = []

    const productUpdates: Array<{
      productId: string
      previousQty: number
      newQty: number
      quantity: number
      packageName?: string
      packageQuantity?: number
    }> = []

    for (const item of items as CartItem[]) {
      // Fetch product
      const { data: product, error: productError } = await supabaseAdmin
        .from("pharmacy_products")
        .select("id, name, price, cost_price, quantity")
        .eq("id", item.productId)
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .single()

      if (productError || !product) {
        return NextResponse.json(
          { error: `Product not found: ${item.productId}` },
          { status: 400 }
        )
      }

      if (!item.quantity || item.quantity <= 0) {
        return NextResponse.json(
          { error: `Invalid quantity for product ${product.name}` },
          { status: 400 }
        )
      }

      const itemTotal = item.unitPrice * item.quantity
      totalAmount += itemTotal

      // Fetch active batches to see if any exist
      const { data: activeBatches } = await supabaseAdmin
        .from("pharmacy_product_batches")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("product_id", item.productId)
        .eq("is_active", true)
        .gt("quantity", 0)
        .limit(1)

      const hasBatches = (activeBatches ?? []).length > 0

      if (hasBatches) {
        const deductions = await deductFromBatches(
          tenantId,
          item.productId,
          item.quantity,
          item.batchId
        )

        if (deductions.length > 0) {
          let unitsAccountedFor = 0

          for (const d of deductions) {
            transactionItems.push({
              tenant_id: tenantId,
              transaction_id: "", // placeholder
              product_id: item.productId,
              batch_id: d.batchId,
              quantity: d.quantity,
              unit_price: item.unitPrice,
              cost_price: d.costPrice,
              total_price: item.unitPrice * d.quantity,
              package_name: item.packageName ?? null,
              package_quantity:
                deductions.length === 1 ? (item.packageQuantity ?? null) : null,
            })
            unitsAccountedFor += d.quantity
          }

          const remainingUnits = item.quantity - unitsAccountedFor
          if (remainingUnits > 0) {
            transactionItems.push({
              tenant_id: tenantId,
              transaction_id: "",
              product_id: item.productId,
              batch_id: null,
              quantity: remainingUnits,
              unit_price: item.unitPrice,
              cost_price: product.cost_price,
              total_price: item.unitPrice * remainingUnits,
              package_name: item.packageName ?? null,
              package_quantity: null,
            })
          }
        } else {
          // Fallback: batches exist but none had stock
          transactionItems.push({
            tenant_id: tenantId,
            transaction_id: "",
            product_id: item.productId,
            batch_id: null,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            cost_price: product.cost_price,
            total_price: itemTotal,
            package_name: item.packageName ?? null,
            package_quantity: item.packageQuantity ?? null,
          })
        }
      } else {
        // No batches defined
        transactionItems.push({
          tenant_id: tenantId,
          transaction_id: "",
          product_id: item.productId,
          batch_id: null,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          cost_price: product.cost_price,
          total_price: itemTotal,
          package_name: item.packageName ?? null,
          package_quantity: item.packageQuantity ?? null,
        })
      }

      // Update product total quantity
      const newQty = product.quantity - item.quantity
      await supabaseAdmin
        .from("pharmacy_products")
        .update({ quantity: newQty, updated_at: new Date().toISOString() })
        .eq("id", item.productId)
        .eq("tenant_id", tenantId)

      productUpdates.push({
        productId: item.productId,
        previousQty: product.quantity,
        newQty,
        quantity: item.quantity,
        packageName: item.packageName,
        packageQuantity: item.packageQuantity,
      })
    }

    // Tax defaulted to 0 (no settings table in schema)
    const taxRate = 0
    const tax = Math.round(totalAmount * taxRate * 100) / 100
    const netAmount = Math.round((totalAmount + tax) * 100) / 100

    const receiptNo = transactionNo ?? (await generateReceiptNumber(tenantId))

    // Create the transaction
    const { data: transaction, error: txError } = await supabaseAdmin
      .from("pharmacy_transactions")
      .insert({
        tenant_id: tenantId,
        transaction_no: receiptNo,
        cashier_id: cashierId,
        client_name: clientName ?? null,
        client_phone: clientPhone ?? null,
        client_address: clientAddress ?? null,
        total_amount: totalAmount,
        discount: 0,
        tax,
        net_amount: netAmount,
        payment_method: paymentMethod,
        status: "COMPLETED",
        notes: staffName ? `Processed via SYNAPSE PHARM by ${staffName}` : null,
        is_edited: false,
      })
      .select()
      .single()

    if (txError || !transaction) {
      console.error("Transaction insert error:", txError)
      return NextResponse.json(
        { error: "Failed to create transaction" },
        { status: 500 }
      )
    }

    // Insert transaction items (set transaction_id)
    const itemsToInsert = transactionItems.map((ti) => ({
      ...ti,
      transaction_id: transaction.id,
    }))

    const { error: itemsError } = await supabaseAdmin
      .from("pharmacy_transaction_items")
      .insert(itemsToInsert)

    if (itemsError) {
      console.error("Transaction items insert error:", itemsError)
      // Continue — don't fail the whole response; transaction record already created
    }

    // Create stock adjustment records
    for (const update of productUpdates) {
      await supabaseAdmin.from("pharmacy_stock_adjustments").insert({
        tenant_id: tenantId,
        product_id: update.productId,
        quantity: -update.quantity,
        type: "DECREASE",
        reason: `Sale - Transaction ${transaction.transaction_no}${update.packageName ? ` (${update.packageQuantity} ${update.packageName})` : ""}`,
        previous_qty: update.previousQty,
        new_qty: update.newQty,
        created_by: session.user.id,
      })
    }

    // Credit sale: link to customer + ledger entry
    let creditCustomerId: string | null = null
    if (isCreditSale) {
      if (typeof customerId === "string" && isValidUUID(customerId)) {
        creditCustomerId = customerId
      } else {
        creditCustomerId = await findOrCreateCreditCustomer(tenantId, {
          name: clientName ?? "Walk-in customer",
          phone: clientPhone ?? null,
          address: clientAddress ?? null,
        })
      }

      await postCreditLedgerEntry({
        tenantId,
        customerId: creditCustomerId,
        amount: netAmount,
        type: "credit",
        transactionId: transaction.id,
        dueDate: creditDueDate || null,
        notes: `POS sale ${transaction.transaction_no}`,
        createdBy: session.user.id,
      })
    }

    // Create audit log
    try {
      await supabaseAdmin.from("pharmacy_audit_logs").insert({
        tenant_id: tenantId,
        profile_id: session.user.id,
        action: "COMPLETE_TRANSACTION",
        entity: "TRANSACTION",
        entity_id: transaction.id,
        details: `Completed transaction ${transaction.transaction_no}`,
      })
    } catch (auditError) {
      console.warn("Failed to create audit log:", auditError)
    }

    // Fetch items with product info for the response
    const { data: responseItems } = await supabaseAdmin
      .from("pharmacy_transaction_items")
      .select(`
        *,
        product:pharmacy_products ( id, name, sku, strength, dosage_form ),
        batch:pharmacy_product_batches ( id, batch_number, expiry_date )
      `)
      .eq("transaction_id", transaction.id)
      .eq("tenant_id", tenantId)

    return NextResponse.json({
      transaction: {
        id: transaction.id,
        transactionNo: transaction.transaction_no,
        createdAt: transaction.created_at,
        clientName: transaction.client_name,
        clientPhone: transaction.client_phone,
        clientAddress: transaction.client_address,
        totalAmount: transaction.total_amount,
        tax: transaction.tax,
        netAmount: transaction.net_amount,
        paymentMethod: transaction.payment_method,
        status: transaction.status,
        items: (responseItems ?? []).map((item: any) => ({
          id: item.id,
          quantity: item.quantity,
          unitPrice: Number(item.unit_price),
          totalPrice: Number(item.total_price),
          packageName: item.package_name,
          packageQuantity: item.package_quantity,
          product: item.product
            ? {
                id: item.product.id,
                name: item.product.name,
                sku: item.product.sku,
                strength: item.product.strength,
                dosageForm: item.product.dosage_form,
              }
            : null,
          batch: item.batch
            ? {
                id: item.batch.id,
                batchNumber: item.batch.batch_number,
                expiryDate: item.batch.expiry_date,
              }
            : null,
        })),
      },
    })
  } catch (error) {
    console.error("Transaction error:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    const errorStack = error instanceof Error ? error.stack : ""
    console.error("Error details:", { message: errorMessage, stack: errorStack })

    return NextResponse.json(
      {
        error: errorMessage || "Failed to process transaction",
        details:
          process.env.NODE_ENV === "development"
            ? { message: errorMessage, stack: errorStack }
            : undefined,
      },
      { status: 500 }
    )
  }
}
