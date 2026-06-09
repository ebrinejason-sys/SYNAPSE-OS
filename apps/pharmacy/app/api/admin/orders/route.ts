import { NextRequest, NextResponse } from "next/server"
import { getPharmacySession, isPharmacyAdmin, hasPermission } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { generateOrderNo, generateTransactionNo } from "@/lib/utils"

export async function GET(request: NextRequest) {
  try {
    const session = await getPharmacySession()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const tenantId = session.profile.tenant_id
    if (!tenantId) return NextResponse.json({ error: "Tenant not found" }, { status: 400 })

    const supabase = await createClient()

    const { data: orders, error } = await supabase
      .from("pharmacy_orders")
      .select(
        `
        *,
        customer:pharmacy_customers(name, email, phone),
        items:pharmacy_order_items(
          id, product_id, product_name, quantity, unit_price, total_price
        )
      `
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching orders:", error)
      return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 })
    }

    // Get claimed-by and processed-by user names from auth
    const profileIds = new Set<string>()
    for (const order of orders ?? []) {
      if (order.claimed_by) profileIds.add(order.claimed_by)
      if (order.processed_by) profileIds.add(order.processed_by)
    }

    const profileNameMap = new Map<string, string>()
    if (profileIds.size > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, first_name, last_name")
        .in("id", Array.from(profileIds))

      for (const p of profiles ?? []) {
        profileNameMap.set(
          p.id,
          p.full_name ?? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() ?? p.id
        )
      }
    }

    const enrichedOrders = (orders ?? []).map((order) => ({
      ...order,
      processedByUser: order.processed_by ? { name: profileNameMap.get(order.processed_by) ?? null } : null,
      claimedByUser: order.claimed_by ? { name: profileNameMap.get(order.claimed_by) ?? null } : null,
    }))

    const stats = {
      pending: enrichedOrders.filter((o) => o.status === "PENDING").length,
      completed: enrichedOrders.filter((o) => o.status === "COMPLETED").length,
      cancelled: enrichedOrders.filter((o) => o.status === "CANCELLED").length,
      totalRevenue: enrichedOrders
        .filter((o) => o.status === "COMPLETED")
        .reduce((sum, o) => sum + (o.total_amount ?? 0), 0),
      supplierOrders: enrichedOrders.filter((o) => o.order_type === "SUPPLIER").length,
      customerOrders: enrichedOrders.filter((o) => o.order_type === "CUSTOMER").length,
      onlineOrders: enrichedOrders.filter((o) => o.is_online_order === true).length,
      unclaimedOrders: enrichedOrders.filter(
        (o) => o.is_online_order === true && !o.claimed_by && o.status === "PENDING"
      ).length,
    }

    return NextResponse.json({ orders: enrichedOrders, stats })
  } catch (error) {
    console.error("Error fetching orders:", error)
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getPharmacySession()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (!isPharmacyAdmin(session) && !hasPermission(session, "MANAGE_ORDERS")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tenantId = session.profile.tenant_id
    if (!tenantId) return NextResponse.json({ error: "Tenant not found" }, { status: 400 })

    const data = await request.json()
    const { customerId, customerName, customerPhone, orderType = "CUSTOMER", items, notes, deliveryAddress } = data

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Items are required" }, { status: 400 })
    }

    const supabase = await createClient()

    let finalCustomerId: string | null = customerId ?? null

    // If customer order with no existing customer, create one
    if (orderType === "CUSTOMER" && !customerId && customerName) {
      const { data: newCustomer, error: customerError } = await supabaseAdmin
        .from("pharmacy_customers")
        .insert({
          tenant_id: tenantId,
          name: customerName,
          email: `${customerName.toLowerCase().replace(/\s+/g, ".")}@temp.local`,
          phone: customerPhone ?? null,
          is_active: true,
        })
        .select("id")
        .single()

      if (customerError || !newCustomer) {
        console.error("Error creating customer:", customerError)
        return NextResponse.json({ error: "Failed to create customer" }, { status: 500 })
      }
      finalCustomerId = newCustomer.id
    }

    // Calculate total and validate stock
    let totalAmount = 0
    const orderItems: Array<{
      tenant_id: string
      product_id: string | null
      product_name: string
      quantity: number
      unit_price: number
      total_price: number
    }> = []

    for (const item of items as Array<{
      productId?: string
      productName?: string
      quantity: number
      unitPrice?: number
    }>) {
      const unitPrice = item.unitPrice ?? 0
      const totalPrice = unitPrice * item.quantity
      totalAmount += totalPrice

      if (orderType === "CUSTOMER" && item.productId) {
        const { data: product } = await supabase
          .from("pharmacy_products")
          .select("quantity, name")
          .eq("id", item.productId)
          .eq("tenant_id", tenantId)
          .single()

        if (product && product.quantity < item.quantity) {
          return NextResponse.json(
            { error: `Insufficient stock for ${product.name}. Available: ${product.quantity}` },
            { status: 400 }
          )
        }
      }

      orderItems.push({
        tenant_id: tenantId,
        product_id: item.productId ?? null,
        product_name: item.productName ?? "",
        quantity: item.quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
      })
    }

    // Generate order number
    // Use REQ prefix for supplier orders, ORD for customer orders
    const orderNo = orderType === "SUPPLIER"
      ? `REQ-${Date.now().toString(36).toUpperCase()}`
      : generateOrderNo()

    // Create order
    const { data: order, error: orderError } = await supabaseAdmin
      .from("pharmacy_orders")
      .insert({
        tenant_id: tenantId,
        order_no: orderNo,
        order_type: orderType,
        customer_id: finalCustomerId,
        total_amount: totalAmount,
        status: "PENDING",
        payment_status: "UNPAID",
        notes: notes ?? null,
        delivery_address: deliveryAddress ?? null,
      })
      .select("id, order_no, status, total_amount, customer_id")
      .single()

    if (orderError || !order) {
      console.error("Error creating order:", orderError)
      return NextResponse.json({ error: "Failed to create order" }, { status: 500 })
    }

    // Insert order items
    const itemsWithOrderId = orderItems.map((item) => ({
      ...item,
      order_id: order.id,
    }))

    const { error: itemsError } = await supabaseAdmin.from("pharmacy_order_items").insert(itemsWithOrderId)

    if (itemsError) {
      console.error("Error creating order items:", itemsError)
      // Rollback order
      await supabaseAdmin.from("pharmacy_orders").delete().eq("id", order.id).eq("tenant_id", tenantId)
      return NextResponse.json({ error: "Failed to create order items" }, { status: 500 })
    }

    // Create audit log
    await supabaseAdmin.from("pharmacy_audit_logs").insert({
      tenant_id: tenantId,
      profile_id: session.user.id,
      action: orderType === "SUPPLIER" ? "CREATE_SUPPLIER_ORDER" : "CREATE_CUSTOMER_ORDER",
      entity: "Order",
      entity_id: order.id,
      details:
        orderType === "SUPPLIER"
          ? `Created supplier requisition ${orderNo}`
          : `Created customer order ${orderNo}`,
    })

    return NextResponse.json(order, { status: 201 })
  } catch (error) {
    console.error("Error creating order:", error)
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getPharmacySession()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (!isPharmacyAdmin(session) && !hasPermission(session, "MANAGE_ORDERS")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tenantId = session.profile.tenant_id
    if (!tenantId) return NextResponse.json({ error: "Tenant not found" }, { status: 400 })

    const data = await request.json()
    const { id, status } = data as { id: string; status: string }

    if (!id || !status) {
      return NextResponse.json({ error: "Order ID and status are required" }, { status: 400 })
    }

    if (!["PENDING", "PROCESSING", "COMPLETED", "CANCELLED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: order, error: orderFetchError } = await supabase
      .from("pharmacy_orders")
      .select("id, order_no, order_type, total_amount, customer_id, status, items:pharmacy_order_items(*)")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .single()

    if (orderFetchError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    // Update order status
    const { data: updatedOrder, error: updateError } = await supabaseAdmin
      .from("pharmacy_orders")
      .update({
        status,
        processed_by: status !== "PENDING" ? session.user.id : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select()
      .single()

    if (updateError) {
      console.error("Error updating order:", updateError)
      return NextResponse.json({ error: "Failed to update order" }, { status: 500 })
    }

    // If completing a customer order, create transaction and deduct stock
    if (status === "COMPLETED" && order.order_type === "CUSTOMER") {
      const itemsWithProducts = (order.items as Array<{
        id: string
        product_id: string | null
        product_name: string
        quantity: number
        unit_price: number
        total_price: number
      }>).filter((item) => item.product_id !== null)

      if (itemsWithProducts.length > 0) {
        const transactionNo = generateTransactionNo()

        const { data: transaction, error: txError } = await supabaseAdmin
          .from("pharmacy_transactions")
          .insert({
            tenant_id: tenantId,
            transaction_no: transactionNo,
            cashier_id: session.user.id,
            total_amount: order.total_amount,
            discount: 0,
            tax: 0,
            net_amount: order.total_amount,
            payment_method: "CASH",
            status: "COMPLETED",
          })
          .select("id")
          .single()

        if (txError || !transaction) {
          console.error("Error creating transaction:", txError)
        } else {
          // Insert transaction items
          await supabaseAdmin.from("pharmacy_transaction_items").insert(
            itemsWithProducts.map((item) => ({
              tenant_id: tenantId,
              transaction_id: transaction.id,
              product_id: item.product_id!,
              quantity: item.quantity,
              unit_price: item.unit_price,
              cost_price: 0,
              total_price: item.total_price,
            }))
          )

          // Deduct stock
          for (const item of itemsWithProducts) {
            if (!item.product_id) continue

            const { data: product } = await supabase
              .from("pharmacy_products")
              .select("quantity")
              .eq("id", item.product_id)
              .eq("tenant_id", tenantId)
              .single()

            const previousQty = product?.quantity ?? 0
            const newQty = previousQty - item.quantity

            await supabaseAdmin
              .from("pharmacy_products")
              .update({ quantity: newQty, updated_at: new Date().toISOString() })
              .eq("id", item.product_id)
              .eq("tenant_id", tenantId)

            await supabaseAdmin.from("pharmacy_stock_adjustments").insert({
              tenant_id: tenantId,
              product_id: item.product_id,
              quantity: -item.quantity,
              type: "DECREASE",
              reason: `Order ${order.order_no} completed`,
              previous_qty: previousQty,
              new_qty: newQty,
              created_by: session.user.id,
            })
          }
        }
      }
    }

    // Clean up notifications when order is completed or cancelled
    if (status === "COMPLETED" || status === "CANCELLED") {
      await supabaseAdmin
        .from("pharmacy_notifications")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("related_id", id)
        .eq("type", "NEW_ORDER")

      await supabaseAdmin
        .from("pharmacy_notifications")
        .update({ is_read: true })
        .eq("tenant_id", tenantId)
        .eq("related_id", id)
        .eq("type", "ORDER_CLAIMED")
    }

    // Create audit log
    await supabaseAdmin.from("pharmacy_audit_logs").insert({
      tenant_id: tenantId,
      profile_id: session.user.id,
      action: "UPDATE_ORDER",
      entity: "Order",
      entity_id: order.id,
      details: `Changed status to ${status}`,
    })

    return NextResponse.json(updatedOrder)
  } catch (error) {
    console.error("Error updating order:", error)
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getPharmacySession()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (!isPharmacyAdmin(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tenantId = session.profile.tenant_id
    if (!tenantId) return NextResponse.json({ error: "Tenant not found" }, { status: 400 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: order, error: orderFetchError } = await supabase
      .from("pharmacy_orders")
      .select("id, order_no, status")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .single()

    if (orderFetchError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    if (order.status === "COMPLETED") {
      return NextResponse.json({ error: "Cannot delete completed orders" }, { status: 400 })
    }

    // Delete notifications related to this order
    await supabaseAdmin
      .from("pharmacy_notifications")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("related_id", id)

    // Delete order items
    await supabaseAdmin
      .from("pharmacy_order_items")
      .delete()
      .eq("order_id", id)
      .eq("tenant_id", tenantId)

    // Delete order
    await supabaseAdmin
      .from("pharmacy_orders")
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenantId)

    // Create audit log
    await supabaseAdmin.from("pharmacy_audit_logs").insert({
      tenant_id: tenantId,
      profile_id: session.user.id,
      action: "DELETE_ORDER",
      entity: "Order",
      entity_id: id,
      details: `Deleted order ${order.order_no}`,
    })

    return NextResponse.json({ message: "Order deleted successfully" })
  } catch (error) {
    console.error("Error deleting order:", error)
    return NextResponse.json({ error: "Failed to delete order" }, { status: 500 })
  }
}
