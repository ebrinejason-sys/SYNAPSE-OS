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
import { Plus, Edit, Trash2, Loader2, X, Mail, Phone, MapPin, User, Package, ShoppingCart } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

interface Supplier {
  id: string
  name: string
  email: string
  phone: string | null
  address: string | null
  contactPerson: string | null
  notes: string | null
  isActive: boolean
  createdAt: string
  _count: {
    purchaseOrders: number
  }
}

interface Product {
  id: string
  name: string
  sku: string
  price: number
  costPrice: number
  quantity: number
}

interface PurchaseOrderItem {
  productId: string | null
  productName: string
  quantity: number
  unitPrice: number
}

export default function SuppliersPage() {
  const { user } = usePharmacySession()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showOrderDialog, setShowOrderDialog] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetchSuppliers()
    fetchProducts()
  }, [])

  const fetchSuppliers = async () => {
    try {
      const response = await fetch("/api/admin/suppliers")
      const data = await response.json()
      setSuppliers(data)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch suppliers",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const fetchProducts = async () => {
    try {
      const response = await fetch("/api/admin/inventory")
      const data = await response.json()
      if (Array.isArray(data)) {
        setProducts(data)
      }
    } catch (error) {
      console.error("Failed to fetch products:", error)
    }
  }

  const handleEdit = (supplier: Supplier) => {
    setSelectedSupplier(supplier)
    setShowEditDialog(true)
  }

  const handleCreateOrder = (supplier: Supplier) => {
    setSelectedSupplier(supplier)
    setShowOrderDialog(true)
  }

  const handleDelete = async (supplierId: string) => {
    if (!confirm("Are you sure you want to delete this supplier? All related purchase orders will also be deleted.")) {
      return
    }

    try {
      const response = await fetch(`/api/admin/suppliers?id=${supplierId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Supplier deleted successfully",
        })
        fetchSuppliers()
      } else {
        const data = await response.json()
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "Failed to delete supplier",
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
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Suppliers</h1>
          <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">Manage your suppliers and create purchase orders</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowCreateDialog(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Add Supplier
          </Button>
        )}
      </div>

      {showCreateDialog && (
        <CreateSupplierDialog
          onClose={() => setShowCreateDialog(false)}
          onSuccess={() => {
            setShowCreateDialog(false)
            fetchSuppliers()
          }}
        />
      )}

      {showEditDialog && selectedSupplier && (
        <EditSupplierDialog
          supplier={selectedSupplier}
          onClose={() => {
            setShowEditDialog(false)
            setSelectedSupplier(null)
          }}
          onSuccess={() => {
            setShowEditDialog(false)
            setSelectedSupplier(null)
            fetchSuppliers()
          }}
        />
      )}

      {showOrderDialog && selectedSupplier && (
        <CreatePurchaseOrderDialog
          supplier={selectedSupplier}
          products={products}
          onClose={() => {
            setShowOrderDialog(false)
            setSelectedSupplier(null)
          }}
          onSuccess={() => {
            setShowOrderDialog(false)
            setSelectedSupplier(null)
            toast({
              title: "Success",
              description: "Purchase order created successfully",
            })
          }}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Suppliers</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : suppliers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No suppliers yet</p>
              <p className="text-sm">Add your first supplier to get started</p>
            </div>
          ) : (
            <>
              {/* Mobile View */}
              <div className="block sm:hidden space-y-4">
                {suppliers.map((supplier) => (
                  <div key={supplier.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">{supplier.name}</h3>
                        <p className="text-sm text-muted-foreground">{supplier.email}</p>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        supplier.isActive ? 'bg-green-500/15 text-[#22C55E]' : 'bg-red-500/15 text-destructive'
                      }`}>
                        {supplier.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    
                    {supplier.phone && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        {supplier.phone}
                      </div>
                    )}
                    
                    {supplier.contactPerson && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-4 w-4" />
                        {supplier.contactPerson}
                      </div>
                    )}
                    
                    <div className="text-sm text-muted-foreground">
                      {supplier._count.purchaseOrders} orders
                    </div>
                    
                    <div className="flex gap-2 pt-2 border-t">
                      <Button size="sm" variant="outline" onClick={() => handleCreateOrder(supplier)} className="flex-1">
                        <ShoppingCart className="h-4 w-4 mr-1" />
                        Order
                      </Button>
                      {isAdmin && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(supplier)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(supplier.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop View */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Contact Person</TableHead>
                      <TableHead>Orders</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suppliers.map((supplier) => (
                      <TableRow key={supplier.id}>
                        <TableCell className="font-medium">{supplier.name}</TableCell>
                        <TableCell>{supplier.email}</TableCell>
                        <TableCell>{supplier.phone || "—"}</TableCell>
                        <TableCell>{supplier.contactPerson || "—"}</TableCell>
                        <TableCell>{supplier._count.purchaseOrders}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            supplier.isActive ? 'bg-green-500/15 text-[#22C55E]' : 'bg-red-500/15 text-destructive'
                          }`}>
                            {supplier.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleCreateOrder(supplier)} title="Create Order">
                            <ShoppingCart className="h-4 w-4" />
                          </Button>
                          {isAdmin && (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => handleEdit(supplier)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDelete(supplier.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
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

// Create Supplier Dialog
function CreateSupplierDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    contactPerson: "",
    notes: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch("/api/admin/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Success",
          description: "Supplier created successfully",
        })
        onSuccess()
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "Failed to create supplier",
        })
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An error occurred",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Add New Supplier</CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Company Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="contactPerson">Contact Person</Label>
              <Input
                id="contactPerson"
                value={formData.contactPerson}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading} className="flex-1">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Supplier"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

// Edit Supplier Dialog
function EditSupplierDialog({ supplier, onClose, onSuccess }: { supplier: Supplier; onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    id: supplier.id,
    name: supplier.name,
    email: supplier.email,
    phone: supplier.phone || "",
    address: supplier.address || "",
    contactPerson: supplier.contactPerson || "",
    notes: supplier.notes || "",
    isActive: supplier.isActive,
  })
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch("/api/admin/suppliers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Success",
          description: "Supplier updated successfully",
        })
        onSuccess()
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "Failed to update supplier",
        })
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An error occurred",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Edit Supplier</CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Company Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="contactPerson">Contact Person</Label>
              <Input
                id="contactPerson"
                value={formData.contactPerson}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="isActive">Active</Label>
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading} className="flex-1">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

// Create Purchase Order Dialog
function CreatePurchaseOrderDialog({ 
  supplier, 
  products,
  onClose, 
  onSuccess 
}: { 
  supplier: Supplier
  products: Product[]
  onClose: () => void
  onSuccess: () => void 
}) {
  const [items, setItems] = useState<PurchaseOrderItem[]>([])
  const [notes, setNotes] = useState("")
  const [expectedDate, setExpectedDate] = useState("")
  const [sendEmail, setSendEmail] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const { toast } = useToast()

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const addItem = (product: Product) => {
    const existing = items.find(i => i.productId === product.id)
    if (existing) {
      setItems(items.map(i => 
        i.productId === product.id 
          ? { ...i, quantity: i.quantity + 1 }
          : i
      ))
    } else {
      setItems([...items, {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: product.costPrice,
      }])
    }
  }

  const updateItem = (index: number, field: string, value: any) => {
    setItems(items.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ))
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const addCustomItem = () => {
    setItems([...items, {
      productId: null,
      productName: "",
      quantity: 1,
      unitPrice: 0,
    }])
  }

  const total = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)

  const handleSubmit = async () => {
    if (items.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please add at least one item",
      })
      return
    }

    if (items.some(i => !i.productName || i.quantity <= 0)) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please fill in all item details",
      })
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch("/api/admin/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: supplier.id,
          items,
          notes,
          expectedDate: expectedDate || null,
          sendEmailToSupplier: sendEmail,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        onSuccess()
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "Failed to create purchase order",
        })
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An error occurred",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>New Purchase Order</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Supplier: {supplier.name}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Product Search */}
          <div className="space-y-2">
            <Label>Add Products</Label>
            <Input
              placeholder="Search products by name or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <div className="border rounded-lg max-h-48 overflow-y-auto">
                {filteredProducts.slice(0, 10).map(product => (
                  <button
                    key={product.id}
                    onClick={() => {
                      addItem(product)
                      setSearchQuery("")
                    }}
                    className="w-full text-left p-3 hover:bg-muted/20 border-b last:border-b-0 flex justify-between items-center"
                  >
                    <div>
                      <div className="font-medium">{product.name}</div>
                      <div className="text-xs text-muted-foreground">{product.sku}</div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatCurrency(product.costPrice)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Custom Item Button */}
          <Button type="button" variant="outline" onClick={addCustomItem} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Custom Item
          </Button>

          {/* Order Items */}
          {items.length > 0 && (
            <div className="space-y-3">
              <Label>Order Items</Label>
              {items.map((item, index) => (
                <div key={index} className="flex gap-2 items-start p-3 border rounded-lg bg-muted/20">
                  <div className="flex-1 space-y-2">
                    <Input
                      placeholder="Product name"
                      value={item.productName}
                      onChange={(e) => updateItem(index, "productName", e.target.value)}
                      disabled={!!item.productId}
                    />
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label className="text-xs">Quantity</Label>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 1)}
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs">Unit Price</Label>
                        <Input
                          type="number"
                          min="0"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(index, "unitPrice", parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs">Total</Label>
                        <div className="h-10 flex items-center font-semibold text-[#22C55E]">
                          {formatCurrency(item.quantity * item.unitPrice)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm"
                    onClick={() => removeItem(index)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              
              <div className="flex justify-end p-3 bg-muted/30 rounded-lg">
                <div className="text-lg font-bold">
                  Total: {formatCurrency(total)}
                </div>
              </div>
            </div>
          )}

          {/* Expected Date */}
          <div className="space-y-2">
            <Label htmlFor="expectedDate">Expected Delivery Date</Label>
            <Input
              id="expectedDate"
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Any special instructions..."
            />
          </div>

          {/* Send Email Checkbox */}
          <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
            <input
              type="checkbox"
              id="sendEmail"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="sendEmail" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Send order email to supplier ({supplier.email})
            </Label>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isLoading || items.length === 0} 
              className="flex-1"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              {sendEmail ? "Create & Send Order" : "Create Order"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
