"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { 
  BarChart3, 
  TrendingUp, 
  Package, 
  DollarSign, 
  Download,
  Calendar,
  Users,
  AlertTriangle,
  Clock,
  PieChart as PieChartIcon
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area
} from "recharts"

export const dynamic = 'force-dynamic'

type ReportType = "sales" | "inventory" | "profit"
type Period = "today" | "yesterday" | "week" | "month" | "year" | "custom"

interface SalesReport {
  type: "sales"
  summary: {
    totalSales: number
    totalDiscount: number
    totalTax: number
    transactionCount: number
    averageTransaction: number
  }
  salesByPaymentMethod: Array<{
    paymentMethod: string
    _sum: { netAmount: number }
    _count: number
  }>
  salesByDay: Array<{ date: string; total: number; count: number }>
  salesByCategory: Array<{ category: string; total: number; count: number }>
  topCustomers: Array<{ name: string; total: number; count: number }>
  topProducts: Array<{
    productId: string
    _sum: { quantity: number; totalPrice: number }
    product: { id: string; name: string; sku: string }
  }>
  salesByUser: Array<{
    userId: string
    _sum: { netAmount: number }
    _count: number
    user: { id: string; name: string }
  }>
}

interface InventoryReport {
  type: "inventory"
  summary: {
    totalProducts: number
    totalUnits: number
    inventoryValueAtCost: number
    inventoryValueAtRetail: number
    potentialProfit: number
    lowStockCount: number
    outOfStockCount: number
    expiringCount: number
    expiredCount: number
  }
  lowStockProducts: Array<{
    id: string
    name: string
    sku: string
    quantity: number
    reorderLevel: number
  }>
  outOfStockProducts: Array<{
    id: string
    name: string
    sku: string
    quantity: number
  }>
  expiringProducts: Array<{
    id: string
    name: string
    sku: string
    quantity: number
    expiryDate: string
  }>
  expiredProducts: Array<{
    id: string
    name: string
    sku: string
    quantity: number
    expiryDate: string
  }>
  productsByCategory: Array<{
    category: string
    _count: number
    _sum: { quantity: number }
  }>
}

interface ProfitReport {
  type: "profit"
  summary: {
    totalRevenue: number
    totalCost: number
    grossProfit: number
    profitMargin: number
    transactionCount: number
  }
  profitByProduct: Array<{
    name: string
    revenue: number
    cost: number
    profit: number
    quantity: number
  }>
  profitByCategory: Array<{
    category: string
    revenue: number
    cost: number
    profit: number
  }>
}

