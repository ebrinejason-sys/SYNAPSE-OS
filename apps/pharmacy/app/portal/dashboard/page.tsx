"use client"

import { useEffect, useState } from "react"
import { usePharmacySession } from "@/hooks/use-pharmacy-session"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Users, Package, DollarSign, ShoppingCart, TrendingUp, AlertTriangle, Calendar, Activity, Clock, User, Receipt } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

// Force dynamic rendering
export const dynamic = 'force-dynamic'

interface DashboardStats {
  // Admin stats
  totalUsers?: number
  totalProducts?: number
  totalRevenue?: number
  todaySales?: number
  lowStockCount?: number
  pendingOrders?: number
  expiringProducts?: Array<{
    id: string
    name: string
    sku: string
    expiryDate: string
    quantity: number
  }>
  recentActivity?: Array<{
    id: string
    action: string
    entity: string
    details: string
    createdAt: string
    user: {
      name: string
      role: string
    }
  }>
  userStats?: Array<{
    userId: string
    userName: string
    userRole: string
    todaySales: number
    todayOrders: number
    todayTransactions: number
  }>
  // Staff stats
  myTodaySales?: number
  myTodayTransactions?: number
  myTotalSales?: number
  myTotalTransactions?: number
  recentTransactions?: Array<{
    id: string
    transactionNo: string
    netAmount: number
    createdAt: string
  }>
  // Meta
  userRole?: string
  isAdmin?: boolean
  permissions?: string[]
}

