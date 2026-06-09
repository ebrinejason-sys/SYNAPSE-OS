import { NextRequest, NextResponse } from "next/server"
import { getPharmacySession, isPharmacyAdmin, hasPermission } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { sendEmail } from "@/lib/email"

// Claim an order
export async function POST(request: NextRequest) {
  try {
    const session = await getPharmacySession()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Check if user has permission to claim orders
    const canClaim =
      isPharmacyAdmin(session) ||
      hasPermission(session, "CLAIM_ORDERS") ||
      hasPermission(session, "MANAGE_POS")

    if (!canClaim) {
      return NextResponse.json({ error: "You don't have permission to claim orders" }, { status: 403 })
    }

    const tenantId = session.profile.tenant_id
    if (!tenantId) return NextResponse.json({ error: "Tenant not found" }, { status: 400 })

    const { orderId } = await request.json()

    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 })
    }

    const supabase = await createClient()

    // Fetch the order
    const { data: order, error: orderError } = await supabase
      .from("pharmacy_orders")
      .select("id, order_no, status, claimed_by, customer_id")
      .eq("id", orderId)
      .eq("tenant_id", tenantId)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    if (order.claimed_by) {
      // Get the name of who claimed it
      const { data: claimedProfile } = await supabase
        .from("profiles")
        .select("full_name, first_name, last_name")
        .eq("id", order.claimed_by)
        .single()

      const claimedByName =
        claimedProfile?.full_name ??
        `${claimedProfile?.first_name ?? ""} ${claimedProfile?.last_name ?? ""}`.trim() ??
        "another user"

      return NextResponse.json(
        { error: `This order has already been claimed by ${claimedByName}` },
        { status: 409 }
      )
    }

    if (order.status !== "PENDING") {
      return NextResponse.json({ error: "Only pending orders can be claimed" }, { status: 400 })
    }

    // Claim the order (sequential check + update — acceptable per spec)
    const { data: updatedOrder, error: updateError } = await supabaseAdmin
      .from("pharmacy_orders")
      .update({
        claimed_by: session.user.id,
        claimed_at: new Date().toISOString(),
        status: "PROCESSING",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .eq("tenant_id", tenantId)
      .select()
      .single()

    if (updateError || !updatedOrder) {
      console.error("Error claiming order:", updateError)
      return NextResponse.json({ error: "Failed to claim order" }, { status: 500 })
    }

    // Delete NEW_ORDER notifications for this order
    await supabaseAdmin
      .from("pharmacy_notifications")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("related_id", orderId)
      .eq("type", "NEW_ORDER")

    // Get all eligible staff to notify (excluding self)
    const { data: eligibleSettings } = await supabaseAdmin
      .from("pharmacy_user_settings")
      .select("profile_id, pharmacy_role, permissions")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .neq("profile_id", session.user.id)

    const notifiableProfileIds = (eligibleSettings ?? [])
      .filter(
        (s) =>
          s.pharmacy_role === "pharmacy_admin" ||
          s.pharmacy_role === "pharmacy_ceo" ||
          (s.permissions as string[])?.includes("CLAIM_ORDERS") ||
          (s.permissions as string[])?.includes("MANAGE_POS")
      )
      .map((s) => s.profile_id)

    const sessionName =
      session.profile.full_name ??
      `${session.profile.first_name ?? ""} ${session.profile.last_name ?? ""}`.trim() ??
      session.user.email ??
      "Staff"

    if (notifiableProfileIds.length > 0) {
      const claimNotifications = notifiableProfileIds.map((profileId) => ({
        tenant_id: tenantId,
        profile_id: profileId,
        type: "ORDER_CLAIMED",
        title: "Order Claimed",
        message: `Order ${order.order_no} has been claimed by ${sessionName}`,
        related_id: orderId,
        is_read: false,
      }))

      await supabaseAdmin.from("pharmacy_notifications").insert(claimNotifications)
    }

    // Send email to customer if applicable
    if (order.customer_id) {
      const { data: customer } = await supabase
        .from("pharmacy_customers")
        .select("name, email")
        .eq("id", order.customer_id)
        .eq("tenant_id", tenantId)
        .single()

      if (customer?.email) {
        try {
          await sendEmail({
            to: customer.email,
            subject: `Your Order ${order.order_no} is Being Processed`,
            html: generateOrderClaimedEmail(
              customer.name ?? "Customer",
              order.order_no,
              sessionName,
              "SYNAPSE Pharm",
              ""
            ),
          })
        } catch (emailError) {
          console.error("Failed to send customer email:", emailError)
        }
      }
    }

    // Audit log
    await supabaseAdmin.from("pharmacy_audit_logs").insert({
      tenant_id: tenantId,
      profile_id: session.user.id,
      action: "CLAIM_ORDER",
      entity: "Order",
      entity_id: orderId,
      details: `Claimed order ${order.order_no}`,
    })

    return NextResponse.json({
      success: true,
      order: {
        id: updatedOrder.id,
        orderNo: updatedOrder.order_no,
        status: updatedOrder.status,
        claimedBy: sessionName,
        claimedAt: updatedOrder.claimed_at,
      },
    })
  } catch (error) {
    console.error("Claim order error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Unclaim an order (for admins or the user who claimed it)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getPharmacySession()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const tenantId = session.profile.tenant_id
    if (!tenantId) return NextResponse.json({ error: "Tenant not found" }, { status: 400 })

    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get("orderId")

    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: order, error: orderError } = await supabase
      .from("pharmacy_orders")
      .select("id, order_no, claimed_by")
      .eq("id", orderId)
      .eq("tenant_id", tenantId)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    // Only allow unclaim if admin or the one who claimed it
    const canUnclaim = isPharmacyAdmin(session) || order.claimed_by === session.user.id

    if (!canUnclaim) {
      return NextResponse.json({ error: "You can only unclaim orders you claimed" }, { status: 403 })
    }

    await supabaseAdmin
      .from("pharmacy_orders")
      .update({
        claimed_by: null,
        claimed_at: null,
        status: "PENDING",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .eq("tenant_id", tenantId)

    // Audit log
    await supabaseAdmin.from("pharmacy_audit_logs").insert({
      tenant_id: tenantId,
      profile_id: session.user.id,
      action: "UNCLAIM_ORDER",
      entity: "Order",
      entity_id: orderId,
      details: `Unclaimed order ${order.order_no}`,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Unclaim order error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

function generateOrderClaimedEmail(
  customerName: string,
  orderNo: string,
  staffName: string,
  pharmacyName: string,
  pharmacyContact: string
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #10B981; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
        .status-box { background-color: #D1FAE5; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Order Update</h1>
        </div>
        <div class="content">
          <h2>Hello ${customerName},</h2>
          <p>Great news! Your order is now being processed.</p>
          <div class="status-box">
            <h3 style="margin: 0; color: #047857;">Order #${orderNo}</h3>
            <p style="margin: 10px 0 0 0; font-size: 18px; color: #059669;"><strong>Status: Processing</strong></p>
          </div>
          <p><strong>${staffName}</strong> is now handling your order and will prepare it for you.</p>
          <p>We'll notify you once your order is ready for pickup or delivery.</p>
          ${pharmacyContact ? `<p>If you have any questions, please contact us at: <strong>${pharmacyContact}</strong></p>` : ""}
          <p>Thank you for choosing ${pharmacyName}!</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} ${pharmacyName}. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `
}