type Report = SalesReport | InventoryReport | ProfitReport

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>("sales")
  const [period, setPeriod] = useState<Period>("today")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [report, setReport] = useState<Report | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchReport()
  }, [reportType, period])

  const fetchReport = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        type: reportType,
        period,
        ...(period === "custom" && startDate && { startDate }),
        ...(period === "custom" && endDate && { endDate }),
      })
      
      const response = await fetch(`/api/admin/reports?${params}`)
      if (!response.ok) throw new Error("Failed to fetch report")
      const data = await response.json()
      setReport(data)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load report",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const exportToCSV = () => {
    if (!report) return
    
    let csvContent = ""
    
    if (report.type === "sales") {
      csvContent = "SALES REPORT\n"
      csvContent += `Period: ${period}\n\n`
      csvContent += "SUMMARY\n"
      csvContent += "Total Sales,Total Discount,Total Tax,Transactions,Average\n"
      csvContent += `${(report as SalesReport).summary.totalSales},${(report as SalesReport).summary.totalDiscount},${(report as SalesReport).summary.totalTax},${(report as SalesReport).summary.transactionCount},${(report as SalesReport).summary.averageTransaction}\n\n`

      csvContent += "DAILY SALES\n"
      csvContent += "Date,Total,Count\n"
      ;((report as SalesReport).salesByDay ?? []).forEach(d => {
        csvContent += `${d.date},${d.total},${d.count}\n`
      })

      csvContent += "\nSALES BY CATEGORY\n"
      csvContent += "Category,Total,Count\n"
      ;((report as SalesReport).salesByCategory ?? []).forEach(c => {
        csvContent += `${c.category},${c.total},${c.count}\n`
      })

      csvContent += "\nTOP PRODUCTS\n"
      csvContent += "Product,Quantity,Revenue\n"
      ;((report as SalesReport).topProducts ?? []).forEach(p => {
        csvContent += `${p.product?.name || 'Unknown'},${p._sum?.quantity ?? (p as { quantity?: number }).quantity ?? 0},${p._sum?.totalPrice ?? (p as { total?: number }).total ?? 0}\n`
      })
    } else if (report.type === "inventory") {
      csvContent = "INVENTORY REPORT\n"
      csvContent += "SUMMARY\n"
      csvContent += "Total Products,Total Units,Value (Cost),Value (Retail),Potential Profit\n"
      csvContent += `${(report as InventoryReport).summary.totalProducts},${(report as InventoryReport).summary.totalUnits},${(report as InventoryReport).summary.inventoryValueAtCost},${(report as InventoryReport).summary.inventoryValueAtRetail},${(report as InventoryReport).summary.potentialProfit}\n\n`

      csvContent += "LOW STOCK PRODUCTS\n"
      csvContent += "Product,SKU,Quantity,Status\n"
      ;((report as InventoryReport).lowStockProducts ?? []).forEach(p => {
        csvContent += `${p.name},${p.sku},${p.quantity},Low Stock\n`
      })

      csvContent += "\nOUT OF STOCK PRODUCTS\n"
      csvContent += "Product,SKU,Quantity\n"
      ;((report as InventoryReport).outOfStockProducts ?? []).forEach(p => {
        csvContent += `${p.name},${p.sku},${p.quantity}\n`
      })

      csvContent += "\nEXPIRING PRODUCTS\n"
      csvContent += "Product,Expiry Date,Quantity\n"
      ;((report as InventoryReport).expiringProducts ?? []).forEach(p => {
        csvContent += `${p.name},${new Date(p.expiryDate).toLocaleDateString()},${p.quantity}\n`
      })
    } else if (report.type === "profit") {
      csvContent = "PROFIT REPORT\n"
      csvContent += "SUMMARY\n"
      csvContent += "Total Revenue,Total Cost,Gross Profit,Margin (%)\n"
      csvContent += `${(report as ProfitReport).summary.totalRevenue},${(report as ProfitReport).summary.totalCost},${(report as ProfitReport).summary.grossProfit},${(report as ProfitReport).summary.profitMargin.toFixed(2)}\n\n`

      csvContent += "PROFIT BY PRODUCT\n"
      csvContent += "Product,Quantity,Revenue,Cost,Profit,Margin (%)\n"
      ;((report as ProfitReport).profitByProduct ?? []).forEach(p => {
        const margin = p.revenue > 0 ? ((p.profit / p.revenue) * 100).toFixed(2) : 0
        csvContent += `${p.name},${p.quantity},${p.revenue},${p.cost},${p.profit},${margin}\n`
      })

      csvContent += "\nPROFIT BY CATEGORY\n"
      csvContent += "Category,Revenue,Cost,Profit,Margin (%)\n"
      ;((report as ProfitReport).profitByCategory ?? []).forEach(c => {
        const margin = c.revenue > 0 ? ((c.profit / c.revenue) * 100).toFixed(2) : 0
        csvContent += `${c.category},${c.revenue},${c.cost},${c.profit},${margin}\n`
      })
    }

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${reportType}-report-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
  }

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ef4444', '#3b82f6', '#10b981']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Reports & Analytics</h1>
          <p className="text-muted-foreground">View detailed business reports</p>
        </div>
        <Button onClick={exportToCSV} disabled={!report}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Report Type */}
            <div className="space-y-3">
              <Label className="text-muted-foreground font-semibold uppercase text-xs tracking-wider">Report Type</Label>
              <div className="flex gap-2">
                {[
                  { value: "sales", label: "Sales", icon: DollarSign },
                  { value: "inventory", label: "Inventory", icon: Package },
                  { value: "profit", label: "Profit", icon: TrendingUp },
                ].map((type) => (
                  <Button
                    key={type.value}
                    variant={reportType === type.value ? "default" : "outline"}
                    onClick={() => setReportType(type.value as ReportType)}
                    className="gap-2 h-10 px-4"
                  >
                    <type.icon className="h-4 w-4" />
                    {type.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Period */}
            <div className="space-y-3 flex-1">
              <Label className="text-muted-foreground font-semibold uppercase text-xs tracking-wider">Time Period</Label>
              <div className="flex gap-2 flex-wrap">
                {[
                  { value: "today", label: "Today" },
                  { value: "yesterday", label: "Yesterday" },
                  { value: "week", label: "This Week" },
                  { value: "month", label: "This Month" },
                  { value: "year", label: "This Year" },
                  { value: "custom", label: "Custom Range" },
                ].map((p) => (
                  <Button
                    key={p.value}
                    variant={period === p.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPeriod(p.value as Period)}
                    className="h-10 px-3"
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Custom Date Range */}
            {period === "custom" && (
              <div className="flex gap-4 items-end animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="space-y-2">
                  <Label className="text-xs">From</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">To</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-10"
                  />
                </div>
                <Button onClick={fetchReport} className="h-10">Apply</Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}

      {/* Sales Report */}
      {!isLoading && report?.type === "sales" && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency((report as SalesReport).summary.totalSales)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Tax: {formatCurrency((report as SalesReport).summary.totalTax)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Transactions</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(report as SalesReport).summary.transactionCount}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Completed orders
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Sale</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency((report as SalesReport).summary.averageTransaction)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Per transaction
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Discounts Given</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency((report as SalesReport).summary.totalDiscount)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total markdown
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 1: Sales Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Sales Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={(report as SalesReport).salesByDay ?? []}>
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    />
                    <YAxis tickFormatter={(value) => `UGX ${value/1000}k`} />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), "Sales"]}
                      labelFormatter={(label) => new Date(label).toLocaleDateString()}
                    />
                    <Area type="monotone" dataKey="total" stroke="#3b82f6" fillOpacity={1} fill="url(#colorTotal)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Sales by Category Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5" />
                  Sales by Category
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={(report as SalesReport).salesByCategory ?? []}
                        dataKey="total"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
                      >
                        {((report as SalesReport).salesByCategory ?? []).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Sales by Payment Method Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Payment Methods
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={(report as SalesReport).salesByPaymentMethod ?? []}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="paymentMethod" />
                      <YAxis tickFormatter={(value) => `UGX ${value/1000}k`} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Bar dataKey="_sum.netAmount" name="Total Sales" fill="#10b981">
                        {((report as SalesReport).salesByPaymentMethod ?? []).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Top Products */}
            <Card>
              <CardHeader>
                <CardTitle>Top Selling Products</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {((report as SalesReport).topProducts ?? []).slice(0, 10).map((item) => (
                      <TableRow key={item.productId}>
                        <TableCell className="font-medium">
                          {item.product?.name || (item as { productName?: string }).productName || "Unknown"}
                        </TableCell>
                        <TableCell className="text-right">
                          {item._sum?.quantity ?? (item as { quantity?: number }).quantity ?? 0}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item._sum?.totalPrice ?? (item as { total?: number }).total ?? 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Top Customers */}
            <Card>
              <CardHeader>
                <CardTitle>Top Customers</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">Orders</TableHead>
                      <TableHead className="text-right">Spend</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {((report as SalesReport).topCustomers ?? []).map((customer, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{customer.name}</TableCell>
                        <TableCell className="text-right">{customer.count}</TableCell>
                        <TableCell className="text-right font-semibold text-[#22C55E]">
                          {formatCurrency(customer.total)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {((report as SalesReport).topCustomers ?? []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                          No customer data recorded for this period
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Sales by User */}
          <Card>
            <CardHeader>
              <CardTitle>Sales Performance by Staff</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff Name</TableHead>
                    <TableHead className="text-right">Transactions</TableHead>
                    <TableHead className="text-right">Total Revenue</TableHead>
                    <TableHead className="text-right">Avg Transaction</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {((report as SalesReport).salesByUser ?? []).map((user) => {
                    const revenue = user._sum?.netAmount ?? (user as { total?: number }).total ?? 0
                    const count = user._count ?? (user as { count?: number }).count ?? 0
                    return (
                    <TableRow key={user.userId}>
                      <TableCell className="font-medium">{user.user?.name || "Unknown Staff"}</TableCell>
                      <TableCell className="text-right">{count}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(revenue)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrency(count > 0 ? revenue / count : 0)}
                      </TableCell>
                    </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Inventory Report */}
      {!isLoading && report?.type === "inventory" && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Products</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(report as InventoryReport).summary.totalProducts}</div>
                <p className="text-xs text-muted-foreground">
                  {(report as InventoryReport).summary.totalUnits} total units
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Inventory Value (Cost)</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency((report as InventoryReport).summary.inventoryValueAtCost)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Inventory Value (Retail)</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency((report as InventoryReport).summary.inventoryValueAtRetail)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Potential Profit</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-[#22C55E]">
                  {formatCurrency((report as InventoryReport).summary.potentialProfit)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Alert Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-400" />
                  <span className="font-medium">Low Stock</span>
                </div>
                <div className="text-3xl font-bold text-yellow-400 mt-2">
                  {(report as InventoryReport).summary.lowStockCount}
                </div>
              </CardContent>
            </Card>
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-destructive" />
                  <span className="font-medium">Out of Stock</span>
                </div>
                <div className="text-3xl font-bold text-destructive mt-2">
                  {(report as InventoryReport).summary.outOfStockCount}
                </div>
              </CardContent>
            </Card>
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  <span className="font-medium">Expiring Soon</span>
                </div>
                <div className="text-3xl font-bold text-orange-700 mt-2">
                  {(report as InventoryReport).summary.expiringCount}
                </div>
              </CardContent>
            </Card>
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <span className="font-medium">Expired</span>
                </div>
                <div className="text-3xl font-bold text-destructive mt-2">
                  {(report as InventoryReport).summary.expiredCount}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Low Stock & Expiring Products Tables */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  Low Stock Products
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {((report as InventoryReport).lowStockProducts ?? []).slice(0, 10).map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>{product.sku}</TableCell>
                        <TableCell className="text-right text-yellow-400 font-bold">{product.quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-orange-500" />
                  Expiring Products (30 days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Expiry Date</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(report as InventoryReport).expiringProducts?.slice(0, 10).map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>{new Date(product.expiryDate).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">{product.quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Expired Products */}
          {(report as InventoryReport).expiredProducts?.length > 0 && (
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Expired Products - Action Required!
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Expired On</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {((report as InventoryReport).expiredProducts ?? []).map((product) => (
                      <TableRow key={product.id} className="bg-red-50">
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>{product.sku}</TableCell>
                        <TableCell className="text-destructive">{new Date(product.expiryDate).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right text-destructive font-bold">{product.quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Products by Category */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5" />
                  Stock Distribution by Category
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={((report as InventoryReport).productsByCategory ?? []).map((cat) => ({
                          ...cat,
                          quantity: cat._sum?.quantity ?? (cat as { total_quantity?: number; quantity?: number }).total_quantity ?? (cat as { quantity?: number }).quantity ?? 0,
                        }))}
                        dataKey="quantity"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
                      >
                        {((report as InventoryReport).productsByCategory ?? []).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Products by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Products</TableHead>
                      <TableHead className="text-right">Total Units</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {((report as InventoryReport).productsByCategory ?? []).map((cat) => (
                      <TableRow key={cat.category}>
                        <TableCell className="font-medium">{cat.category}</TableCell>
                        <TableCell className="text-right">
                          {cat._count ?? (cat as { count?: number }).count ?? 0}
                        </TableCell>
                        <TableCell className="text-right">
                          {cat._sum?.quantity ??
                            (cat as { total_quantity?: number; quantity?: number }).total_quantity ??
                            (cat as { quantity?: number }).quantity ??
                            0}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Profit Report */}
      {!isLoading && report?.type === "profit" && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency((report as ProfitReport).summary.totalRevenue)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency((report as ProfitReport).summary.totalCost)}</div>
              </CardContent>
            </Card>
            <Card className="bg-green-50 border-green-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gross Profit</CardTitle>
                <TrendingUp className="h-4 w-4 text-[#22C55E]" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-[#22C55E]">
                  {formatCurrency((report as ProfitReport).summary.grossProfit)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Profit Margin</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(report as ProfitReport).summary.profitMargin.toFixed(1)}%
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Profit by Category Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5" />
                  Profit Distribution by Category
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={(report as ProfitReport).profitByCategory ?? []}
                        dataKey="profit"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
                      >
                        {((report as ProfitReport).profitByCategory ?? []).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Profit vs Cost Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Profit vs Cost per Category
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={(report as ProfitReport).profitByCategory ?? []}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="category" />
                      <YAxis tickFormatter={(value) => `UGX ${value/1000}k`} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                      <Bar dataKey="cost" name="Total Cost" fill="#ef4444" stackId="a" />
                      <Bar dataKey="profit" name="Gross Profit" fill="#10b981" stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Profit by Product */}
          <Card>
            <CardHeader>
              <CardTitle>Profit by Product</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty Sold</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {((report as ProfitReport).profitByProduct ?? []).map((product, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell className="text-right">{product.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(product.revenue)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(product.cost)}</TableCell>
                      <TableCell className={`text-right font-bold ${product.profit >= 0 ? 'text-[#22C55E]' : 'text-destructive'}`}>
                        {formatCurrency(product.profit)}
                      </TableCell>
                      <TableCell className="text-right">
                        {product.revenue > 0 ? ((product.profit / product.revenue) * 100).toFixed(1) : 0}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
