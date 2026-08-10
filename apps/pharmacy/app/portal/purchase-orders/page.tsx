"use client"

import { useEffect, useState } from "react"
import { usePharmacySession } from "@/hooks/use-pharmacy-session"

export const dynamic = 'force-dynamic'

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { Loader2, X, Eye, Truck, CheckCircle, XCircle, Mail, Package } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

interface PurchaseOrderItem {
  id: string
  productId: string | null
  productName: string
  quantity: number
  unitPrice: number
  product?: {
    name: string
    sku: string
  }
}

interface PurchaseOrder {
  id: string
  orderNumber: string
  status: "PENDING" | "SENT" | "CONFIRMED" | "SHIPPED" | "RECEIVED" | "CANCELLED"
  totalAmount: number
  notes: string | null
  expectedDate: string | null
  createdAt: string
  updatedAt: string
  supplier: {
    id: string
    name: string
    email: string
    phone: string | null
  }
  items: PurchaseOrderItem[]
  createdBy: {
    name: string
  }
}

interface ReceiptLine {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  batchNumber: string
  expiryDate: string
  costPrice: string
}

const statusConfig = {
  PENDING: { label: "Pending", color: "bg-yellow-500/15 text-yellow-400", icon: Package },
  SENT: { label: "Sent to Supplier", color: "bg-blue-500/15 text-blue-400", icon: Mail },
  CONFIRMED: { label: "Confirmed", color: "bg-purple-500/15 text-purple-400", icon: CheckCircle },
  SHIPPED: { label: "Shipped", color: "bg-indigo-500/15 text-indigo-400", icon: Truck },
  RECEIVED: { label: "Received", color: "bg-green-500/15 text-[#22C55E]", icon: CheckCircle },
  CANCELLED: { label: "Cancelled", color: "bg-red-500/15 text-destructive", icon: XCircle },
}