export default function AdminDashboard() {
  const { user } = usePharmacySession()
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/admin/dashboard")
      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error("Failed to fetch stats:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Admin Dashboard
  if (stats?.isAdmin) {
    const adminCards = [
      {
        title: "Total Users",
        value: stats?.totalUsers || 0,
        icon: Users,
        color: "text-blue-400",
        bgColor: "bg-blue-500/15",
        href: "/portal/users",
      },
      {
        title: "Total Products",
        value: stats?.totalProducts || 0,
        icon: Package,
        color: "text-[#22C55E]",
        bgColor: "bg-green-500/15",
        href: "/portal/inventory",
      },
      {
        title: "Total Revenue",
        value: formatCurrency(stats?.totalRevenue || 0),
        icon: DollarSign,
        color: "text-purple-400",
        bgColor: "bg-purple-500/15",
        href: "/portal/transactions",
      },
      {
        title: "Today's Sales",
        value: formatCurrency(stats?.todaySales || 0),
        icon: TrendingUp,
        color: "text-primary",
        bgColor: "bg-primary/15",
        href: "/portal/transactions",
      },
      {
        title: "Low Stock Items",
        value: stats?.lowStockCount || 0,
        icon: AlertTriangle,
        color: "text-destructive",
        bgColor: "bg-red-500/15",
        href: "/portal/inventory?filter=low-stock",
      },
      {
        title: "Pending Orders",
        value: stats?.pendingOrders || 0,
        icon: ShoppingCart,
        color: "text-indigo-400",
        bgColor: "bg-indigo-500/15",
        href: "/portal/orders",
      },
    ]

    return (
      <div className="space-y-6">
        <div className="mb-4 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">Welcome back! Here's what's happening today.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
          {adminCards.map((card) => {
            const Icon = card.icon
            return (
              <Card 
                key={card.title} 
                className="overflow-hidden cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
                onClick={() => router.push(card.href)}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground leading-tight">
                    {card.title}
                  </CardTitle>
                  <div className={`${card.bgColor} p-1.5 sm:p-2 rounded-lg shrink-0`}>
                    <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${card.color}`} />
                  </div>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0">
                  <div className="text-lg sm:text-2xl font-bold truncate">{card.value}</div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {stats?.expiringProducts && stats.expiringProducts.length > 0 && (
          <Card className="border-accent/20 bg-accent/10">
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="flex items-center text-[#E8B84B] text-sm sm:text-base">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                Products Expiring Soon
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0">
              <div className="block sm:hidden space-y-2">
                {stats.expiringProducts.map((product) => (
                  <div key={product.id} className="bg-card p-3 rounded-lg border border-accent/20">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-sm">{product.name}</span>
                      <span className="text-xs text-muted-foreground">{product.sku}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Stock: {product.quantity}</span>
                      <span className="text-destructive font-semibold">
                        {new Date(product.expiryDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden sm:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Expiry Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.expiringProducts.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>{product.sku}</TableCell>
                        <TableCell>{product.quantity}</TableCell>
                        <TableCell className="text-destructive font-semibold">
                          {new Date(product.expiryDate).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {stats?.userStats && stats.userStats.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="h-5 w-5 mr-2 text-blue-400" />
                User Activity Today
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6">
              <div className="block sm:hidden space-y-3">
                {stats.userStats.map((user) => (
                  <div key={user.userId} className="p-3 bg-muted/20 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{user.userName}</span>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        user.userRole === 'ADMIN' ? 'bg-purple-500/15 text-purple-400' :
                        user.userRole === 'CEO' ? 'bg-blue-500/15 text-blue-400' :
                        'bg-green-500/15 text-[#22C55E]'
                      }`}>
                        {user.userRole}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Sales</p>
                        <p className="font-semibold text-[#22C55E]">{formatCurrency(user.todaySales)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Orders</p>
                        <p className="font-semibold">{user.todayOrders}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Trans</p>
                        <p className="font-semibold">{user.todayTransactions}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden sm:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Sales Today</TableHead>
                      <TableHead className="text-right">Orders</TableHead>
                      <TableHead className="text-right">Transactions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.userStats.map((user) => (
                      <TableRow key={user.userId}>
                        <TableCell className="font-medium">{user.userName}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            user.userRole === 'ADMIN' ? 'bg-purple-500/15 text-purple-400' :
                            user.userRole === 'CEO' ? 'bg-blue-500/15 text-blue-400' :
                            'bg-green-500/15 text-[#22C55E]'
                          }`}>
                            {user.userRole}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-[#22C55E]">
                          {formatCurrency(user.todaySales)}
                        </TableCell>
                        <TableCell className="text-right">{user.todayOrders}</TableCell>
                        <TableCell className="text-right">{user.todayTransactions}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {stats?.recentActivity && stats.recentActivity.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Activity className="h-5 w-5 mr-2 text-[#22C55E]" />
                Recent Activity Log
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6">
              <div className="space-y-3">
                {stats.recentActivity.map((activity) => (
                  <div key={activity.id} className="p-3 sm:p-4 bg-muted/20 rounded-lg">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                      <div className="hidden sm:block bg-muted/50 p-2 rounded-full shrink-0">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="font-medium text-sm sm:text-base truncate">{activity.user.name}</span>
                          <span className={`px-2 py-0.5 text-xs rounded-full shrink-0 ${
                            activity.user.role === 'ADMIN' ? 'bg-purple-500/15 text-purple-400' :
                            activity.user.role === 'CEO' ? 'bg-blue-500/15 text-blue-400' :
                            'bg-green-500/15 text-[#22C55E]'
                          }`}>
                            {activity.user.role}
                          </span>
                          <span className={`px-2 py-0.5 text-xs rounded-full shrink-0 ml-auto sm:ml-0 ${
                            activity.action.includes('CREATE') ? 'bg-green-500/15 text-[#22C55E]' :
                            activity.action.includes('UPDATE') || activity.action.includes('EDIT') ? 'bg-blue-500/15 text-blue-400' :
                            activity.action.includes('DELETE') ? 'bg-red-500/15 text-destructive' :
                            activity.action.includes('PAYMENT') ? 'bg-purple-500/15 text-purple-400' :
                            'bg-muted/30 text-foreground'
                          }`}>
                            {activity.action.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground break-words">{activity.details}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(activity.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  // Staff Dashboard (Non-Admin)
  const staffCards: Array<{
    title: string
    value: string | number
    icon: any
    color: string
    bgColor: string
    href?: string
  }> = []
  
  // Total Products card (for POS users)
  if (stats?.totalProducts !== undefined) {
    staffCards.push({
      title: "Total Products",
      value: stats.totalProducts,
      icon: Package,
      color: "text-[#22C55E]",
      bgColor: "bg-green-500/15",
      href: "/portal/inventory",
    })
  }

  // My Today's Sales (for POS users)
  if (stats?.myTodaySales !== undefined) {
    staffCards.push({
      title: "My Sales Today",
      value: formatCurrency(stats.myTodaySales),
      icon: TrendingUp,
      color: "text-primary",
      bgColor: "bg-primary/15",
      href: "/portal/transactions",
    })
  }

  // My Transactions Today (for POS users)
  if (stats?.myTodayTransactions !== undefined) {
    staffCards.push({
      title: "My Transactions Today",
      value: stats.myTodayTransactions,
      icon: Receipt,
      color: "text-blue-400",
      bgColor: "bg-blue-500/15",
      href: "/portal/transactions",
    })
  }

  // My Total Sales (for POS users)
  if (stats?.myTotalSales !== undefined) {
    staffCards.push({
      title: "My Total Sales",
      value: formatCurrency(stats.myTotalSales),
      icon: DollarSign,
      color: "text-purple-400",
      bgColor: "bg-purple-500/15",
      href: "/portal/transactions",
    })
  }

  // Pending Orders (for POS users)
  if (stats?.pendingOrders !== undefined) {
    staffCards.push({
      title: "Pending Orders",
      value: stats.pendingOrders,
      icon: ShoppingCart,
      color: "text-indigo-400",
      bgColor: "bg-indigo-500/15",
      href: "/portal/orders",
    })
  }

  // Low Stock Items (for inventory users)
  if (stats?.lowStockCount !== undefined) {
    staffCards.push({
      title: "Low Stock Items",
      value: stats.lowStockCount,
      icon: AlertTriangle,
      color: "text-destructive",
      bgColor: "bg-red-500/15",
      href: "/portal/inventory?filter=low-stock",
    })
  }

  // Check permissions for navigation
  const hasPermission = (permission: string) => {
    if (stats?.isAdmin) return true
    return stats?.permissions?.includes(permission)
  }

  const handleCardClick = (href?: string) => {
    if (!href) return
    
    // Check permission before navigating
    if (href.includes("/portal/inventory") && !hasPermission("VIEW_INVENTORY") && !hasPermission("MANAGE_INVENTORY")) {
      return
    }
    if (href.includes("/portal/transactions") && !hasPermission("VIEW_TRANSACTIONS") && !hasPermission("MANAGE_TRANSACTIONS")) {
      return
    }
    if (href.includes("/portal/orders") && !hasPermission("MANAGE_POS")) {
      return
    }
    
    router.push(href)
  }

  return (
    <div className="space-y-6">
      <div className="mb-4 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
          Welcome back, {user?.fullName ?? ""}! Here's your activity overview.
        </p>
      </div>

      {staffCards.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
          {staffCards.map((card) => {
            const Icon = card.icon
            return (
              <Card 
                key={card.title} 
                className={`overflow-hidden ${card.href ? 'cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all duration-200' : ''}`}
                onClick={() => handleCardClick(card.href)}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground leading-tight">
                    {card.title}
                  </CardTitle>
                  <div className={`${card.bgColor} p-1.5 sm:p-2 rounded-lg shrink-0`}>
                    <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${card.color}`} />
                  </div>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0">
                  <div className="text-lg sm:text-2xl font-bold truncate">{card.value}</div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            <p>No dashboard widgets available for your permissions.</p>
            <p className="text-sm mt-2">Contact an administrator if you need access to additional features.</p>
          </CardContent>
        </Card>
      )}

      {/* Recent Transactions for staff */}
      {stats?.recentTransactions && stats.recentTransactions.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Receipt className="h-5 w-5 mr-2 text-blue-400" />
              My Recent Transactions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6">
            <div className="space-y-3">
              {stats.recentTransactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                  <div>
                    <p className="font-medium">{transaction.transactionNo}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(transaction.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span className="font-semibold text-[#22C55E]">
                    {formatCurrency(transaction.netAmount)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
