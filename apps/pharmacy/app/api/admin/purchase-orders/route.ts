import { NextRequest, NextResponse } from "next/server"
import { isPharmacyAdmin } from "@/lib/auth"
import { requirePharmacyPermission } from "@/lib/api-auth"
import { mapPurchaseOrder } from "@/lib/api-serialize"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { sendEmail } from "@/lib/email"
import { receivePharmacyPurchase } from "@synapse/db/pharmacy-purchases"

function generatePurchaseOrderNo(): string {
  const prefix = "PO"
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${prefix}-${timestamp}-${random}`
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePharmacyPermission("purchasing.manage")
  if (!auth.ok) return auth.response
  const { session, tenantId } = auth

    if (!tenantId) return NextResponse.json({ error: "Tenant not found" }, { status: 400 })

    const { searchParams } = new URL(request.url)
    const supplierId = searchParams.get("supplierId")

    let query = (supabaseAdmin as any)
      .from("pharmacy_purchase_orders")
      .select(
        `
        *,
        supplier:pharmacy_suppliers(id, name, email, phone),
        items:pharmacy_purchase_order_items(
          id, product_id, product_name, quantity, received_quantity, unit_price, total_price
        )
      `
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })

    if (supplierId) {
      query = query.eq("supplier_id", supplierId)
    }

    const { data: purchaseOrders, error } = await query

    if (error) {
      console.error("Get purchase orders error:", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    const creatorIds = new Set<string>()
    for (const po of purchaseOrders ?? []) {
      if (po.created_by) creatorIds.add(po.created_by)
    }

    const nameMap = new Map<string, string>()
    if (creatorIds.size > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, first_name, last_name")
        .in("id", Array.from(creatorIds))

      for (const p of profiles ?? []) {
        nameMap.set(
          p.id,
          p.full_name ??
            `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() ??
            p.id,
        )
      }
    }

    return NextResponse.json(
      (purchaseOrders ?? []).map((row: Record<string, unknown>) =>
        mapPurchaseOrder(
          row,
          row.created_by
            ? nameMap.get(String(row.created_by)) ?? "Unknown"
            : "Unknown",
        ),
      ),
    )
  } catch (error) {
    console.error("Get purchase orders error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePharmacyPermission("purchasing.manage")
  if (!auth.ok) return auth.response
  const { session, tenantId } = auth

    if (!tenantId) return NextResponse.json({ error: "Tenant not found" }, { status: 400 })

    const { supplierId, items, notes, expectedDate, sendEmailToSupplier } = await request.json()

    if (!supplierId || !items || items.length === 0) {
      return NextResponse.json({ error: "Supplier and items are required" }, { status: 400 })
    }

    const { data: supplier, error: supplierError } = await (supabaseAdmin as any)
      .from("pharmacy_suppliers")
      .select("id, name, email, contact_person")
      .eq("tenant_id", tenantId)
      .eq("id", supplierId)
      .single()

    if (supplierError || !supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 })
    }

    const totalAmount = (items as Array<{ quantity: number; unitPrice: number }>).reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    )

    const orderNo = generatePurchaseOrderNo()

    const { data: purchaseOrder, error: poError } = await supabaseAdmin
      .from("pharmacy_purchase_orders")
      .insert({
        tenant_id: tenantId,
        order_no: orderNo,
        supplier_id: supplierId,
        total_amount: totalAmount,
        notes: notes ?? null,
        expected_date: expectedDate ? new Date(expectedDate).toISOString() : null,
        created_by: session.user.id,
        status: sendEmailToSupplier ? "SENT" : "DRAFT",
        email_sent: sendEmailToSupplier ?? false,
        email_sent_at: sendEmailToSupplier ? new Date().toISOString() : null,
      })
      .select("id, order_no, status, total_amount")
      .single()

    if (poError || !purchaseOrder) {
      console.error("Error creating purchase order:", poError)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    // Insert purchase order items
    const poItems = (items as Array<{
      productId?: string
      productName: string
      quantity: number
      unitPrice: number
    }>).map((item) => ({
      tenant_id: tenantId,
      purchase_order_id: purchaseOrder.id,
      product_id: item.productId ?? null,
      product_name: item.productName,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total_price: item.quantity * item.unitPrice,
    }))

    const { error: itemsError } = await supabaseAdmin.from("pharmacy_purchase_order_items").insert(poItems)

    if (itemsError) {
      console.error("Error creating PO items:", itemsError)
      await supabaseAdmin.from("pharmacy_purchase_orders").delete().eq("id", purchaseOrder.id).eq("tenant_id", tenantId)
      return NextResponse.json({ error: "Failed to create purchase order items" }, { status: 500 })
    }

    // Send email to supplier if requested
    if (sendEmailToSupplier && supplier.email) {
      const itemsTable = poItems
        .map(
          (item) =>
            `<tr>
          <td style="padding: 10px; border: 1px solid #ddd;">${item.product_name}</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${item.quantity}</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">USh ${item.unit_price.toLocaleString()}</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">USh ${item.total_price.toLocaleString()}</td>
        </tr>`
        )
        .join("")

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #7c3aed 0%, #2563eb 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">Purchase Order</h1>
            <p style="color: rgba(255,255,255,0.9); margin-top: 10px;">From SYNAPSE Pharm</p>
          </div>
          <div style="padding: 30px; background: #f9fafb;">
            <div style="background: white; padding: 25px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
              <p>Dear ${supplier.contact_person ?? supplier.name},</p>
              <p>We would like to place the following order:</p>
              <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0;"><strong>Order Number:</strong> ${orderNo}</p>
                <p style="margin: 10px 0 0;"><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                ${expectedDate ? `<p style="margin: 10px 0 0;"><strong>Expected Delivery:</strong> ${new Date(expectedDate).toLocaleDateString()}</p>` : ""}
              </div>
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <thead>
                  <tr style="background: #7c3aed; color: white;">
                    <th style="padding: 12px; text-align: left;">Product</th>
                    <th style="padding: 12px; text-align: center;">Quantity</th>
                    <th style="padding: 12px; text-align: right;">Unit Price</th>
                    <th style="padding: 12px; text-align: right;">Total</th>
                  </tr>
                </thead>
                <tbody>${itemsTable}</tbody>
                <tfoot>
                  <tr style="background: #f3f4f6; font-weight: bold;">
                    <td colspan="3" style="padding: 12px; text-align: right;">Total Amount:</td>
                    <td style="padding: 12px; text-align: right;">USh ${totalAmount.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
              ${notes ? `<div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;"><p style="margin: 0;"><strong>Notes:</strong></p><p style="margin: 5px 0 0;">${notes}</p></div>` : ""}
              <p>Please confirm receipt of this order and provide an estimated delivery date.</p>
              <p>Thank you for your continued partnership.</p>
              <p>Best regards,<br><strong>SYNAPSE Pharm</strong></p>
            </div>
          </div>
          <div style="padding: 20px; text-align: center; color: #6b7280; font-size: 12px;">
            <p>This is an automated message from SYNAPSE Pharm System</p>
          </div>
        </div>
      `

      await sendEmail({
        to: supplier.email,
        subject: `Purchase Order ${orderNo} - SYNAPSE Pharm`,
        html: emailHtml,
      })
    }

    // Audit log
    await supabaseAdmin.from("pharmacy_audit_logs").insert({
      tenant_id: tenantId,
      profile_id: session.user.id,
      action: "CREATE_PURCHASE_ORDER",
      entity: "PURCHASE_ORDER",
      entity_id: purchaseOrder.id,
      details: `Created PO ${orderNo} for ${supplier.name}${sendEmailToSupplier ? " (email sent)" : ""}`,
    })

    return NextResponse.json({
      success: true,
      purchaseOrder: mapPurchaseOrder(
        {
          ...(purchaseOrder as Record<string, unknown>),
          supplier: {
            id: supplier.id,
            name: supplier.name,
            email: supplier.email,
            phone: null,
          },
          items: [],
          expected_date: expectedDate ? new Date(expectedDate).toISOString() : null,
          notes: notes ?? null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        session.fullName || session.email || "Unknown",
      ),
    })
  } catch (error) {
    console.error("Create purchase order error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requirePharmacyPermission("purchasing.manage")
  if (!auth.ok) return auth.response
  const { session, tenantId } = auth

    if (!tenantId) return NextResponse.json({ error: "Tenant not found" }, { status: 400 })

    const body = await request.json()
    const {
      id,
      status,
      sendEmail: shouldSendEmail,
      receiptItems,
    } = body as {
      id?: string
      status?: string
      sendEmail?: boolean
      receiptItems?: Array<{
        productId: string
        batchNumber: string
        expiryDate: string
        quantity?: number
        costPrice?: number
      }>
    }

    if (!id) {
      return NextResponse.json({ error: "Purchase order ID required" }, { status: 400 })
    }

    const { data: purchaseOrder, error: poFetchError } = await (supabaseAdmin as any)
      .from("pharmacy_purchase_orders")
      .select(
        `
        id, order_no, total_amount, email_sent, status, supplier_id,
        supplier:pharmacy_suppliers(name, email, contact_person),
        items:pharmacy_purchase_order_items(id, product_id, product_name, quantity, received_quantity, unit_price, total_price)
      `
      )
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .single()

    if (poFetchError || !purchaseOrder) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (status) updateData.status = status

    const supplier = purchaseOrder.supplier as unknown as { name: string; email: string | null; contact_person: string | null } | null
    let receivedSummary: Array<{ productId: string; batchId: string; quantity: number }> = []

    // Receiving MUST go through receive_pharmacy_stock via pharmacy_purchases.
    if (status === "RECEIVED" || status === "PARTIALLY_RECEIVED") {
      if (purchaseOrder.status === "RECEIVED") {
        return NextResponse.json({ error: "Purchase order already received" }, { status: 409 })
      }

      const poItems = purchaseOrder.items as Array<{
        id: string
        product_id: string | null
        product_name: string
        quantity: number
        unit_price: number
        total_price: number
        received_quantity?: number
      }>

      const linkedItems = poItems.filter((i) => i.product_id)
      if (linkedItems.length === 0) {
        return NextResponse.json(
          { error: "No product-linked lines to receive. Link products on the PO first." },
          { status: 400 },
        )
      }

      if (!receiptItems || receiptItems.length === 0) {
        return NextResponse.json(
          {
            error:
              "Receiving a purchase order requires per-line batch numbers and expiry dates. Status RECEIVED cannot bypass authoritative receiving.",
            code: "REQUIRES_BATCH",
            required: linkedItems.map((i) => ({
              productId: i.product_id,
              productName: i.product_name,
              quantity: i.quantity,
            })),
          },
          { status: 400 },
        )
      }

      const lines = receiptItems
        .map((receipt) => {
          const line = linkedItems.find((item) => item.product_id === receipt.productId)
          if (!line) return null
          const qty = Math.trunc(Number(receipt.quantity ?? line.quantity))
          if (!(qty > 0)) return null
          return {
            clientItemId: line.id,
            productId: line.product_id as string,
            productName: line.product_name,
            quantity: qty,
            unitCost: receipt.costPrice ?? line.unit_price,
            batchNumber: receipt.batchNumber,
            expiryDate: receipt.expiryDate,
            purchaseOrderItemId: line.id,
          }
        })
        .filter((line): line is NonNullable<typeof line> => Boolean(line))

      const missing = lines.find((line) => !line.batchNumber?.trim() || !line.expiryDate)
      if (missing || lines.length === 0) {
        return NextResponse.json(
          { error: "Each received line needs a batch number, expiry date, and quantity.", code: "REQUIRES_BATCH" },
          { status: 400 },
        )
      }

      const result = await receivePharmacyPurchase(supabaseAdmin as any, {
        tenantId,
        actorId: session.user.id,
        supplierId: purchaseOrder.supplier_id,
        supplierInvoiceNo: purchaseOrder.order_no,
        purchaseOrderId: purchaseOrder.id,
        idempotencyKey: `po-receive:${purchaseOrder.id}:${lines.map((l) => `${l.productId}:${l.batchNumber}:${l.quantity}`).join("|")}`,
        receiveNow: true,
        lines,
      })
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error, code: result.code, detail: "detail" in result ? result.detail : undefined },
          { status: 400 },
        )
      }
      receivedSummary = result.received.map((row) => ({
        productId: row.productId,
        batchId: row.batchId,
        quantity: row.quantity,
      }))
      delete updateData.status
    }

    // Send email to supplier if requested and not already sent
    if (shouldSendEmail && !purchaseOrder.email_sent && supplier?.email) {
      const poItems = purchaseOrder.items as Array<{
        product_name: string
        quantity: number
        unit_price: number
        total_price: number
      }>

      const itemsTable = poItems
        .map(
          (item) =>
            `<tr>
          <td style="padding: 10px; border: 1px solid #ddd;">${item.product_name}</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${item.quantity}</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">USh ${item.unit_price.toLocaleString()}</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">USh ${item.total_price.toLocaleString()}</td>
        </tr>`
        )
        .join("")

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #7c3aed 0%, #2563eb 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">Purchase Order</h1>
          </div>
          <div style="padding: 30px;">
            <p>Dear ${supplier.contact_person ?? supplier.name},</p>
            <p>Please find our purchase order details below:</p>
            <p><strong>Order Number:</strong> ${purchaseOrder.order_no}</p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <thead>
                <tr style="background: #7c3aed; color: white;">
                  <th style="padding: 12px;">Product</th>
                  <th style="padding: 12px;">Quantity</th>
                  <th style="padding: 12px;">Unit Price</th>
                  <th style="padding: 12px;">Total</th>
                </tr>
              </thead>
              <tbody>${itemsTable}</tbody>
              <tfoot>
                <tr style="background: #f3f4f6; font-weight: bold;">
                  <td colspan="3" style="padding: 12px; text-align: right;">Total:</td>
                  <td style="padding: 12px;">USh ${(purchaseOrder.total_amount as number).toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
            <p>Best regards,<br>SYNAPSE Pharm</p>
          </div>
        </div>
      `

      await sendEmail({
        to: supplier.email,
        subject: `Purchase Order ${purchaseOrder.order_no} - SYNAPSE Pharm`,
        html: emailHtml,
      })

      updateData.email_sent = true
      updateData.email_sent_at = new Date().toISOString()
      updateData.status = "SENT"
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("pharmacy_purchase_orders")
      .update(updateData)
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select()
      .single()

    if (updateError) {
      console.error("Error updating purchase order:", updateError)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    // Audit log
    await supabaseAdmin.from("pharmacy_audit_logs").insert({
      tenant_id: tenantId,
      profile_id: session.user.id,
      action: "UPDATE_PURCHASE_ORDER",
      entity: "PURCHASE_ORDER",
      entity_id: id,
      details: `Updated PO ${purchaseOrder.order_no} status to ${(updateData.status as string) ?? status}`,
    })

    return NextResponse.json({
      success: true,
      purchaseOrder: updated,
      received: receivedSummary.length > 0 ? receivedSummary : undefined,
    })
  } catch (error) {
    console.error("Update purchase order error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requirePharmacyPermission("purchasing.manage")
  if (!auth.ok) return auth.response
  const { session, tenantId } = auth

    if (!isPharmacyAdmin(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!tenantId) return NextResponse.json({ error: "Tenant not found" }, { status: 400 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Purchase order ID required" }, { status: 400 })
    }

    const { data: purchaseOrder, error: poFetchError } = await (supabaseAdmin as any)
      .from("pharmacy_purchase_orders")
      .select("id, order_no, status")
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .single()

    if (poFetchError || !purchaseOrder) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 })
    }

    if (purchaseOrder.status === "RECEIVED") {
      return NextResponse.json(
        { error: "Cannot delete a received purchase order" },
        { status: 400 }
      )
    }

    // Delete items first
    await supabaseAdmin
      .from("pharmacy_purchase_order_items")
      .delete()
      .eq("purchase_order_id", id)
      .eq("tenant_id", tenantId)

    // Delete purchase order
    await supabaseAdmin
      .from("pharmacy_purchase_orders")
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenantId)

    // Audit log
    await supabaseAdmin.from("pharmacy_audit_logs").insert({
      tenant_id: tenantId,
      profile_id: session.user.id,
      action: "DELETE_PURCHASE_ORDER",
      entity: "PURCHASE_ORDER",
      entity_id: id,
      details: `Deleted PO ${purchaseOrder.order_no}`,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete purchase order error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
