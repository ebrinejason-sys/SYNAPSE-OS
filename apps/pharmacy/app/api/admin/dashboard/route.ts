import { NextRequest, NextResponse } from "next/server"
import { isPharmacyAdmin, hasPermission } from "@/lib/auth"
import { requirePharmacyAdmin } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { ensureDefaultPharmacyStore } from "@/lib/ensure-default-store"
import { listRecentLedgerSales, sumCompletedRevenue } from "@/lib/pos/sale-ledger"

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePharmacyAdmin()
    if (!auth.ok) return auth.response
    const { session, tenantId } = auth

    if (tenantId) {
      await ensureDefaultPharmacyStore(tenantId)
    }

    const adminUser = isPharmacyAdmin(session)
    const hasPOSAccess = adminUser || hasPermission(session, "MANAGE_POS")
    const hasInventoryAccess =
      adminUser ||
      hasPermission(session, "MANAGE_INVENTORY") ||
      hasPermission(session, "VIEW_INVENTORY")
    const hasTransactionAccess =
      adminUser ||
      hasPermission(session, "VIEW_TRANSACTIONS") ||
      hasPermission(session, "MANAGE_TRANSACTIONS")

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayStartISO = todayStart.toISOString()
    const thirtyDaysFromNow = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    ).toISOString()
    const nowISO = new Date().toISOString()

    if (adminUser) {
      // Fetch settings first to get low_stock_threshold
      const { data: settings } = await (supabaseAdmin as any)
        .from("pharmacy_settings")
        .select("low_stock_threshold")
        .eq("tenant_id", tenantId)
        .single()

      const lowStockThreshold = settings?.low_stock_threshold ?? 10

      const [
        totalProductsResult,
        totalRevenue,
        todaySales,
        lowStockResult,
        expiringResult,
        recentActivityResult,
        staffSettingsResult,
      ] = await Promise.all([
        // Total active products
        (supabaseAdmin as any)
          .from("pharmacy_products")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .eq("is_active", true),
        sumCompletedRevenue({ tenantId }),
        sumCompletedRevenue({ tenantId, fromIso: todayStartISO }),
        // Low stock count
        (supabaseAdmin as any)
          .from("pharmacy_products")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .eq("is_active", true)
          .lte("quantity", lowStockThreshold),
        // Expiring in 30 days
        (supabaseAdmin as any)
          .from("pharmacy_products")
          .select("id, name, sku, expiry_date, quantity")
          .eq("tenant_id", tenantId)
          .eq("is_active", true)
          .lte("expiry_date", thirtyDaysFromNow)
          .gte("expiry_date", nowISO)
          .order("expiry_date", { ascending: true }),
        // Recent activity logs (no implicit join)
        (supabaseAdmin as any)
          .from("pharmacy_audit_logs")
          .select("id, profile_id, action, entity, details, created_at")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(8),
        // Staff settings (no implicit join)
        (supabaseAdmin as any)
          .from("pharmacy_user_settings")
          .select("profile_id, pharmacy_role")
          .eq("tenant_id", tenantId)
          .eq("is_active", true),
      ])

      const totalRevenueAmount = totalRevenue.amount
      const todaySalesAmount = todaySales.amount

      // Resolve profiles for activity logs and staff
      const activityLogs: any[] = recentActivityResult.data ?? []
      const staffRaw: any[] = staffSettingsResult.data ?? []
      const allProfileIds = [
        ...new Set([
          ...activityLogs.map((l: any) => l.profile_id).filter(Boolean),
          ...staffRaw.map((s: any) => s.profile_id).filter(Boolean),
        ]),
      ]
      const { data: profileRows } = await (supabaseAdmin as any)
        .from("profiles")
        .select("id, full_name, first_name, last_name")
        .in("id", allProfileIds)
      const profileMap = new Map((profileRows ?? []).map((p: any) => [p.id, p]))

      const resolveName = (profileId: string) => {
        const p: any = profileMap.get(profileId)
        return p?.full_name || [p?.first_name, p?.last_name].filter(Boolean).join(" ") || "Unknown"
      }

      // Map recentActivity to expected shape
      const recentActivity = activityLogs.map((log: any) => ({
        id: log.id,
        action: log.action,
        entity: log.entity,
        details: log.details,
        createdAt: log.created_at,
        user: { name: resolveName(log.profile_id), role: "STAFF" },
      }))

      const staffSettings = staffRaw

      const userStats = await Promise.all(
        staffSettings.map(async (pu) => {
          const today = await sumCompletedRevenue({
            tenantId,
            cashierId: pu.profile_id,
            fromIso: todayStartISO,
          })

          return {
            userId: pu.profile_id,
            userName: resolveName(pu.profile_id),
            userRole: pu.pharmacy_role,
            todaySales: today.amount,
            todayTransactions: today.count,
          }
        })
      )

      userStats.sort((a, b) => b.todaySales - a.todaySales)

      return NextResponse.json({
        totalUsers: staffSettings.length,
        totalProducts: totalProductsResult.count ?? 0,
        totalRevenue: totalRevenueAmount,
        todaySales: todaySalesAmount,
        lowStockCount: lowStockResult.count ?? 0,
        pendingOrders: 0,
        expiringProducts: expiringResult.data ?? [],
        recentActivity,
        userStats,
        isAdmin: true,
      })
    }

    // Non-admin user dashboard
    const dashboardData: Record<string, unknown> = {
      isAdmin: false,
    }

    if (hasPOSAccess || hasInventoryAccess) {
      const { count } = await (supabaseAdmin as any)
        .from("pharmacy_products")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
      dashboardData.totalProducts = count ?? 0
    }

    if (hasInventoryAccess) {
      const { data: settings } = await (supabaseAdmin as any)
        .from("pharmacy_settings")
        .select("low_stock_threshold")
        .eq("tenant_id", tenantId)
        .single()

      const threshold = settings?.low_stock_threshold ?? 10
      const { count } = await (supabaseAdmin as any)
        .from("pharmacy_products")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .lte("quantity", threshold)
      dashboardData.lowStockCount = count ?? 0
    }

    if (hasPOSAccess) {
      const [myToday, myAll] = await Promise.all([
        sumCompletedRevenue({
          tenantId,
          cashierId: session.user.id,
          fromIso: todayStartISO,
        }),
        sumCompletedRevenue({ tenantId, cashierId: session.user.id }),
      ])

      dashboardData.myTodaySales = myToday.amount
      dashboardData.myTodayTransactions = myToday.count
      dashboardData.myTotalSales = myAll.amount
      dashboardData.myTotalTransactions = myAll.count
      dashboardData.pendingOrders = 0
    }

    if (hasTransactionAccess) {
      dashboardData.recentTransactions = await listRecentLedgerSales({
        tenantId,
        cashierId: session.user.id,
        limit: 5,
      })
    }

    return NextResponse.json(dashboardData)
  } catch (error) {
    console.error("Dashboard stats error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
