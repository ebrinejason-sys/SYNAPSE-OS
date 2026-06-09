import { NextRequest, NextResponse } from "next/server"
import { getPharmacySession, isPharmacyAdmin, hasPermission } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const session = await getPharmacySession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const adminUser = isPharmacyAdmin(session)
    const canViewReports =
      adminUser || hasPermission(session, "VIEW_REPORTS")

    if (!canViewReports) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const reportType = searchParams.get("type") || "sales"
    const period = searchParams.get("period") || "today"
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    // Calculate date range
    let dateFrom: Date
    let dateTo: Date = new Date()

    switch (period) {
      case "today":
        dateFrom = new Date(new Date().setHours(0, 0, 0, 0))
        break
      case "yesterday":
        dateFrom = new Date(new Date().setHours(0, 0, 0, 0))
        dateFrom.setDate(dateFrom.getDate() - 1)
        dateTo = new Date(new Date().setHours(0, 0, 0, 0))
        break
      case "week":
        dateFrom = new Date()
        dateFrom.setDate(dateFrom.getDate() - 7)
        break
      case "month":
        dateFrom = new Date()
        dateFrom.setMonth(dateFrom.getMonth() - 1)
        break
      case "year":
        dateFrom = new Date()
        dateFrom.setFullYear(dateFrom.getFullYear() - 1)
        break
      case "custom":
        dateFrom = startDate ? new Date(startDate) : new Date()
        dateTo = endDate ? new Date(endDate) : new Date()
        break
      default:
        dateFrom = new Date(new Date().setHours(0, 0, 0, 0))
    }

    const supabase = await createClient()
    const dateFromISO = dateFrom.toISOString()
    const dateToISO = dateTo.toISOString()

    // ── SALES REPORT ─────────────────────────────────────────────────────────
    if (reportType === "sales") {
      const [txResult, itemsResult] = await Promise.all([
        // All completed transactions in range
        supabase
          .from("pharmacy_transactions")
          .select(
            "id, transaction_no, net_amount, discount, tax, payment_method, client_name, cashier_id, created_at, profiles(full_name, first_name, last_name)"
          )
          .eq("status", "COMPLETED")
          .gte("created_at", dateFromISO)
          .lte("created_at", dateToISO)
          .order("created_at", { ascending: false }),
        // All transaction items in range (for category + top products)
        supabase
          .from("pharmacy_transaction_items")
          .select(
            "product_id, quantity, total_price, unit_price, pharmacy_transactions!inner(status, created_at), pharmacy_products(name, sku, category)"
          )
          .eq("pharmacy_transactions.status", "COMPLETED")
          .gte("pharmacy_transactions.created_at", dateFromISO)
          .lte("pharmacy_transactions.created_at", dateToISO),
      ])

      if (txResult.error) throw txResult.error
      if (itemsResult.error) throw itemsResult.error

      type TxRow = {
        id: string
        transaction_no: string | null
        net_amount: number | null
        discount: number | null
        tax: number | null
        payment_method: string | null
        client_name: string | null
        cashier_id: string | null
        created_at: string
        profiles: {
          full_name: string | null
          first_name: string | null
          last_name: string | null
        } | null
      }

      type ItemRow = {
        product_id: string | null
        quantity: number | null
        total_price: number | null
        unit_price: number | null
        pharmacy_transactions: { status: string; created_at: string } | null
        pharmacy_products: {
          name: string | null
          sku: string | null
          category: string | null
        } | null
      }

      const transactions = (txResult.data ?? []) as unknown as TxRow[]
      const items = (itemsResult.data ?? []) as unknown as ItemRow[]

      // Aggregate totals
      let totalSalesAmt = 0
      let totalDiscountAmt = 0
      let totalTaxAmt = 0

      for (const tx of transactions) {
        totalSalesAmt += tx.net_amount ?? 0
        totalDiscountAmt += tx.discount ?? 0
        totalTaxAmt += tx.tax ?? 0
      }

      // Sales by payment method (JS aggregation — no groupBy in Supabase JS client)
      const paymentMethodMap = new Map<
        string,
        { payment_method: string; total: number; count: number }
      >()
      for (const tx of transactions) {
        const method = tx.payment_method ?? "UNKNOWN"
        const existing = paymentMethodMap.get(method) ?? {
          payment_method: method,
          total: 0,
          count: 0,
        }
        existing.total += tx.net_amount ?? 0
        existing.count += 1
        paymentMethodMap.set(method, existing)
      }
      const salesByPaymentMethod = Array.from(paymentMethodMap.values())

      // Sales by day
      const salesByDayMap = new Map<
        string,
        { date: string; total: number; count: number }
      >()
      for (const tx of transactions) {
        const dateStr = tx.created_at.split("T")[0]
        const existing = salesByDayMap.get(dateStr) ?? {
          date: dateStr,
          total: 0,
          count: 0,
        }
        existing.total += tx.net_amount ?? 0
        existing.count += 1
        salesByDayMap.set(dateStr, existing)
      }
      const salesByDay = Array.from(salesByDayMap.values()).sort((a, b) =>
        a.date.localeCompare(b.date)
      )

      // Sales by category
      const salesByCategoryMap = new Map<
        string,
        { category: string; total: number; count: number }
      >()
      for (const item of items) {
        const category =
          item.pharmacy_products?.category ?? "Uncategorized"
        const existing = salesByCategoryMap.get(category) ?? {
          category,
          total: 0,
          count: 0,
        }
        existing.total += item.total_price ?? 0
        existing.count += 1
        salesByCategoryMap.set(category, existing)
      }
      const salesByCategory = Array.from(salesByCategoryMap.values()).sort(
        (a, b) => b.total - a.total
      )

      // Top customers
      const topCustomersMap = new Map<
        string,
        { name: string; total: number; count: number }
      >()
      for (const tx of transactions) {
        if (tx.client_name) {
          const existing = topCustomersMap.get(tx.client_name) ?? {
            name: tx.client_name,
            total: 0,
            count: 0,
          }
          existing.total += tx.net_amount ?? 0
          existing.count += 1
          topCustomersMap.set(tx.client_name, existing)
        }
      }
      const topCustomers = Array.from(topCustomersMap.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, 10)

      // Top products (JS aggregation)
      const topProductsMap = new Map<
        string,
        {
          productId: string
          productName: string | null
          productSku: string | null
          quantity: number
          total: number
        }
      >()
      for (const item of items) {
        const pid = item.product_id ?? "unknown"
        const existing = topProductsMap.get(pid) ?? {
          productId: pid,
          productName: item.pharmacy_products?.name ?? null,
          productSku: item.pharmacy_products?.sku ?? null,
          quantity: 0,
          total: 0,
        }
        existing.quantity += item.quantity ?? 0
        existing.total += item.total_price ?? 0
        topProductsMap.set(pid, existing)
      }
      const topProducts = Array.from(topProductsMap.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, 10)

      // Sales by user (JS aggregation)
      const salesByUserMap = new Map<
        string,
        { cashier_id: string; userName: string | null; total: number; count: number }
      >()
      for (const tx of transactions) {
        const uid = tx.cashier_id ?? "unknown"
        const profile = tx.profiles
        const name =
          profile?.full_name ??
          [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ??
          null
        const existing = salesByUserMap.get(uid) ?? {
          cashier_id: uid,
          userName: name,
          total: 0,
          count: 0,
        }
        existing.total += tx.net_amount ?? 0
        existing.count += 1
        salesByUserMap.set(uid, existing)
      }
      const salesByUser = Array.from(salesByUserMap.values())

      const transactionCount = transactions.length

      return NextResponse.json({
        type: "sales",
        period,
        dateFrom,
        dateTo,
        summary: {
          totalSales: totalSalesAmt,
          totalDiscount: totalDiscountAmt,
          totalTax: totalTaxAmt,
          transactionCount,
          averageTransaction:
            transactionCount > 0 ? totalSalesAmt / transactionCount : 0,
        },
        salesByPaymentMethod,
        salesByDay,
        salesByCategory,
        topCustomers,
        topProducts,
        salesByUser,
        transactions: transactions.slice(0, 100),
      })
    }

    // ── INVENTORY REPORT ─────────────────────────────────────────────────────
    if (reportType === "inventory") {
      // Get low stock threshold from settings
      const { data: settingsRow } = await supabase
        .from("pharmacy_settings")
        .select("low_stock_threshold")
        .eq("tenant_id", session.profile.tenant_id!)
        .single()

      const lowStockThreshold = settingsRow?.low_stock_threshold ?? 10
      const nowISO = new Date().toISOString()
      const thirtyDaysFromNow = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ).toISOString()

      const [
        allProductsResult,
        lowStockResult,
        outOfStockResult,
        expiringResult,
        expiredResult,
        stockMovementsResult,
      ] = await Promise.all([
        // All active products (for totals, value calc, category grouping)
        supabase
          .from("pharmacy_products")
          .select("id, name, sku, category, quantity, cost_price, price, reorder_level, expiry_date, is_active")
          .eq("is_active", true),
        // Low stock (between 1 and threshold)
        supabase
          .from("pharmacy_products")
          .select("*")
          .eq("is_active", true)
          .gt("quantity", 0)
          .lte("quantity", lowStockThreshold)
          .order("quantity", { ascending: true }),
        // Out of stock
        supabase
          .from("pharmacy_products")
          .select("*")
          .eq("is_active", true)
          .lte("quantity", 0),
        // Expiring in 30 days
        supabase
          .from("pharmacy_products")
          .select("*")
          .eq("is_active", true)
          .gte("expiry_date", nowISO)
          .lte("expiry_date", thirtyDaysFromNow)
          .order("expiry_date", { ascending: true }),
        // Already expired
        supabase
          .from("pharmacy_products")
          .select("*")
          .eq("is_active", true)
          .lt("expiry_date", nowISO),
        // Recent stock adjustments in range
        supabase
          .from("pharmacy_stock_adjustments")
          .select("*, pharmacy_products(name, sku)")
          .gte("created_at", dateFromISO)
          .lte("created_at", dateToISO)
          .order("created_at", { ascending: false })
          .limit(50),
      ])

      if (allProductsResult.error) throw allProductsResult.error

      type ProductRow = {
        id: string
        name: string | null
        sku: string | null
        category: string | null
        quantity: number | null
        cost_price: number | null
        price: number | null
        reorder_level: number | null
        expiry_date: string | null
        is_active: boolean | null
      }

      const allProducts = (allProductsResult.data ?? []) as ProductRow[]

      const totalProducts = allProducts.length
      const totalUnits = allProducts.reduce(
        (sum, p) => sum + (p.quantity ?? 0),
        0
      )
      const inventoryValueAtCost = allProducts.reduce(
        (sum, p) => sum + (p.quantity ?? 0) * (p.cost_price ?? 0),
        0
      )
      const inventoryValueAtRetail = allProducts.reduce(
        (sum, p) => sum + (p.quantity ?? 0) * (p.price ?? 0),
        0
      )

      // Products by category (JS aggregation)
      const productsByCategoryMap = new Map<
        string,
        { category: string; count: number; total_quantity: number }
      >()
      for (const p of allProducts) {
        const cat = p.category ?? "Uncategorized"
        const existing = productsByCategoryMap.get(cat) ?? {
          category: cat,
          count: 0,
          total_quantity: 0,
        }
        existing.count += 1
        existing.total_quantity += p.quantity ?? 0
        productsByCategoryMap.set(cat, existing)
      }
      const productsByCategory = Array.from(productsByCategoryMap.values())

      return NextResponse.json({
        type: "inventory",
        period,
        dateFrom,
        dateTo,
        summary: {
          totalProducts,
          totalUnits,
          inventoryValueAtCost,
          inventoryValueAtRetail,
          potentialProfit: inventoryValueAtRetail - inventoryValueAtCost,
          lowStockCount: lowStockResult.data?.length ?? 0,
          outOfStockCount: outOfStockResult.data?.length ?? 0,
          expiringCount: expiringResult.data?.length ?? 0,
          expiredCount: expiredResult.data?.length ?? 0,
        },
        lowStockProducts: lowStockResult.data ?? [],
        outOfStockProducts: outOfStockResult.data ?? [],
        expiringProducts: expiringResult.data ?? [],
        expiredProducts: expiredResult.data ?? [],
        productsByCategory,
        stockMovements: stockMovementsResult.data ?? [],
      })
    }

    // ── PROFIT REPORT ─────────────────────────────────────────────────────────
    if (reportType === "profit") {
      const { data: txItems, error: txItemsError } = await supabase
        .from("pharmacy_transaction_items")
        .select(
          "product_id, quantity, total_price, cost_price, pharmacy_transactions!inner(id, status, created_at), pharmacy_products(name, category, cost_price)"
        )
        .eq("pharmacy_transactions.status", "COMPLETED")
        .gte("pharmacy_transactions.created_at", dateFromISO)
        .lte("pharmacy_transactions.created_at", dateToISO)

      if (txItemsError) throw txItemsError

      type ProfitItemRow = {
        product_id: string | null
        quantity: number | null
        total_price: number | null
        cost_price: number | null
        pharmacy_transactions: { id: string; status: string; created_at: string } | null
        pharmacy_products: {
          name: string | null
          category: string | null
          cost_price: number | null
        } | null
      }

      const items = (txItems ?? []) as unknown as ProfitItemRow[]

      let totalRevenue = 0
      let totalCost = 0

      const profitByProduct: Record<
        string,
        {
          name: string
          revenue: number
          cost: number
          profit: number
          quantity: number
        }
      > = {}

      const profitByCategory: Record<
        string,
        { category: string; revenue: number; cost: number; profit: number }
      > = {}

      for (const item of items) {
        // Priority: 1. Item-specific cost_price (historical), 2. Current product cost_price, 3. Zero
        const unitCost =
          item.cost_price !== null
            ? (item.cost_price ?? 0)
            : (item.pharmacy_products?.cost_price ?? 0)
        const cost = unitCost * (item.quantity ?? 0)
        const revenue = item.total_price ?? 0

        totalRevenue += revenue
        totalCost += cost

        const productId = item.product_id ?? "unknown"
        if (!profitByProduct[productId]) {
          profitByProduct[productId] = {
            name: item.pharmacy_products?.name ?? "Unknown",
            revenue: 0,
            cost: 0,
            profit: 0,
            quantity: 0,
          }
        }
        profitByProduct[productId].revenue += revenue
        profitByProduct[productId].cost += cost
        profitByProduct[productId].profit += revenue - cost
        profitByProduct[productId].quantity += item.quantity ?? 0

        const category =
          item.pharmacy_products?.category ?? "Uncategorized"
        if (!profitByCategory[category]) {
          profitByCategory[category] = {
            category,
            revenue: 0,
            cost: 0,
            profit: 0,
          }
        }
        profitByCategory[category].revenue += revenue
        profitByCategory[category].cost += cost
        profitByCategory[category].profit += revenue - cost
      }

      const profitByProductArray = Object.values(profitByProduct).sort(
        (a, b) => b.profit - a.profit
      )

      const profitByCategoryArray = Object.values(profitByCategory).sort(
        (a, b) => b.profit - a.profit
      )

      // Count distinct transactions for summary
      const txSet = new Set<string>()
      for (const item of items) {
        if (item.pharmacy_transactions) {
          txSet.add(item.pharmacy_transactions.id)
        }
      }

      return NextResponse.json({
        type: "profit",
        period,
        dateFrom,
        dateTo,
        summary: {
          totalRevenue,
          totalCost,
          grossProfit: totalRevenue - totalCost,
          profitMargin:
            totalRevenue > 0
              ? ((totalRevenue - totalCost) / totalRevenue) * 100
              : 0,
          transactionCount: txSet.size,
        },
        profitByProduct: profitByProductArray.slice(0, 50),
        profitByCategory: profitByCategoryArray,
      })
    }

    return NextResponse.json({ error: "Invalid report type" }, { status: 400 })
  } catch (error) {
    console.error("Reports error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