export default function PurchaseOrdersPage() {
  const { user } = usePharmacySession()
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null)
  const [receivingOrder, setReceivingOrder] = useState<PurchaseOrder | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const { toast } = useToast()

  useEffect(() => {
    fetchOrders()
  }, [statusFilter])

  const fetchOrders = async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter !== "ALL") {
        params.append("status", statusFilter)
      }
      const response = await fetch(`/api/admin/purchase-orders?${params}`)
      const data = await response.json()
      setOrders(Array.isArray(data) ? data : [])
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch purchase orders",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateStatus = async (
    orderId: string,
    newStatus: string,
    receiptItems?: Array<{
      productId: string
      batchNumber: string
      expiryDate: string
      quantity?: number
      costPrice?: number
    }>,
  ) => {
    try {
      const response = await fetch("/api/admin/purchase-orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: orderId,
          status: newStatus,
          ...(receiptItems ? { receiptItems } : {}),
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (response.ok) {
        toast({
          title: "Success",
          description: newStatus === "RECEIVED"
            ? "Order received — stock booked to genuine batches"
            : "Order status updated",
        })
        fetchOrders()
        setSelectedOrder(null)
        setReceivingOrder(null)
      } else {
        const requiresBatch = data.code === "REQUIRES_BATCH"
        toast({
          variant: "destructive",
          title: requiresBatch ? "Batch data required" : "Error",
          description:
            data.error ||
            (requiresBatch
              ? "Each product line needs a batch number and expiry date before this order can be received."
              : "Failed to update status"),
        })
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An error occurred",
      })
    }
  }

  const handleResendEmail = async (orderId: string) => {
    try {
      const response = await fetch("/api/admin/purchase-orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderId, resendEmail: true }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Email sent to supplier",
        })
      } else {
        const data = await response.json()
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "Failed to send email",
        })
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An error occurred",
      })
    }
  }

  const isAdmin = user?.pharmacyRole === "pharmacy_admin" || user?.pharmacyRole === "pharmacy_ceo"

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Purchase Orders</h1>
          <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">Track and manage supplier orders</p>
        </div>
      </div>

      {/* Status Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Button
          variant={statusFilter === "ALL" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("ALL")}
        >
          All
        </Button>
        {Object.entries(statusConfig).map(([status, config]) => (
          <Button
            key={status}
            variant={statusFilter === status ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter(status)}
          >
            {config.label}
          </Button>
        ))}
      </div>

      {selectedOrder && (
        <OrderDetailDialog
          order={selectedOrder}
          isAdmin={isAdmin}
          onClose={() => setSelectedOrder(null)}
          onUpdateStatus={(orderId, status) => {
            if (status === "RECEIVED") {
              setReceivingOrder(selectedOrder)
              return
            }
            handleUpdateStatus(orderId, status)
          }}
          onResendEmail={handleResendEmail}
        />
      )}

      {receivingOrder && (
        <ReceiveOrderDialog
          order={receivingOrder}
          onClose={() => setReceivingOrder(null)}
          onConfirm={(receiptItems) =>
            handleUpdateStatus(receivingOrder.id, "RECEIVED", receiptItems)
          }
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Orders ({orders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No purchase orders found</p>
              <p className="text-sm">Create purchase orders from the Suppliers page</p>
            </div>
          ) : (
            <>
              {/* Mobile View */}
              <div className="block sm:hidden space-y-4">
                {orders.map((order) => {
                  const StatusIcon = statusConfig[order.status].icon
                  return (
                    <div key={order.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold">{order.orderNumber}</h3>
                          <p className="text-sm text-muted-foreground">{order.supplier.name}</p>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full flex items-center gap-1 ${statusConfig[order.status].color}`}>
                          <StatusIcon className="h-3 w-3" />
                          {statusConfig[order.status].label}
                        </span>
                      </div>
                      
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{order.items.length} items</span>
                        <span className="font-semibold text-[#22C55E]">{formatCurrency(order.totalAmount)}</span>
                      </div>
                      
                      <div className="text-xs text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </div>
                      
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="w-full"
                        onClick={() => setSelectedOrder(order)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </Button>
                    </div>
                  )
                })}
              </div>

              {/* Desktop View */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => {
                      const StatusIcon = statusConfig[order.status].icon
                      return (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono">{order.orderNumber}</TableCell>
                          <TableCell>
                            <div>{order.supplier.name}</div>
                            <div className="text-xs text-muted-foreground">{order.supplier.email}</div>
                          </TableCell>
                          <TableCell>{order.items.length} items</TableCell>
                          <TableCell className="font-semibold text-[#22C55E]">
                            {formatCurrency(order.totalAmount)}
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 text-xs rounded-full flex items-center gap-1 w-fit ${statusConfig[order.status].color}`}>
                              <StatusIcon className="h-3 w-3" />
                              {statusConfig[order.status].label}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div>{new Date(order.createdAt).toLocaleDateString()}</div>
                            {order.expectedDate && (
                              <div className="text-xs text-muted-foreground">
                                Expected: {new Date(order.expectedDate).toLocaleDateString()}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>{order.createdBy.name}</TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setSelectedOrder(order)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ReceiveOrderDialog({
  order,
  onClose,
  onConfirm,
}: {
  order: PurchaseOrder
  onClose: () => void
  onConfirm: (
    receiptItems: Array<{
      productId: string
      batchNumber: string
      expiryDate: string
      quantity?: number
      costPrice?: number
    }>,
  ) => void | Promise<void>
}) {
  const linkedItems = order.items.filter((i) => i.productId)
  const [lines, setLines] = useState<ReceiptLine[]>(() =>
    linkedItems.map((item) => ({
      productId: item.productId as string,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      batchNumber: "",
      expiryDate: "",
      costPrice: item.unitPrice != null ? String(item.unitPrice) : "",
    })),
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  const updateLine = (productId: string, patch: Partial<ReceiptLine>) => {
    setLines((prev) =>
      prev.map((line) => (line.productId === productId ? { ...line, ...patch } : line)),
    )
  }

  const handleSubmit = async () => {
    const incomplete = lines.find((l) => !l.batchNumber.trim() || !l.expiryDate)
    if (incomplete) {
      toast({
        variant: "destructive",
        title: "Batch data required",
        description: `Enter batch number and expiry for ${incomplete.productName} before receiving.`,
      })
      return
    }

    setIsSubmitting(true)
    try {
      await onConfirm(
        lines.map((l) => ({
          productId: l.productId,
          batchNumber: l.batchNumber.trim(),
          expiryDate: l.expiryDate,
          quantity: l.quantity,
          ...(l.costPrice.trim() !== ""
            ? { costPrice: Number(l.costPrice) }
            : {}),
        })),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Receive order {order.orderNumber}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Enter the supplier batch number and expiry for each product. Stock cannot be marked received without genuine batch data.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {linkedItems.length === 0 ? (
            <p className="text-sm text-destructive">
              No product-linked lines to receive. Link products on the purchase order first.
            </p>
          ) : (
            lines.map((line) => (
              <div key={line.productId} className="border rounded-lg p-4 space-y-3">
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="font-medium">{line.productName}</p>
                    <p className="text-xs text-muted-foreground">Qty {line.quantity}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label>Batch number *</Label>
                    <Input
                      value={line.batchNumber}
                      onChange={(e) => updateLine(line.productId, { batchNumber: e.target.value })}
                      placeholder="e.g. BN-2026-041"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Expiry date *</Label>
                    <Input
                      type="date"
                      value={line.expiryDate}
                      onChange={(e) => updateLine(line.productId, { expiryDate: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Cost (optional)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.costPrice}
                      onChange={(e) => updateLine(line.productId, { costPrice: e.target.value })}
                      placeholder={String(line.unitPrice)}
                    />
                  </div>
                </div>
              </div>
            ))
          )}

          <div className="flex gap-2 pt-2 border-t">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={isSubmitting || linkedItems.length === 0}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Receiving…
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirm receipt
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Order Detail Dialog
function OrderDetailDialog({ 
  order, 
  isAdmin,
  onClose, 
  onUpdateStatus,
  onResendEmail,
}: { 
  order: PurchaseOrder
  isAdmin: boolean
  onClose: () => void
  onUpdateStatus: (orderId: string, status: string) => void
  onResendEmail: (orderId: string) => void
}) {
  const StatusIcon = statusConfig[order.status].icon

  const statusFlow = ["PENDING", "SENT", "CONFIRMED", "SHIPPED", "RECEIVED"]
  const currentIndex = statusFlow.indexOf(order.status)
  const nextStatus = currentIndex < statusFlow.length - 1 ? statusFlow[currentIndex + 1] : null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Order {order.orderNumber}
                <span className={`px-2 py-1 text-xs rounded-full flex items-center gap-1 ${statusConfig[order.status].color}`}>
                  <StatusIcon className="h-3 w-3" />
                  {statusConfig[order.status].label}
                </span>
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Created on {new Date(order.createdAt).toLocaleString()} by {order.createdBy.name}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Supplier Info */}
          <div className="bg-muted/20 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Supplier</h3>
            <div className="text-sm space-y-1">
              <p className="font-medium">{order.supplier.name}</p>
              <p className="text-muted-foreground">{order.supplier.email}</p>
              {order.supplier.phone && <p className="text-muted-foreground">{order.supplier.phone}</p>}
            </div>
          </div>

          {/* Order Items */}
          <div>
            <h3 className="font-semibold mb-3">Order Items</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/20">
                  <tr>
                    <th className="text-left p-3">Product</th>
                    <th className="text-center p-3">Qty</th>
                    <th className="text-right p-3">Unit Price</th>
                    <th className="text-right p-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="p-3">
                        <div>{item.productName}</div>
                        {item.product?.sku && (
                          <div className="text-xs text-muted-foreground">{item.product.sku}</div>
                        )}
                      </td>
                      <td className="text-center p-3">{item.quantity}</td>
                      <td className="text-right p-3">{formatCurrency(item.unitPrice)}</td>
                      <td className="text-right p-3 font-semibold">
                        {formatCurrency(item.quantity * item.unitPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/20 font-bold">
                  <tr className="border-t">
                    <td colSpan={3} className="text-right p-3">Total:</td>
                    <td className="text-right p-3 text-[#22C55E]">
                      {formatCurrency(order.totalAmount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Expected Date */}
          {order.expectedDate && (
            <div className="flex items-center gap-2 text-sm">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <span>Expected delivery: {new Date(order.expectedDate).toLocaleDateString()}</span>
            </div>
          )}

          {/* Notes */}
          {order.notes && (
            <div>
              <h3 className="font-semibold mb-2">Notes</h3>
              <p className="text-sm text-muted-foreground bg-muted/20 p-3 rounded-lg">{order.notes}</p>
            </div>
          )}

          {/* Actions */}
          {isAdmin && order.status !== "CANCELLED" && order.status !== "RECEIVED" && (
            <div className="space-y-3 pt-4 border-t">
              <h3 className="font-semibold">Actions</h3>
              <div className="flex flex-wrap gap-2">
                {/* Resend Email */}
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => onResendEmail(order.id)}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Send/Resend Email
                </Button>

                {/* Next Status */}
                {nextStatus && (
                  <Button 
                    size="sm"
                    onClick={() => onUpdateStatus(order.id, nextStatus)}
                  >
                    {nextStatus === "RECEIVED" ? (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Receive with batch details…
                      </>
                    ) : (
                      <>Mark as {statusConfig[nextStatus as keyof typeof statusConfig].label}</>
                    )}
                  </Button>
                )}

                {/* Cancel */}
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => {
                    if (confirm("Are you sure you want to cancel this order?")) {
                      onUpdateStatus(order.id, "CANCELLED")
                    }
                  }}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel Order
                </Button>
              </div>
            </div>
          )}

          {/* Close Button */}
          <div className="pt-4">
            <Button variant="outline" onClick={onClose} className="w-full">
              Close
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
