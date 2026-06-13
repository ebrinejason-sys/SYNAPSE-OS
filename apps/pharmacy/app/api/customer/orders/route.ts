import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { sendEmail } from "@/lib/email"

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    minimumFractionDigits: 0,
  }).format(amount)
}

// Get customer's orders
export async function GET(request: NextRequest) {
  try {
    const customerId = request.headers.get("x-customer-id")
    const tenantId = request.headers.get("x-tenant-id")

    if (!customerId || !tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: orders, error } = await supabaseAdmin
      .from("pharmacy_orders")
      .select(
        `
        *,
        items:pharmacy_order_items(
          id, product_id, product_name, quantity, unit_price, total_price
        )
      `
      )
      .eq("tenant_id", tenantId)
      .eq("customer_id", customerId)
      .eq("is_online_order", true)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Get customer orders error:", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    // Get claimed_by user names
    const claimedByIds = (orders ?? [])
      .filter((o) => o.claimed_by)
      .map((o) => o.claimed_by as string)

    const profileNameMap = new Map<string, string>()
    if (claimedByIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, first_name, last_name")
        .in("id", claimedByIds)

      for (const p of profiles ?? []) {
        profileNameMap.set(
          p.id,
          p.full_name ?? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() ?? p.id
        )
      }
    }

    const enrichedOrders = (orders ?? []).map((order) => ({
      ...order,
      claimedByUser: order.claimed_by ? { name: profileNameMap.get(order.claimed_by) ?? null } : null,
    }))

    return NextResponse.json(enrichedOrders)
  } catch (error) {
    console.error("Get customer orders error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Place a new order
export async function POST(request: NextRequest) {
  try {
    const customerId = request.headers.get("x-customer-id")
    const tenantId = request.headers.get("x-tenant-id")

    if (!customerId || !tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { items, notes, deliveryAddress } = await request.json()

    if (!items || (items as unknown[]).length === 0) {
      return NextResponse.json({ error: "Items are required" }, { status: 400 })
    }

    // Get customer info
    const { data: customer, error: customerError } = await supabaseAdmin
      .from("pharmacy_customers")
      .select("id, name, email, address, is_active")
      .eq("id", customerId)
      .eq("tenant_id", tenantId)
      .single()

    if (customerError || !customer || !customer.is_active) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }

    // Validate products and calculate total
    let totalAmount = 0
    const orderItems: Array<{
      tenant_id: string
      product_id: string
      product_name: string
      quantity: number
      unit_price: number
      total_price: number
    }> = []

    for (const item of items as Array<{ productId: string; quantity: number }>) {
      const { data: product, error: productError } = await supabaseAdmin
        .from("pharmacy_products")
        .select("id, name, price, quantity, is_active")
        .eq("id", item.productId)
        .eq("tenant_id", tenantId)
        .single()

      if (productError || !product || !product.is_active) {
        return NextResponse.json({ error: `Product ${item.productId} not found` }, { status: 400 })
      }

      if (product.quantity < item.quantity) {
        return NextResponse.json(
          { error: `Insufficient stock for ${product.name}. Available: ${product.quantity}` },
          { status: 400 }
        )
      }

      const totalPrice = product.price * item.quantity
      totalAmount += totalPrice

      orderItems.push({
        tenant_id: tenantId,
        product_id: product.id,
        product_name: product.name,
        quantity: item.quantity,
        unit_price: product.price,
        total_price: totalPrice,
      })
    }

    // Generate order number (ONLINE prefix, sequential)
    const { data: lastOnlineOrder } = await supabaseAdmin
      .from("pharmacy_orders")
      .select("order_no")
      .eq("tenant_id", tenantId)
      .like("order_no", "ONLINE-%")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    let orderNo = "ONLINE-0001"
    if (lastOnlineOrder?.order_no) {
      const parts = lastOnlineOrder.order_no.split("-")
      const lastNum = parseInt(parts[1] ?? "0", 10)
      orderNo = `ONLINE-${String(lastNum + 1).padStart(4, "0")}`
    }

    // Create order
    const { data: order, error: orderError } = await supabaseAdmin
      .from("pharmacy_orders")
      .insert({
        tenant_id: tenantId,
        order_no: orderNo,
        customer_id: customerId,
        order_type: "CUSTOMER",
        total_amount: totalAmount,
        status: "PENDING",
        payment_status: "UNPAID",
        notes: notes ?? null,
        delivery_address: deliveryAddress ?? customer.address ?? null,
        is_online_order: true,
      })
      .select("id, order_no, total_amount, status")
      .single()

    if (orderError || !order) {
      console.error("Error creating order:", orderError)
      return NextResponse.json({ error: "Failed to create order" }, { status: 500 })
    }

    // Insert order items
    const { error: itemsError } = await supabaseAdmin
      .from("pharmacy_order_items")
      .insert(orderItems.map((item) => ({ ...item, order_id: order.id })))

    if (itemsError) {
      console.error("Error creating order items:", itemsError)
      await supabaseAdmin.from("pharmacy_orders").delete().eq("id", order.id).eq("tenant_id", tenantId)
      return NextResponse.json({ error: "Failed to create order items" }, { status: 500 })
    }

    // Notify all eligible staff via pharmacy_notifications
    const { data: eligibleSettings } = await supabaseAdmin
      .from("pharmacy_user_settings")
      .select("profile_id, pharmacy_role, permissions")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)

    const notifiableProfileIds = (eligibleSettings ?? [])
      .filter(
        (s) =>
          s.pharmacy_role === "pharmacy_admin" ||
          s.pharmacy_role === "pharmacy_ceo" ||
          (s.permissions as string[])?.includes("CLAIM_ORDERS") ||
          (s.permissions as string[])?.includes("MANAGE_POS")
      )
      .map((s) => s.profile_id)

    if (notifiableProfileIds.length > 0) {
      const notifications = notifiableProfileIds.map((profileId) => ({
        tenant_id: tenantId,
        profile_id: profileId,
        type: "NEW_ORDER",
        title: "New Customer Order",
        message: `New online order ${orderNo} from ${customer.name} for ${formatCurrency(totalAmount)}`,
        related_id: order.id,
        is_read: false,
      }))

      await supabaseAdmin.from("pharmacy_notifications").insert(notifications)
    }

    // Send email to staff with auth user emails
    if (notifiableProfileIds.length > 0) {
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })

      const notifiableAuthUsers = authUsers?.users.filter((u) =>
        notifiableProfileIds.includes(u.id)
      ) ?? []

      for (const authUser of notifiableAuthUsers) {
        if (!authUser.email) continue
        const displayName =
          authUser.user_metadata?.full_name ?? authUser.email

        try {
          await sendEmail({
            to: authUser.email,
            subject: `New Customer Order: ${orderNo}`,
            html: generateNewOrderEmail(
              displayName,
              orderNo,
              customer.name ?? "Customer",
              totalAmount,
              orderItems,
              "SYNAPSE Pharm"
            ),
          })
        } catch (emailError) {
          console.error(`Failed to send email to ${authUser.email}:`, emailError)
        }
      }
    }

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderNo: order.order_no,
        totalAmount: order.total_amount,
        status: order.status,
      },
    })
  } catch (error) {
    console.error("Place order error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

function generateNewOrderEmail(
  staffName: string,
  orderNo: string,
  customerName: string,
  totalAmount: number,
  items: Array<{ product_name: string; quantity: number; unit_price: number; total_price: number }>,
  pharmacyName: string
): string {
  const itemsHtml = items
    .map(
      (item) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.product_name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(item.unit_price)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(item.total_price)}</td>
      </tr>
    `
    )
    .join("")

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
        .order-details { background-color: white; padding: 15px; border-left: 4px solid #4F46E5; margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th { background-color: #4F46E5; color: white; padding: 10px; text-align: left; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        .highlight { background-color: #FEF3C7; padding: 15px; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>New Customer Order</h1>
        </div>
        <div class="content">
          <h2>Hello ${staffName},</h2>
          <p>A new customer order has been placed and is waiting to be claimed.</p>
          <div class="highlight">
            <strong>First come, first served!</strong> Claim this order now to process it.
          </div>
          <div class="order-details">
            <h3>Order Details:</h3>
            <p><strong>Order #:</strong> ${orderNo}</p>
            <p><strong>Customer:</strong> ${customerName}</p>
            <p><strong>Total Amount:</strong> ${formatCurrency(totalAmount)}</p>
          </div>
          <h4>Order Items:</h4>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Price</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          <a href="${process.env.NEXT_PUBLIC_APP_URL ?? ""}/portal/orders" style="display: inline-block; padding: 12px 30px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px;">View &amp; Claim Order</a>
          <p style="margin-top: 30px; font-size: 12px; color: #666;">
            This order will be assigned to the first staff member who claims it.
          </p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} ${pharmacyName}. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `
}
