import { NextRequest, NextResponse } from "next/server"
import { requirePharmacyTenant } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase/admin"

// Get notifications for the current user
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePharmacyTenant()
    if (!auth.ok) return auth.response
    const { session, tenantId } = auth

    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get("unread") === "true"
    const limit = parseInt(searchParams.get("limit") || "20")

    let query = (supabaseAdmin as any)
      .from("pharmacy_notifications")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("profile_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (unreadOnly) {
      query = query.eq("is_read", false)
    }

    const { data: notifications, error } = await query

    if (error) throw error

    const { count: unreadCount, error: countError } = await (supabaseAdmin as any)
      .from("pharmacy_notifications")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("profile_id", session.user.id)
      .eq("is_read", false)

    if (countError) throw countError

    return NextResponse.json({
      notifications,
      unreadCount: unreadCount ?? 0,
    })
  } catch (error) {
    console.error("Get notifications error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// Mark notifications as read
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requirePharmacyTenant()
    if (!auth.ok) return auth.response
    const { session, tenantId } = auth

    const { notificationIds, markAll } = await request.json()

    if (markAll) {
      const { error } = await supabaseAdmin
        .from("pharmacy_notifications")
        .update({ is_read: true })
        .eq("profile_id", session.user.id)
        .eq("is_read", false)

      if (error) throw error
    } else if (notificationIds && notificationIds.length > 0) {
      const { error } = await supabaseAdmin
        .from("pharmacy_notifications")
        .update({ is_read: true })
        .in("id", notificationIds)
        .eq("profile_id", session.user.id)

      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Update notifications error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// Delete notifications
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requirePharmacyTenant()
    if (!auth.ok) return auth.response
    const { session, tenantId } = auth

    const { searchParams } = new URL(request.url)
    const notificationId = searchParams.get("id")
    const cleanupOld = searchParams.get("cleanup") === "true"

    if (notificationId) {
      // Delete a specific notification belonging to this user
      const { error } = await supabaseAdmin
        .from("pharmacy_notifications")
        .delete()
        .eq("id", notificationId)
        .eq("profile_id", session.user.id)

      if (error) throw error
    } else if (cleanupOld) {
      // Clean up read notifications older than 7 days
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const { error } = await supabaseAdmin
        .from("pharmacy_notifications")
        .delete()
        .eq("profile_id", session.user.id)
        .eq("is_read", true)
        .lt("created_at", sevenDaysAgo.toISOString())

      if (error) throw error

      return NextResponse.json({
        success: true,
        message: "Cleaned up old read notifications",
      })
    } else {
      // Delete all read notifications older than 7 days for this user
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const { error } = await supabaseAdmin
        .from("pharmacy_notifications")
        .delete()
        .eq("profile_id", session.user.id)
        .eq("is_read", true)
        .lt("created_at", sevenDaysAgo.toISOString())

      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete notifications error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
